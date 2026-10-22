const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const log = require('./log');
const { findQuestionSelector, tryEnterWork } = require('./quiz_capture');

/**
 * 回填单个作业的答案。
 * @param {Page} page
 * @param {string} workUrl
 * @param {number} workIndex
 * @param {object} answers  { "w0_q0": {type, answer}, ... }
 */
async function submitWork(page, workUrl, workIndex, answers) {
  log.info(`回填：作业#${workIndex + 1}`);

  try {
    await page.goto(workUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
  } catch (e) {
    log.warn(`打开作业失败: ${e.message}`);
    return 0;
  }
  await page.waitForTimeout(2500);
  await tryEnterWork(page);

  const { sel, count } = await findQuestionSelector(page);
  if (!sel) {
    log.warn('未识别到题目容器，跳过回填');
    return 0;
  }

  let filled = 0;
  for (let i = 0; i < count; i++) {
    const key = `w${workIndex}_q${i}`;
    const item = answers[key];
    if (!item || item.answer == null || item.answer === '') continue;

    try {
      const loc = page.locator(sel).nth(i);
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      const ok = await fillQuestion(loc, item);
      if (ok) {
        filled++;
        log.info(`  题目${i + 1} 已填: ${JSON.stringify(item.answer).slice(0, 60)}`);
      }
    } catch (e) {
      log.warn(`  题目${i + 1} 回填失败: ${e.message}`);
    }
  }

  // 提交
  const submitted = await clickSubmit(page);
  log.info(submitted ? `作业#${workIndex + 1} 已提交（填 ${filled} 题）` : `作业#${workIndex + 1} 未找到提交按钮`);
  return filled;
}

/**
 * 按题型填单题：
 * - 选择（单选/多选/判断）：点击选项
 * - 填空/简答：写 input/textarea
 */
async function fillQuestion(loc, item) {
  const type = (item.type || '').toLowerCase();
  const answer = item.answer;

  // 填空 / 简答
  if (type === 'fill' || type === 'short' || type === 'text') {
    const inputs = loc.locator('input[type="text"], textarea');
    const n = await inputs.count().catch(() => 0);
    if (n > 0) {
      const val = Array.isArray(answer) ? answer.join('；') : String(answer);
      await inputs.first().fill(val).catch(() => {});
      return true;
    }
  }

  // 选择题：answer 可传 "B" / "AB" / 选项文本
  const letters = Array.isArray(answer) ? answer : String(answer).split('');
  const radios = loc.locator('input[type="radio"], input[type="checkbox"]');
  const nOpt = await radios.count().catch(() => 0);

  if (nOpt > 0) {
    let hit = false;
    for (const ch of letters) {
      const idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(String(ch).toUpperCase());
      if (idx < 0 || idx >= nOpt) continue;
      const input = radios.nth(idx);
      await input.check({ force: true }).catch(async () => {
        await input.click({ force: true }).catch(() => {});
      });
      hit = true;
    }
    if (hit) return true;
  }

  // 退路：按选项文本匹配
  const textOpts = loc.locator('li, .answerItem, [class*="option"]');
  const m = await textOpts.count().catch(() => 0);
  for (let k = 0; k < m; k++) {
    const opt = textOpts.nth(k);
    const t = await opt.innerText().catch(() => '');
    if (Array.isArray(answer)) {
      if (answer.some((a) => t.includes(String(a)))) {
        await opt.click({ force: true }).catch(() => {});
        return true;
      }
    } else if (answer && t.includes(String(answer))) {
      await opt.click({ force: true }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function clickSubmit(page) {
  const texts = ['提交', '交卷', '提交作业', '提交答案', '确定提交'];
  for (const t of texts) {
    const btn = page.getByText(t, { exact: false }).first();
    if (await btn.count().catch(() => 0)) {
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(1500);
      // 二次确认
      const confirm = page.getByText('确定', { exact: false }).first();
      if (await confirm.count().catch(() => 0)) {
        await confirm.click({ timeout: 1500 }).catch(() => {});
      }
      return true;
    }
  }
  return false;
}

module.exports = { submitWork, fillQuestion, clickSubmit };
