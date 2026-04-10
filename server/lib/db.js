import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export const CURRENT_SCHEMA_VERSION = 3;

/**
 * Open the SQLite database at the given path.
 * Ensures parent directory exists, enables WAL mode, sets busy_timeout.
 * Safe to call from multiple processes against the same file.
 */
export function openDb(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}

// Helper: run a single DDL statement via prepare().run()
// (avoids better-sqlite3's multi-statement helper whose name collides
// with a security hook's pattern matcher)
function runDdl(db, sql) {
  db.prepare(sql).run();
}

/**
 * Run schema migration to CURRENT_SCHEMA_VERSION. Idempotent and safe to call
 * on every startup. Wrapped in a transaction; settings table is created first
 * so the version check itself can read from it.
 *
 * Only the dashboard process should call this. The proxy process calls
 * waitForSchemaVersion() instead and depends on the dashboard having run
 * migration first.
 *
 * Returns a summary { fromVersion, toVersion, droppedCounts } for logging.
 */
export function migrate(db) {
  // Ensure settings table exists before we can read schema_version
  runDdl(db, `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const currentVersionRow = db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get();
  const fromVersion = Number(currentVersionRow?.value || '0');

  if (fromVersion >= CURRENT_SCHEMA_VERSION) {
    return { fromVersion, toVersion: fromVersion, droppedCounts: null, ran: false };
  }

  // Count rows in pre-existing activity tables so we can report loss in the log.
  const droppedCounts = { scrapes: 0, searches: 0, maps: 0, crawls: 0 };
  for (const table of Object.keys(droppedCounts)) {
    try {
      droppedCounts[table] = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
    } catch (_) {
      droppedCounts[table] = null; // table didn't exist
    }
  }

  const runMigration = db.transaction(() => {
    // Drop legacy activity tables (v1 -> v2)
    runDdl(db, 'DROP TABLE IF EXISTS scrapes');
    runDdl(db, 'DROP TABLE IF EXISTS searches');
    runDdl(db, 'DROP TABLE IF EXISTS maps');
    runDdl(db, 'DROP TABLE IF EXISTS crawls');

    // Create proxy_operations (primary observation log)
    runDdl(db, `
      CREATE TABLE IF NOT EXISTS proxy_operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        client_ip TEXT,
        client_ua TEXT,
        client_auth_hash TEXT,
        target_url TEXT,
        target_host TEXT,
        query_text TEXT,
        request_body_size INTEGER NOT NULL,
        response_status INTEGER NOT NULL,
        response_size INTEGER NOT NULL,
        success INTEGER NOT NULL,
        error_message TEXT,
        firecrawl_id TEXT,
        credits_used REAL,
        scraped_status_code INTEGER,
        concurrency_limited INTEGER,
        duration_ms INTEGER NOT NULL,
        upstream_response_time_ms INTEGER,
        request_body TEXT,
        response_body TEXT
      )
    `);
    runDdl(db, 'CREATE INDEX IF NOT EXISTS idx_proxy_ops_timestamp ON proxy_operations(timestamp)');
    runDdl(db, 'CREATE INDEX IF NOT EXISTS idx_proxy_ops_type ON proxy_operations(operation_type, timestamp)');
    runDdl(db, 'CREATE INDEX IF NOT EXISTS idx_proxy_ops_client ON proxy_operations(client_ip, timestamp)');
    runDdl(db, 'CREATE INDEX IF NOT EXISTS idx_proxy_ops_host ON proxy_operations(target_host)');
    runDdl(db, 'CREATE INDEX IF NOT EXISTS idx_proxy_ops_firecrawl ON proxy_operations(firecrawl_id)');
    runDdl(db, 'CREATE INDEX IF NOT EXISTS idx_proxy_ops_success ON proxy_operations(success, timestamp)');

    // Create server_metrics_snapshots (aggregate trends from /v1/team/* polling)
    runDdl(db, `
      CREATE TABLE IF NOT EXISTS server_metrics_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        jobs_in_queue INTEGER,
        active_jobs INTEGER,
        waiting_jobs INTEGER,
        max_concurrency INTEGER,
        most_recent_success TEXT,
        remaining_credits INTEGER,
        plan_credits INTEGER,
        remaining_tokens INTEGER,
        plan_tokens INTEGER,
        fetch_ok INTEGER NOT NULL
      )
    `);
    runDdl(db, 'CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON server_metrics_snapshots(timestamp)');

    // v3 — notification_log (additive; no data loss)
    runDdl(db, `
      CREATE TABLE IF NOT EXISTS notification_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        destinations TEXT NOT NULL,
        results TEXT NOT NULL,
        success INTEGER NOT NULL
      )
    `);
    runDdl(db, 'CREATE INDEX IF NOT EXISTS idx_notif_timestamp ON notification_log(timestamp)');
    runDdl(db, 'CREATE INDEX IF NOT EXISTS idx_notif_event ON notification_log(event_type, timestamp)');
    runDdl(db, 'CREATE INDEX IF NOT EXISTS idx_notif_success ON notification_log(success, event_type, timestamp)');

    // Seed new settings keys. INSERT OR IGNORE preserves existing values.
    const seed = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    seed.run('firecrawl_url',              process.env.FIRECRAWL_URL || 'http://10.0.20.66:3002');
    seed.run('api_key',                    process.env.FIRECRAWL_API_KEY || '');
    seed.run('bull_auth_key',              process.env.FIRECRAWL_BULL_AUTH_KEY || '');
    seed.run('dashboard_port',             String(process.env.DASHBOARD_PORT || '3001'));
    seed.run('proxy_port',                 String(process.env.PROXY_PORT || '3101'));
    seed.run('polling_interval',           '5000');
    seed.run('snapshot_poll_interval',     '300000');
    seed.run('proxy_retention_days',       '30');
    seed.run('proxy_retention_max_rows',   '100000');
    seed.run('snapshot_retention_days',    '90');
    seed.run('debug_log_bodies',           '0');
    seed.run('proxy_trust_forwarded_for',  '1');
    seed.run('proxy_max_body_bytes',       '52428800');
    seed.run('proxy_write_queue_flush_ms', '250');
    seed.run('proxy_write_queue_max_rows', '500');

    // v3 — notification settings
    seed.run('notifications_enabled',             '0');
    seed.run('notification_check_interval_ms',    '60000');
    seed.run('notification_dedup_minutes',        '15');
    seed.run('notification_startup_grace_seconds','90');
    seed.run('notification_retention_days',       '90');
    seed.run('notify_on_proxy_unreachable',       '1');
    seed.run('notify_on_firecrawl_unreachable',   '1');
    seed.run('notify_on_redis_unhealthy',         '0');
    seed.run('notify_on_bull_auth_rejected',      '1');
    seed.run('notify_on_high_error_rate',         '0');
    seed.run('notification_error_rate_threshold','0.5');
    seed.run('notification_error_rate_min_ops',   '10');
    seed.run('ntfy_enabled',                      '0');
    seed.run('ntfy_url',                          'https://ntfy.sh');
    seed.run('ntfy_topic',                        '');
    seed.run('ntfy_auth_type',                    'none');
    seed.run('ntfy_username',                     '');
    seed.run('ntfy_password',                     '');
    seed.run('ntfy_priority',                     '4');
    seed.run('webhook_enabled',                   '0');
    seed.run('webhook_url',                       '');
    seed.run('webhook_auth_header',               '');

    // Remove v1-only settings keys whose consumers are gone.
    db.prepare("DELETE FROM settings WHERE key IN ('retention_days','retention_max_rows')").run();

    // Stamp the new version.
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('schema_version', String(CURRENT_SCHEMA_VERSION));
  });

  runMigration();

  return { fromVersion, toVersion: CURRENT_SCHEMA_VERSION, droppedCounts, ran: true };
}

/**
 * Wait until settings.schema_version equals or exceeds target.
 * Polls every 500ms. Throws if timeout is reached.
 * Used by the proxy process to wait for dashboard migration to complete.
 */
export async function waitForSchemaVersion(db, target, { timeoutMs = 30000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get();
      const current = Number(row?.value || '0');
      if (current >= target) return current;
    } catch (_) {
      // settings table may not exist yet; treat as version 0 and keep waiting
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`schema_version did not reach ${target} within ${timeoutMs}ms; dashboard migration may not have run`);
}

/**
 * Read a pragma-derived DB size report. Used by /api/maintenance/dbsize
 * and by housekeeping.
 */
export function getDbSize(db) {
  const pageCount = db.pragma('page_count', { simple: true });
  const pageSize = db.pragma('page_size', { simple: true });
  const bytes = pageCount * pageSize;
  const formatted = bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return { bytes, formatted };
}
