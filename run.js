/**
 * CLI 入口（备用）：node run.js
 * 不弹悬浮窗，直接命令行刷全部课程。
 */
const engine = require('./src/engine');
const cfg = require('./config');
const log = require('./src/log');

function push(e) {
  if (!e) return;
  if (e.type === 'stage' || e.type === 'progress') console.log('[stage]', e.text);
  if (e.type === 'error') console.error('[ERROR]', e.text);
}

async function main() {
  log.init(cfg.logFile, { retentionDays: cfg.logRetentionDays, maxSizeMB: cfg.maxLogSizeMB });
  log.setSink((l) => console.log(l));
  try {
    log.info('读取课程列表...');
    const courses = await engine.getCourses(push);
    if (!courses.length) {
      log.warn('没有课程');
      return;
    }
    console.log('\n课程列表:');
    courses.forEach((c, i) => console.log(`  ${i + 1}. ${c.title} (${c.courseId})`));
    log.info(`开始刷全部 ${courses.length} 门课程，倍速 ${cfg.defaultSpeed}x`);
    await engine.runCourses(courses.map((c) => c.courseId), cfg.defaultSpeed, push);
  } catch (e) {
    log.error(e.message);
  }
}

main();
