const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const log = require('./log');

function attachErrorLogging(context) {
  context.on('page', (p) => {
    try {
      p.on('pageerror', (e) => log.warn(`[页面异常] ${e.message}`));
      p.on('console', (msg) => {
        if (msg.type() === 'error') log.warn(`[控制台错误] ${msg.text().slice(0, 200)}`);
      });
    } catch (e) {}
  });
}

async function doLaunch() {
  const context = await chromium.launchPersistentContext(cfg.profileDir, {
    executablePath: cfg.edgePath,
    headless: false,
    viewport: null,
    args: [
      '--start-maximized',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    } catch (e) {}
    window.chrome = window.chrome || { runtime: {} };
  });

  attachErrorLogging(context);
  return context;
}

/**
 * 启动专用 Edge（独立 profile，已登录态持久化）。
 * 若上次异常退出残留锁，清理后重试一次。
 */
async function launch() {
  fs.mkdirSync(cfg.profileDir, { recursive: true });
  try {
    const ctx = await doLaunch();
    log.info(`Edge 已启动（profile: ${cfg.profileDir}）`);
    return ctx;
  } catch (e) {
    log.warn(`Edge 首次启动失败：${e.message.split('\n')[0].slice(0, 80)}，清理锁文件后重试`);
    await new Promise((r) => setTimeout(r, 1500));
    for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
      try { fs.unlinkSync(path.join(cfg.profileDir, f)); } catch (e2) {}
    }
    const ctx = await doLaunch();
    log.info(`Edge 已启动（重试成功，profile: ${cfg.profileDir}）`);
    return ctx;
  }
}

module.exports = { launch };
