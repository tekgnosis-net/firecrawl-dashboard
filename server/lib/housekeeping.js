import { getDbSize } from './db.js';
import {
  getProxyRetentionDays,
  getProxyRetentionMaxRows,
  getSnapshotRetentionDays,
  getNotificationRetentionDays,
} from './settings.js';

/**
 * Dashboard-side housekeeping. Prunes proxy_operations and
 * server_metrics_snapshots by age + row count, then VACUUMs if anything
 * was deleted.
 *
 * Runs on the same 60s-after-startup + every-6-hours schedule as the
 * original server/index.js housekeeping.
 */

export function runHousekeeping(db) {
  const proxyDays = getProxyRetentionDays(db);
  const proxyMaxRows = getProxyRetentionMaxRows(db);
  const snapshotDays = getSnapshotRetentionDays(db);
  const notificationDays = getNotificationRetentionDays(db);

  const sizeBefore = getDbSize(db).formatted;
  const results = { proxyOpsAgeDeleted: 0, proxyOpsRowLimitDeleted: 0, snapshotsAgeDeleted: 0, notificationsAgeDeleted: 0 };

  // Age-based pruning for proxy_operations
  if (proxyDays > 0) {
    results.proxyOpsAgeDeleted = db.prepare(
      `DELETE FROM proxy_operations WHERE timestamp < datetime('now', '-' || ? || ' days')`
    ).run(proxyDays).changes;
  }

  // Row-count pruning for proxy_operations (keep newest N)
  if (proxyMaxRows > 0) {
    const currentCount = db.prepare('SELECT COUNT(*) AS c FROM proxy_operations').get().c;
    if (currentCount > proxyMaxRows) {
      results.proxyOpsRowLimitDeleted = db.prepare(
        `DELETE FROM proxy_operations WHERE id NOT IN (SELECT id FROM proxy_operations ORDER BY timestamp DESC LIMIT ?)`
      ).run(proxyMaxRows).changes;
    }
  }

  // Age-based pruning for snapshots
  if (snapshotDays > 0) {
    results.snapshotsAgeDeleted = db.prepare(
      `DELETE FROM server_metrics_snapshots WHERE timestamp < datetime('now', '-' || ? || ' days')`
    ).run(snapshotDays).changes;
  }

  // Age-based pruning for notification_log
  if (notificationDays > 0) {
    results.notificationsAgeDeleted = db.prepare(
      `DELETE FROM notification_log WHERE timestamp < datetime('now', '-' || ? || ' days')`
    ).run(notificationDays).changes;
  }

  const totalDeleted = results.proxyOpsAgeDeleted + results.proxyOpsRowLimitDeleted + results.snapshotsAgeDeleted + results.notificationsAgeDeleted;

  // WAL checkpoint (unconditional) + VACUUM (only if rows deleted)
  db.pragma('wal_checkpoint(TRUNCATE)');
  if (totalDeleted > 0) {
    db.prepare('VACUUM').run();
  }

  const sizeAfter = getDbSize(db).formatted;
  console.log(`[housekeeping] proxyOps age=${results.proxyOpsAgeDeleted} rowLimit=${results.proxyOpsRowLimitDeleted}, snapshots age=${results.snapshotsAgeDeleted}, notifications age=${results.notificationsAgeDeleted}, db=${sizeBefore}->${sizeAfter}`);

  return { ...results, dbSizeBefore: sizeBefore, dbSizeAfter: sizeAfter };
}

/**
 * Start the housekeeping schedule: first run 60s after startup,
 * then every 6 hours. Returns a stop() function.
 */
export function startHousekeepingSchedule(db) {
  let intervalHandle = null;
  const startupHandle = setTimeout(() => {
    try { runHousekeeping(db); } catch (err) { console.error('[housekeeping] error:', err.message); }
    intervalHandle = setInterval(() => {
      try { runHousekeeping(db); } catch (err) { console.error('[housekeeping] error:', err.message); }
    }, 6 * 60 * 60 * 1000);
  }, 60 * 1000);

  return () => {
    clearTimeout(startupHandle);
    if (intervalHandle) clearInterval(intervalHandle);
  };
}
