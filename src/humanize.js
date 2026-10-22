const cfg = require('../config');

const ab = () => cfg.antiBan || { enabled: false };

function rand(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** 随机人类化延迟 */
async function sleep(page, min, max) {
  if (!ab().enabled) return 0;
  const lo = min != null ? min : ab().minDelayMs;
  const hi = max != null ? max : ab().maxDelayMs;
  const ms = rand(lo, hi);
  await page.waitForTimeout(ms).catch(() => {});
  return ms;
}

/** 随机移动鼠标，制造真人交互痕迹 */
async function jitterMouse(page) {
  if (!ab().enabled || !ab().mouseJitter) return;
  try {
    const vp = await page
      .evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
      .catch(() => ({ w: 1280, h: 800 }));
    const w = Math.max(200, vp.w || 1280);
    const h = Math.max(200, vp.h || 800);
    const moves = rand(2, 4);
    for (let i = 0; i < moves; i++) {
      const x = rand(20, w - 20);
      const y = rand(20, h - 20);
      await page.mouse.move(x, y, { steps: rand(4, 10) }).catch(() => {});
      await page.waitForTimeout(rand(80, 280)).catch(() => {});
    }
  } catch (e) {}
}

module.exports = { rand, sleep, jitterMouse };
