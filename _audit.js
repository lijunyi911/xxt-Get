const { chromium } = require('playwright-core');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, colorScheme: 'dark' });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', async (d) => { try { await d.accept(); } catch (e) {} });

  await page.addInitScript(() => {
    window.api = {
      loadCourses: async () => ({ ok: true, courses: [{ courseId: 'c1', title: '线性代数', href: 'u1' }, { courseId: 'c2', title: '金属工艺学', href: 'u2' }] }),
      start: async () => ({ ok: true }), stop: async () => ({ ok: true }),
      setSpeed: async () => ({ ok: true }), setDocDwell: async () => ({ ok: true }),
      setDailyLimit: async () => ({ ok: true }), setMuted: async () => ({ ok: true }),
      setOnTop: async () => ({ ok: true }), setOpacity: async () => ({ ok: true }),
      setPace: async () => ({ ok: true }), clearLogFile: async () => ({ ok: true }),
      getStateInfo: async () => ({ ok: true, count: 5 }), exportState: async () => ({ ok: true, path: 'x' }),
      exportSettings: async () => ({ ok: true, path: 's' }), importSettings: async () => ({ ok: false }),
      getHistory: async () => ({ ok: true, days: [{ date: '2026-11-15', seconds: 3600 }], weekTotal: 3600 }),
      exportHistory: async () => ({ ok: true, path: 'h' }), clearState: async () => ({ ok: true }),
      refreshSession: async () => ({ ok: true }), aiConfig: async () => ({ ok: true }),
      homeworkList: async () => ({ ok: true, works: [] }), homeworkOpen: async () => ({ ok: true, clicked: true }),
      homeworkParse: async () => ({ ok: true, questions: [] }), homeworkAnswer: async () => ({ ok: true, answers: [] }),
      homeworkFill: async () => ({ ok: true, result: { filled: 1, failed: 0 } }), homeworkSubmit: async () => ({ ok: true, clicked: true }),
      minimize: () => {}, close: () => {}, toggleMax: () => {}, notify: async () => ({ ok: true }),
      exportLog: async () => ({ ok: true, path: 'l' }), copyText: async () => ({ ok: true }),
      onEvent: (cb) => { window.__cb = cb; },
    };
  });

  await page.goto(pathToFileURL(path.join(__dirname, 'web', 'index.html')).href);
  await page.waitForTimeout(700);

  const steps = [
    ['读取课程', () => page.click('#btnLoad')],
    ['全选', () => page.click('#btnAll')],
    ['排序', () => page.click('#btnSort')],
    ['搜索', () => page.fill('#courseSearch', '线')],
    ['倍速', () => page.click('.spd[data-speed="1.5"]')],
    ['开始', () => page.click('#btnStart')],
    ['暂停', () => page.click('#btnPause')],
    ['停止', () => page.click('#btnStop')],
    ['设置', () => page.click('#btnSettings')],
    ['文档停留', () => page.fill('#docDwellNum', '12.5')],
    ['每日上限', () => page.selectOption('#optDailyLimit', '180')],
    ['节奏', () => page.click('button[data-pace="fast"]')],
    ['字号', () => page.click('button[data-font="15"]')],
    ['圆角', () => page.click('button[data-radius="14"]')],
    ['主题色', () => page.click('.color-dot[data-accent="blue"]')],
    ['色轮', () => page.click('#colorWheel')],
    ['紧凑', () => page.click('#optCompact')],
    ['静音', () => page.click('#optMuted')],
    ['置顶', () => page.click('#optOnTop')],
    ['透明度', () => page.fill('#optOpacity', '0.8')],
    ['导出设置', () => page.click('#btnExportSettings')],
    ['断点', () => page.click('#btnExportState')],
    ['历史', () => page.click('#btnExportHistory')],
    ['关设置', () => page.click('#btnSettingsClose')],
    ['日志搜索', () => page.fill('#logSearch', '章节')],
    ['日志过滤', () => page.selectOption('#logFilter', 'warn')],
    ['复制日志', () => page.click('#btnCopyLog')],
    ['清空日志', () => page.click('#btnClearLog')],
    ['作业面板', () => page.click('#btnHomework')],
    ['关作业', () => page.click('#hwClose')],
    ['Ctrl+F', () => page.keyboard.press('Control+f')],
  ];

  let fail = 0;
  for (const [name, fn] of steps) {
    const before = errors.length;
    try { await fn(); } catch (e) { errors.push(`STEP ${name}: ${e.message}`); }
    await page.waitForTimeout(120);
    if (errors.length > before) { fail++; console.log(`[FAIL] ${name}: ${errors.slice(before).join(' | ')}`); }
  }

  // 事件回调
  await page.evaluate(() => {
    const cb = window.__cb;
    if (!cb) return;
    cb({ type: 'stage', text: '测试' });
    cb({ type: 'progress', text: '视频', pct: 50 });
    cb({ type: 'stats', done: 1, skipped: 2, quiz: 0, failed: 0, current: 1, total: 3, dailyMinutes: 10, dailyLimit: 0 });
    cb({ type: 'courseDone', title: '测试课程' });
    cb({ type: 'challenge', text: '验证码' });
    cb({ type: 'error', text: '模拟错误' });
    cb({ type: 'summary', done: 2, skipped: 1, quiz: 0, failed: 0, dailyMinutes: 20, finished: true });
  });
  await page.waitForTimeout(600);

  console.log(`\n步骤 ${steps.length}，失败 ${fail}，错误 ${errors.length}`);
  if (errors.length) errors.slice(0, 20).forEach((e) => console.log(e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
