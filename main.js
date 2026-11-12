const { app, BrowserWindow, ipcMain, Notification, dialog, clipboard, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const engine = require('./src/engine');
const state = require('./src/state');
const daily = require('./src/daily');
const log = require('./src/log');
const cfg = require('./config');

let win = null;
let tray = null;
let isQuitting = false;

// 系统托盘
function createTray() {
  try {
    const iconPath = path.join(__dirname, 'build', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('学习通刷课助手');
    const menu = Menu.buildFromTemplate([
      { label: '显示主窗口', click: () => showMainWindow() },
      { label: '隐藏窗口', click: () => { if (win) win.hide(); } },
      { type: 'separator' },
      { label: '退出', click: () => { isQuitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
    tray.on('double-click', () => showMainWindow());
  } catch (e) {
    log.warn(`托盘创建失败: ${e.message}`);
  }
}

function showMainWindow() {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
  } else {
    createWindow();
  }
}

// 窗口位置/大小记忆
const winStateFile = path.join(cfg.dataDir, 'window.json');

function loadWinState() {
  try { return JSON.parse(fs.readFileSync(winStateFile, 'utf8')); } catch (e) { return {}; }
}

function saveWinState() {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getBounds();
    fs.mkdirSync(cfg.dataDir, { recursive: true });
    fs.writeFileSync(winStateFile, JSON.stringify({ ...b, maximized: win.isMaximized() }), 'utf8');
  } catch (e) {}
}

function send(data) {
  if (win && !win.isDestroyed()) win.webContents.send('event', data);
  if (tray && data) {
    try {
      if (data.type === 'stage') tray.setToolTip(`学习通刷课 - ${(data.text || '').slice(0, 40)}`);
      else if (data.type === 'challenge') tray.setToolTip('学习通刷课 - 需要人工验证');
      else if (data.type === 'summary') tray.setToolTip('学习通刷课 - 已完成');
    } catch (e) {}
  }
  if (win && data && data.type === 'challenge') {
    try { win.flashFrame(true); } catch (e) {}
  }
}

function createWindow() {
  const st = loadWinState();
  win = new BrowserWindow({
    width: st.width || 370,
    height: st.height || 620,
    x: typeof st.x === 'number' ? st.x : 24,
    y: typeof st.y === 'number' ? st.y : 90,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: '学习通刷课助手',
    backgroundColor: '#12161c',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (st.maximized) win.maximize();

  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'web', 'index.html'));

  win.on('close', (e) => {
    saveWinState();
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('focus', () => { try { win.flashFrame(false); } catch (e) {} });
  win.on('closed', () => { win = null; });
}

ipcMain.handle('load-courses', async () => {
  engine.requestStop(); // 若正在刷课/读取，先中止旧操作
  try {
    const courses = await engine.getCourses(send);
    if (!courses) return { ok: false, error: '已被新的操作取代' };
    return { ok: true, courses };
  } catch (e) {
    log.error(`加载课程失败: ${e.message}`);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('start', async (_e, payload) => {
  const { courses, speed } = payload || {};
  engine.requestStop(); // 若正在读取/刷课，先中止旧操作
  // 不 await，立即返回，进度通过事件推送
  engine.runCourses(courses || [], speed || cfg.defaultSpeed, send)
    .catch((e) => send({ type: 'error', text: e.message }));
  return { ok: true };
});

ipcMain.handle('stop', () => {
  engine.requestStop();
  log.info('已请求停止');
  return { ok: true };
});

ipcMain.handle('toggle-pause', (_e, v) => {
  engine.setPaused(v);
  log.info(v ? '已暂停' : '已继续');
  return { ok: true, paused: !!v };
});

ipcMain.handle('set-speed', (_e, v) => {
  engine.setSpeed(v);
  log.info(`倍速已调整为 ${v}x`);
  return { ok: true };
});

ipcMain.handle('set-doc-dwell', (_e, v) => {
  engine.setDocDwell(v);
  log.info(`文档停留已调整为 ${v}ms`);
  return { ok: true };
});

ipcMain.handle('set-daily-limit', (_e, v) => {
  engine.setDailyLimit(v);
  log.info(`每日上限已调整为 ${v} 分钟`);
  return { ok: true };
});

ipcMain.handle('set-muted', (_e, v) => {
  engine.setMuted(v);
  return { ok: true };
});

ipcMain.handle('set-on-top', (_e, v) => {
  try { if (win) win.setAlwaysOnTop(!!v, 'screen-saver'); } catch (e) {}
  return { ok: true };
});

ipcMain.handle('set-opacity', (_e, v) => {
  try {
    if (win) win.setOpacity(Math.max(0.4, Math.min(1, Number(v) || 1)));
  } catch (e) {}
  return { ok: true };
});

ipcMain.handle('set-pace', (_e, v) => {
  engine.setPace(v);
  log.info(`节奏已调整为 ${v}`);
  return { ok: true };
});

ipcMain.handle('clear-log-file', () => {
  try {
    fs.writeFileSync(cfg.logFile, '', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('get-state-info', () => {
  try {
    const data = state.load(cfg.stateFile);
    return { ok: true, count: Object.keys(data || {}).length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('export-state', async () => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出断点数据',
      defaultPath: `xxt-state-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false };
    let content = '{}';
    try { content = fs.readFileSync(cfg.stateFile, 'utf8'); } catch (e) {}
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('export-settings', async (_e, json) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出设置',
      defaultPath: `xxt-settings-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false };
    fs.writeFileSync(filePath, String(json || '{}'), 'utf8');
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('import-settings', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: '导入设置',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths.length) return { ok: false };
    const content = fs.readFileSync(filePaths[0], 'utf8');
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('get-history', () => {
  try {
    const h = daily.history();
    const days = Object.keys(h).sort().slice(-7);
    return { ok: true, days: days.map((d) => ({ date: d, seconds: h[d] })) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('export-history', async () => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出学习统计',
      defaultPath: `xxt-history-${Date.now()}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (canceled || !filePath) return { ok: false };
    const h = daily.history();
    const lines = ['日期,学习分钟数'];
    Object.keys(h).sort().forEach((d) => lines.push(`${d},${Math.round(h[d] / 60)}`));
    fs.writeFileSync(filePath, '\ufeff' + lines.join('\r\n'), 'utf8');
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('clear-state', () => {
  try {
    const b = state.clear(cfg.stateFile);
    log.warn(`已清除断点${b ? '（已备份到 ' + b + '）' : ''}，下次将重新刷课`);
    return { ok: true, backup: b };
  } catch (e) {
    log.error(`清除断点失败: ${e.message}`);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('win-minimize', () => { if (win) win.minimize(); });
ipcMain.handle('win-close', () => { if (win) win.close(); });
ipcMain.handle('win-toggle-max', () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.handle('notify', (_e, payload) => {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: (payload && payload.title) || '学习通刷课助手',
        body: (payload && payload.body) || '',
        icon: path.join(__dirname, 'build', 'icon.png'),
      }).show();
    }
  } catch (e) {}
});

ipcMain.handle('copy-text', (_e, text) => {
  try {
    clipboard.writeText(String(text || ''));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('export-log', async () => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出运行日志',
      defaultPath: `xxt-log-${Date.now()}.txt`,
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    });
    if (canceled || !filePath) return { ok: false };
    let content = '';
    try { content = fs.readFileSync(cfg.logFile, 'utf8'); } catch (e) {}
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.whenReady().then(() => {
  log.init(cfg.logFile, { retentionDays: cfg.logRetentionDays, maxSizeMB: cfg.maxLogSizeMB });
  log.setSink((line) => send({ type: 'log', text: line }));
  log.info(`启动，日志保留 ${cfg.logRetentionDays} 天`);
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // 有托盘时常驻，不自动退出；无托盘才退出
  if (!tray) app.quit();
});

app.on('before-quit', async () => {
  isQuitting = true;
  try { await engine.shutdown(); } catch (e) {}
});
