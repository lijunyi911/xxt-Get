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

// 启动淡入
requestAnimationFrame(() => document.body.classList.add('ready'));
setTimeout(() => document.body.classList.add('ready'), 1500);

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

  const root = document.documentElement.style;
  root.setProperty('--accent', accent);
  root.setProperty('--accent2', accent2);
  root.setProperty('--accent3', accent3);
  root.setProperty('--on-accent', onAccent);
  root.setProperty('--hover-text', accent3);

  document.querySelectorAll('.color-dot').forEach((b) => {
    const p = ACCENT_PRESETS[b.dataset.accent];
    b.classList.toggle('active', !!p && p.toLowerCase() === String(hex).toLowerCase());
  });
  const picker = document.getElementById('accentPicker');
  if (picker) picker.value = hex;
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

// 颜色轮盘：任意颜色
const accentPicker = document.getElementById('accentPicker');
if (accentPicker) {
  accentPicker.addEventListener('input', (e) => {
    currentAccentHex = e.target.value;
    applyAccentHex(currentAccentHex);
  });
  accentPicker.addEventListener('change', (e) => {
    currentAccentHex = e.target.value;
    applyAccentHex(currentAccentHex);
    try { localStorage.setItem(ACCENT_KEY, currentAccentHex); } catch (err) {}
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

// ===== 设置导出 / 导入 =====
if ($('btnExportSettings')) {
  $('btnExportSettings').addEventListener('click', async () => {
    const data = {};
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
      const data = JSON.parse(r.content);
      Object.keys(data).forEach((k) => {
        if (k.startsWith('xxt-')) localStorage.setItem(k, data[k]);
      });
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
  btnSettings.addEventListener('click', () => settingsMask.classList.add('show'));
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
  btnResetOpt.addEventListener('click', () => {
    if (!confirm('恢复所有设置到默认值？')) return;
    try { localStorage.clear(); } catch (e) {}
    location.reload();
  });
}
const btnAbout = document.getElementById('btnAbout');
if (btnAbout) {
  btnAbout.addEventListener('click', () => {
    alert('学习通刷课助手 v1.2.0\n\nhttps://github.com/lijunyi911/xxt-Get\n\n快捷键：\nCtrl+Enter 开始\nEsc 停止\nCtrl+L 读取课程\nCtrl+F 搜索课程');
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
  const arr = sortByName
    ? [...list].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh'))
    : list;
  box.innerHTML = arr.map((c, i) => `
    <label class="course-item">
      <input type="checkbox" data-cid="${c.courseId}" />
      <span class="cnum">${i + 1}.</span>
      <span class="cname" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span>
    </label>
  `).join('');
  document.querySelectorAll('#courseList input[type="checkbox"]').forEach((inp) => {
    if (checked.has(inp.dataset.cid)) inp.checked = true;
  });
  box.scrollTop = keepScroll;
  $('btnAll').disabled = false;
  $('btnAll').textContent = '全选';
  $('btnSort').disabled = false;
}

// 排序
let sortByName = false;
$('btnSort').addEventListener('click', () => {
  sortByName = !sortByName;
  $('btnSort').textContent = sortByName ? '名称↓' : '排序';
  if (courses.length) renderCourses(courses);
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
  $('loadHint').textContent = total ? `已选 ${sel} / 共 ${total}` : '';
}
$('courseList').addEventListener('change', updateCourseCount);

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
  if (!confirm(`即将开始刷课\n课程：${scope}\n倍速：${currentSpeed}x\n\n确定开始？`)) return;
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
  if (!confirm('确定要停止刷课吗？')) return;
  await window.api.stop();
  addLog('[INFO] 已发送停止指令');
  $('btnStop').disabled = true;
  $('btnStart').disabled = false;
  $('btnPause').disabled = true;
  isPaused = false;
  $('btnPause').textContent = '暂停';
  runStart = 0;
});

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
  const text = [...document.querySelectorAll('#log > div')].map((d) => d.textContent).join('\n');
  try {
    const r = await window.api.copyText(text);
    if (r && r.ok) addLog('[INFO] 日志已复制到剪贴板');
    else addLog('[ERROR] 复制失败');
  } catch (e) {
    addLog('[ERROR] 复制失败：' + e.message);
  }
});
$('btnClearLog').addEventListener('click', () => {
  $('log').innerHTML = '';
  try { window.api.clearLogFile(); } catch (e) {}
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
  }
});

// 窗口按钮
$('btnMin').addEventListener('click', () => window.api.minimize());
$('btnClose').addEventListener('click', () => window.api.close());
if ($('btnMax')) $('btnMax').addEventListener('click', () => window.api.toggleMax());

function setStats(s) {
  if (!s) return;
  $('stDone').textContent = s.done ?? 0;
  $('stSkip').textContent = s.skipped ?? 0;
  $('stQuiz').textContent = s.quiz ?? 0;
  $('stFail').textContent = s.failed ?? 0;
  if (s.dailyMinutes != null) $('stDaily').textContent = s.dailyMinutes;
  if (s.dailyLimit != null) $('stLimit').textContent = s.dailyLimit > 0 ? s.dailyLimit : '∞';
  if (s.courseIndex != null && s.courseTotal != null) {
    $('stCourse').textContent = `${s.courseIndex}/${s.courseTotal}`;
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
    } else {
      const m = (ev.text || '').match(/(\d+)\s*\/\s*(\d+)/);
      if (m) {
        const pct = Math.min(100, Math.round((parseInt(m[1]) / parseInt(m[2])) * 100));
        $('bar').style.width = pct + '%';
      }
    }
    if (ev.text) $('stage').textContent = ev.text;
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
      try {
        window.api.notify({
          title: '刷课完成',
          body: `完成 ${ev.done} 节，跳过 ${ev.skipped} 节`,
        });
      } catch (e) {}
    }
  } else if (ev.type === 'error') {
    addLog('[ERROR] ' + (ev.text || ''));
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
    $('btnPause').disabled = true;
    isPaused = false;
    $('btnPause').textContent = '暂停';
    runStart = 0;
    if ($('btnRetry')) $('btnRetry').style.display = '';
  } else if (ev.type === 'challenge') {
    playBeep(880, 0.4, 0.12);
    addLog('[WARN] ⚠ 检测到人工验证：' + (ev.text || '') + '，已自动停止，请手动完成');
    $('stage').textContent = '需要人工验证，已暂停';
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
  } else if (ev.type === 'limit') {
    playBeep(440, 0.5, 0.12);
    addLog('[WARN] ⚠ 平台提示：' + (ev.text || '') + '，已停止');
    $('stage').textContent = '已达平台上限，已停止';
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
  } else if (ev.type === 'quiz') {
    addLog('[WARN] ' + (ev.text || '') + (ev.file ? `（截图：${ev.file}）` : ''));
  } else if (ev.type === 'courseDone') {
    playBeep(1100, 0.2, 0.08);
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
function showToast(text) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
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

function addLog(line) {
  const box = $('log');
  const div = document.createElement('div');
  let level = 'info';
  if (/\[WARN\]/.test(line)) level = 'warn';
  if (/\[ERROR\]/.test(line)) level = 'error';
  div.dataset.level = level;
  if (level !== 'info') div.className = level;
  div.textContent = line;
  const reverse = $('logReverse') && $('logReverse').checked;
  if (reverse) box.insertBefore(div, box.firstChild);
  else box.appendChild(div);
  if (!$('logAuto') || $('logAuto').checked) {
    box.scrollTop = reverse ? 0 : box.scrollHeight;
  }
  while (box.childNodes.length > 500) box.removeChild(reverse ? box.lastChild : box.firstChild);
  applyLogFilter();
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
