const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const engine = require('./src/engine');
const state = require('./src/state');
const log = require('./src/log');
const cfg = require('./config');

let win = null;

function send(data) {
  if (win && !win.isDestroyed()) win.webContents.send('event', data);
}

function createWindow() {
  win = new BrowserWindow({
    width: 370,
    height: 620,
    x: 24,
    y: 90,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: '学习通刷课助手',
    backgroundColor: '#12161c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'web', 'index.html'));

  win.on('closed', () => { win = null; });
}

ipcMain.handle('load-courses', async () => {
  try {
    const courses = await engine.getCourses(send);
    return { ok: true, courses };
  } catch (e) {
    log.error(`加载课程失败: ${e.message}`);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('start', async (_e, payload) => {
  const { courses, speed } = payload || {};
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

app.whenReady().then(() => {
  log.init(cfg.logFile, { retentionDays: cfg.logRetentionDays, maxSizeMB: cfg.maxLogSizeMB });
  log.setSink((line) => send({ type: 'log', text: line }));
  log.info(`启动，日志保留 ${cfg.logRetentionDays} 天`);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', async () => {
  try { await engine.shutdown(); } catch (e) {}
});
