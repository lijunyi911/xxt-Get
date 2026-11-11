const $ = (id) => document.getElementById(id);

// ===== 主题：浅色 / 深色 / 跟随系统 =====
const THEME_KEY = 'xxt-theme';
let themeMode = 'system';
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

let currentSpeed = 2;
let courses = [];

// 倍速选择
$('speedRow').addEventListener('click', (e) => {
  const btn = e.target.closest('.spd');
  if (!btn) return;
  document.querySelectorAll('.spd').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentSpeed = parseFloat(btn.dataset.speed);
});

// 加载课程
$('btnLoad').addEventListener('click', async () => {
  $('btnLoad').disabled = true;
  $('loadHint').textContent = '正在打开 Edge 并读取...';
  addLog('[INFO] 正在启动 Edge / 读取课程列表...');
  try {
    const res = await window.api.loadCourses();
    if (res.ok) {
      courses = res.courses || [];
      renderCourses(courses);
      $('loadHint').textContent = `共 ${courses.length} 门`;
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

// 全选 / 反选
$('btnAll').addEventListener('click', () => {
  const boxes = [...document.querySelectorAll('#courseList input[type="checkbox"]')];
  if (!boxes.length) return;
  const allChecked = boxes.every((b) => b.checked);
  boxes.forEach((b) => { b.checked = !allChecked; });
  $('btnAll').textContent = allChecked ? '全选' : '取消全选';
  addLog(`[INFO] ${allChecked ? '已取消全选' : '已全选'} ${boxes.length} 门课程`);
});

function renderCourses(list) {
  const box = $('courseList');
  if (!list.length) {
    box.innerHTML = '<div class="empty">没有读到课程，请确认已登录</div>';
    $('btnAll').disabled = true;
    $('btnAll').textContent = '全选';
    return;
  }
  box.innerHTML = list.map((c) => `
    <label class="course-item">
      <input type="checkbox" data-cid="${c.courseId}" />
      <span class="cname" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span>
    </label>
  `).join('');
  $('btnAll').disabled = false;
  $('btnAll').textContent = '全选';
}

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

// 开始刷课
$('btnStart').addEventListener('click', async () => {
  const selected = [...document.querySelectorAll('#courseList input:checked')].map((i) => i.dataset.cid);
  $('btnStart').disabled = true;
  $('btnStop').disabled = false;
  if (!selected.length) {
    addLog('[WARN] 未勾选课程，将刷全部课程');
  } else {
    addLog(`[INFO] 开始刷课，已选 ${selected.length} 门，倍速 ${currentSpeed}x`);
  }
  await window.api.start(selected, currentSpeed);
});

// 停止
$('btnStop').addEventListener('click', async () => {
  await window.api.stop();
  addLog('[INFO] 已发送停止指令');
  $('btnStop').disabled = true;
  $('btnStart').disabled = false;
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
  if (s.dailyLimit != null) $('stLimit').textContent = s.dailyLimit;
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
  } else if (ev.type === 'summary') {
    setStats(ev);
    addLog(`[INFO] 本次汇总：完成 ${ev.done}，跳过 ${ev.skipped}，章节测验 ${ev.quiz}，失败 ${ev.failed}；今日已学 ${ev.dailyMinutes} 分钟`);
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
    // 正常刷完（非手动停止）→ 收起课程列表，回到初始状态
    if (ev.finished) {
      resetCourseList();
      $('stage').textContent = '全部课程已刷完，可再次点击「读取我的课程」';
    }
  } else if (ev.type === 'error') {
    addLog('[ERROR] ' + (ev.text || ''));
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
  } else if (ev.type === 'challenge') {
    addLog('[WARN] ⚠ 检测到人工验证：' + (ev.text || '') + '，已自动停止，请手动完成');
    $('stage').textContent = '需要人工验证，已暂停';
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
  } else if (ev.type === 'limit') {
    addLog('[WARN] ⚠ 平台提示：' + (ev.text || '') + '，已停止');
    $('stage').textContent = '已达平台上限，已停止';
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
  } else if (ev.type === 'quiz') {
    addLog('[WARN] ' + (ev.text || '') + (ev.file ? `（截图：${ev.file}）` : ''));
  } else if (ev.type === 'courseDone') {
    showCourseDone(ev.title || '');
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
  if (/\[WARN\]/.test(line)) div.className = 'warn';
  if (/\[ERROR\]/.test(line)) div.className = 'error';
  div.textContent = line;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  while (box.childNodes.length > 400) box.removeChild(box.firstChild);
}
