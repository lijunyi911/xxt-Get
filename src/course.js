const cfg = require('../config');
const log = require('./log');

/**
 * 读取“我的课程”。
 * 真实流程：个人空间首页 → 找到「课程」菜单 dataurl（courses/study?s=...） → 进入学生端 → 抓 a.courseName。
 */
async function listCourses(page) {
  // 1. 打开个人空间首页
  await page.goto(cfg.chaoxingHome, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // 2. 找「课程」菜单的真实地址
  const courseListUrl = await page.evaluate(() => {
    const els = document.querySelectorAll('[dataurl]');
    for (const el of els) {
      const u = el.getAttribute('dataurl') || '';
      if (/courses\/study/.test(u)) return u;
    }
    return null;
  });

  if (!courseListUrl) {
    log.warn('未在首页找到「课程」菜单入口');
  } else {
    log.info(`课程列表入口: ${courseListUrl}`);
  }

  // 3. 进入课程列表页
  const target = courseListUrl || 'https://mooc1-1.chaoxing.com/visit/courses/study';
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // 4. 提取课程
  const courses = await page.evaluate(() => {
    const out = [];
    const seen = new Set();

    const push = (a) => {
      const href = a.href || '';
      const m = href.match(/courseid=(\d+)/i);
      if (!m) return;
      const cid = m[1];
      if (seen.has(cid)) return;
      const title = (a.getAttribute('title') || a.textContent || '').trim();
      if (!title) return;
      seen.add(cid);
      out.push({ courseId: cid, title: title.replace(/\s+/g, ' '), href });
    };

    // 首选：a.courseName
    document.querySelectorAll('a.courseName[href*="stucoursemiddle"]').forEach(push);
    // 兜底：任意 stucoursemiddle 链接
    if (out.length === 0) {
      document.querySelectorAll('a[href*="stucoursemiddle"]').forEach(push);
    }
    return out;
  });

  log.info(`读取到 ${courses.length} 门课程`);
  return courses;
}

module.exports = { listCourses };
