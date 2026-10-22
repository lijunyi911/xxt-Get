const path = require('path');
const fs = require('fs');

const ROOT = __dirname;

function getElectronApp() {
  try {
    const e = require('electron');
    if (e && e.app && typeof e.app.getPath === 'function') return e.app;
  } catch (err) {}
  return null;
}

const app = getElectronApp();
const isPackaged = !!(app && app.isPackaged);

// 开发模式：项目内 data/；打包后：系统用户数据目录（asar 内不可写）
// 便携版（U盘）运行时，数据跟随 exe 所在目录，方便随身携带
const PORTABLE_DIR = process.env.PORTABLE_EXECUTABLE_DIR;
const BASE = isPackaged
  ? (PORTABLE_DIR ? path.join(PORTABLE_DIR, 'xxt-Get-data') : app.getPath('userData'))
  : ROOT;

// 跨平台 Edge 路径
const EDGE_PATH = (() => {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const p of candidates) {
      try { if (fs.existsSync(p)) return p; } catch (e) {}
    }
    return candidates[0];
  }
  if (process.platform === 'darwin') {
    return '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
  }
  return '/usr/bin/microsoft-edge';
})();

module.exports = {
  ROOT,
  isPackaged,
  baseDir: BASE,

  dataDir: path.join(BASE, 'data'),
  quizDir: path.join(BASE, 'quiz'),
  stateFile: path.join(BASE, 'data', 'state.json'),
  answersFile: path.join(BASE, 'data', 'answers.json'),
  logFile: path.join(BASE, 'data', 'run.log'),

  // 专用 Edge profile（开发时沿用原路径；打包后放用户数据目录）
  profileDir: isPackaged ? path.join(BASE, 'edge-profile') : 'D:\\xxt-edge-profile',
  edgePath: EDGE_PATH,

  // 学习通入口
  chaoxingHome: 'https://i.chaoxing.com',

  // 倍速档位（上限 2x）
  speeds: [0.5, 1, 1.5, 2],
  defaultSpeed: 2,

  // 时间参数
  actionDelayMs: 600,
  videoWaitTimeoutMs: 60 * 60 * 1000, // 单视频最长等待 1h
  docDwellMs: 30000,                  // 文档阅读停留 30s（渐进滚动）
  docFallbackMs: 6000,                // 未知任务点短暂兜底滚动
  pollIntervalMs: 1000,

  // 防封策略（降低自动化特征）
  antiBan: {
    enabled: true,
    minDelayMs: 500,
    maxDelayMs: 2000,
    mouseJitter: true,
    randomPauseChance: 0.2,
    dailyLimitMinutes: 240,
    chapterGapMinMs: 2000,
    chapterGapMaxMs: 6000,
  },

  // 日志：单文件超过 5MB 轮转；保留 7 天，超期自动删除
  maxLogSizeMB: 5,
  logRetentionDays: 7,

  debugDump: true,
};
