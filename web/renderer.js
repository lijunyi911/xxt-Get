const $ = (id) => document.getElementById(id);

// ===== 主题：浅色 / 深色 / 跟随系统 =====
const THEME_KEY = 'xxt-theme';
let themeMode = 'system';
let currentAccentHex = '#ff8c1a';
const ACCENT_PRESETS = {
  orange: '#ff8c1a',
  blue: '#3d9bff',
  green: '#2fbf71',
  purple: '#a06bff',
};
try { themeMode = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) {}
const lightMedia = window.matchMedia('(prefers-color-scheme: light)');

function applyTheme() {
  let dark;
  if (themeMode === 'dark') dark = true;
  else if (themeMode === 'light') dark = false;
  else dark = !lightMedia.matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';

  const btn = document.getElementById('btnTheme');
  if (btn) {
    btn.textContent = themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色';
  }
  applyAccentHex(currentAccentHex);
}

const themeBtn = document.getElementById('btnTheme');
const themePop = document.getElementById('themePop');

function updateThemeMenu() {
  if (!themePop) return;
  themePop.querySelectorAll('button[data-mode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === themeMode);
  });
}

if (themeBtn && themePop) {
  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themePop.classList.toggle('show');
    updateThemeMenu();
  });

  themePop.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    themeMode = b.dataset.mode;
    try { localStorage.setItem(THEME_KEY, themeMode); } catch (err) {}
    applyTheme();
    updateThemeMenu();
    themePop.classList.remove('show');
    addLog(`[INFO] 主题切换为：${b.textContent.trim()}`);
    showToast(`主题：${b.textContent.trim()}`, 'success');
  });

  document.addEventListener('click', (e) => {
    if (!themePop.contains(e.target) && e.target !== themeBtn) {
      themePop.classList.remove('show');
    }
  });
}
lightMedia.addEventListener('change', () => { if (themeMode === 'system') applyTheme(); });
applyTheme();

// ===== 外观设置：字号 / 紧凑 / 动画 =====
const FONT_KEY = 'xxt-font';
const COMPACT_KEY = 'xxt-compact';
const ANIM_KEY = 'xxt-anim';

function applyFont(v) {
  document.documentElement.style.setProperty('--base-font', v + 'px');
  document.querySelectorAll('button[data-font]').forEach((b) => {
    b.classList.toggle('active', b.dataset.font === String(v));
  });
}
function applyCompact(on) { document.body.classList.toggle('compact', !!on); }
function applyAnim(on) { document.body.classList.toggle('no-anim', !on); }

document.addEventListener('click', (e) => {
  const fb = e.target.closest('button[data-font]');
  if (!fb) return;
  applyFont(fb.dataset.font);
  try { localStorage.setItem(FONT_KEY, fb.dataset.font); } catch (err) {}
});

const optMuted = document.getElementById('optMuted');
if (optMuted) {
  optMuted.addEventListener('change', (e) => {
    try { window.api.setMuted(e.target.checked); } catch (err) {}
    try { localStorage.setItem('xxt-muted', e.target.checked ? '1' : '0'); } catch (err) {}
  });
}
(function initMuted() {
  let v = '1';
  try { v = localStorage.getItem('xxt-muted') || '1'; } catch (e) {}
  if (optMuted) optMuted.checked = v === '1';
  try { window.api.setMuted(v === '1'); } catch (e) {}
})();

// 启动淡入（用 CSS 动画，不依赖初始透明度）
document.body.classList.add('ready');

// ===== 橙黑主题确认弹窗（替代系统 confirm） =====
function showConfirm(msg) {
  return new Promise((resolve) => {
    const mask = $('confirmMask');
    const msgEl = $('confirmMsg');
    const ok = $('confirmOk');
    const cancel = $('confirmCancel');
    if (!mask || !ok || !cancel) { resolve(true); return; }
    msgEl.textContent = String(msg || '');
    mask.classList.add('show');
    const done = (v) => {
      mask.classList.remove('show');
      ok.onclick = null;
      cancel.onclick = null;
      resolve(v);
    };
    ok.onclick = () => done(true);
    cancel.onclick = () => done(false);
  });
}

// 全局错误捕获
window.addEventListener('error', (e) => {
  try { addLog('[ERROR] 界面异常：' + (e.message || '未知')); } catch (err) {}
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = e && e.reason && e.reason.message ? e.reason.message : String(e && e.reason);
  try { addLog('[ERROR] 未处理异常：' + msg); } catch (err) {}
});

// ===== 提示音 =====
let audioCtx = null;
let soundOn = true;
function playBeep(freq, dur, vol = 0.08) {
  if (!soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}
const optSound = document.getElementById('optSound');
if (optSound) {
  optSound.addEventListener('change', (e) => {
    soundOn = e.target.checked;
    try { localStorage.setItem('xxt-sound', soundOn ? '1' : '0'); } catch (err) {}
  });
}
(function initSound() {
  let v = '1';
  try { v = localStorage.getItem('xxt-sound') || '1'; } catch (e) {}
  soundOn = v === '1';
  if (optSound) optSound.checked = soundOn;
})();

// ===== 主题色 / 圆角 =====
const ACCENT_KEY = 'xxt-accent';
const RADIUS_KEY = 'xxt-radius';

function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return { r: 255, g: 140, b: 26 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function mixHex(hex, target, ratio) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex(a.r + (b.r - a.r) * ratio, a.g + (b.g - a.g) * ratio, a.b + (b.b - a.b) * ratio);
}
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** 应用任意主题色，并按深浅色分别适配 */
function applyAccentHex(hex) {
  const isLight = document.documentElement.dataset.theme === 'light';
  const accent = hex;
  const accent2 = isLight ? mixHex(hex, '#000000', 0.22) : mixHex(hex, '#000000', 0.12);
  const accent3 = isLight ? mixHex(hex, '#000000', 0.32) : mixHex(hex, '#ffffff', 0.40);
  const onAccent = luminance(hex) > 0.55 ? '#111111' : '#ffffff';
  const rgb = hexToRgb(hex);
  const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

  const root = document.documentElement.style;
  root.setProperty('--accent', accent);
  root.setProperty('--accent2', accent2);
  root.setProperty('--accent3', accent3);
  root.setProperty('--on-accent', onAccent);
  root.setProperty('--hover-text', accent3);
  // 光效跟随主题色
  root.setProperty('--accent-rgb', rgbStr);
  root.setProperty('--glow-1', `rgba(${rgbStr}, ${isLight ? 0.14 : 0.20})`);
  root.setProperty('--glow-2', `rgba(${rgbStr}, ${isLight ? 0.06 : 0.09})`);
  root.setProperty('--bg-glow-1', `rgba(${rgbStr}, ${isLight ? 0.10 : 0.07})`);
  root.setProperty('--bg-glow-2', `rgba(${rgbStr}, ${isLight ? 0.06 : 0.05})`);

  document.querySelectorAll('.color-dot').forEach((b) => {
    const p = ACCENT_PRESETS[b.dataset.accent];
    b.classList.toggle('active', !!p && p.toLowerCase() === String(hex).toLowerCase());
  });
  if (typeof syncColorPanel === 'function') syncColorPanel(hex);
}

function applyRadius(v) {
  document.documentElement.style.setProperty('--radius', v + 'px');
  document.querySelectorAll('button[data-radius]').forEach((b) => {
    b.classList.toggle('active', b.dataset.radius === String(v));
  });
}

document.addEventListener('click', (e) => {
  const dot = e.target.closest('.color-dot');
  if (dot) {
    const hex = ACCENT_PRESETS[dot.dataset.accent] || dot.dataset.accent;
    currentAccentHex = hex;
    applyAccentHex(hex);
    try { localStorage.setItem(ACCENT_KEY, hex); } catch (err) {}
    return;
  }
  const rb = e.target.closest('button[data-radius]');
  if (rb) {
    applyRadius(rb.dataset.radius);
    try { localStorage.setItem(RADIUS_KEY, rb.dataset.radius); } catch (err) {}
  }
});

// 颜色轮盘：点击展开橙黑主题调色板
const colorWheel = document.getElementById('colorWheel');
const colorPanel = document.getElementById('colorPanel');
const colorPreview = document.getElementById('colorPreview');
const hexInput = document.getElementById('hexInput');
const hueRange = document.getElementById('hueRange');
const satRange = document.getElementById('satRange');
const lightRange = document.getElementById('lightRange');

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return '#' + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}

function syncColorPanel(hex) {
  const hsl = hexToHsl(hex);
  const hue = document.getElementById('hueRange');
  const sat = document.getElementById('satRange');
  const light = document.getElementById('lightRange');
  const hexEl = document.getElementById('hexInput');
  const preview = document.getElementById('colorPreview');
  if (hue) hue.value = hsl.h;
  if (sat) sat.value = hsl.s;
  if (light) light.value = hsl.l;
  if (hexEl) hexEl.value = hex;
  if (preview) preview.style.background = hex;
}

if (colorWheel && colorPanel) {
  colorWheel.addEventListener('click', () => colorPanel.classList.toggle('show'));
}

function applyFromHsl() {
  const h = Number(hueRange.value) || 0;
  const s = Number(satRange.value) || 0;
  const l = Number(lightRange.value) || 0;
  const hex = hslToHex(h, s, l);
  currentAccentHex = hex;
  applyAccentHex(hex);
  try { localStorage.setItem(ACCENT_KEY, hex); } catch (e) {}
}
[hueRange, satRange, lightRange].forEach((r) => {
  if (r) r.addEventListener('input', applyFromHsl);
});

if (hexInput) {
  hexInput.addEventListener('change', () => {
    let v = String(hexInput.value || '').trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
      hexInput.value = currentAccentHex;
      return;
    }
    currentAccentHex = v.toLowerCase();
    applyAccentHex(currentAccentHex);
    try { localStorage.setItem(ACCENT_KEY, currentAccentHex); } catch (e) {}
  });
}

(function initThemeExtras() {
  let a = '#ff8c1a', r = '8';
  try {
    a = localStorage.getItem(ACCENT_KEY) || '#ff8c1a';
    if (!String(a).startsWith('#')) a = ACCENT_PRESETS[a] || '#ff8c1a';
    r = localStorage.getItem(RADIUS_KEY) || '8';
  } catch (e) {}
  currentAccentHex = a;
  applyAccentHex(a);
  applyRadius(r);
})();

// ===== 失焦省电：窗口不在前台时隐藏光晕 =====
window.addEventListener('blur', () => document.body.classList.add('no-focus'));
window.addEventListener('focus', () => document.body.classList.remove('no-focus'));

// ===== 网络状态检测 =====
window.addEventListener('offline', () => {
  addLog('[WARN] 网络已断开，已自动暂停');
  playBeep(300, 0.4, 0.12);
  if (!isPaused) {
    isPaused = true;
    try { window.api.setPaused(true); } catch (e) {}
    $('btnPause').textContent = '继续';
    $('btnPause').classList.add('active');
  }
});
window.addEventListener('online', () => {
  addLog('[INFO] 网络已恢复，点击「继续」可继续刷课');
  playBeep(880, 0.2, 0.08);
});

// ===== 断点数据 =====
async function loadStateInfo() {
  try {
    const r = await window.api.getStateInfo();
    const el = $('stateCount');
    if (!el) return;
    el.textContent = r && r.ok ? `${r.count} 条记录` : '读取失败';
  } catch (e) {}
}
if ($('btnSettings')) $('btnSettings').addEventListener('click', loadStateInfo);
if ($('btnExportState')) {
  $('btnExportState').addEventListener('click', async () => {
    try {
      const r = await window.api.exportState();
      if (r && r.ok) addLog(`[INFO] 断点已导出：${r.path}`);
      else if (r && r.error) addLog(`[ERROR] 导出失败：${r.error}`);
    } catch (e) {
      addLog(`[ERROR] 导出失败：${e.message}`);
    }
  });
}
if ($('btnExpandAll')) {
  $('btnExpandAll').addEventListener('click', () => {
    document.querySelectorAll('.settings-body .set-item').forEach((it) => it.classList.remove('collapsed'));
    try { localStorage.setItem('xxt-collapsed', '[]'); } catch (e) {}
  });
}
if ($('btnCollapseAll')) {
  $('btnCollapseAll').addEventListener('click', () => {
    document.querySelectorAll('.settings-body .set-item').forEach((it) => it.classList.add('collapsed'));
    const all = [...document.querySelectorAll('.settings-body .set-item')].map((_, i) => i);
    try { localStorage.setItem('xxt-collapsed', JSON.stringify(all)); } catch (e) {}
  });
}

if ($('btnClearRunHistory')) {
  $('btnClearRunHistory').addEventListener('click', async () => {
    if (!(await showConfirm('清空刷课历史记录？'))) return;
    try { localStorage.setItem('xxt-run-history', '[]'); } catch (e) {}
    renderRunHistory();
    showToast('刷课历史已清空', 'success');
  });
}

if ($('btnCheckSession')) {
  $('btnCheckSession').addEventListener('click', async () => {
    try {
      const r = await window.api.checkSession();
      if (r && r.alive) {
        addLog(`[INFO] Edge 会话正常（${r.pages} 个标签页）`);
        showToast('Edge 会话正常', 'success');
      } else {
        addLog('[WARN] Edge 会话未启动');
        showToast('Edge 会话未启动，请先读取课程', 'warn');
      }
    } catch (e) { addLog(`[ERROR] ${e.message}`); }
  });
}
if ($('btnOpenData')) {
  $('btnOpenData').addEventListener('click', () => {
    try { window.api.openDataDir(); } catch (e) {}
  });
}
if ($('btnClearHistory')) {
  $('btnClearHistory').addEventListener('click', async () => {
    if (!(await showConfirm('清空所有学习历史记录？'))) return;
    try {
      const r = await window.api.clearHistory();
      if (r && r.ok) {
        addLog('[INFO] 学习历史已清空');
        loadHistory();
      }
    } catch (e) {}
  });
}

// ===== 设置导出 / 导入 =====
if ($('btnExportSettings')) {
  $('btnExportSettings').addEventListener('click', async () => {
    const data = { _version: 2, _exportedAt: new Date().toISOString() };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('xxt-')) data[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    const r = await window.api.exportSettings(JSON.stringify(data, null, 2));
    if (r && r.ok) addLog(`[INFO] 设置已导出：${r.path}`);
    else if (r && r.error) addLog(`[ERROR] 导出失败：${r.error}`);
  });
}
if ($('btnImportSettings')) {
  $('btnImportSettings').addEventListener('click', async () => {
    const r = await window.api.importSettings();
    if (!r || !r.ok) return;
    try {
      const data = JSON.parse(r.content || '{}');
      if (data._version && data._version > 2) {
        if (!(await showConfirm('该配置文件来自更新的版本，继续导入可能不兼容。仍要导入吗？'))) return;
      }
      let count = 0;
      Object.keys(data).forEach((k) => {
        if (k.startsWith('xxt-')) { localStorage.setItem(k, data[k]); count++; }
      });
      addLog(`[INFO] 已导入 ${count} 项设置`);
      alert('设置已导入，即将刷新');
      location.reload();
    } catch (e) {
      alert('导入失败：' + e.message);
    }
  });
}

// ===== 节奏 =====
const PACE_KEY = 'xxt-pace';
function applyPace(v) {
  document.querySelectorAll('button[data-pace]').forEach((b) => {
    b.classList.toggle('active', b.dataset.pace === v);
  });
  try { window.api.setPace(v); } catch (e) {}
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-pace]');
  if (!b) return;
  applyPace(b.dataset.pace);
  try { localStorage.setItem(PACE_KEY, b.dataset.pace); } catch (err) {}
});
(function initPace() {
  let v = 'normal';
  try { v = localStorage.getItem(PACE_KEY) || 'normal'; } catch (e) {}
  applyPace(v);
})();

// ===== 窗口置顶 / 透明度 =====
const optOnTop = document.getElementById('optOnTop');
const optOpacity = document.getElementById('optOpacity');
const opacityVal = document.getElementById('opacityVal');
if (optOnTop) {
  optOnTop.addEventListener('change', (e) => {
    try { window.api.setOnTop(e.target.checked); } catch (err) {}
    try { localStorage.setItem('xxt-ontop', e.target.checked ? '1' : '0'); } catch (err) {}
  });
}
if (optOpacity) {
  optOpacity.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (opacityVal) opacityVal.textContent = Math.round(v * 100) + '%';
    try { window.api.setOpacity(v); } catch (err) {}
  });
  optOpacity.addEventListener('change', (e) => {
    try { localStorage.setItem('xxt-opacity', e.target.value); } catch (err) {}
  });
}
(function initWindowOpts() {
  let top = '1', op = '1';
  try {
    top = localStorage.getItem('xxt-ontop') || '1';
    op = localStorage.getItem('xxt-opacity') || '1';
  } catch (e) {}
  if (optOnTop) optOnTop.checked = top === '1';
  if (optOpacity) optOpacity.value = op;
  if (opacityVal) opacityVal.textContent = Math.round(Number(op) * 100) + '%';
  try { window.api.setOnTop(top === '1'); } catch (e) {}
  try { window.api.setOpacity(Number(op)); } catch (e) {}
})();

// ===== 学习历史 =====
async function loadHistory() {
  try {
    const r = await window.api.getHistory();
    const box = $('historyList');
    if (!box) return;
    if (r && r.ok && r.days.length) {
      box.innerHTML = r.days.map((d) => `
        <div class="history-row"><span>${d.date}</span><b>${Math.round(d.seconds / 60)} 分钟</b></div>
      `).join('');
    } else {
      box.innerHTML = '<div class="empty">暂无记录</div>';
    }
    const wt = $('weekTotal');
    if (wt && r && r.ok) {
      const sec = r.weekTotal || 0;
      const hh = Math.floor(sec / 3600);
      const mm = Math.round((sec % 3600) / 60);
      wt.textContent = `本周累计 ${hh > 0 ? hh + ' 小时 ' : ''}${mm} 分钟`;
    }
  } catch (e) {}
}
if ($('btnSettings')) $('btnSettings').addEventListener('click', loadHistory);
if ($('btnExportHistory')) {
  $('btnExportHistory').addEventListener('click', async () => {
    try {
      const r = await window.api.exportHistory();
      if (r && r.ok) addLog(`[INFO] 统计已导出：${r.path}`);
      else if (r && r.error) addLog(`[ERROR] 导出失败：${r.error}`);
    } catch (e) {
      addLog(`[ERROR] 导出失败：${e.message}`);
    }
  });
}

// ===== 设置面板开关 =====
const settingsMask = document.getElementById('settingsMask');
const btnSettings = document.getElementById('btnSettings');
if (btnSettings && settingsMask) {
  btnSettings.addEventListener('click', () => {
    settingsMask.classList.add('show');
    const panel = document.querySelector('.settings-panel');
    if (panel) panel.scrollTop = 0;
    if ($('setSearch')) $('setSearch').value = '';
    document.querySelectorAll('.settings-body .set-item').forEach((i) => { i.style.display = ''; });
  });
  const closeBtn = document.getElementById('btnSettingsClose');
  if (closeBtn) closeBtn.addEventListener('click', () => settingsMask.classList.remove('show'));
  settingsMask.addEventListener('click', (e) => {
    if (e.target === settingsMask) settingsMask.classList.remove('show');
  });
}

const optCompact = document.getElementById('optCompact');
const optAnim = document.getElementById('optAnim');
if (optCompact) {
  optCompact.addEventListener('change', (e) => {
    applyCompact(e.target.checked);
    try { localStorage.setItem(COMPACT_KEY, e.target.checked ? '1' : '0'); } catch (err) {}
  });
}
if (optAnim) {
  optAnim.addEventListener('change', (e) => {
    applyAnim(e.target.checked);
    try { localStorage.setItem(ANIM_KEY, e.target.checked ? '1' : '0'); } catch (err) {}
  });
}

(function initAppearance() {
  let f = '13', c = '0', a = '1';
  try {
    f = localStorage.getItem(FONT_KEY) || '13';
    c = localStorage.getItem(COMPACT_KEY) || '0';
    a = localStorage.getItem(ANIM_KEY) || '1';
  } catch (e) {}
  applyFont(f);
  applyCompact(c === '1');
  applyAnim(a === '1');
  if (optCompact) optCompact.checked = c === '1';
  if (optAnim) optAnim.checked = a === '1';
})();

// ===== 每日上限 / 恢复默认 / 关于 =====
const LIMIT_KEY = 'xxt-daily-limit';
const optDailyLimit = document.getElementById('optDailyLimit');
function applyDailyLimit(v) {
  if (optDailyLimit) optDailyLimit.value = String(v);
  try { window.api.setDailyLimit(v); } catch (e) {}
}
if (optDailyLimit) {
  optDailyLimit.addEventListener('change', (e) => {
    const v = e.target.value;
    applyDailyLimit(v);
    try { localStorage.setItem(LIMIT_KEY, v); } catch (err) {}
  });
}
(function initLimit() {
  let v = '0';
  try { v = localStorage.getItem(LIMIT_KEY) || '0'; } catch (e) {}
  applyDailyLimit(v);
})();

const btnResetOpt = document.getElementById('btnResetOpt');
if (btnResetOpt) {
  btnResetOpt.addEventListener('click', async () => {
    if (!(await showConfirm('恢复所有设置到默认值？'))) return;
    try { localStorage.clear(); } catch (e) {}
    location.reload();
  });
}
const btnAbout = document.getElementById('btnAbout');
if (btnAbout) {
  btnAbout.addEventListener('click', () => {
    alert('学习通刷课助手 v1.2.1\n\nhttps://github.com/lijunyi911/xxt-Get\n\n快捷键：\nCtrl+Enter 开始\nEsc 停止\nCtrl+L 读取课程\nCtrl+F 搜索课程\nCtrl+D 作业答题\nCtrl+, 设置\nCtrl+R 刷新会话');
  });
}

let currentSpeed = 2;
let courses = [];

// 倍速选择 + 记忆
const SPEED_KEY = 'xxt-speed';
function loadSpeed() {
  try {
    const v = parseFloat(localStorage.getItem(SPEED_KEY));
    return [0.5, 1, 1.5, 2].includes(v) ? v : 2;
  } catch (e) { return 2; }
}
function applySpeed(sp) {
  currentSpeed = sp;
  document.querySelectorAll('.spd').forEach((b) => {
    b.classList.toggle('active', parseFloat(b.dataset.speed) === sp);
  });
}

$('speedRow').addEventListener('click', (e) => {
  const btn = e.target.closest('.spd');
  if (!btn) return;
  const sp = parseFloat(btn.dataset.speed);
  applySpeed(sp);
  try { localStorage.setItem(SPEED_KEY, String(sp)); } catch (err) {}
  try { window.api.setSpeed(sp); } catch (err) {}
});

applySpeed(loadSpeed());

// 文档停留时长：无极调节 + 自定义输入
const DOC_KEY = 'xxt-doc-dwell';
const dwellRange = $('docDwellRange');
const dwellNum = $('docDwellNum');
const dwellVal = $('docDwellVal');

function setDwellSec(sec) {
  let s = Number(sec);
  if (!Number.isFinite(s) || s <= 0) s = 30;
  s = Math.max(0.1, Math.round(s * 10) / 10);
  dwellRange.value = String(Math.min(60, s));
  dwellNum.value = String(s);
  dwellVal.textContent = String(s);
  try { window.api.setDocDwell(Math.round(s * 1000)); } catch (e) {}
  try { localStorage.setItem(DOC_KEY, String(s)); } catch (e) {}
}

dwellRange.addEventListener('input', () => setDwellSec(dwellRange.value));
dwellNum.addEventListener('change', () => setDwellSec(dwellNum.value));

(function initDocDwell() {
  let s = 30;
  try {
    s = parseFloat(localStorage.getItem(DOC_KEY)) || 30;
    if (s > 300) s = s / 1000; // 兼容旧版毫秒数据
  } catch (e) {}
  setDwellSec(s);
})();

// 加载课程（失败自动重试一次）
$('btnLoad').addEventListener('click', async () => {
  $('btnLoad').disabled = true;
  $('loadHint').textContent = '正在打开 Edge 并读取...';
  addLog('[INFO] 正在启动 Edge / 读取课程列表...');
  try {
    let res = await window.api.loadCourses();
    if (!res.ok) {
      addLog('[WARN] 读取失败，1.5 秒后自动重试一次...');
      await new Promise((r) => setTimeout(r, 1500));
      res = await window.api.loadCourses();
    }
    if (res.ok) {
      courses = res.courses || [];
      renderCourses(courses);
      updateCourseCount();
      addLog(`[INFO] 读取到 ${courses.length} 门课程`);
    } else {
      $('loadHint').textContent = '读取失败';
      addLog(`[ERROR] ${res.error}`);
    }
  } catch (e) {
    $('loadHint').textContent = '读取失败';
    addLog(`[ERROR] ${e.message}`);
  } finally {
    $('btnLoad').disabled = false;
  }
});

// 课程搜索
$('courseSearch').addEventListener('input', (e) => {
  const q = (e.target.value || '').trim().toLowerCase();
  document.querySelectorAll('#courseList .course-item').forEach((el) => {
    const name = (el.querySelector('.cname')?.textContent || '').toLowerCase();
    el.style.display = !q || name.includes(q) ? '' : 'none';
  });
});

// 全选 / 反选
$('btnAll').addEventListener('click', () => {
  const boxes = [...document.querySelectorAll('#courseList input[type="checkbox"]')];
  if (!boxes.length) return;
  const allChecked = boxes.every((b) => b.checked);
  boxes.forEach((b) => { b.checked = !allChecked; });
  $('btnAll').textContent = allChecked ? '全选' : '取消全选';
  updateCourseCount();
  addLog(`[INFO] ${allChecked ? '已取消全选' : '已全选'} ${boxes.length} 门课程`);
});

function showPrompt(msg, def = '') {
  return new Promise((resolve) => {
    const mask = $('promptMask');
    if (!mask) { resolve(null); return; }
    const msgEl = $('promptMsg');
    const inp = $('promptInput');
    const ok = $('promptOk');
    const cancel = $('promptCancel');
    msgEl.textContent = msg;
    inp.value = def;
    mask.classList.add('show');
    setTimeout(() => inp.focus(), 50);
    const done = (v) => {
      mask.classList.remove('show');
      ok.onclick = null;
      cancel.onclick = null;
      inp.onkeydown = null;
      resolve(v);
    };
    ok.onclick = () => done(inp.value.trim());
    cancel.onclick = () => done(null);
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') done(inp.value.trim());
      if (e.key === 'Escape') done(null);
    };
  });
}

function getNotes() {
  try { return JSON.parse(localStorage.getItem('xxt-notes') || '{}'); } catch (e) { return {}; }
}
function setNote(cid, text) {
  const n = getNotes();
  if (text) n[cid] = text;
  else delete n[cid];
  try { localStorage.setItem('xxt-notes', JSON.stringify(n)); } catch (e) {}
}

function getFavs() {
  try { return JSON.parse(localStorage.getItem('xxt-fav') || '[]'); } catch (e) { return []; }
}
function toggleFav(cid) {
  const favs = getFavs();
  const i = favs.indexOf(cid);
  if (i >= 0) favs.splice(i, 1); else favs.push(cid);
  try { localStorage.setItem('xxt-fav', JSON.stringify(favs)); } catch (e) {}
}

function renderCourses(list) {
  const box = $('courseList');
  if (!list.length) {
    box.innerHTML = '<div class="empty">没有读到课程，请确认已登录</div>';
    $('btnAll').disabled = true;
    $('btnAll').textContent = '全选';
    $('btnSort').disabled = true;
    return;
  }
  // 排序时保留本次勾选状态
  const checked = new Set([...document.querySelectorAll('#courseList input:checked')].map((i) => i.dataset.cid));
  const keepScroll = box.scrollTop;
  const favs = getFavs();
  const notes = getNotes();
  let arr = sortByName
    ? [...list].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh'))
    : list.slice();
  // 收藏课程置顶
  arr.sort((a, b) => {
    const fa = favs.includes(a.courseId) ? 0 : 1;
    const fb = favs.includes(b.courseId) ? 0 : 1;
    return fa - fb;
  });
  box.innerHTML = arr.map((c, i) => {
    const note = notes[c.courseId] || '';
    return `
    <label class="course-item">
      <input type="checkbox" data-cid="${c.courseId}" />
      <span class="cnum">${i + 1}.</span>
      <span class="cname" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}${note ? `<span class="cnote" title="${escapeHtml(note)}">${escapeHtml(note)}</span>` : ''}</span>
      <button class="note-btn" data-note="${c.courseId}" title="备注">✎</button>
      <button class="fav-btn ${favs.includes(c.courseId) ? 'on' : ''}" data-fav="${c.courseId}" title="收藏">${favs.includes(c.courseId) ? '★' : '☆'}</button>
    </label>`;
  }).join('');
  document.querySelectorAll('#courseList input[type="checkbox"]').forEach((inp) => {
    if (checked.has(inp.dataset.cid)) inp.checked = true;
  });
  box.scrollTop = keepScroll;
  $('btnAll').disabled = false;
  $('btnAll').textContent = '全选';
  $('btnSort').disabled = false;
  if ($('btnInvert')) $('btnInvert').disabled = false;
}

// 排序
let sortByName = false;
try { sortByName = localStorage.getItem('xxt-sort') === '1'; } catch (e) {}
$('btnSort').addEventListener('click', () => {
  sortByName = !sortByName;
  try { localStorage.setItem('xxt-sort', sortByName ? '1' : '0'); } catch (e) {}
  $('btnSort').textContent = sortByName ? '名称↓' : '排序';
  if (courses.length) renderCourses(courses);
});
// 搜索框 Esc 清空
$('courseSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.target.value = '';
    e.target.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

// 备注按钮
$('courseList').addEventListener('click', async (e) => {
  const nb = e.target.closest('.note-btn');
  if (!nb) return;
  e.preventDefault();
  e.stopPropagation();
  const cid = nb.dataset.note;
  const notes = getNotes();
  const text = await showPrompt('课程备注（留空删除）', notes[cid] || '');
  if (text === null) return;
  setNote(cid, text);
  renderCourses(courses);
});

// 收藏星标点击（阻止触发勾选）
$('courseList').addEventListener('click', (e) => {
  const b = e.target.closest('.fav-btn');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  toggleFav(b.dataset.fav);
  renderCourses(courses);
});

// 双击课程项切换勾选
$('courseList').addEventListener('dblclick', (e) => {
  const item = e.target.closest('.course-item');
  if (!item) return;
  const inp = item.querySelector('input');
  if (inp) {
    inp.checked = !inp.checked;
    updateCourseCount();
  }
});

// 已选/总数徽章
function updateCourseCount() {
  const total = document.querySelectorAll('#courseList input[type="checkbox"]').length;
  const sel = document.querySelectorAll('#courseList input:checked').length;
  const favCount = getFavs().length;
  const favText = favCount ? ` · 收藏 ${favCount}` : '';
  $('loadHint').textContent = total ? `已选 ${sel} / 共 ${total}${favText}` : '';
}
$('courseList').addEventListener('change', updateCourseCount);
$('btnInvert').addEventListener('click', () => {
  document.querySelectorAll('#courseList .course-item').forEach((item) => {
    if (item.style.display === 'none') return;
    const inp = item.querySelector('input');
    if (inp) inp.checked = !inp.checked;
  });
  updateCourseCount();
});
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    e.preventDefault();
    if (!$('btnAll').disabled) $('btnAll').click();
  }
});

/** 收起课程列表，回到初始状态 */
function resetCourseList() {
  courses = [];
  $('courseList').innerHTML = '<div class="empty">点「读取我的课程」加载列表</div>';
  $('btnAll').disabled = true;
  $('btnAll').textContent = '全选';
  $('loadHint').textContent = '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// 暂停 / 继续 + 运行计时
let isPaused = false;
let runStart = 0;
$('btnPause').addEventListener('click', async () => {
  isPaused = !isPaused;
  try { await window.api.setPaused(isPaused); } catch (e) {}
  $('btnPause').textContent = isPaused ? '继续' : '暂停';
  $('btnPause').classList.toggle('active', isPaused);
  if ($('stage')) $('stage').textContent = isPaused ? '已暂停' : '继续刷课中...';
});
setInterval(() => {
  if (!runStart) return;
  const sec = Math.floor((Date.now() - runStart) / 1000);
  $('stRunTime').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}, 1000);

// 开始刷课
$('btnStart').addEventListener('click', async () => {
  const selected = [...document.querySelectorAll('#courseList input:checked')].map((i) => i.dataset.cid);
  if ($('btnRetry')) $('btnRetry').style.display = 'none';
  const scope = selected.length ? `${selected.length} 门` : '全部课程';
  if (!(await showConfirm(`即将开始刷课\n课程：${scope}\n倍速：${currentSpeed}x\n\n确定开始？`))) return;
  $('btnStart').disabled = true;
  $('btnStop').disabled = false;
  $('btnPause').disabled = false;
  $('btnPause').textContent = '暂停';
  isPaused = false;
  runStart = Date.now();
  if (!selected.length) {
    addLog('[WARN] 未勾选课程，将刷全部课程');
  } else {
    addLog(`[INFO] 开始刷课，已选 ${selected.length} 门，倍速 ${currentSpeed}x`);
  }
  await window.api.start(selected, currentSpeed);
});

// 重试
if ($('btnRetry')) {
  $('btnRetry').addEventListener('click', () => {
    $('btnRetry').style.display = 'none';
    $('btnStart').click();
  });
}

// 停止
$('btnStop').addEventListener('click', async () => {
  if (!(await showConfirm('确定要停止刷课吗？'))) return;
  await window.api.stop();
  addLog('[INFO] 已发送停止指令');
  $('btnStop').disabled = true;
  $('btnStart').disabled = false;
  $('btnPause').disabled = true;
  isPaused = false;
  $('btnPause').textContent = '暂停';
  runStart = 0;
});

// 刷新会话（刷课卡住时用）
if ($('btnRefresh')) {
  $('btnRefresh').addEventListener('click', async () => {
    const btn = $('btnRefresh');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '刷新中';
    addLog('[INFO] 正在重置浏览器会话...');
    try {
      const r = await window.api.refreshSession();
      if (r && r.ok) {
        addLog('[INFO] 会话已重置，正在重新读取课程...');
        $('btnStart').disabled = false;
        $('btnStop').disabled = true;
        $('btnPause').disabled = true;
        isPaused = false;
        $('btnPause').textContent = '暂停';
        runStart = 0;
        btn.textContent = '刷新';
        btn.disabled = false;
        $('btnLoad').click();
        return;
      }
      addLog(`[ERROR] 刷新失败：${(r && r.error) || '未知错误'}`);
    } catch (e) {
      addLog(`[ERROR] 刷新失败：${e.message}`);
    }
    btn.textContent = '刷新';
    btn.disabled = false;
  });
}

// ===== 日志字号 =====
function applyLogFont(v) {
  document.documentElement.style.setProperty('--log-font', v + 'px');
  document.querySelectorAll('button[data-logfont]').forEach((b) => {
    b.classList.toggle('active', b.dataset.logfont === String(v));
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-logfont]');
  if (!b) return;
  applyLogFont(b.dataset.logfont);
  try { localStorage.setItem('xxt-logfont', b.dataset.logfont); } catch (err) {}
});
(function initLogFont() {
  let v = '12';
  try { v = localStorage.getItem('xxt-logfont') || '12'; } catch (e) {}
  applyLogFont(v);
})();

// 设置项搜索
if ($('setSearch')) {
  $('setSearch').addEventListener('input', (e) => {
    const q = (e.target.value || '').trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.settings-body .set-item').forEach((item) => {
      const t = (item.textContent || '').toLowerCase();
      const show = !q || t.includes(q);
      item.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    const tip = $('setNoResult');
    if (tip) tip.style.display = q && visible === 0 ? '' : 'none';
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($('settingsMask') && $('settingsMask').classList.contains('show')) {
      $('settingsMask').classList.remove('show');
      e.stopPropagation();
    }
    if ($('hwMask') && $('hwMask').classList.contains('show')) {
      $('hwMask').classList.remove('show');
      e.stopPropagation();
    }
  }
}, true);

// 日志开关持久化
(function initLogToggles() {
  try {
    if (localStorage.getItem('xxt-logauto') === '0' && $('logAuto')) $('logAuto').checked = false;
    if (localStorage.getItem('xxt-logreverse') === '1' && $('logReverse')) $('logReverse').checked = true;
  } catch (e) {}
  if ($('logAuto')) $('logAuto').addEventListener('change', () => {
    try { localStorage.setItem('xxt-logauto', $('logAuto').checked ? '1' : '0'); } catch (e) {}
  });
  if ($('logReverse')) $('logReverse').addEventListener('change', () => {
    try { localStorage.setItem('xxt-logreverse', $('logReverse').checked ? '1' : '0'); } catch (e) {}
  });
})();

// 设置分组折叠
(function initCollapse() {
  const KEY = 'xxt-collapsed';
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) {}
  document.querySelectorAll('.settings-body .set-item').forEach((item, idx) => {
    const label = item.querySelector('.set-label');
    if (!label) return;
    label.classList.add('collapsible');
    if (saved.includes(idx)) item.classList.add('collapsed');
    label.addEventListener('click', () => {
      item.classList.toggle('collapsed');
      const cur = [];
      document.querySelectorAll('.settings-body .set-item').forEach((it, i) => {
        if (it.classList.contains('collapsed')) cur.push(i);
      });
      try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {}
    });
  });
})();

function getRunHistory() {
  try { return JSON.parse(localStorage.getItem('xxt-run-history') || '[]'); } catch (e) { return []; }
}
function addRunHistory(rec) {
  const h = getRunHistory();
  h.unshift(rec);
  if (h.length > 30) h.length = 30;
  try { localStorage.setItem('xxt-run-history', JSON.stringify(h)); } catch (e) {}
  renderRunHistory();
}
function renderRunHistory() {
  const box = $('runHistoryList');
  if (!box) return;
  const h = getRunHistory();
  if (!h.length) { box.innerHTML = '<div class="empty">暂无记录</div>'; return; }
  box.innerHTML = h.slice(0, 10).map((r) => `
    <div class="history-row"><span>${new Date(r.at).toLocaleString()}</span><b>完成 ${r.done} · 跳过 ${r.skipped}</b></div>
  `).join('');
}

// 初始化历史列表
setTimeout(renderRunHistory, 100);

// ===== 通知中心 =====
let notifications = [];
try { notifications = JSON.parse(localStorage.getItem('xxt-notify') || '[]'); } catch (e) {}
if (!Array.isArray(notifications)) notifications = [];

function saveNotify() {
  try { localStorage.setItem('xxt-notify', JSON.stringify(notifications.slice(0, 50))); } catch (e) {}
}
function renderNotify() {
  const unread = notifications.filter((n) => !n.read).length;
  const badge = $('notifyCount');
  if (badge) {
    badge.textContent = String(unread);
    badge.style.display = unread ? '' : 'none';
  }
  const list = $('notifyList');
  if (!list) return;
  if (!notifications.length) {
    list.innerHTML = '<div class="empty">暂无通知</div>';
    return;
  }
  list.innerHTML = notifications.map((n, i) => `
    <div class="notify-item ${n.type || ''} ${n.read ? 'read' : ''}" data-i="${i}">
      <span>${escapeHtml(n.text)}</span>
      <span class="nt-time">${new Date(n.at).toLocaleString()}</span>
    </div>
  `).join('');
}
function addNotify(text, type = 'info') {
  notifications.unshift({ text: String(text), type, at: Date.now(), read: false });
  if (notifications.length > 50) notifications.length = 50;
  saveNotify();
  renderNotify();
}

if ($('btnNotify')) {
  $('btnNotify').addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = $('notifyPop');
    pop.classList.toggle('show');
    if (pop.classList.contains('show')) {
      notifications.forEach((n) => { n.read = true; });
      saveNotify();
      setTimeout(renderNotify, 300);
    }
  });
}
if ($('btnNotifyClear')) {
  $('btnNotifyClear').addEventListener('click', () => {
    notifications = [];
    saveNotify();
    renderNotify();
  });
}
if ($('notifyList')) {
  $('notifyList').addEventListener('click', (e) => {
    const item = e.target.closest('.notify-item');
    if (!item) return;
    const n = notifications[Number(item.dataset.i)];
    if (n) { n.read = true; saveNotify(); renderNotify(); }
  });
}
document.addEventListener('click', (e) => {
  const pop = $('notifyPop');
  if (pop && !pop.contains(e.target) && e.target !== $('btnNotify') && !$('btnNotify').contains(e.target)) {
    pop.classList.remove('show');
  }
});
renderNotify();

// ===== 命令面板（Ctrl+P）=====
const COMMANDS = [
  { label: '读取我的课程', keys: 'Ctrl+L', run: () => $('btnLoad') && $('btnLoad').click() },
  { label: '开始刷课', keys: 'Ctrl+Enter', run: () => $('btnStart') && $('btnStart').click() },
  { label: '暂停 / 继续', keys: '', run: () => $('btnPause') && $('btnPause').click() },
  { label: '停止刷课', keys: 'Esc', run: () => $('btnStop') && $('btnStop').click() },
  { label: '刷新会话', keys: 'Ctrl+R', run: () => $('btnRefresh') && $('btnRefresh').click() },
  { label: '清除断点重刷', keys: '', run: () => $('btnClear') && $('btnClear').click() },
  { label: '打开设置', keys: 'Ctrl+,', run: () => $('btnSettings') && $('btnSettings').click() },
  { label: '作业答题', keys: 'Ctrl+D', run: () => $('btnHomework') && $('btnHomework').click() },
  { label: '切换主题', keys: '', run: () => $('btnTheme') && $('btnTheme').click() },
  { label: '导出日志', keys: '', run: () => $('btnExportLog') && $('btnExportLog').click() },
  { label: '导出设置', keys: '', run: () => $('btnExportSettings') && $('btnExportSettings').click() },
  { label: '关于', keys: '', run: () => $('btnAbout') && $('btnAbout').click() },
];

let cmdIndex = 0;
let cmdFiltered = COMMANDS.slice();

function renderCmd() {
  const box = $('cmdList');
  if (!box) return;
  if (!cmdFiltered.length) {
    box.innerHTML = '<div class="empty">没有匹配的命令</div>';
    return;
  }
  box.innerHTML = cmdFiltered.map((c, i) => `
    <div class="cmd-item ${i === cmdIndex ? 'active' : ''}" data-i="${i}">
      <span>${escapeHtml(c.label)}</span>
      <span class="kbd">${escapeHtml(c.keys || '')}</span>
    </div>
  `).join('');
  const active = box.querySelector('.cmd-item.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function openCmd() {
  const mask = $('cmdMask');
  if (!mask) return;
  mask.classList.add('show');
  const input = $('cmdInput');
  if (input) { input.value = ''; input.focus(); }
  cmdIndex = 0;
  cmdFiltered = COMMANDS.slice();
  renderCmd();
}

function closeCmd() {
  const mask = $('cmdMask');
  if (mask) mask.classList.remove('show');
}

function runCmd(c) {
  if (!c) return;
  closeCmd();
  try { c.run(); } catch (e) {}
}

if ($('cmdInput')) {
  $('cmdInput').addEventListener('input', (e) => {
    const q = (e.target.value || '').trim().toLowerCase();
    cmdFiltered = COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
    cmdIndex = 0;
    renderCmd();
  });
  $('cmdInput').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cmdIndex = Math.min(cmdFiltered.length - 1, cmdIndex + 1);
      renderCmd();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cmdIndex = Math.max(0, cmdIndex - 1);
      renderCmd();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCmd(cmdFiltered[cmdIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCmd();
    }
  });
}
if ($('cmdList')) {
  $('cmdList').addEventListener('click', (e) => {
    const item = e.target.closest('.cmd-item');
    if (!item) return;
    runCmd(cmdFiltered[Number(item.dataset.i)]);
  });
  $('cmdList').addEventListener('mousemove', (e) => {
    const item = e.target.closest('.cmd-item');
    if (!item) return;
    const i = Number(item.dataset.i);
    if (i !== cmdIndex) { cmdIndex = i; renderCmd(); }
  });
}
if ($('cmdMask')) {
  $('cmdMask').addEventListener('click', (e) => {
    if (e.target === $('cmdMask')) closeCmd();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault();
    openCmd();
  }
});

// 日志过滤/搜索状态恢复
(function restoreLogFilters() {
  try {
    const f = localStorage.getItem('xxt-logfilter');
    if (f && $('logFilter')) $('logFilter').value = f;
    const s = localStorage.getItem('xxt-logsearch');
    if (s && $('logSearch')) $('logSearch').value = s;
  } catch (e) {}
  if ($('logFilter')) $('logFilter').addEventListener('change', () => {
    try { localStorage.setItem('xxt-logfilter', $('logFilter').value); } catch (e) {}
  });
  if ($('logSearch')) $('logSearch').addEventListener('input', () => {
    try { localStorage.setItem('xxt-logsearch', $('logSearch').value); } catch (e) {}
  });
  setTimeout(applyLogFilter, 50);
})();

// ===== 作业答题 =====
let hwWorks = [];
let hwQuestions = [];
let hwAnswers = [];

function hwCurrentCourse() {
  const checked = document.querySelector('#courseList input:checked');
  if (checked) {
    const c = courses.find((x) => x.courseId === checked.dataset.cid);
    if (c) return c;
  }
  return courses[0] || null;
}

function renderHwWorks() {
  const box = $('hwList');
  if (!box) return;
  if (!hwWorks.length) { box.innerHTML = '<div class="empty">没有读取到作业</div>'; return; }
  box.innerHTML = hwWorks.map((w, i) => `
    <div class="hw-item ${w.done ? 'done' : ''}" data-i="${i}">
      <span>${escapeHtml(w.title)}</span>
      <span class="st">${w.done ? '已提交' : '未提交'}</span>
    </div>
  `).join('');
}

function renderHwQuestions() {
  const box = $('hwQuestions');
  if (!box) return;
  if (!hwQuestions.length) { box.innerHTML = ''; return; }
  box.innerHTML = hwQuestions.map((q, i) => {
    const ans = hwAnswers.find((a) => a.index === q.index);
    const val = ans ? escapeHtml(ans.answer) : '';
    const isEssay = q.type === 'essay' || q.hasTextarea;
    const field = isEssay
      ? `<textarea class="hw-ans" data-qi="${i}" rows="2" placeholder="简答题答案">${val}</textarea>`
      : `<input class="hw-ans" data-qi="${i}" value="${val}" placeholder="选项字母，如 A 或 AC" />`;
    return `<div class="hw-q">
      <div class="stem">${q.index}. ${escapeHtml(q.stem)}</div>
      <div class="ans-line">${field}<button class="mini hw-copy" data-copy="${i}" title="复制答案">复制</button></div>
    </div>`;
  }).join('');
}

if ($('btnHomework')) {
  $('btnHomework').addEventListener('click', () => {
    $('hwMask').classList.add('show');
    if (!courses.length) addLog('[WARN] 请先「读取我的课程」');
  });
}
if ($('hwClose')) $('hwClose').addEventListener('click', () => {
  $('hwMask').classList.remove('show');
  if ($('hwSearch')) $('hwSearch').value = '';
  document.querySelectorAll('#hwList .hw-item').forEach((i) => { i.style.display = ''; });
});

if ($('hwSearch')) {
  $('hwSearch').addEventListener('input', (e) => {
    const q = (e.target.value || '').trim().toLowerCase();
    document.querySelectorAll('#hwList .hw-item').forEach((item) => {
      item.style.display = !q || (item.textContent || '').toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

if ($('hwListBtn')) {
  $('hwListBtn').addEventListener('click', async () => {
    const course = hwCurrentCourse();
    if (!course) { addLog('[WARN] 没有课程，请先读取'); return; }
    if ($('hwHint')) $('hwHint').textContent = `课程：${course.title}`;
    addLog(`[INFO] 读取作业列表：${course.title}`);
    try {
      const r = await window.api.homeworkList(course);
      if (r.ok) {
        hwWorks = r.works || [];
        renderHwWorks();
        addLog(`[INFO] 共 ${hwWorks.length} 个作业`);
      } else {
        addLog(`[ERROR] ${r.error}`);
      }
    } catch (e) { addLog(`[ERROR] ${e.message}`); }
  });
}

if ($('hwList')) {
  $('hwList').addEventListener('click', async (e) => {
    const item = e.target.closest('.hw-item');
    if (!item) return;
    const w = hwWorks[Number(item.dataset.i)];
    if (!w) return;
    addLog(`[INFO] 打开作业：${w.title}`);
    try {
      const r = await window.api.homeworkOpen(w);
      if (!r.ok) { addLog(`[ERROR] ${r.error}`); return; }
      if (r.clicked === false) {
        addLog('[WARN] 未能自动点击「做作业」，请在 Edge 中手动打开');
        showToast('未能自动打开作业，请在 Edge 中手动点「做作业」');
        return;
      }
      const p = await window.api.homeworkParse();
      if (p.ok) {
        hwQuestions = p.questions || [];
        hwAnswers = [];
        renderHwQuestions();
        $('hwAnswerBtn').disabled = hwQuestions.length === 0;
        $('hwFillBtn').disabled = true;
        $('hwSubmitBtn').disabled = true;
        addLog(`[INFO] 抓到 ${hwQuestions.length} 道题`);
        if ($('hwHint')) $('hwHint').textContent = `已抓取 ${hwQuestions.length} 题`;
        if (hwQuestions.length === 0) {
          showToast('未抓到题目，请确认 Edge 已打开作业答题页');
        }
      } else {
        addLog(`[ERROR] ${p.error}`);
      }
    } catch (e) { addLog(`[ERROR] ${e.message}`); }
  });
}

function loadAnswerBank() {
  try { return JSON.parse(localStorage.getItem('xxt-answer-bank') || '{}'); } catch (e) { return {}; }
}
function saveAnswerBank(b) {
  try { localStorage.setItem('xxt-answer-bank', JSON.stringify(b)); } catch (e) {}
}

if ($('hwAnswerBtn')) {
  $('hwAnswerBtn').addEventListener('click', async () => {
    if (!hwQuestions.length) return;
    const aiKey = (localStorage.getItem('xxt-ai-key') || '').trim();
    if (!aiKey) {
      showToast('未填写 API Key，请到「设置 → AI 答题」中填写', 'warn');
      addLog('[WARN] 未填写 DeepSeek API Key，请先到设置里配置');
      return;
    }
    $('hwAnswerBtn').disabled = true;
    $('hwAnswerBtn').textContent = '答题中...';
    try {
      const bank = loadAnswerBank();
      const answers = [];
      const miss = [];
      hwQuestions.forEach((q) => {
        const key = (q.stem || '').slice(0, 120);
        if (bank[key]) answers.push({ index: q.index, answer: bank[key] });
        else miss.push(q);
      });
      if (answers.length) addLog(`[INFO] 题库命中 ${answers.length} 题`);

      if (miss.length) {
        const r = await window.api.homeworkAnswer(miss);
        if (!r.ok) {
          addLog(`[ERROR] ${r.error}`);
        } else {
          (r.answers || []).forEach((a) => {
            answers.push(a);
            const q = miss.find((x) => x.index === a.index);
            if (q) bank[(q.stem || '').slice(0, 120)] = a.answer;
          });
          saveAnswerBank(bank);
          addLog(`[INFO] AI 已给出 ${(r.answers || []).length} 个答案`);
        }
      }

      hwAnswers = answers.sort((a, b) => a.index - b.index);
      renderHwQuestions();
      $('hwFillBtn').disabled = hwAnswers.length === 0;
    } catch (e) { addLog(`[ERROR] ${e.message}`); }
    $('hwAnswerBtn').disabled = false;
    $('hwAnswerBtn').textContent = 'AI 答题';
  });
}

if ($('hwQuestions')) {
  $('hwQuestions').addEventListener('click', (e) => {
    const b = e.target.closest('.hw-copy');
    if (!b) return;
    const q = hwQuestions[Number(b.dataset.copy)];
    if (!q) return;
    const ans = hwAnswers.find((a) => a.index === q.index);
    if (ans) {
      try { window.api.copyText(String(ans.answer)); showToast('已复制答案', 'success'); } catch (err) {}
    }
  });
  $('hwQuestions').addEventListener('input', (e) => {
    const inp = e.target.closest('input[data-qi], textarea[data-qi]');
    if (!inp) return;
    const q = hwQuestions[Number(inp.dataset.qi)];
    if (!q) return;
    const idx = hwAnswers.findIndex((a) => a.index === q.index);
    if (idx >= 0) hwAnswers[idx].answer = inp.value;
    else hwAnswers.push({ index: q.index, answer: inp.value });
  });
}

if ($('hwFillBtn')) {
  $('hwFillBtn').addEventListener('click', async () => {
    if (!hwAnswers.length) return;
    try {
      const r = await window.api.homeworkFill(hwAnswers);
      if (r.ok) {
        addLog(`[INFO] 已填写 ${r.result.filled} 题，失败 ${r.result.failed} 题`);
        $('hwSubmitBtn').disabled = false;
      } else {
        addLog(`[ERROR] ${r.error}`);
      }
    } catch (e) { addLog(`[ERROR] ${e.message}`); }
  });
}

if ($('hwSubmitBtn')) {
  $('hwSubmitBtn').addEventListener('click', async () => {
    if (!(await showConfirm('确定提交作业吗？提交后通常无法修改。'))) return;
    try {
      const r = await window.api.homeworkSubmit();
      if (r.ok && r.clicked) addLog('[INFO] 已点击提交，请在 Edge 中确认结果');
      else addLog('[WARN] 未找到提交按钮，请在 Edge 中手动提交');
    } catch (e) { addLog(`[ERROR] ${e.message}`); }
  });
}

// AI 配置
const AI_KEY = 'xxt-ai-key';
const AI_MODEL = 'xxt-ai-model';
const aiKeyEl = document.getElementById('aiKey');
const aiModelEl = document.getElementById('aiModel');

function applyAiConfig() {
  let key = '', model = 'deepseek-chat';
  try {
    key = localStorage.getItem(AI_KEY) || '';
    model = localStorage.getItem(AI_MODEL) || 'deepseek-chat';
  } catch (e) {}
  if (aiKeyEl) aiKeyEl.value = key;
  if (aiModelEl) aiModelEl.value = model;
  try { window.api.aiConfig({ apiKey: key, model }); } catch (e) {}
}
if (aiKeyEl) {
  aiKeyEl.addEventListener('change', () => {
    try { localStorage.setItem(AI_KEY, aiKeyEl.value.trim()); } catch (e) {}
    applyAiConfig();
  });
}
if (aiModelEl) {
  aiModelEl.addEventListener('change', () => {
    try { localStorage.setItem(AI_MODEL, aiModelEl.value); } catch (e) {}
    applyAiConfig();
  });
}
applyAiConfig();

// 清除断点重刷
$('btnClear').addEventListener('click', async () => {
  try {
    const res = await window.api.clearState();
    if (res && res.ok) {
      addLog('[WARN] 已清除断点，下次将重新刷课');
    } else {
      addLog('[ERROR] 清除断点失败: ' + (res && res.error ? res.error : '未知错误'));
    }
  } catch (e) {
    addLog('[ERROR] 清除断点失败: ' + e.message);
  }
});

// 日志：复制 / 清空 / 自动滚动
$('btnCopyLog').addEventListener('click', async () => {
  const body = [...document.querySelectorAll('#log > div')].map((d) => d.textContent).join('\n');
  const text = `学习通刷课助手 运行日志\n导出时间：${new Date().toLocaleString()}\n${'─'.repeat(30)}\n${body}`;
  try {
    const r = await window.api.copyText(text);
    if (r && r.ok) addLog('[INFO] 日志已复制到剪贴板');
    else addLog('[ERROR] 复制失败');
  } catch (e) {
    addLog('[ERROR] 复制失败：' + e.message);
  }
});
$('btnClearLog').addEventListener('click', async () => {
  if (!(await showConfirm('清空界面日志和日志文件？'))) return;
  $('log').innerHTML = '';
  logErrorCount = 0;
  logStatsCount.info = 0;
  logStatsCount.warn = 0;
  logStatsCount.error = 0;
  updateLogStats();
  if ($('logErrCount')) $('logErrCount').style.display = 'none';
  try { window.api.clearLogFile(); } catch (e) {}
});
$('log').addEventListener('dblclick', (e) => {
  const d = e.target.closest('div');
  if (!d) return;
  try { window.api.copyText(d.textContent); showToast('已复制该行', 'success'); } catch (err) {}
});

// 导出日志
$('btnExportLog').addEventListener('click', async () => {
  try {
    const r = await window.api.exportLog();
    if (r && r.ok) addLog(`[INFO] 日志已导出：${r.path}`);
    else if (r && r.error) addLog(`[ERROR] 导出失败：${r.error}`);
  } catch (e) {
    addLog(`[ERROR] 导出失败：${e.message}`);
  }
});

// 快捷键
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    if (!$('btnStart').disabled) $('btnStart').click();
  } else if (e.key === 'Escape') {
    if (!$('btnStop').disabled) $('btnStop').click();
  } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
    e.preventDefault();
    if (!$('btnLoad').disabled) $('btnLoad').click();
  } else if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault();
    if ($('courseSearch')) {
      $('courseSearch').focus();
      $('courseSearch').select();
    }
  } else if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault();
    if ($('btnHomework')) $('btnHomework').click();
  } else if (e.ctrlKey && e.key === ',') {
    e.preventDefault();
    if ($('btnSettings')) $('btnSettings').click();
  } else if (e.ctrlKey && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault();
    if ($('btnRefresh') && !$('btnRefresh').disabled) $('btnRefresh').click();
  }
});

// 窗口按钮
$('btnMin').addEventListener('click', () => window.api.minimize());
$('btnClose').addEventListener('click', () => window.api.close());
if ($('btnMax')) $('btnMax').addEventListener('click', () => window.api.toggleMax());

function setStats(s) {
  if (!s) return;
  if ($('stDone')) $('stDone').textContent = s.done ?? 0;
  if ($('stSkip')) $('stSkip').textContent = s.skipped ?? 0;
  if ($('stQuiz')) $('stQuiz').textContent = s.quiz ?? 0;
  if ($('stFail')) $('stFail').textContent = s.failed ?? 0;
  if (s.dailyMinutes != null && $('stDaily')) $('stDaily').textContent = s.dailyMinutes;
  if (s.dailyLimit != null && $('stLimit')) $('stLimit').textContent = s.dailyLimit > 0 ? s.dailyLimit : '∞';
  if (s.courseIndex != null && s.courseTotal != null && $('stCourse')) {
    $('stCourse').textContent = `${s.courseIndex}/${s.courseTotal}`;
  }
  // 预计剩余时间 + 剩余章节
  if (s.current != null && s.total) {
    const remainN = Math.max(0, s.total - (s.current || 0));
    if ($('stRemainCount')) $('stRemainCount').textContent = String(remainN);
    if (runStart && s.current > 0) {
      const per = (Date.now() - runStart) / s.current;
      const etaMin = Math.round((per * remainN) / 60000);
      if ($('stEta')) $('stEta').textContent = etaMin > 0 ? `${etaMin} 分` : '-';
    }
  }
  if (s.failed != null && $('stFail')) {
    $('stFail').classList.toggle('err', Number(s.failed) > 0);
  }
  // 今日学习进度
  const dm = s.dailyMinutes != null ? s.dailyMinutes : 0;
  const dl = s.dailyLimit != null ? s.dailyLimit : 0;
  if ($('dailyBar')) {
    if (dl > 0) {
      $('dailyBar').style.width = Math.min(100, (dm / dl) * 100) + '%';
      $('stRemain').textContent = `今日剩余额度 ${Math.max(0, dl - dm)} 分钟`;
    } else {
      $('dailyBar').style.width = '0%';
      $('stRemain').textContent = '今日不限时长';
    }
  }
}

// 事件接收
window.api.onEvent((ev) => {
  if (!ev) return;
  if (ev.type === 'stage') {
    $('stage').textContent = ev.text || '';
  } else if (ev.type === 'progress') {
    if (ev.pct != null) {
      $('bar').style.width = Math.min(100, ev.pct) + '%';
      $('bar').style.background = ev.pct >= 70 ? '' : (ev.pct >= 30 ? 'linear-gradient(90deg,#ffb020,#ffd166)' : 'linear-gradient(90deg,#e5484d,#ff8a80)');
      if ($('bar').parentElement) $('bar').parentElement.title = `进度 ${ev.pct}%`;
    } else {
      const m = (ev.text || '').match(/(\d+)\s*\/\s*(\d+)/);
      if (m) {
        const pct = Math.min(100, Math.round((parseInt(m[1]) / parseInt(m[2])) * 100));
        $('bar').style.width = pct + '%';
        if ($('bar').parentElement) $('bar').parentElement.title = `进度 ${pct}%`;
      }
    }
    if (ev.text) $('stage').textContent = ev.text;
  } else if (ev.type === 'toggle-pause') {
    if (!$('btnPause').disabled) $('btnPause').click();
  } else if (ev.type === 'log') {
    addLog(ev.text || '');
  } else if (ev.type === 'courses') {
    if (Array.isArray(ev.courses)) courses = ev.courses;
  } else if (ev.type === 'stats') {
    setStats(ev);
    // 章节整体进度（视频播放时会被视频进度覆盖）
    if (ev.total > 0) {
      const pct = Math.max(0, Math.min(100, Math.round(((ev.current || 0) / ev.total) * 100)));
      $('bar').style.width = pct + '%';
    }
  } else if (ev.type === 'summary') {
    playBeep(660, 0.3, 0.08);
    addRunHistory({ at: Date.now(), done: ev.done || 0, skipped: ev.skipped || 0, failed: ev.failed || 0 });
    setStats(ev);
    addLog(`[INFO] 本次汇总：完成 ${ev.done}，跳过 ${ev.skipped}，章节测验 ${ev.quiz}，失败 ${ev.failed}；今日已学 ${ev.dailyMinutes} 分钟`);
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
    $('btnPause').disabled = true;
    isPaused = false;
    $('btnPause').textContent = '暂停';
    runStart = 0;
    // 正常刷完（非手动停止）→ 收起课程列表，回到初始状态
    if (ev.finished) {
      resetCourseList();
      $('stage').textContent = '全部课程已刷完，可再次点击「读取我的课程」';
      addNotify('全部课程已刷完', 'success');
      try {
        window.api.notify({
          title: '刷课完成',
          body: `完成 ${ev.done} 节，跳过 ${ev.skipped} 节`,
        });
      } catch (e) {}
    }
  } else if (ev.type === 'error') {
    addLog('[ERROR] ' + (ev.text || ''));
    addNotify('运行错误：' + (ev.text || ''), 'error');
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
    $('btnPause').disabled = true;
    isPaused = false;
    $('btnPause').textContent = '暂停';
    runStart = 0;
    if ($('btnRetry')) $('btnRetry').style.display = '';
  } else if (ev.type === 'challenge') {
    playBeep(880, 0.4, 0.12);
    addNotify(`检测到人工验证：${ev.text || ''}`, 'warn');
    addLog('[WARN] ⚠ 检测到人工验证：' + (ev.text || '') + '，已自动停止，请手动完成');
    $('stage').textContent = '需要人工验证，已暂停';
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
  } else if (ev.type === 'limit') {
    playBeep(440, 0.5, 0.12);
    addNotify(`平台限制：${ev.text || ''}`, 'warn');
    addLog('[WARN] ⚠ 平台提示：' + (ev.text || '') + '，已停止');
    $('stage').textContent = '已达平台上限，已停止';
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
  } else if (ev.type === 'quiz') {
    addLog('[WARN] ' + (ev.text || '') + (ev.file ? `（截图：${ev.file}）` : ''));
  } else if (ev.type === 'courseDone') {
    playBeep(1100, 0.2, 0.08);
    addNotify(`《${ev.title || '课程'}》已全部刷完`, 'success');
    showCourseDone(ev.title || '');
    try {
      window.api.notify({ title: '课程完成', body: `《${ev.title}》已全部刷完` });
    } catch (e) {}
  }
});

// ===== 全绿庆祝：隐藏全部 UI + 满屏大烟花 =====
function showCourseDone(title) {
  if (title) addLog(`[INFO] 《${title}》已完成`);
  if (document.body.classList.contains('celebrating')) {
    if (title) showToast(`《${title}》已完成`);
    return;
  }
  fireGrandFirework(1500, () => {
    if (title) showToast(`《${title}》已完成`);
  });
}

/** 顶部提示条 */
let toastTimer = null;
let lastToast = { text: '', at: 0 };
function showToast(text, type = 'info') {
  const now = Date.now();
  if (text === lastToast.text && now - lastToast.at < 3000) return;
  lastToast = { text, at: now };
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.className = `toast ${type}`;
  t.textContent = text;
  // 强制重排后再加 show，保证过渡生效
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function fireGrandFirework(duration = 1500, onDone) {
  if (document.body.classList.contains('celebrating')) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'firework-canvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const colors = ['#ff8c1a', '#ffd166', '#ff6b6b', '#ffffff', '#7bdff2', '#b388ff', '#4dd4ac'];
  const bursts = [];

  function spawnBurst(x, y, color, count) {
    const parts = [];
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.08;
      const sp = 2.5 + Math.random() * 8;
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: 1.5 + Math.random() * 2.5,
        color: color || colors[(Math.random() * colors.length) | 0],
        life: 1,
        decay: 0.007 + Math.random() * 0.01,
      });
    }
    bursts.push(parts);
  }

  // 只放一个居中的大烟花
  spawnBurst(W * 0.5, H * 0.45, null, 380);

  // 烟花先画出来，下一帧再同时：烟花渐显 + UI 渐隐，避免出现全黑空档
  requestAnimationFrame(() => {
    canvas.classList.add('show');
    document.body.classList.add('celebrating');
  });

  const start = performance.now();
  function frame(now) {
    const t = now - start;

    // 拖尾残影
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, 0, W, H);

    // 发光叠加
    ctx.globalCompositeOperation = 'lighter';
    for (const ps of bursts) {
      for (const p of ps) {
        if (p.life <= 0) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.025;
        p.vx *= 0.986;
        p.vy *= 0.986;
        p.life -= p.decay;
        if (p.life <= 0) continue;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (t < duration) {
      requestAnimationFrame(frame);
    } else {
      // 渐出：烟花淡出 + UI 渐显，过渡结束后再移除画布
      canvas.classList.remove('show');
      document.body.classList.remove('celebrating');
      setTimeout(() => canvas.remove(), 300);
      if (typeof onDone === 'function') onDone();
    }
  }
  requestAnimationFrame(frame);
}

// ===== 光标橙色光晕 =====
const glowEl = document.getElementById('cursor-glow');
if (glowEl) {
  document.addEventListener('mousemove', (e) => {
    glowEl.style.transform = `translate(${e.clientX - 70}px, ${e.clientY - 70}px)`;
    glowEl.classList.add('on');
  });
  document.addEventListener('mouseleave', () => glowEl.classList.remove('on'));
}

// ===== 3D 倾斜光影：鼠标跟随（Q 弹） =====
document.querySelectorAll('.section').forEach((el) => {
  el.addEventListener('mouseenter', () => {
    // 跟手：短而平滑，避免跳变
    el.style.transition = 'transform .18s cubic-bezier(.22, 1, .36, 1)';
  });
  el.addEventListener('mousemove', (e) => {
    if (window.innerWidth > 900) return; // 宽屏/全屏不做 3D 倾斜
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${(px * 9).toFixed(2)}deg) rotateX(${(-py * 9).toFixed(2)}deg) translateY(-2px) scale(1.006)`;
  });
  el.addEventListener('mouseleave', () => {
    // 离开：弹性回弹（带过冲，Q 弹）
    el.style.transition = 'transform .62s cubic-bezier(.34, 1.56, .64, 1)';
    el.style.transform = '';
  });
});

let logErrorCount = 0;
const logStatsCount = { info: 0, warn: 0, error: 0 };
function updateLogStats() {
  const el = $('logStats');
  if (!el) return;
  el.textContent = `信息 ${logStatsCount.info} · 警告 ${logStatsCount.warn} · 错误 ${logStatsCount.error}`;
}

let filterTimer = null;
function scheduleLogFilter() {
  if (filterTimer) return;
  filterTimer = setTimeout(() => { filterTimer = null; applyLogFilter(); }, 150);
}

function addLog(line) {
  const box = $('log');
  const div = document.createElement('div');
  let level = 'info';
  if (/\[WARN\]/.test(line)) level = 'warn';
  if (/\[ERROR\]/.test(line)) level = 'error';
  div.dataset.level = level;
  if (level !== 'info') div.className = level;
  const text = String(line).length > 500 ? String(line).slice(0, 500) + '…' : String(line);
  div.textContent = text;
  div.title = String(line);
  if (level === 'error') {
    logErrorCount++;
    const badge = $('logErrCount');
    if (badge) { badge.textContent = String(logErrorCount); badge.style.display = ''; }
  }
  logStatsCount[level] = (logStatsCount[level] || 0) + 1;
  updateLogStats();
  const reverse = $('logReverse') && $('logReverse').checked;
  if (reverse) box.insertBefore(div, box.firstChild);
  else box.appendChild(div);
  if (!$('logAuto') || $('logAuto').checked) {
    box.scrollTop = reverse ? 0 : box.scrollHeight;
  }
  while (box.childNodes.length > 500) box.removeChild(reverse ? box.lastChild : box.firstChild);
  scheduleLogFilter();
}

// 日志过滤
function applyLogFilter() {
  const sel = $('logFilter');
  if (!sel) return;
  const f = sel.value;
  const q = ($('logSearch') ? ($('logSearch').value || '').trim().toLowerCase() : '');
  document.querySelectorAll('#log > div').forEach((d) => {
    const lv = d.dataset.level || 'info';
    const text = (d.textContent || '').toLowerCase();
    const okLevel = f === 'all' || lv === f;
    const okSearch = !q || text.includes(q);
    d.style.display = okLevel && okSearch ? '' : 'none';
  });
}
$('logFilter').addEventListener('change', applyLogFilter);
if ($('logSearch')) $('logSearch').addEventListener('input', applyLogFilter);
