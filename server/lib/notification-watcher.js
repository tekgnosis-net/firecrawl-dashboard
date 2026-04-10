import axios from 'axios';
import { internalGet } from './firecrawl-client.js';
import { getOverview } from './stats-queries.js';
import { dispatch } from './notifier.js';
import {
  getNotificationsEnabled,
  getNotificationCheckIntervalMs,
  getNotificationStartupGraceSeconds,
  getNotificationDedupMinutes,
  getEventEnabled,
  getErrorRateThreshold,
  getErrorRateMinOps,
  getBullAuthKey,
  getProxyPort,
  getProxyHost,
  getProxyHealthUrl,
} from './settings.js';

/**
 * Notification watcher — background worker that evaluates event conditions
 * on an interval and dispatches alerts via the notifier module.
 *
 * Runs only in the dashboard process. The proxy process has no awareness
 * of notifications. All state lives in the shared SQLite DB (notification_log
 * for dedup, settings for configuration).
 *
 * Lifecycle:
 *   - start()  → wait for startup grace period, then run a tick, then
 *                schedule setInterval for subsequent ticks
 *   - stop()   → clear startup timeout and interval handle; idempotent
 *
 * Each tick fans out the enabled event checks via Promise.allSettled so a
 * slow upstream doesn't block other checks. Failed checks log but don't
 * crash the tick.
 */

// ============================================================
// Dedup: query the most recent successful fire for this event type
// ============================================================

function wasRecentlyFired(db, eventType, dedupMinutes) {
  const row = db.prepare(`
    SELECT timestamp FROM notification_log
    WHERE event_type = ? AND success = 1
    ORDER BY timestamp DESC LIMIT 1
  `).get(eventType);
  if (!row) return false;
  const ageMs = Date.now() - new Date(row.timestamp).getTime();
  return ageMs < dedupMinutes * 60_000;
}

// ============================================================
// Event check functions
// Each returns either null (condition not firing) or an event object
// ready for notifier.dispatch(db, event).
// ============================================================

async function checkProxyUnreachable(db) {
  const port = getProxyPort(db);
  const host = getProxyHost();
  try {
    // Use getProxyHealthUrl so the probe honors PROXY_HOST. In Docker
    // the dashboard and proxy live in separate containers; `localhost`
    // from the dashboard container would not reach the proxy container.
    await axios.get(getProxyHealthUrl(db), { timeout: 2000 });
    return null; // proxy is alive
  } catch (err) {
    return {
      event_type: 'proxy_unreachable',
      severity: 'critical',
      title: 'Firecrawl proxy is down',
      message: `The transparent Firecrawl proxy on ${host}:${port} is unreachable. External clients submitting scrape/crawl/search requests through the proxy will receive connection errors until it is restarted.`,
      details: { host, port, probe_error: err.message || String(err) },
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkFirecrawlUnreachable(db) {
  try {
    await internalGet(db, '/', { timeoutMs: 5000 });
    return null; // Firecrawl root responded
  } catch (err) {
    return {
      event_type: 'firecrawl_unreachable',
      severity: 'critical',
      title: 'Firecrawl server is unreachable',
      message: `The Firecrawl server cannot be reached. The proxy will return 502 errors to all client requests until the server recovers.`,
      details: { kind: err.kind || 'unknown', error: err.message || String(err) },
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkRedisUnhealthy(db) {
  const bullKey = getBullAuthKey(db);
  if (!bullKey) return null; // can't check without the admin key
  try {
    const response = await internalGet(db, `/admin/${encodeURIComponent(bullKey)}/redis-health`, { timeoutMs: 5000 });
    if (response?.status === 'healthy') return null;
    return {
      event_type: 'redis_unhealthy',
      severity: 'warning',
      title: 'Firecrawl Redis is degraded',
      message: `Firecrawl's Redis subsystem reports non-healthy state: ${response?.status || 'unknown'}. Queue operations may be delayed or failing.`,
      details: response?.details || response || {},
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    // Treat unreachable as a separate concern (covered by firecrawl_unreachable)
    return null;
  }
}

async function checkBullAuthRejected(db) {
  const bullKey = getBullAuthKey(db);
  if (!bullKey) return null; // no key configured, no check
  try {
    await internalGet(db, `/admin/${encodeURIComponent(bullKey)}/queues/api/queues`, { timeoutMs: 5000 });
    return null; // auth accepted
  } catch (err) {
    // Only fire if the upstream specifically rejected our auth (401/404),
    // not on generic transport failures.
    if (err.status === 401 || err.status === 404) {
      return {
        event_type: 'bull_auth_rejected',
        severity: 'critical',
        title: 'BULL_AUTH credential rejected',
        message: `The configured Bull admin auth key is no longer accepted by Firecrawl (HTTP ${err.status}). BullMQ queue and Redis health metrics will not be available until the key is updated in Settings.`,
        details: { status: err.status, error: err.message },
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }
}

async function checkHighErrorRate(db) {
  try {
    const overview = getOverview(db, { hours: 5 / 60 }); // 5-minute window
    const threshold = getErrorRateThreshold(db);
    const minOps = getErrorRateMinOps(db);

    if (overview.total < minOps) return null;
    const failureRate = 1 - (overview.successRate ?? 1);
    if (failureRate < threshold) return null;

    return {
      event_type: 'high_error_rate',
      severity: 'warning',
      title: `High proxy error rate: ${Math.round(failureRate * 100)}% failing`,
      message: `Proxy observed ${overview.failed}/${overview.total} failed operations in the last 5 minutes. Threshold is ${Math.round(threshold * 100)}% (minimum ${minOps} ops).`,
      details: {
        window: '5m',
        total: overview.total,
        success: overview.success,
        failed: overview.failed,
        successRate: overview.successRate,
        threshold,
        minOps,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    // Don't let stats query failures crash the tick
    console.error('[notification-watcher] error-rate check failed:', err.message);
    return null;
  }
}

// Registry of all checks. Each entry is [event_type, checkFunction].
// The event_type key must match the setting key via getEventEnabled.
const CHECKS = [
  ['proxy_unreachable',     checkProxyUnreachable],
  ['firecrawl_unreachable', checkFirecrawlUnreachable],
  ['redis_unhealthy',       checkRedisUnhealthy],
  ['bull_auth_rejected',    checkBullAuthRejected],
  ['high_error_rate',       checkHighErrorRate],
];

// ============================================================
// Watcher factory
// ============================================================

export function createWatcher(db) {
  let intervalHandle = null;
  let startupHandle = null;
  let tickCount = 0;

  /**
   * Run one evaluation pass. Fires any non-deduped events. Never throws.
   */
  async function runTick() {
    tickCount++;
    if (!getNotificationsEnabled(db)) return;

    const dedupMin = getNotificationDedupMinutes(db);
    const enabledChecks = CHECKS.filter(([eventType]) => getEventEnabled(db, eventType));
    if (enabledChecks.length === 0) return;

    const results = await Promise.allSettled(
      enabledChecks.map(([, fn]) => fn(db))
    );

    for (let i = 0; i < results.length; i++) {
      const [eventType] = enabledChecks[i];
      const outcome = results[i];

      if (outcome.status === 'rejected') {
        console.error(`[notification-watcher] ${eventType} check rejected:`, outcome.reason?.message || outcome.reason);
        continue;
      }
      const event = outcome.value;
      if (!event) continue; // condition not firing

      if (wasRecentlyFired(db, event.event_type, dedupMin)) {
        // Dedup suppressed this fire; quietly skip
        continue;
      }

      try {
        const dispatchResult = await dispatch(db, event);
        if (dispatchResult.success === 1) {
          console.log(`[notification-watcher] dispatched ${event.event_type} (${event.severity}) → ${dispatchResult.destinations.join(', ')}`);
        } else if (dispatchResult.skipped) {
          console.log(`[notification-watcher] ${event.event_type} firing but no destinations enabled`);
        } else {
          console.warn(`[notification-watcher] dispatch failed for ${event.event_type}:`, JSON.stringify(dispatchResult.results));
        }
      } catch (err) {
        console.error(`[notification-watcher] dispatch error for ${event.event_type}:`, err.message);
      }
    }
  }

  function start() {
    const interval = getNotificationCheckIntervalMs(db);
    const grace = getNotificationStartupGraceSeconds(db) * 1000;
    if (interval <= 0) {
      console.log('[notification-watcher] disabled (check_interval_ms=0)');
      return;
    }

    startupHandle = setTimeout(() => {
      runTick().catch(err => console.error('[notification-watcher] initial tick error:', err.message));
      intervalHandle = setInterval(() => {
        runTick().catch(err => console.error('[notification-watcher] tick error:', err.message));
      }, interval);
      console.log(`[notification-watcher] started; grace=${grace}ms interval=${interval}ms`);
    }, grace);

    console.log(`[notification-watcher] waiting ${grace}ms for startup grace period...`);
  }

  function stop() {
    if (startupHandle) {
      clearTimeout(startupHandle);
      startupHandle = null;
    }
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  // Exposed for the POST /api/notifications/test endpoint and for manual testing.
  async function runOnceForDebug() {
    await runTick();
  }

  function getStats() {
    return { tickCount };
  }

  return { start, stop, runOnceForDebug, getStats };
}
