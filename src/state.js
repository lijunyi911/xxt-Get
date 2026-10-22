const fs = require('fs');
const log = require('./log');

// 断点格式版本：结构升级后旧断点自动失效重置
const VERSION = 2;

function backup(file) {
  try {
    const b = file.replace(/\.json$/i, '') + '.bak.json';
    fs.copyFileSync(file, b);
    return b;
  } catch (e) {
    return null;
  }
}

/** 一条断点是否可信：必须是新版本、带完成类型、带完成依据 */
function isValidEntry(v) {
  if (!v || typeof v !== 'object') return false;
  if (v.v !== VERSION) return false;
  if (v.type !== 'video' && v.type !== 'doc') return false;
  if (!((v.dur > 0) || (v.dwell > 0))) return false;
  return true;
}

/**
 * 读取断点；自动识别并清理脏数据：
 * - 文件损坏 → 备份并重置
 * - 旧版本/旧格式（如值为纯数字）→ 备份并重置
 * - 个别条目缺完成依据 → 剔除该条
 */
function load(file) {
  let rawText = null;
  let raw = null;
  try {
    rawText = fs.readFileSync(file, 'utf8');
    raw = JSON.parse(rawText);
  } catch (e) {
    if (rawText) {
      const b = backup(file);
      log.warn(`断点文件损坏，已备份${b ? '到 ' + b : ''}并重置`);
    }
    return { version: VERSION, done: {} };
  }

  if (!raw || typeof raw !== 'object') {
    const b = backup(file);
    log.warn(`断点内容异常，已备份${b ? '到 ' + b : ''}并重置`);
    return { version: VERSION, done: {} };
  }

  if (raw.version !== VERSION || !raw.done || typeof raw.done !== 'object') {
    const b = backup(file);
    log.warn(`断点格式或版本过旧（不可信），已备份${b ? '到 ' + b : ''}并重置，将重新刷课`);
    return { version: VERSION, done: {} };
  }

  const clean = {};
  let dirty = 0;
  for (const [k, v] of Object.entries(raw.done)) {
    if (isValidEntry(v)) clean[k] = v;
    else dirty++;
  }

  if (dirty > 0) {
    backup(file);
    const out = { version: VERSION, done: clean };
    save(file, out);
    log.warn(`检测到 ${dirty} 条脏断点（缺完成依据/未真正完成），已自动清除，将重刷这些章节`);
    return out;
  }

  return raw;
}

function save(file, data) {
  try {
    data.version = VERSION;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function isDone(state, key) {
  return isValidEntry(state.done && state.done[key]);
}

/**
 * 记录完成断点（必须带完成依据）
 * @param {object} info { type: 'video'|'doc', dur?, dwell? }
 */
function markDone(state, key, info = {}) {
  state.version = VERSION;
  state.done = state.done || {};
  state.done[key] = { v: VERSION, t: Date.now(), ...info };
}

/** 清除全部断点（用户主动重刷） */
function clear(file) {
  try {
    if (fs.existsSync(file)) {
      const b = backup(file);
      fs.unlinkSync(file);
      return b;
    }
  } catch (e) {}
  return null;
}

module.exports = { load, save, isDone, markDone, clear, isValidEntry, VERSION };
