const cfg = require('../config');
const log = require('./log');
const state = require('./state');
const profile = require('./profile');
const courseMod = require('./course');
const player = require('./player');
const humanize = require('./humanize');
const daily = require('./daily');

let session = null;      // { context, page }
let stopFlag = false;
let stateData = {};

// 本次运行统计
const stats = {
  done: 0,      // 本次完成
  skipped: 0,   // 已完成跳过
  quiz: 0,      // 章节测验（需手动）
  failed: 0,    // 无法识别/失败
  total: 0,     // 总章节数
  current: 0,   // 当前进度序号
};

function requestStop() { stopFlag = true; }
function resetStop() { stopFlag = false; }

// ===== 操作串行队列：同一时间只跑一个浏览器操作，新请求自动取代旧请求 =====
let opChain = Promise.resolve();
let opSeq = 0;

function serialize(fn) {
  const mySeq = ++opSeq;
  const p = opChain.then(
    () => {
      if (mySeq !== opSeq) return null; // 已被更新的请求取代
      return fn();
    },
    () => {
      if (mySeq !== opSeq) return null;
      return fn();
    }
  );
  opChain = p.catch(() => {});
  return p;
}

function pushStats(push) {
  if (!push) return;
  push({
    type: 'stats',
    ...stats,
    dailyMinutes: daily.minutes(),
    dailyLimit: (cfg.antiBan && cfg.antiBan.dailyLimitMinutes) || 0,
  });
}

/** 判断是否已登录 */
async function isLoggedIn(page) {
  try {
    if (page.isClosed && page.isClosed()) return false;
    const url = page.url();
    if (/passport|login|sso|verify/i.test(url)) return false;

    const text = await page.evaluate(() => (document.body ? document.body.innerText : '') || '');
    // 明确的未登录特征
    if (/扫码登录|账号登录|登录学习通|请输入手机号|请输入密码|请登录后/.test(text)) return false;
    // 明确的已登录特征
    if (/个人空间|我的课程|退出登录|个人中心|我的资料|我的收藏/.test(text)) return true;
    // 兜底：页面在 chaoxing 且有内容，视为已登录
    return true;
  } catch {
    return false;
  }
}

async function waitForLogin(page, timeoutMs, push) {
  const start = Date.now();
  if (push) push({ type: 'stage', text: '等待登录：请在 Edge 窗口里登录学习通' });
  while (Date.now() - start < timeoutMs) {
    if (stopFlag) return false;
    if (page.isClosed && page.isClosed()) return false;
    if (await isLoggedIn(page)) {
      log.info('检测到已登录');
      if (push) push({ type: 'stage', text: '已登录' });
      return true;
    }
    if (push) push({ type: 'stage', text: '尚未登录，请登录后脚本自动继续...' });
    try {
      await page.waitForTimeout(3000);
    } catch (e) {
      return false;
    }
  }
  return false;
}

/** 会话是否仍然可用（浏览器没被关掉） */
function isSessionAlive(s) {
  try {
    if (!s || !s.context) return false;
    if (typeof s.context.isConnected === 'function' && !s.context.isConnected()) return false;
    return true;
  } catch (e) {
    return false;
  }
}

async function ensureSession(push) {
  if (session && isSessionAlive(session)) {
    // 工作页被用户关掉了就新开一个，绝不复用用户自己的标签页
    if (session.workPage && !session.workPage.isClosed()) {
      session.page = session.workPage;
      return session;
    }
    session.workPage = await session.context.newPage();
    session.page = session.workPage;
    return session;
  }

  if (session) {
    log.warn('检测到 Edge 会话已关闭，重新启动');
    try { await session.context.close(); } catch (e) {}
    session = null;
  }

  if (push) push({ type: 'stage', text: '正在启动专用 Edge...' });
  const context = await profile.launch();
  const pages = context.pages();

  // 优先用空白页当工作页，避免占用用户已经打开的标签页
  let workPage = pages.find((p) => /^about:blank$|^$/.test(p.url()));
  if (!workPage) workPage = await context.newPage();

  session = { context, page: workPage, workPage };
  await workPage.goto(cfg.chaoxingHome, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await workPage.waitForTimeout(1200);
  return session;
}

/** 读取课程列表（对外：串行队列） */
async function getCourses(push) {
  return serialize(() => getCoursesInner(push));
}

/** 读取课程列表（内部：不加锁） */
async function getCoursesInner(push) {
  resetStop(); // 新的一次读取不受上次“停止”影响
  const { page } = await ensureSession(push);

  // 先强制回到个人空间首页，避免页面停在活动页/课程页导致登录判断失败
  await page.goto(cfg.chaoxingHome, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  // 把工作页切到前台，让用户看到首页（用户自己的标签页保留不动）
  try { await page.bringToFront(); } catch (e) {}

  if (!(await isLoggedIn(page))) {
    const ok = await waitForLogin(page, 10 * 60 * 1000, push);
    if (!ok) throw new Error('登录超时或已停止');
  }
  return courseMod.listCourses(page);
}

/**
 * 进入课程页，读取目录里每个小节的完成状态。
 * 学习通目录圆点：绿色 em.openlock = 已完成；橙色 em.orange = 未完成。
 * @returns [{ url, chId, title, done }]
 */
async function getChapterList(page, course) {
  await page.goto(course.href, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);

  return page.evaluate(() => {
    const out = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="studentstudy"]').forEach((a) => {
      const h = a.href;
      const m = h.match(/chapterId=(\d+)/i);
      if (!m) return;
      if (seen.has(m[1])) return;
      seen.add(m[1]);

      const em = a.querySelector('.icon em');
      const cls = em ? String(em.className || '') : '';
      const isOrange = /\borange\b/i.test(cls);
      const hasJobCount = !!a.querySelector('.icon .knowledgeJobCount');
      // 有图标时：橙色/有未完成任务点 = 未完成；否则已完成
      // 没有图标：状态未知，按未完成处理，进页面再判断
      const done = em ? !(isOrange || hasJobCount) : false;

      const title = (
        a.getAttribute('aria-label') ||
        (a.querySelector('.articlename') || {}).textContent ||
        ''
      ).trim().replace(/\s+/g, ' ');

      out.push({ url: h, chId: m[1], title, done });
    });
    return out;
  });
}

/** 等视频播放结束（或超时/停止） */
async function waitVideoEnd(page, push) {
  const start = Date.now();
  let lastLog = 0;
  let lastPauseCheck = 0;
  while (Date.now() - start < cfg.videoWaitTimeoutMs) {
    if (stopFlag) return false;

    // 平台每日上限提示 → 立即停止
    const limitHit = await player.detectLimitHint(page);
    if (limitHit) {
      log.warn(`检测到平台上限提示：${limitHit}`);
      if (push) push({ type: 'limit', text: limitHit });
      requestStop();
      return false;
    }

    // 人工验证检测（人脸/验证码/滑块）→ 停止，避免硬刷触发封禁
    const challenge = await player.detectChallenge(page);
    if (challenge) {
      log.warn(`检测到人工验证「${challenge}」，已停止刷课，请手动完成`);
      if (push) push({ type: 'challenge', text: challenge });
      requestStop();
      return false;
    }

    await player.handleDialogs(page);
    if (await player.isVideoEnded(page)) return true;

    // 模拟真人：每隔约 2 秒判定一次，有概率随机暂停一会儿
    if (cfg.antiBan && cfg.antiBan.enabled && Date.now() - lastPauseCheck > 2000) {
      lastPauseCheck = Date.now();
      if (Math.random() < cfg.antiBan.randomPauseChance) {
        log.info('模拟真人：随机暂停一会儿');
        await player.pauseVideo(page);
        await humanize.sleep(page, 3000, 9000);
        await player.resumeVideo(page);
        await humanize.jitterMouse(page);
      }
    }

    const p = await player.getVideoProgress(page);
    if (p && Date.now() - lastLog > 5000) {
      lastLog = Date.now();
      const pct = p.dur > 0 ? Math.round((p.cur / p.dur) * 100) : 0;
      if (push) push({ type: 'progress', text: `视频 ${p.cur}/${p.dur}s`, pct });
    }
    await page.waitForTimeout(cfg.pollIntervalMs);
  }
  return false;
}

/** 打开章节并读取状态（带一次重试） */
async function openChapterWithStatus(page, chUrl, chId) {
  let st = { done: false, kind: 'unknown' };
  for (let attempt = 0; attempt < 2; attempt++) {
    await humanize.jitterMouse(page);
    await humanize.sleep(page);
    await page.goto(chUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await humanize.jitterMouse(page);
    await humanize.sleep(page, 300, 1200);

    st = await player.checkChapterStatus(page);
    if (st.kind !== 'unknown') return st;

    if (attempt === 0) log.warn(`  章节 ${chId} 状态未识别，重试一次`);
  }
  return st;
}

/** 刷单门课程：逐个章节进入并播放 */
async function processCourse(page, course, speed, push) {
  log.info(`课程：${course.title}`);
  if (push) push({ type: 'stage', text: `课程：${course.title}` });
  // 刷课时把工作页切到前台，用户自己的标签页不动
  try { await page.bringToFront(); } catch (e) {}

  const list = await getChapterList(page, course);
  if (!list.length) {
    log.warn('  未找到章节链接');
    return;
  }

  const todo = list.filter((x) => !x.done);
  const already = list.length - todo.length;

  log.info(`  ${course.title}：共 ${list.length} 节，已完成 ${already} 节，待刷 ${todo.length} 节`);
  stats.skipped += already;
  stats.total += todo.length;
  pushStats(push);

  if (!todo.length) {
    log.info(`  ${course.title} 全部已完成，整门课跳过`);
    if (push) push({ type: 'courseDone', title: course.title });
    return;
  }

  for (let i = 0; i < todo.length; i++) {
    if (stopFlag) break;

    // 单日学习时长上限保护
    if (daily.exceeded()) {
      log.warn(`已达到单日学习上限 ${cfg.antiBan.dailyLimitMinutes} 分钟，停止刷课`);
      if (push) push({ type: 'error', text: `已达单日学习上限（${cfg.antiBan.dailyLimitMinutes} 分钟），已停止` });
      break;
    }

    const ch = todo[i];
    const chUrl = ch.url;
    const chId = ch.chId;
    const key = `ch_${chId}`;

    stats.current = i + 1;
    pushStats(push);
    if (push) push({ type: 'stage', text: `${course.title} 章节 ${i + 1}/${todo.length}（${ch.title || chId}）` });

    const st = await openChapterWithStatus(page, chUrl, chId);

    if (st.done) {
      log.info(`  章节 ${chId} 已完成（${st.kind}），跳过`);
      stats.skipped++;
      pushStats(push);
      continue;
    }

    // 文档/未知：页面无可靠完成标记，本地记录过即视为已完成，跳过
    if ((st.kind === 'doc' || st.kind === 'unknown') && state.isDone(stateData, key)) {
      log.info(`  章节 ${chId} 已完成（本地记录/${st.kind}），跳过`);
      stats.skipped++;
      pushStats(push);
      continue;
    }

    if (st.kind === 'quiz') {
      const file = await player.captureQuiz(page, chId);
      log.info(`  章节测验（章节 ${chId}），已截图存档${file ? '：' + file : ''}，请手动完成`);
      if (push) push({ type: 'quiz', text: `章节 ${chId} 有章节测验，需手动完成`, file: file || null });
      stats.quiz++;
      pushStats(push);
      continue; // 不硬刷，继续下一个章节
    }

    if (st.kind === 'unknown') {
      log.warn(`  章节 ${chId} 状态无法识别，跳过（计入失败）`);
      stats.failed++;
      pushStats(push);
      continue;
    }

    log.info(`  章节 ${chId} 未完成（${st.kind}），开始刷`);

    let completed = false;
    let completionInfo = null;

    if (st.kind === 'video') {
      const found = await player.ensureVideoPlaying(page, speed);
      if (found) {
        log.info(`  播放视频（章节 ${chId}）`);
        const t0 = Date.now();
        const ended = await waitVideoEnd(page, push);
        daily.add((Date.now() - t0) / 1000);
        pushStats(push);
        if (ended) {
          completed = true;
          const p = await player.getVideoProgress(page);
          completionInfo = { type: 'video', dur: p && p.dur ? p.dur : 0 };
        }
      }
    } else if (st.kind === 'doc') {
      log.info(`  文档/PPT（章节 ${chId}），直接跳到最后一页`);
      if (push) push({ type: 'stage', text: `文档 ${chId}：跳到最后一页` });
      await player.jumpDocumentToEnd(page, cfg.docJumpDwellMs);
      daily.add(cfg.docJumpDwellMs / 1000);
      pushStats(push);
      completed = true;
      completionInfo = { type: 'doc', dwell: cfg.docJumpDwellMs };
    }

    if (completed && !stopFlag && completionInfo) {
      stats.done++;
      state.markDone(stateData, key, completionInfo);
      state.save(cfg.stateFile, stateData);
    } else if (!completed && !stopFlag) {
      stats.failed++;
    }
    pushStats(push);

    // 章节间随机间隔，避免连续快速切换（模拟真人节奏）
    await humanize.sleep(page, cfg.antiBan.chapterGapMinMs, cfg.antiBan.chapterGapMaxMs);
  }
}

/** 开始刷课（对外：串行队列） */
async function runCourses(courses, speed, push) {
  return serialize(() => runCoursesInner(courses, speed, push));
}

/** 开始刷课（内部：不加锁） */
async function runCoursesInner(courses, speed, push) {
  resetStop();
  stateData = state.load(cfg.stateFile);

  stats.done = 0; stats.skipped = 0; stats.quiz = 0; stats.failed = 0; stats.total = 0; stats.current = 0;
  pushStats(push);

  const { page } = await ensureSession(push);

  try {
    const all = await getCoursesInner(push);
    const chosen = courses && courses.length
      ? all.filter((c) => courses.includes(c.courseId) || courses.includes(c.title))
      : all;
    if (!chosen.length) {
      if (push) push({ type: 'error', text: '没有可刷的课程' });
      return;
    }
    log.info(`准备刷 ${chosen.length} 门课程`);
    for (const c of chosen) {
      if (stopFlag) break;
      await processCourse(page, c, speed, push);
    }
    if (push) push({ type: 'stage', text: stopFlag ? '已停止' : '全部完成' });
  } catch (e) {
    log.error(`运行异常: ${e.message}`);
    if (push) push({ type: 'error', text: e.message });
  } finally {
    if (push) {
      push({
        type: 'summary',
        ...stats,
        finished: !stopFlag,
        dailyMinutes: daily.minutes(),
        dailyLimit: (cfg.antiBan && cfg.antiBan.dailyLimitMinutes) || 0,
      });
    }
  }
}

async function shutdown() {
  try { if (session) await session.context.close(); } catch (e) {}
  session = null;
}

/** 仅供自检：强制关闭底层浏览器但保留 session，模拟“Edge 被关掉”的故障场景 */
async function _forceCloseContextForTest() {
  try { if (session && session.context) await session.context.close(); } catch (e) {}
}

module.exports = {
  getCourses,
  runCourses,
  getChapterList,
  requestStop,
  resetStop,
  isLoggedIn,
  shutdown,
  _forceCloseContextForTest,
};
