const { chromium } = require('playwright-core');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, colorScheme: 'dark' });
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.addInitScript(() => {
    window.api = {
      loadCourses: async () => ({ ok: true, courses: [{ courseId: 'c1', title: '线性代数', href: 'u1' }] }),
      start: async () => ({ ok: true }), stop: async () => ({ ok: true }),
      setSpeed: async () => ({ ok: true }), setDocDwell: async () => ({ ok: true }),
      setDailyLimit: async () => ({ ok: true }), setMuted: async () => ({ ok: true }),
      setOnTop: async () => ({ ok: true }), setOpacity: async () => ({ ok: true }),
      setPace: async () => ({ ok: true }), clearLogFile: async () => ({ ok: true }),
      getStateInfo: async () => ({ ok: true, count: 5 }), exportState: async () => ({ ok: true }),
      exportSettings: async () => ({ ok: true }), importSettings: async () => ({ ok: false }),
      getHistory: async () => ({ ok: true, days: [], weekTotal: 0 }), exportHistory: async () => ({ ok: true }),
      clearState: async () => ({ ok: true }), refreshSession: async () => ({ ok: true }),
      aiConfig: async () => ({ ok: true }), homeworkList: async () => ({ ok: true, works: [] }),
      homeworkOpen: async () => ({ ok: true, clicked: true }), homeworkParse: async () => ({ ok: true, questions: [] }),
      homeworkAnswer: async () => ({ ok: true, answers: [] }), homeworkFill: async () => ({ ok: true, result: {} }),
      homeworkSubmit: async () => ({ ok: true, clicked: true }), openDataDir: async () => ({ ok: true }),
      clearHistory: async () => ({ ok: true }),
      minimize: () => {}, close: () => {}, toggleMax: () => {}, notify: async () => ({ ok: true }),
      exportLog: async () => ({ ok: true }), copyText: async () => ({ ok: true }),
      onEvent: (cb) => { window.__cb = cb; },
    };
  });

  await page.goto(pathToFileURL(path.join(__dirname, 'web', 'index.html')).href);
  await page.waitForTimeout(600);

  const checks = await page.evaluate(() => {
    const ids = ['btnLoad','btnAll','btnSort','courseSearch','btnStart','btnPause','btnStop','btnHomework','btnClear','btnRefresh','btnSettings','btnHomework'];
    const missing = ids.filter((id) => !document.getElementById(id));
    return { missing, hasErrBadge: !!document.getElementById('logStats'), hasSearch: !!document.getElementById('setSearch') };
  });
  console.log('DOM checks:', JSON.stringify(checks));

  // 触发事件回调
  await page.evaluate(() => {
    const cb = window.__cb;
    if (!cb) return;
    cb({ type: 'stats', done: 1, skipped: 2, quiz: 0, failed: 1, current: 2, total: 5, dailyMinutes: 10, dailyLimit: 0 });
    cb({ type: 'log', text: '[ERROR] 测试错误' });
    cb({ type: 'stage', text: '测试章节' });
  });
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => ({
    stats: document.getElementById('logStats') ? document.getElementById('logStats').textContent : '',
    remain: document.getElementById('stRemainCount') ? document.getElementById('stRemainCount').textContent : '',
    eta: document.getElementById('stEta') ? document.getElementById('stEta').textContent : '',
    failErr: document.getElementById('stFail') ? document.getElementById('stFail').className : '',
  }));
  console.log('after events:', JSON.stringify(after));

  // 打开设置
  await page.click('#btnSettings');
  await page.waitForTimeout(300);
  const settingsOpen = await page.evaluate(() => document.getElementById('settingsMask').classList.contains('show'));
  console.log('settings open:', settingsOpen);

  // 搜索设置
  await page.fill('#setSearch', '主题');
  await page.waitForTimeout(200);
  const visibleItems = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.settings-body .set-item')];
    return { total: items.length, visible: items.filter((i) => i.style.display !== 'none').length };
  });
  console.log('search filter:', JSON.stringify(visibleItems));

  await page.screenshot({ path: 'opt10-check.png' });
  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
