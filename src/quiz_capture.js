const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const log = require('./log');

// 学习通作业题目容器的常见选择器（按优先级，运行时自适应）
const QUESTION_SELECTORS = [
  '.questionLi',
  '.TiMu',
  '[class*="question-item"]',
  '[class*="questionItem"]',
  '.question-title',
  '.singleQuesId',
];

async function findQuestionSelector(page) {
  for (const sel of QUESTION_SELECTORS) {
    const count = await page.locator(sel).count().catch(() => 0);
    if (count > 0) return { sel, count };
  }
  return { sel: null, count: 0 };
}

/**
 * 采题：打开作业页，逐题截图存档，返回题目元数据。
 * @param {Page} page
 * @param {string} workUrl 作业页 URL
 * @param {number} workIndex 作业序号
 * @param {object} store 全局记录对象
 */
async function captureWork(page, workUrl, workIndex, store) {
  log.info(`采题：作业#${workIndex + 1} → ${workUrl}`);

  try {
    await page.goto(workUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
  } catch (e) {
    log.warn(`打开作业失败: ${e.message}`);
    return [];
  }
  await page.waitForTimeout(3000);

  // 有些作业需要点击“开始答题”/“进入”
  await tryEnterWork(page);

  const { sel, count } = await findQuestionSelector(page);
  if (!sel) {
    log.warn('未识别到题目容器，尝试 dump 页面结构用于调试');
    if (cfg.debugDump) await dumpDebug(page, workIndex);
    return [];
  }
  log.info(`识别到 ${count} 道题（选择器 ${sel}）`);

  const out = [];
  for (let i = 0; i < count; i++) {
    try {
      const loc = page.locator(sel).nth(i);
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);

      const imageName = `w${workIndex}_q${i}.png`;
      const imagePath = path.join(cfg.quizDir, imageName);
      await loc.screenshot({ path: imagePath }).catch(async () => {
        // 元素截图失败时退回整页截图
        await page.screenshot({ path: imagePath, fullPage: false });
      });

      const text = await loc.innerText().catch(() => '');
      out.push({
        workIndex,
        index: i,
        image: imageName,
        text: text.slice(0, 600),
      });
      log.info(`  题目${i + 1} 已截图: ${imageName}`);
    } catch (e) {
      log.warn(`  题目${i + 1} 截图失败: ${e.message}`);
    }
  }

  if (store.works) {
    store.works.push({ workIndex, url: workUrl, questions: out });
  }
  return out;
}

async function tryEnterWork(page) {
  const texts = ['开始答题', '进入答题', '开始考试', '继续答题'];
  for (const t of texts) {
    const btn = page.getByText(t, { exact: false }).first();
    if (await btn.count().catch(() => 0)) {
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(1500);
      log.info(`点击「${t}」进入作业`);
      return;
    }
  }
}

async function dumpDebug(page, workIndex) {
  try {
    const html = await page.content();
    const f = path.join(cfg.dataDir, `debug_work${workIndex}.html`);
    fs.writeFileSync(f, html, 'utf8');
    log.info(`页面结构已保存: ${f}`);
  } catch (e) {}
}

module.exports = { captureWork, findQuestionSelector, tryEnterWork };
