/**
 * Settings helpers used by both dashboard and proxy processes.
 *
 * Design principle: fresh reads on every call, no in-memory cache.
 * Rationale: better-sqlite3 reads are sub-millisecond (page cache in memory),
 * so the overhead is negligible compared to the upstream Firecrawl call
 * (500-5000ms). Cache-free reads eliminate settings propagation delay
 * between the two processes — when the dashboard writes a new value, the
 * proxy sees it on its very next request with zero coordination machinery.
 */

/**
 * Read a single setting value. Returns the raw string from the DB,
 * or undefined if the key does not exist. Callers are responsible for
 * type coercion (Number, Boolean) at the use site.
 */
export function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value;
}

/**
 * Read a setting with a fallback. Also honors an env-var override
 * (first-choice fallback) when a setting is empty/missing.
 *
 * This mirrors the original server/index.js pattern where settings like
 * firecrawl_url could be overridden by FIRECRAWL_URL at process start.
 */
export function getSettingWithEnv(db, key, envKey, defaultValue) {
  const fromDb = getSetting(db, key);
  if (fromDb !== undefined && fromDb !== '') return fromDb;
  if (envKey && process.env[envKey]) return process.env[envKey];
  return defaultValue;
}

/**
 * Write a single setting value. Upsert semantics.
 */
export function setSetting(db, key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

/**
 * Bulk read all settings as a flat object. Used by the dashboard's
 * GET /api/settings endpoint to serialize the whole config.
 */
export function getAllSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const { key, value } of rows) out[key] = value;
  return out;
}

// --- Named helpers for the values that are read on the hot path ---
// These document the env-var fallbacks and default values in one place,
// and give the proxy middleware a type-coerced convenience API.

export function getFirecrawlUrl(db) {
  return getSettingWithEnv(db, 'firecrawl_url', 'FIRECRAWL_URL', 'http://10.0.20.66:3002');
}

export function getApiKey(db) {
  return getSettingWithEnv(db, 'api_key', 'FIRECRAWL_API_KEY', '');
}

export function getBullAuthKey(db) {
  return getSettingWithEnv(db, 'bull_auth_key', 'FIRECRAWL_BULL_AUTH_KEY', '');
}

export function getDashboardPort(db) {
  return parseInt(getSettingWithEnv(db, 'dashboard_port', 'DASHBOARD_PORT', '3001'), 10);
}

export function getProxyPort(db) {
  return parseInt(getSettingWithEnv(db, 'proxy_port', 'PROXY_PORT', '3101'), 10);
}

export function getProxyMaxBodyBytes(db) {
  return parseInt(getSetting(db, 'proxy_max_body_bytes') || '52428800', 10);
}

export function getProxyTrustForwardedFor(db) {
  return getSetting(db, 'proxy_trust_forwarded_for') === '1';
}

export function getDebugLogBodies(db) {
  return getSetting(db, 'debug_log_bodies') === '1';
}

export function getSnapshotPollInterval(db) {
  return parseInt(getSetting(db, 'snapshot_poll_interval') || '300000', 10);
}

export function getProxyRetentionDays(db) {
  return parseInt(getSetting(db, 'proxy_retention_days') || '30', 10);
}

export function getProxyRetentionMaxRows(db) {
  return parseInt(getSetting(db, 'proxy_retention_max_rows') || '100000', 10);
}

export function getSnapshotRetentionDays(db) {
  return parseInt(getSetting(db, 'snapshot_retention_days') || '90', 10);
}

export function getProxyWriteQueueFlushMs(db) {
  return parseInt(getSetting(db, 'proxy_write_queue_flush_ms') || '250', 10);
}

export function getProxyWriteQueueMaxRows(db) {
  return parseInt(getSetting(db, 'proxy_write_queue_max_rows') || '500', 10);
}

export function getPollingInterval(db) {
  return parseInt(getSetting(db, 'polling_interval') || '5000', 10);
}

// --- Notification config ---

export function getNotificationsEnabled(db) {
  return getSetting(db, 'notifications_enabled') === '1';
}

export function getNotificationCheckIntervalMs(db) {
  return parseInt(getSetting(db, 'notification_check_interval_ms') || '60000', 10);
}

export function getNotificationDedupMinutes(db) {
  return parseInt(getSetting(db, 'notification_dedup_minutes') || '15', 10);
}

export function getNotificationStartupGraceSeconds(db) {
  return parseInt(getSetting(db, 'notification_startup_grace_seconds') || '90', 10);
}

export function getNotificationRetentionDays(db) {
  return parseInt(getSetting(db, 'notification_retention_days') || '90', 10);
}

export function getEventEnabled(db, eventType) {
  // Map event_type -> setting key. Unknown types default to disabled.
  const keyByType = {
    proxy_unreachable:     'notify_on_proxy_unreachable',
    firecrawl_unreachable: 'notify_on_firecrawl_unreachable',
    redis_unhealthy:       'notify_on_redis_unhealthy',
    bull_auth_rejected:    'notify_on_bull_auth_rejected',
    high_error_rate:       'notify_on_high_error_rate',
  };
  const key = keyByType[eventType];
  if (!key) return false;
  return getSetting(db, key) === '1';
}

export function getErrorRateThreshold(db) {
  return parseFloat(getSetting(db, 'notification_error_rate_threshold') || '0.5');
}

export function getErrorRateMinOps(db) {
  return parseInt(getSetting(db, 'notification_error_rate_min_ops') || '10', 10);
}

export function getNtfyConfig(db) {
  return {
    enabled:  getSetting(db, 'ntfy_enabled') === '1',
    url:      getSetting(db, 'ntfy_url') || 'https://ntfy.sh',
    topic:    getSetting(db, 'ntfy_topic') || '',
    authType: getSetting(db, 'ntfy_auth_type') || 'none',
    username: getSetting(db, 'ntfy_username') || '',
    password: getSetting(db, 'ntfy_password') || '',
    priority: parseInt(getSetting(db, 'ntfy_priority') || '4', 10),
  };
}

export function getWebhookConfig(db) {
  return {
    enabled:    getSetting(db, 'webhook_enabled') === '1',
    url:        getSetting(db, 'webhook_url') || '',
    authHeader: getSetting(db, 'webhook_auth_header') || '',
  };
}
