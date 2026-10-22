const fs = require('fs');
const path = require('path');

let sink = null;
let logFile = null;
let retentionDays = 7;

/** 清理过期日志（只清日志类文件，保留 state.json / answers.json） */
function cleanup(days) {
  if (!logFile) return 0;
  const dir = path.dirname(logFile);
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  let removed = 0;
  try {
    fs.readdirSync(dir).forEach((f) => {
      if (!/^(run-\d{8}-\d{6}\.log|debug_.*\.html|electron_.*\.txt|.*\.tmp)$/.test(f)) return;
      const fp = path.join(dir, f);
      try {
        if (fs.statSync(fp).mtimeMs < cutoff) {
          fs.unlinkSync(fp);
          removed++;
        }
      } catch (e) {}
    });
  } catch (e) {}
  return removed;
}

function rotateIfBig(maxSizeMB) {
  if (!logFile) return;
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > maxSizeMB * 1024 * 1024) {
      const d = new Date();
      const stamp =
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}` +
        `-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
      fs.renameSync(logFile, path.join(path.dirname(logFile), `run-${stamp}.log`));
    }
  } catch (e) {}
}

function init(file, opts = {}) {
  logFile = file;
  retentionDays = opts.retentionDays || 7;
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); } catch {}
  try { rotateIfBig(opts.maxSizeMB || 5); } catch {}
  try { cleanup(retentionDays); } catch {}
}

function setSink(fn) {
  sink = fn;
}

function log(level, msg) {
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  if (logFile) {
    try { fs.appendFileSync(logFile, line + '\r\n'); } catch {}
  }
  if (sink) {
    try { sink(line); } catch {}
  }
}

module.exports = {
  init,
  setSink,
  cleanup,
  info: (m) => log('INFO', m),
  warn: (m) => log('WARN', m),
  error: (m) => log('ERROR', m),
  log,
};
