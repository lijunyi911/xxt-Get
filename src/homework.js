const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const log = require('./log');

/** 读取某门课的作业列表 */
async function listWorks(page, course) {
  const cur = page.url() || '';
  const onWorkList = /work\/(getAllWork|list)/.test(cur);

  if (!onWorkList) {
    await page.goto(course.href, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2500);

    let workUrl = await page.evaluate(() => {
      const byHref = (pat) => {
        const a = document.querySelector(`a[href*="${pat}"]`);
        return a ? a.href : null;
      };
      const direct = byHref('work/getAllWork') || byHref('work/list');
      if (direct) return direct;
      for (const a of document.querySelectorAll('a')) {
        const t = (a.textContent || '').trim();
        if (t === '作业' && /work/i.test(a.href || '')) return a.href;
      }
      return null;
    });

    // 兜底：用课程页 URL 参数直接构造作业列表地址
    if (!workUrl) {
      try {
        const u = new URL(page.url());
        const courseId = u.searchParams.get('courseId');
        const classId = u.searchParams.get('clazzid') || u.searchParams.get('classId');
        if (courseId && classId) {
          const p = new URLSearchParams({ classId, courseId, isdisplaytable: '2', mooc: '1' });
          ['ut', 'enc', 'cpi', 'openc'].forEach((k) => {
            const v = u.searchParams.get(k);
            if (v) p.set(k, v);
          });
          workUrl = `https://mooc1-2.chaoxing.com/mooc-ans/work/getAllWork?${p.toString()}`;
          log.info(`用课程参数构造作业入口：${workUrl}`);
        }
      } catch (e) {}
    }

    if (!workUrl) {
      log.warn(`未找到作业入口（当前页：${cur}）`);
      return [];
    }

    log.info(`作业入口：${workUrl}`);
    await page.goto(workUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  const works = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const isAction = (t) => /^(做作业|查看|查看作业|开始答题|继续答题|去完成)$/.test(t);

    const nodes = [...document.querySelectorAll('a, button, div, span')].filter((el) => {
      const t = (el.textContent || '').trim();
      return t && t.length <= 8 && isAction(t);
    });

    nodes.forEach((btn, i) => {
      try { btn.setAttribute('data-xxt-hw', String(i)); } catch (e) {}
      const action = (btn.textContent || '').trim();

      // 向上找真正包含作业信息的卡片容器
      let card = null;
      let el = btn.parentElement;
      let guard = 0;
      while (el && guard < 8) {
        const txt = el.textContent || '';
        if (/作业状态|开始时间|截止时间/.test(txt) && txt.length < 600) {
          card = el;
          break;
        }
        el = el.parentElement;
        guard++;
      }
      if (!card) card = btn.closest('li, .work-item, .workContent, .workList, tr, div');

      let title = '';
      const titleEl = card
        ? card.querySelector('h1, h2, h3, h4, .title, .work-title, .workName, .work_name, .name')
        : null;
      if (titleEl) title = titleEl.textContent.trim();
      if (!title && card) {
        const raw = (card.textContent || '').replace(/\s+/g, ' ').trim();
        const cut = raw.search(/开始时间|截止时间|作业状态|做作业|查看/);
        title = (cut > 0 ? raw.slice(0, cut) : raw).trim().slice(0, 60);
      }

      let url = btn.href || '';
      if (!url && btn.getAttribute) {
        url = btn.getAttribute('data-url') || btn.getAttribute('data-href') || '';
      }
      if (!url && btn.getAttribute) {
        const oc = btn.getAttribute('onclick') || '';
        const m = oc.match(/['"]([^'"]*(?:doHomeWork|workId=)[^'"]*)['"]/);
        if (m) url = m[1];
      }
      if (!url && card) {
        const a = card.querySelector('a[href*="doHomeWork"], a[href*="workId="]');
        if (a) url = a.href;
      }

      const done = /查看/.test(action);
      const key = `${title}|${url}|${action}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ title: title || action, url: url || '', done, action, idx: i });
    });

    return out;
  });

  // 保存一份页面结构，方便排查不同课程模板
  try {
    fs.mkdirSync(cfg.dataDir, { recursive: true });
    const html = await page.content();
    fs.writeFileSync(path.join(cfg.dataDir, 'homework-dump.html'), html, 'utf8');
    log.info('作业页结构已保存到 data/homework-dump.html');
  } catch (e) {}

  log.info(`读取到 ${works.length} 个作业`);
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
        // 去掉「A. 」这类前缀，避免与选项字母重复
        text = text.replace(/^[A-Za-z][\.、．\s]\s*/, '');
        const value = String(inp.value || '').trim();
        return { value, text };
      }).filter((o) => o.text);

      const textarea = c.querySelector('textarea');
      let type = 'unknown';
      if (textarea) type = 'essay';
      else if (c.querySelector('input[type="checkbox"]')) type = 'multi';
      else if (c.querySelector('input[type="radio"]')) {
        type = 'single';
        const joined = options.map((o) => o.text).join(' ');
        if (options.length <= 2 && /^(对|错|正确|错误|是|否|√|×)/.test(joined)) type = 'judge';
      }

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
