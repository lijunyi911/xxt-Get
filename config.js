const path = require('path');

const ROOT = __dirname;

module.exports = {
  ROOT,
  dataDir: path.join(ROOT, 'data'),
  quizDir: path.join(ROOT, 'quiz'),
  stateFile: path.join(ROOT, 'data', 'state.json'),
  answersFile: path.join(ROOT, 'data', 'answers.json'),
  logFile: path.join(ROOT, 'data', 'run.log'),

  // 专用 Edge profile（与日常 Edge 完全隔离）
  profileDir: 'D:\\xxt-edge-profile',
  edgePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',

  // 学习通入口
  chaoxingHome: 'https://i.chaoxing.com',

  // 倍速档位（上限 2x）
  speeds: [0.5, 1, 1.5, 2],
  defaultSpeed: 2,

  // 时间参数（尽量快）
  actionDelayMs: 600,
  videoWaitTimeoutMs: 60 * 60 * 1000, // 单视频最长等待 1h
  docDwellMs: 30000,                  // 文档阅读停留 30s（渐进滚动）
  docFallbackMs: 6000,                // 未知任务点短暂兜底滚动
  pollIntervalMs: 1000,

  // 防封策略（降低自动化特征）
  antiBan: {
    enabled: true,
    minDelayMs: 500,        // 操作间随机最小延迟
    maxDelayMs: 2000,       // 操作间随机最大延迟
    mouseJitter: true,      // 随机移动鼠标，模拟真人
    randomPauseChance: 0.2, // 视频播放中随机暂停的概率（模拟走神/暂停）
    dailyLimitMinutes: 240, // 单日学习上限（分钟），超限自动停止
    chapterGapMinMs: 2000,  // 章节间随机间隔
    chapterGapMaxMs: 6000,
  },

  // 日志：单文件超过 5MB 轮转；保留 7 天，超期自动删除
  maxLogSizeMB: 5,
  logRetentionDays: 7,

  // 是否在页面结构未知时打印调试信息
  debugDump: true,
};
