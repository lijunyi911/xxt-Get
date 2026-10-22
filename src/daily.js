const fs = require('fs');
const path = require('path');
const cfg = require('../config');

const file = path.join(cfg.dataDir, 'daily.json');

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
  return d;
}

function minutes() {
  return Math.round(load().seconds / 60);
}

function exceeded() {
  const limit = (cfg.antiBan && cfg.antiBan.dailyLimitMinutes) || 0;
  return limit > 0 && load().seconds >= limit * 60;
}

module.exports = { load, save, add, minutes, exceeded, today };
