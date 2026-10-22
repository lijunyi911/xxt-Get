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

function requestStop() { stopFlag = true; }
function resetStop() { stopFlag = false; }

/** 判断是否已登录 */
async function isLoggedIn(page) {
  try {
    if (page.isClosed && page.isClosed()) return false;
    if (/passport|login|sso|verify/i.test(page.url())) return false;
    const hasUser = await page.locator('text=个人空间').count();
    if (hasUser > 0) return true;
    const hasLogin = await page.locator('text=登录').count();
    return hasLogin === 0;
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
    if (!s.page || (typeof s.page.isClosed === 'function' && s.page.isClosed())) {
      const pages = s.context.pages();
      if (!pages.length) return false;
      s.page = pages[0];
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function ensureSession(push) {
  if (session && isSessionAlive(session)) return session;

  if (session) {
    log.warn('检测到 Edge 会话已关闭，重新启动');
    try { await session.context.close(); } catch (e) {}
    session = null;
  }

  if (push) push({ type: 'stage', text: '正在启动专用 Edge...' });
  const context = await profile.launch();
  const page = context.pages()[0] || (await context.newPage());
  session = { context, page };
  await page.goto(cfg.chaoxingHome, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return session;
}

/** 读取课程列表（必要时先等待登录） */
async function getCourses(push) {
  resetStop(); // 新的一次读取不受上次“停止”影响
  const { page } = await ensureSession(push);
  if (!(await isLoggedIn(page))) {
    const ok = await waitForLogin(page, 10 * 60 * 1000, push);
    if (!ok) throw new Error('登录超时或已停止');
  }
  return courseMod.listCourses(page);
}

/** 进入课程页，抓出所有章节学习链接 */
async function getChapterUrls(page, course) {
  await page.goto(course.href, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const urls = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="studentstudy"]').forEach((a) => {
      const h = a.href;
      const m = h.match(/chapterId=(\d+)/i);
      if (!m) return;
      if (seen.has(m[1])) return;
      seen.add(m[1]);
      out.push(h);
    });
    return out;
  });
  return urls;
}

/** 等视频播放结束（或超时/停止） */
async function waitVideoEnd(page, push) {
  const start = Date.now();
  let lastLog = 0;
  let lastPauseCheck = 0;
  while (Date.now() - start < cfg.videoWaitTimeoutMs) {
    if (stopFlag) return false;

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

    // 模拟真人：每隔约 30 秒有 20% 概率随机暂停一会儿
    if (cfg.antiBan && cfg.antiBan.enabled && Date.now() - lastPauseCheck > 30000) {
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
      if (push) push({ type: 'progress', text: `视频 ${p.cur}/${p.dur}s` });
    }
    await page.waitForTimeout(cfg.pollIntervalMs);
  }
  return false;
}

/** 刷单门课程：逐个章节进入并播放 */
async function processCourse(page, course, speed, push) {
  log.info(`课程：${course.title}`);
  if (push) push({ type: 'stage', text: `课程：${course.title}` });

  const chapters = await getChapterUrls(page, course);
  log.info(`  ${course.title} 共 ${chapters.length} 个章节`);
  if (!chapters.length) {
    log.warn('  未找到章节链接');
    return;
  }

  for (let i = 0; i < chapters.length; i++) {
    if (stopFlag) break;

    // 单日学习时长上限保护
    if (daily.exceeded()) {
      log.warn(`已达到单日学习上限 ${cfg.antiBan.dailyLimitMinutes} 分钟，停止刷课`);
      if (push) push({ type: 'error', text: `已达单日学习上限（${cfg.antiBan.dailyLimitMinutes} 分钟），已停止` });
      break;
    }

    const chUrl = chapters[i];
    const chId = (chUrl.match(/chapterId=(\d+)/i) || [])[1] || String(i);
    const key = `ch_${chId}`;

    if (push) push({ type: 'stage', text: `${course.title} 章节 ${i + 1}/${chapters.length}` });

    // 打开章节前：鼠标抖动 + 随机延迟（降低自动化特征）
    await humanize.jitterMouse(page);
    await humanize.sleep(page);

    // 打开章节 → 读取页面真实完成状态
    await page.goto(chUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await humanize.jitterMouse(page);
    await humanize.sleep(page, 300, 1200);

    const st = await player.checkChapterStatus(page);
    if (st.done) {
      log.info(`  章节 ${chId} 已完成（${st.kind}），跳过`);
      continue; // 已完成：不做任何操作，直接下一个
    }
    // 文档/未知：页面无可靠完成标记，本地记录过即视为已完成，跳过
    if ((st.kind === 'doc' || st.kind === 'unknown') && state.isDone(stateData, key)) {
      log.info(`  章节 ${chId} 已完成（本地记录/${st.kind}），跳过`);
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
        if (ended) {
          completed = true;
          const p = await player.getVideoProgress(page);
          completionInfo = { type: 'video', dur: p && p.dur ? p.dur : 0 };
        }
      }
    } else if (st.kind === 'doc') {
      log.info(`  阅读文档（章节 ${chId}），停留 ${Math.round(cfg.docDwellMs / 1000)}s`);
      if (push) push({ type: 'stage', text: `阅读文档 ${chId} ...` });
      await player.readDocument(page, cfg.docDwellMs);
      daily.add(cfg.docDwellMs / 1000);
      completed = true;
      completionInfo = { type: 'doc', dwell: cfg.docDwellMs };
    } else {
      log.info(`  未知任务点（章节 ${chId}），短暂滚动兜底`);
      await player.readDocument(page, cfg.docFallbackMs);
      daily.add(cfg.docFallbackMs / 1000);
      completed = true;
      completionInfo = { type: 'doc', dwell: cfg.docFallbackMs };
    }

    if (completed && !stopFlag && completionInfo) {
      state.markDone(stateData, key, completionInfo);
      state.save(cfg.stateFile, stateData);
    }

    // 章节间随机间隔，避免连续快速切换（模拟真人节奏）
    await humanize.sleep(page, cfg.antiBan.chapterGapMinMs, cfg.antiBan.chapterGapMaxMs);
  }
}

/** 开始刷课 */
async function runCourses(courses, speed, push) {
  resetStop();
  stateData = state.load(cfg.stateFile);
  const { page } = await ensureSession(push);

  try {
    const all = await getCourses(push);
    const chosen = courses && courses.length
      ? all.filter((c) => courses.includes(c.courseId) || courses.includes(c.title))
      : all;
    if (!chosen.length) {
      if (push) push({ type: 'error', text: '没有选中课程' });
      return;
    }
    log.info(`准备刷 ${chosen.length} 门课程`);
    for (const c of chosen) {
      if (stopFlag) break;
      await processCourse(page, c, speed, push);
    }
    if (push) push({ type: 'stage', text: '全部完成' });
  } catch (e) {
    log.error(`运行异常: ${e.message}`);
    if (push) push({ type: 'error', text: e.message });
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
  getChapterUrls,
  requestStop,
  resetStop,
  isLoggedIn,
  shutdown,
  _forceCloseContextForTest,
};
