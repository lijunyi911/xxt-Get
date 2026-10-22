/**
 * 日志清理脚本：删除超过保留天数的日志类文件。
 * 由 Windows 计划任务每周执行一次；应用每次启动也会自动调用。
 */
const cfg = require('./config');
const log = require('./src/log');

log.init(cfg.logFile, { retentionDays: cfg.logRetentionDays, maxSizeMB: cfg.maxLogSizeMB });
const removed = log.cleanup(cfg.logRetentionDays);
console.log(`日志清理完成：保留 ${cfg.logRetentionDays} 天，本次删除 ${removed} 个过期文件`);
