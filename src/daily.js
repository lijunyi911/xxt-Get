const fs = require('fs');
const path = require('path');
const cfg = require('../config');

const file = path.join(cfg.dataDir, 'daily.json');
const historyFile = path.join(cfg.dataDir, 'history.json');

function loadHistory() {
  try { return JSON.parse(fs.readFileSync(historyFile, 'utf8')); } catch (e) { return {}; }
}
function saveHistory(h) {
  try { fs.writeFileSync(historyFile, JSON.stringify(h, null, 2), 'utf8'); } catch (e) {}
}
function history() { return loadHistory(); }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (d && d.date === today()) return d;
  } catch (e) {}
  return { date: today(), seconds: 0 };
}

function save(d) {
  try { fs.writeFileSync(file, JSON.stringify(d, null, 2), 'utf8'); } catch (e) {}
}

function add(sec) {
  const d = load();
  d.seconds += Math.max(0, Math.round(sec));
  save(d);
  // 同步写入历史（按日期）
  try {
    const h = loadHistory();
    h[d.date] = d.seconds;
    saveHistory(h);
  } catch (e) {}
  return d;
}

function minutes() {
  return Math.round(load().seconds / 60);
}

// 运行时可调整的每日上限
let runtimeLimit = (cfg.antiBan && cfg.antiBan.dailyLimitMinutes) || 0;
function setLimit(v) {
  const n = parseInt(v, 10);
  if (Number.isFinite(n) && n >= 0) runtimeLimit = n; // 0 = 不限
}

function exceeded() {
  return runtimeLimit > 0 && load().seconds >= runtimeLimit * 60;
}

module.exports = { load, save, add, minutes, exceeded, setLimit, history };
