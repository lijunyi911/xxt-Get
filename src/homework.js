const log = require('./log');

/** 读取某门课的作业列表 */
async function listWorks(page, course) {
  await page.goto(course.href, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const workUrl = await page.evaluate(() => {
    for (const a of document.querySelectorAll('a[href*="work/list"]')) return a.href;
    for (const a of document.querySelectorAll('a')) {
      const t = (a.textContent || '').trim();
      if (t === '作业' || /^\d+\s*作业/.test(t)) {
        const h = a.href || '';
        if (/work/i.test(h)) return h;
      }
    }
    return null;
  });

  if (!workUrl) {
    log.warn('未找到该课程的作业入口');
    return [];
  }

  await page.goto(workUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const works = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="doHomeWorkNew"], a[href*="work/doHomeWork"]').forEach((a) => {
      const href = a.href || '';
      if (!href || seen.has(href)) return;
      seen.add(href);
      const title = (a.getAttribute('title') || a.textContent || '').trim().replace(/\s+/g, ' ');
      if (!title) return;
      const box = a.closest('li, tr, .workContent, .work-list-item') || a.parentElement;
      const text = box ? box.textContent || '' : '';
      const done = /已交|已完成|已批阅|已提交/.test(text);
      out.push({ title, url: href, done });
    });
    return out;
  });

  log.info(`课程 ${course.title} 共 ${works.length} 个作业`);
  return works;
}

/** 打开作业页并抓取题目 */
async function parseQuestions(page) {
  const questions = await page.evaluate(() => {
    const containers = [...document.querySelectorAll('.questionLi, .TiMu, li.questionLi')];
    const out = [];
    containers.forEach((c, i) => {
      const stemEl = c.querySelector('.Zy_TItle, .mark_name, .QtContent');
      let stem = stemEl ? stemEl.textContent : '';
      stem = stem.trim().replace(/\s+/g, ' ');
      if (!stem) return;

      const inputs = [...c.querySelectorAll('input[type="radio"], input[type="checkbox"]')];
      const options = inputs.map((inp) => {
        const label = inp.closest('label') || inp.parentElement;
        let text = label ? label.textContent : '';
        text = text.trim().replace(/\s+/g, ' ');
        return { value: String(inp.value || ''), text };
      }).filter((o) => o.text);

      const textarea = c.querySelector('textarea');
      let type = 'unknown';
      if (textarea) type = 'essay';
      else if (c.querySelector('input[type="checkbox"]')) type = 'multi';
      else if (c.querySelector('input[type="radio"]')) type = 'single';

      out.push({
        index: i + 1,
        stem: stem.slice(0, 300),
        options,
        type,
        hasTextarea: !!textarea,
      });
    });
    return out;
  });

  log.info(`抓到 ${questions.length} 道题`);
  return questions;
}

/** 按答案填写（不提交） */
async function fillAnswers(page, answers) {
  const result = await page.evaluate((answers) => {
    const containers = [...document.querySelectorAll('.questionLi, .TiMu, li.questionLi')];
    let filled = 0;
    let failed = 0;
    const details = [];

    answers.forEach((ans) => {
      const c = containers[ans.index - 1];
      if (!c) {
        failed++;
        details.push({ index: ans.index, ok: false, reason: '未找到题目' });
        return;
      }
      const raw = String(ans.answer == null ? '' : ans.answer).trim();
      if (!raw) {
        failed++;
        details.push({ index: ans.index, ok: false, reason: '答案为空' });
        return;
      }

      const textarea = c.querySelector('textarea');
      if (textarea) {
        textarea.value = raw;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
        details.push({ index: ans.index, ok: true, type: 'essay' });
        return;
      }

      const inputs = [...c.querySelectorAll('input[type="radio"], input[type="checkbox"]')];
      const letters = raw.toUpperCase().replace(/[^A-Z]/g, '').split('').filter(Boolean);
      let picked = 0;
      inputs.forEach((inp) => {
        const label = inp.closest('label') || inp.parentElement;
        const text = label ? label.textContent.trim() : '';
        const letterFromText = (text.match(/^\s*([A-Z])[\s\.、．]/) || [])[1] || '';
        const value = String(inp.value || '').toUpperCase().trim();
        const key = /^[A-Z]$/.test(value) ? value : letterFromText;
        if (key && letters.includes(key)) {
          if (!inp.checked) inp.click();
          picked++;
        }
      });
      if (picked > 0) {
        filled++;
        details.push({ index: ans.index, ok: true, type: 'choice' });
      } else {
        failed++;
        details.push({ index: ans.index, ok: false, reason: `选项未匹配：${raw}` });
      }
    });

    return { filled, failed, details };
  }, answers);

  log.info(`已填写 ${result.filled} 题，失败 ${result.failed} 题`);
  return result;
}

/** 尝试点击提交按钮（需人工确认） */
async function submitWork(page) {
  const clicked = await page.evaluate(() => {
    const els = [...document.querySelectorAll('a, button, input[type="button"], div.btn')];
    const hit = els.find((el) => /^(提交|交卷|提交作业|完成作业)$/.test((el.textContent || el.value || '').trim()));
    if (hit) {
      hit.click();
      return true;
    }
    return false;
  });
  log.info(clicked ? '已点击提交按钮' : '未找到提交按钮');
  return clicked;
}

module.exports = { listWorks, parseQuestions, fillAnswers, submitWork };
