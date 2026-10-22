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

function renderCourses(list) {
  const box = $('courseList');
  if (!list.length) {
    box.innerHTML = '<div class="empty">没有读到课程，请确认已登录</div>';
    return;
  }
  box.innerHTML = list.map((c, i) => `
    <label class="course-item">
      <input type="checkbox" data-cid="${c.courseId}" />
      <span class="cname" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span>
    </label>
  `).join('');
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

// 事件接收
window.api.onEvent((ev) => {
  if (!ev) return;
  if (ev.type === 'stage') {
    $('stage').textContent = ev.text || '';
  } else if (ev.type === 'progress') {
    // 解析 "视频 cur/dur"
    const m = (ev.text || '').match(/(\d+)\s*\/\s*(\d+)/);
    if (m) {
      const pct = Math.min(100, Math.round((parseInt(m[1]) / parseInt(m[2])) * 100));
      $('bar').style.width = pct + '%';
      $('stage').textContent = ev.text;
    }
  } else if (ev.type === 'log') {
    addLog(ev.text || '');
  } else if (ev.type === 'courses') {
    if (Array.isArray(ev.courses)) courses = ev.courses;
  } else if (ev.type === 'error') {
    addLog('[ERROR] ' + (ev.text || ''));
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
  } else if (ev.type === 'challenge') {
    addLog('[WARN] ⚠ 检测到人工验证：' + (ev.text || '') + '，已自动停止，请手动完成');
    $('stage').textContent = '需要人工验证，已暂停';
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
  }
});

function addLog(line) {
  const box = $('log');
  const div = document.createElement('div');
  if (/\[WARN\]/.test(line)) div.className = 'warn';
  if (/\[ERROR\]/.test(line)) div.className = 'error';
  div.textContent = line;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  // 限制行数
  while (box.childNodes.length > 400) box.removeChild(box.firstChild);
}
