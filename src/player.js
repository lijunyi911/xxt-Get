const cfg = require('../config');
const log = require('./log');

const CONTINUE_TEXTS = ['继续学习', '继续观看', '继续播放', '确定', '我知道了', '知道了'];

/** 找视频并强制播放 */
async function ensureVideoPlaying(page, speed) {
  let found = false;
  for (const frame of page.frames()) {
    try {
      const has = await frame.evaluate(() => !!document.querySelector('video'));
      if (!has) continue;
      found = true;
      await frame.evaluate((sp) => {
        const v = document.querySelector('video');
        if (!v) return;
        v.muted = true;
        v.playbackRate = sp;
        v.play().catch(() => {});
        if (!window.__xxtSpeedLoop) {
          window.__xxtSpeedLoop = setInterval(() => {
            const vv = document.querySelector('video');
            if (vv && !vv.paused && Math.abs(vv.playbackRate - sp) > 0.01) {
              try { vv.playbackRate = sp; } catch (e) {}
            }
          }, 800);
        }
      }, speed);
    } catch (e) {}
  }
  return found;
}

/** 处理确认弹窗 */
async function handleDialogs(page) {
  for (const frame of page.frames()) {
    try {
      const clicked = await frame.evaluate((texts) => {
        const els = document.querySelectorAll('button, a, div, span');
        for (const el of els) {
          const t = (el.innerText || '').trim();
          if (!t) continue;
          if (!texts.some((x) => t === x || t.includes(x))) continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.width < 320 && r.height > 0 && r.height < 80) {
            el.click();
            return true;
          }
        }
        return false;
      }, CONTINUE_TEXTS);
      if (clicked) {
        log.info('已处理确认弹窗');
        return true;
      }
    } catch (e) {}
  }
  return false;
}

/** 视频是否结束 */
async function isVideoEnded(page) {
  for (const frame of page.frames()) {
    try {
      const ended = await frame.evaluate(() => {
        const v = document.querySelector('video');
        if (!v) return null;
        if (!v.duration || isNaN(v.duration)) return v.ended ? true : null;
        return v.ended || v.currentTime >= v.duration - 1.5;
      });
      if (ended === true) return true;
    } catch (e) {}
  }
  return false;
}

/** 视频进度 */
async function getVideoProgress(page) {
  for (const frame of page.frames()) {
    try {
      const p = await frame.evaluate(() => {
        const v = document.querySelector('video');
        if (!v || !v.duration) return null;
        return { cur: Math.round(v.currentTime), dur: Math.round(v.duration) };
      });
      if (p) return p;
    } catch (e) {}
  }
  return null;
}

/** 轮询等待视频元素出现 */
async function waitForVideo(page, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const f of page.frames()) {
      try {
        if (await f.evaluate(() => !!document.querySelector('video'))) return true;
      } catch (e) {}
    }
    await page.waitForTimeout(800);
  }
  return false;
}

/** 判断当前章节任务类型：video / doc / quiz / unknown（先等视频，避免误判） */
async function detectTaskType(page) {
  // 1. 先等视频（视频可能异步加载）
  if (await waitForVideo(page, 10000)) return 'video';

  // 2. 明确的文档查看器
  for (const f of page.frames()) {
    try {
      const isDoc = await f.evaluate(() => {
        const u = location.href;
        if (/modules\/(document|pdf|ppt|office)|\/pdf\/|officeonline|viewer\.html/i.test(u)) return true;
        if (document.querySelector('iframe[src*="/document"], iframe[src*="pdf"], embed[type="application/pdf"]')) return true;
        return false;
      });
      if (isDoc) return 'doc';
    } catch (e) {}
  }

  // 3. 任务点标签文本
  try {
    const text = await page.evaluate(() => document.body.innerText || '');
    if (/(^|\s)文档(\s|$)|阅读/.test(text)) return 'doc';
    if (/章节测验/.test(text)) return 'quiz';
  } catch (e) {}
  return 'unknown';
}

/** 点击“文档”任务点标签（如果存在） */
async function openDocumentTask(page) {
  try {
    const badge = page.getByText('文档', { exact: true }).first();
    if (await badge.count()) {
      await badge.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(3500);
      log.info('已点击「文档」任务点');
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * 阅读文档：渐进式滚动模拟阅读，持续 totalMs。
 * 覆盖：页面级滚动 + 内部可滚动容器 + PDF.js/文档查看器容器。
 */
async function readDocument(page, totalMs) {
  const steps = 14;
  const per = Math.max(2500, Math.floor(totalMs / steps));
  for (let s = 0; s < steps; s++) {
    if (page.isClosed && page.isClosed()) break;
    for (const f of page.frames()) {
      try {
        await f.evaluate(() => {
          const step = Math.max(300, Math.floor(window.innerHeight * 0.85));
          window.scrollBy(0, step);
          document.querySelectorAll('div, section, article, [class*="scroll"], [class*="viewer"], [class*="pdf"]').forEach((d) => {
            try {
              if (d.scrollHeight > d.clientHeight + 100) {
                d.scrollTop += Math.floor(d.clientHeight * 0.85);
              }
            } catch (e) {}
          });
        });
      } catch (e) {}
    }
    await page.waitForTimeout(per);
  }
  log.info(`文档阅读完成（约 ${Math.round(totalMs / 1000)}s 渐进滚动）`);
}

/** 读取当前章节顶部的任务点标签（视频/文档/阅读/章节测验） */
async function getTaskBadges(page) {
  try {
    return await page.evaluate(() => {
      const names = ['视频', '文档', '阅读', '章节测验'];
      const out = [];
      const seen = new Set();
      document.querySelectorAll('a, span, div, li, p, em').forEach((el) => {
        const t = (el.textContent || '').trim();
        if (!names.includes(t)) return;
        if (el.children.length > 0) return;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.width > 240 || r.height <= 0 || r.height > 60) return;
        if (seen.has(t)) return;
        seen.add(t);
        out.push(t);
      });
      return out;
    });
  } catch (e) {
    return [];
  }
}

/** 点击指定任务点标签 */
async function clickBadge(page, name) {
  try {
    const el = page.getByText(name, { exact: true }).first();
    if (await el.count()) {
      await el.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(3000);
      return true;
    }
  } catch (e) {}
  return false;
}

/** 是否有文档查看器 */
async function hasDocumentFrame(page) {
  for (const f of page.frames()) {
    try {
      const ok = await f.evaluate(() => {
        const u = location.href;
        if (/modules\/(document|pdf|ppt|office)|\/pdf\/|officeonline|viewer\.html/i.test(u)) return true;
        if (document.querySelector('iframe[src*="/document"], iframe[src*="pdf"], embed[type="application/pdf"]')) return true;
        return false;
      });
      if (ok) return true;
    } catch (e) {}
  }
  return false;
}

/**
 * 读取章节真实完成状态（页面为准，不依赖本地断点）
 * @returns { done: boolean, kind: 'video'|'doc'|'unknown', progress? }
 */
async function checkChapterStatus(page) {
  // 1. 视频：等待加载（最多 5s），以播放进度判断是否已看完
  const hasVideo = await waitForVideo(page, 5000);
  if (hasVideo) {
    const p = await getVideoProgress(page);
    const done = !!(p && p.dur > 0 && p.cur >= p.dur - 2);
    return { done, kind: 'video', progress: p };
  }

  // 2. 文档
  if (await hasDocumentFrame(page)) return { done: false, kind: 'doc' };

  // 3. 无法判定：交给上层按本地记录/兜底处理
  return { done: false, kind: 'unknown' };
}

/** 暂停视频 */
async function pauseVideo(page) {
  for (const f of page.frames()) {
    try {
      await f.evaluate(() => {
        const v = document.querySelector('video');
        if (v && !v.paused) v.pause();
      });
    } catch (e) {}
  }
}

/** 继续播放视频 */
async function resumeVideo(page) {
  for (const f of page.frames()) {
    try {
      await f.evaluate(() => {
        const v = document.querySelector('video');
        if (v && v.paused) v.play().catch(() => {});
      });
    } catch (e) {}
  }
}

/** 检测验证码/人脸识别等人工验证弹窗 */
async function detectChallenge(page) {
  const texts = ['人脸识别', '请完成验证', '拍照', '滑块验证', '拖动滑块', '验证码', '实名认证', '人像采集', '请验证'];
  for (const f of page.frames()) {
    try {
      const hit = await f.evaluate((ts) => {
        const body = document.body ? (document.body.innerText || '') : '';
        return ts.find((x) => body.includes(x)) || null;
      }, texts);
      if (hit) return hit;
    } catch (e) {}
  }
  return null;
}

module.exports = {
  ensureVideoPlaying,
  waitForVideo,
  handleDialogs,
  isVideoEnded,
  getVideoProgress,
  detectTaskType,
  openDocumentTask,
  readDocument,
  getTaskBadges,
  clickBadge,
  hasDocumentFrame,
  checkChapterStatus,
  pauseVideo,
  resumeVideo,
  detectChallenge,
};
