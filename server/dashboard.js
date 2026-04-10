import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { openDb, migrate, getDbSize, CURRENT_SCHEMA_VERSION } from './lib/db.js';
import {
  getAllSettings, setSetting,
  getFirecrawlUrl, getApiKey, getBullAuthKey,
  getDashboardPort, getPollingInterval,
  getProxyHealthUrl,
} from './lib/settings.js';
import { internalGet } from './lib/firecrawl-client.js';
import { createSnapshotPoller } from './lib/snapshot-poller.js';
import { runHousekeeping, startHousekeepingSchedule } from './lib/housekeeping.js';
import {
  getOverview, getTimeline, getClients, getDomains,
  getErrors, getCredits, getRecent, getSnapshots,
  getDistribution, getStatusCodes, getHeatmap,
  getOperationDetail, getCrawlLifecycle, exportRowsAsCsv,
} from './lib/stats-queries.js';
import { createWatcher } from './lib/notification-watcher.js';
import { dispatch as dispatchNotification } from './lib/notifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, '../data/dashboard.db');
const db = openDb(DB_PATH);

// --- Migration (runs exactly once; idempotent on re-start) ---
const migrationResult = migrate(db);
if (migrationResult.ran) {
  console.log(`[dashboard] migrated schema ${migrationResult.fromVersion} -> ${migrationResult.toVersion}`);
  if (migrationResult.droppedCounts) {
    const { scrapes, searches, maps, crawls } = migrationResult.droppedCounts;
    const parts = [];
    if (scrapes !== null) parts.push(`scrapes=${scrapes}`);
    if (searches !== null) parts.push(`searches=${searches}`);
    if (maps !== null) parts.push(`maps=${maps}`);
    if (crawls !== null) parts.push(`crawls=${crawls}`);
    if (parts.length) console.log(`[dashboard] dropped legacy activity tables: ${parts.join(', ')}`);
  }
} else {
  console.log(`[dashboard] schema already at version ${migrationResult.toVersion}, no migration needed`);
}

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT, 10) || getDashboardPort(db);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ============================================================
// Health and self-status
// ============================================================

// Local liveness probe shared by Docker healthcheck and the frontend's
// ProcessStatusCard. Exposed at both `/healthz` (for Docker) and
// `/api/healthz` (so the Vite dev proxy — which only forwards `/api/*`
// to the backend — can reach it in dev mode without extra Vite config).
async function handleHealthz(req, res) {
  let proxyHealth = null;
  try {
    // Use getProxyHealthUrl() so the cross-ping honors PROXY_HOST. In
    // standalone dev this is `localhost`; in Docker it's the proxy
    // container's service DNS name (e.g. `proxy`), set via env.
    const r = await axios.get(getProxyHealthUrl(db), { timeout: 2000 });
    proxyHealth = r.data;
  } catch (_) {
    proxyHealth = { status: 'unreachable' };
  }

  res.json({
    status: 'healthy',
    service: 'dashboard',
    schema_version: CURRENT_SCHEMA_VERSION,
    uptimeSeconds: process.uptime(),
    proxy: proxyHealth,
  });
}
app.get('/healthz', handleHealthz);
app.get('/api/healthz', handleHealthz);

/**
 * /api/health — combined Firecrawl liveness + Redis health probe.
 * Accepts ?url=&apiKey=&bullAuthKey= overrides so SettingsPage can
 * validate pending credentials before saving.
 */
app.get('/api/health', async (req, res) => {
  const url = req.query.url || getFirecrawlUrl(db);
  const apiKey = req.query.apiKey || getApiKey(db);
  const bullAuthKey = req.query.bullAuthKey !== undefined ? req.query.bullAuthKey : getBullAuthKey(db);

  const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};

  const tasks = [
    axios.get(`${url}/`, { timeout: 5000, headers, validateStatus: () => true }).catch(e => ({ error: e.message })),
  ];
  if (bullAuthKey) {
    tasks.push(
      axios.get(`${url}/admin/${encodeURIComponent(bullAuthKey)}/redis-health`, { timeout: 5000, headers, validateStatus: () => true })
        .catch(e => ({ error: e.message }))
    );
  }

  const [rootRes, redisRes] = await Promise.all(tasks);

  const rootOk = rootRes && !rootRes.error && rootRes.status >= 200 && rootRes.status < 400;
  const redisOk = redisRes && !redisRes.error && redisRes.status >= 200 && redisRes.status < 400;

  let status = 'unhealthy';
  if (rootOk && (!bullAuthKey || redisOk)) status = 'healthy';
  else if (rootOk) status = 'degraded';

  let bullAuthState = 'not_configured';
  if (bullAuthKey) {
    if (redisOk) bullAuthState = 'configured';
    else if (redisRes?.status === 401 || redisRes?.status === 404) bullAuthState = 'rejected';
    else bullAuthState = 'unreachable';
  }

  res.status(rootOk ? 200 : 503).json({
    status,
    firecrawl: rootRes?.data || { error: rootRes?.error || 'unreachable' },
    redis: redisRes ? (redisRes.error ? { error: redisRes.error } : redisRes.data) : null,
    bullAuth: bullAuthState,
  });
});

// ============================================================
// Settings API
// ============================================================

app.get('/api/settings', (req, res) => {
  const all = getAllSettings(db);
  res.json({
    success: true,
    data: {
      firecrawlUrl:            all.firecrawl_url || '',
      apiKey:                  all.api_key || '',
      bullAuthKey:             all.bull_auth_key || '',
      dashboardPort:           Number(all.dashboard_port) || 3001,
      proxyPort:               Number(all.proxy_port) || 3101,
      pollingInterval:         Number(all.polling_interval) || 5000,
      snapshotPollInterval:    Number(all.snapshot_poll_interval) || 300000,
      proxyRetentionDays:      Number(all.proxy_retention_days) || 30,
      proxyRetentionMaxRows:   Number(all.proxy_retention_max_rows) || 100000,
      snapshotRetentionDays:   Number(all.snapshot_retention_days) || 90,
      debugLogBodies:          all.debug_log_bodies === '1',
      proxyTrustForwardedFor:  all.proxy_trust_forwarded_for === '1',
      proxyMaxBodyBytes:       Number(all.proxy_max_body_bytes) || 52428800,

      // Notification settings (v3)
      notificationsEnabled:             all.notifications_enabled === '1',
      notificationCheckIntervalMs:      Number(all.notification_check_interval_ms) || 60000,
      notificationDedupMinutes:         Number(all.notification_dedup_minutes) || 15,
      notificationStartupGraceSeconds:  Number(all.notification_startup_grace_seconds) || 90,
      notificationRetentionDays:        Number(all.notification_retention_days) || 90,
      notifyOnProxyUnreachable:         all.notify_on_proxy_unreachable === '1',
      notifyOnFirecrawlUnreachable:     all.notify_on_firecrawl_unreachable === '1',
      notifyOnRedisUnhealthy:           all.notify_on_redis_unhealthy === '1',
      notifyOnBullAuthRejected:         all.notify_on_bull_auth_rejected === '1',
      notifyOnHighErrorRate:            all.notify_on_high_error_rate === '1',
      notificationErrorRateThreshold:   Number(all.notification_error_rate_threshold) || 0.5,
      notificationErrorRateMinOps:      Number(all.notification_error_rate_min_ops) || 10,
      ntfyEnabled:  all.ntfy_enabled === '1',
      ntfyUrl:      all.ntfy_url || 'https://ntfy.sh',
      ntfyTopic:    all.ntfy_topic || '',
      ntfyAuthType: all.ntfy_auth_type || 'none',
      ntfyUsername: all.ntfy_username || '',
      ntfyPassword: all.ntfy_password || '',
      ntfyPriority: Number(all.ntfy_priority) || 4,
      webhookEnabled:    all.webhook_enabled === '1',
      webhookUrl:        all.webhook_url || '',
      webhookAuthHeader: all.webhook_auth_header || '',
    },
  });
});

app.post('/api/settings', (req, res) => {
  const b = req.body || {};
  try {
    // Only update fields that are present in the body (allows partial updates)
    const map = {
      firecrawlUrl:            'firecrawl_url',
      apiKey:                  'api_key',
      bullAuthKey:             'bull_auth_key',
      dashboardPort:           'dashboard_port',
      proxyPort:               'proxy_port',
      pollingInterval:         'polling_interval',
      snapshotPollInterval:    'snapshot_poll_interval',
      proxyRetentionDays:      'proxy_retention_days',
      proxyRetentionMaxRows:   'proxy_retention_max_rows',
      snapshotRetentionDays:   'snapshot_retention_days',
      debugLogBodies:          'debug_log_bodies',
      proxyTrustForwardedFor:  'proxy_trust_forwarded_for',
      proxyMaxBodyBytes:       'proxy_max_body_bytes',

      // Notification settings (v3)
      notificationsEnabled:            'notifications_enabled',
      notificationCheckIntervalMs:     'notification_check_interval_ms',
      notificationDedupMinutes:        'notification_dedup_minutes',
      notificationStartupGraceSeconds: 'notification_startup_grace_seconds',
      notificationRetentionDays:       'notification_retention_days',
      notifyOnProxyUnreachable:        'notify_on_proxy_unreachable',
      notifyOnFirecrawlUnreachable:    'notify_on_firecrawl_unreachable',
      notifyOnRedisUnhealthy:          'notify_on_redis_unhealthy',
      notifyOnBullAuthRejected:        'notify_on_bull_auth_rejected',
      notifyOnHighErrorRate:           'notify_on_high_error_rate',
      notificationErrorRateThreshold:  'notification_error_rate_threshold',
      notificationErrorRateMinOps:     'notification_error_rate_min_ops',
      ntfyEnabled:       'ntfy_enabled',
      ntfyUrl:           'ntfy_url',
      ntfyTopic:         'ntfy_topic',
      ntfyAuthType:      'ntfy_auth_type',
      ntfyUsername:      'ntfy_username',
      ntfyPassword:      'ntfy_password',
      ntfyPriority:      'ntfy_priority',
      webhookEnabled:    'webhook_enabled',
      webhookUrl:        'webhook_url',
      webhookAuthHeader: 'webhook_auth_header',
    };
    for (const [jsonKey, dbKey] of Object.entries(map)) {
      if (b[jsonKey] !== undefined) {
        let v = b[jsonKey];
        if (typeof v === 'boolean') v = v ? '1' : '0';
        setSetting(db, dbKey, v);
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// Live Firecrawl metric fan-out (direct reads — NOT through proxy)
// These are dashboard-internal calls. They do not get logged in
// proxy_operations; they would drown out real traffic.
// ============================================================

function makeLiveMetricHandler(path) {
  return async (req, res) => {
    try {
      const data = await internalGet(db, path);
      res.json({ success: true, data });
    } catch (err) {
      const status = err.kind === 'timeout' ? 504 : 502;
      res.status(status).json({ success: false, error: err.message || 'Firecrawl unreachable' });
    }
  };
}

app.get('/api/firecrawl/queue-status', makeLiveMetricHandler('/v1/team/queue-status'));
app.get('/api/firecrawl/credit-usage', async (req, res) => {
  try {
    const data = await internalGet(db, '/v1/team/credit-usage');
    res.json({ success: true, data: data.data });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});
app.get('/api/firecrawl/token-usage', async (req, res) => {
  try {
    const data = await internalGet(db, '/v1/team/token-usage');
    res.json({ success: true, data: data.data });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});
app.get('/api/firecrawl/active-crawls', async (req, res) => {
  try {
    const data = await internalGet(db, '/v1/crawl/active');
    res.json({ success: true, data: { crawls: data.crawls || [] } });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});
app.get('/api/firecrawl/bull-queues', async (req, res) => {
  const key = getBullAuthKey(db);
  if (!key) return res.json({ success: true, data: null, reason: 'not_configured' });
  try {
    const data = await internalGet(db, `/admin/${encodeURIComponent(key)}/queues/api/queues`);
    res.json({ success: true, data });
  } catch (err) {
    if (err.status === 401 || err.status === 404) {
      return res.status(502).json({ success: false, error: 'BULL_AUTH rejected' });
    }
    res.status(502).json({ success: false, error: err.message });
  }
});
app.get('/api/firecrawl/redis-health', async (req, res) => {
  const key = getBullAuthKey(db);
  if (!key) return res.json({ success: true, data: null, reason: 'not_configured' });
  try {
    const data = await internalGet(db, `/admin/${encodeURIComponent(key)}/redis-health`);
    res.json({ success: true, data });
  } catch (err) {
    if (err.status === 401 || err.status === 404) {
      return res.status(502).json({ success: false, error: 'BULL_AUTH rejected' });
    }
    res.status(502).json({ success: false, error: err.message });
  }
});

// ============================================================
// Stats from proxy_operations (the new observation log)
// ============================================================

function wrapStats(handler) {
  return (req, res) => {
    try {
      res.json({ success: true, data: handler(db, req.query) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

// Existing stats endpoints now pass the full query object as the filter bag.
// buildFilterClause inside each query function extracts only the keys it
// understands, so unrelated query params (like `limit`, `bucket`, `offset`)
// are still handled separately by the query functions.
app.get('/api/stats/proxy/overview',    wrapStats((db, q) => getOverview(db, q)));
app.get('/api/stats/proxy/timeline',    wrapStats((db, q) => getTimeline(db, q)));
app.get('/api/stats/proxy/clients',     wrapStats((db, q) => getClients(db, q)));
app.get('/api/stats/proxy/domains',     wrapStats((db, q) => getDomains(db, q)));
app.get('/api/stats/proxy/errors',      wrapStats((db, q) => getErrors(db, q)));
app.get('/api/stats/proxy/credits',     wrapStats((db, q) => getCredits(db, q)));
app.get('/api/stats/proxy/recent',      wrapStats((db, q) => getRecent(db, q)));
app.get('/api/stats/snapshots',         wrapStats((db, q) => getSnapshots(db, q)));

// New Reports-page endpoints
app.get('/api/stats/proxy/distribution', wrapStats((db, q) => getDistribution(db, q)));
app.get('/api/stats/proxy/status-codes', wrapStats((db, q) => getStatusCodes(db, q)));
app.get('/api/stats/proxy/heatmap',      wrapStats((db, q) => getHeatmap(db, q)));

// Single-operation detail — used by the detail drawer
app.get('/api/stats/proxy/operation/:id', (req, res) => {
  try {
    const row = getOperationDetail(db, parseInt(req.params.id, 10));
    if (!row) return res.status(404).json({ success: false, error: 'operation not found' });
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Crawl lifecycle — all rows sharing a firecrawl_id
app.get('/api/stats/proxy/crawl/:firecrawl_id', (req, res) => {
  try {
    const rows = getCrawlLifecycle(db, req.params.firecrawl_id);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// CSV export — streamed, never loads more than one row at a time
app.get('/api/stats/proxy/export.csv', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="firecrawl-proxy-export.csv"');
    const written = exportRowsAsCsv(db, req.query, res, 10000);
    res.end();
    console.log(`[reports] CSV export wrote ${written} rows`);
  } catch (error) {
    // If headers haven't been sent yet, return JSON error
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.end();
    }
  }
});

// ============================================================
// Maintenance
// ============================================================

app.get('/api/maintenance/dbsize', (req, res) => {
  try { res.json({ success: true, data: getDbSize(db) }); }
  catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/maintenance', (req, res) => {
  try { res.json({ success: true, data: runHousekeeping(db) }); }
  catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================================================
// Notifications (v3)
// ============================================================

/**
 * GET /api/notifications/recent?limit=20
 * Returns the most recent notification_log rows with JSON blobs parsed.
 */
app.get('/api/notifications/recent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 200);
  try {
    const rows = db.prepare(`
      SELECT id, timestamp, event_type, severity, title, message, details, destinations, results, success
      FROM notification_log
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit);
    const parsed = rows.map(r => ({
      ...r,
      details: r.details ? JSON.parse(r.details) : null,
      destinations: JSON.parse(r.destinations),
      results: JSON.parse(r.results),
      success: r.success === 1,
    }));
    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/test
 * Dispatches a synthetic test event to whatever destinations are configured.
 * Bypasses dedup (test events should fire whenever the user clicks the button).
 */
app.post('/api/notifications/test', async (req, res) => {
  const event = {
    event_type: 'test',
    severity: 'info',
    title: 'Firecrawl Dashboard test notification',
    message: 'If you see this, your notification configuration is working. This is a manual test from the Settings page.',
    details: { from: 'settings-page-test-button', at: new Date().toISOString() },
    timestamp: new Date().toISOString(),
  };
  try {
    const result = await dispatchNotification(db, event);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// SPA fallback (production only)
// ============================================================

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get(/.*/, (req, res) => res.sendFile(join(__dirname, '../dist/index.html')));
}

// ============================================================
// Start workers and listen
// ============================================================

const snapshotPoller = createSnapshotPoller(db);
snapshotPoller.start();

const stopHousekeeping = startHousekeepingSchedule(db);

const notificationWatcher = createWatcher(db);
notificationWatcher.start();

const server = app.listen(PORT, () => {
  console.log(`[dashboard] listening on :${PORT} (schema v${CURRENT_SCHEMA_VERSION}) firecrawl=${getFirecrawlUrl(db)}`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[dashboard] ${signal} received, shutting down...`);
  snapshotPoller.stop();
  stopHousekeeping();
  notificationWatcher.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Safety: force exit if close hangs
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
