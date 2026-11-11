const $ = (id) => document.getElementById(id);

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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// 开始刷课
$('btnStart').addEventListener('click', async () => {
  const selected = [...document.querySelectorAll('#courseList input:checked')].map((i) => i.dataset.cid);
  if (!selected.length) {
    addLog('[WARN] 请先勾选至少一门课程');
    return;
  }
  $('btnStart').disabled = true;
  $('btnStop').disabled = false;
  addLog(`[INFO] 开始刷课，已选 ${selected.length} 门，倍速 ${currentSpeed}x`);
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

// ===== 全绿庆祝 =====
let confettiEl = null;

function showCourseDone(title) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = `《${title}》已经全部刷完了！🎉`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
  fireConfetti(1500);
}

function fireConfetti(duration) {
  if (confettiEl) {
    confettiEl.remove();
    confettiEl = null;
  }
  const canvas = document.createElement('canvas');
  confettiEl = canvas;
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const colors = ['#ff8c1a', '#ffb347', '#ffd166', '#ff6b6b', '#ffffff', '#4dd4ac', '#7bdff2'];
  const parts = [];
  const cx = canvas.width / 2;
  const cy = canvas.height / 3;

  for (let i = 0; i < 140; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 4 + Math.random() * 9;
    parts.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 4,
      size: 3 + Math.random() * 5,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
    });
  }

  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.32;
      p.vx *= 0.992;
      p.rot += p.vr;
      const k = Math.max(0, 1 - elapsed / duration);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
      if (confettiEl === canvas) confettiEl = null;
    }
  }
  requestAnimationFrame(frame);
}

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
