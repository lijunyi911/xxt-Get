const { chromium } = require('playwright-core');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 780 }, colorScheme: 'dark' });
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', async (d) => { try { await d.accept(); } catch (e) {} });

  await page.addInitScript(() => {
    window.api = {
      loadCourses: async () => ({ ok: true, courses: [
        { courseId: 'c1', title: '线性代数', href: 'u1' },
        { courseId: 'c2', title: '金属工艺学', href: 'u2' },
      ] }),
      start: async () => ({ ok: true }), stop: async () => ({ ok: true }),
      setSpeed: async () => ({ ok: true }), setDocDwell: async () => ({ ok: true }),
      setDailyLimit: async () => ({ ok: true }), setMuted: async () => ({ ok: true }),
      setOnTop: async () => ({ ok: true }), setOpacity: async () => ({ ok: true }),
      setPace: async () => ({ ok: true }), clearLogFile: async () => ({ ok: true }),
      getStateInfo: async () => ({ ok: true, count: 5 }), exportState: async () => ({ ok: true }),
      exportSettings: async () => ({ ok: true }), importSettings: async () => ({ ok: false }),
      getHistory: async () => ({ ok: true, days: [], weekTotal: 0 }), exportHistory: async () => ({ ok: true }),
      clearState: async () => ({ ok: true }), refreshSession: async () => ({ ok: true }),
      checkSession: async () => ({ ok: true, alive: true, pages: 1 }),
      aiConfig: async () => ({ ok: true }), openDataDir: async () => ({ ok: true }),
      clearHistory: async () => ({ ok: true }),
      homeworkList: async () => ({ ok: true, works: [{ title: '26问答专项', url: '', done: false, action: '做作业', idx: 0 }] }),
      homeworkOpen: async () => ({ ok: true, clicked: true }),
      homeworkParse: async () => ({ ok: true, questions: [
        { index: 1, stem: '下列哪个是矩阵的秩？', type: 'single', options: [{ value: 'A', text: 'A. 行数' }, { value: 'B', text: 'B. 非零子式最高阶数' }] },
        { index: 2, stem: '简述可逆条件', type: 'essay', hasTextarea: true, options: [] },
      ] }),
      homeworkAnswer: async () => ({ ok: true, answers: [{ index: 1, answer: 'B' }, { index: 2, answer: '行列式不为零' }] }),
      homeworkFill: async () => ({ ok: true, result: { filled: 2, failed: 0 } }),
      homeworkSubmit: async () => ({ ok: true, clicked: true }),
      minimize: () => {}, close: () => {}, toggleMax: () => {}, notify: async () => ({ ok: true }),
      exportLog: async () => ({ ok: true }), copyText: async () => ({ ok: true }),
      onEvent: (cb) => { window.__cb = cb; },
    };
  });

  await page.goto(pathToFileURL(path.join(__dirname, 'web', 'index.html')).href);
  await page.waitForTimeout(700);

  const steps = [
    ['读取课程', () => page.click('#btnLoad')],
    ['收藏', () => page.click('.fav-btn')],
    ['备注', async () => { await page.click('.note-btn'); await page.waitForTimeout(200); await page.fill('#promptInput', '测试备注'); await page.click('#promptOk'); }],
    ['全选', () => page.click('#btnAll')],
    ['反选', () => page.click('#btnInvert')],
    ['排序', () => page.click('#btnSort')],
    ['命令面板', () => page.keyboard.press('Control+p')],
    ['命令搜索', () => page.fill('#cmdInput', '设置')],
    ['命令执行', async () => { await page.keyboard.press('Enter'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); }],
    ['通知', () => page.click('#btnNotify')],
    ['通知清空', () => page.click('#btnNotifyClear')],
    ['设置', () => page.click('#btnSettings')],
    ['检查会话', () => page.click('#btnCheckSession')],
    ['设置搜索', () => page.fill('#setSearch', '主题')],
    ['关设置', () => page.click('#btnSettingsClose')],
    ['作业面板', () => page.click('#btnHomework')],
    ['读取作业', () => page.click('#hwListBtn')],
    ['打开作业', () => page.click('#hwList .hw-item')],
    ['设置Key', () => page.evaluate(() => localStorage.setItem('xxt-ai-key', 'sk-test-key'))],
    ['AI答题', () => page.click('#hwAnswerBtn')],
    ['填写', () => page.click('#hwFillBtn')],
    ['提交', async () => { await page.click('#hwSubmitBtn'); await page.waitForTimeout(300); if (await page.$('#confirmOk')) await page.click('#confirmOk'); }],
    ['关作业', () => page.click('#hwClose')],
  ];

  let fail = 0;
  for (const [name, fn] of steps) {
    const before = errors.length;
    try { await fn(); } catch (e) { errors.push(`STEP ${name}: ${e.message.split('\n')[0]}`); }
    await page.waitForTimeout(200);
    if (errors.length > before) { fail++; console.log(`[FAIL] ${name}`); }
    else console.log(`[OK] ${name}`);
  }

  const state = await page.evaluate(() => ({
    favs: localStorage.getItem('xxt-fav'),
    notes: localStorage.getItem('xxt-notes'),
    history: localStorage.getItem('xxt-run-history'),
    questions: document.querySelectorAll('#hwQuestions .hw-q').length,
  }));
  console.log('state:', JSON.stringify(state));

  // 事件
  await page.evaluate(() => {
    const cb = window.__cb;
    if (!cb) return;
    cb({ type: 'summary', done: 2, skipped: 1, quiz: 0, failed: 0, dailyMinutes: 20, finished: true });
    cb({ type: 'challenge', text: '验证码' });
    cb({ type: 'error', text: '模拟错误' });
  });
  await page.waitForTimeout(500);
  const notifyCount = await page.evaluate(() => document.querySelectorAll('#notifyList .notify-item').length);
  console.log('notifications:', notifyCount);

  console.log(`\n${steps.length} 步，失败 ${fail}，错误 ${errors.length}`);
  if (errors.length) errors.slice(0, 15).forEach((e) => console.log(e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
