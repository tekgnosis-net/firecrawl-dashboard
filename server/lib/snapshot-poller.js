import { internalGet } from './firecrawl-client.js';
import { getSnapshotPollInterval } from './settings.js';

/**
 * Server-metrics snapshot poller.
 *
 * Runs in the dashboard process only. Polls Firecrawl's /v1/team/queue-status,
 * /v1/team/credit-usage, /v1/team/token-usage on an interval and inserts
 * one row per tick into server_metrics_snapshots.
 *
 * Uses Promise.allSettled so a single failed endpoint doesn't skip the row
 * entirely — missing fields are logged as NULL and fetch_ok=0 marks the row
 * as partial. The trend charts honor fetch_ok when drawing gaps.
 *
 * Scheduling: first capture 10s after startup (gives Firecrawl time to be
 * ready after a fresh `docker compose up -d`), then on the configured interval.
 * Call stop() on graceful shutdown.
 */

export function createSnapshotPoller(db) {
  let intervalHandle = null;
  let startupHandle = null;

  const insert = db.prepare(`
    INSERT INTO server_metrics_snapshots (
      timestamp, jobs_in_queue, active_jobs, waiting_jobs,
      max_concurrency, most_recent_success,
      remaining_credits, plan_credits,
      remaining_tokens, plan_tokens,
      fetch_ok
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Tracks endpoints that consistently return 5xx (typically billing endpoints
  // on self-hosted Firecrawl without Autumn). Once classified as "unavailable",
  // we stop logging their absence as a failure on every tick — the row is
  // still written with NULLs for those columns so trend charts show gaps.
  const unavailable = new Set();

  function isUpstreamUnavailable(settled) {
    return settled.status === 'rejected'
        && settled.reason?.kind === 'http'
        && settled.reason?.status >= 500
        && settled.reason?.status < 600;
  }

  async function captureSnapshot() {
    const timestamp = new Date().toISOString();
    const results = await Promise.allSettled([
      internalGet(db, '/v1/team/queue-status'),
      internalGet(db, '/v1/team/credit-usage'),
      internalGet(db, '/v1/team/token-usage'),
    ]);

    const [queueRes, creditRes, tokenRes] = results;
    const queue = queueRes.status === 'fulfilled' ? queueRes.value : null;
    const credit = creditRes.status === 'fulfilled' ? creditRes.value?.data : null;
    const token = tokenRes.status === 'fulfilled' ? tokenRes.value?.data : null;

    if (isUpstreamUnavailable(creditRes) && !unavailable.has('credit-usage')) {
      unavailable.add('credit-usage');
      console.log('[snapshot-poller] /v1/team/credit-usage is unavailable on this deployment (5xx); suppressing further failure logs');
    }
    if (isUpstreamUnavailable(tokenRes) && !unavailable.has('token-usage')) {
      unavailable.add('token-usage');
      console.log('[snapshot-poller] /v1/team/token-usage is unavailable on this deployment (5xx); suppressing further failure logs');
    }

    // A snapshot is "OK" if every endpoint that is *expected* to work did. An
    // endpoint classified as persistently unavailable no longer counts against
    // fetch_ok — otherwise every row would be marked partial forever.
    const queueOk  = !!queue;
    const creditOk = !!credit || unavailable.has('credit-usage');
    const tokenOk  = !!token  || unavailable.has('token-usage');
    const allOk = queueOk && creditOk && tokenOk;

    try {
      insert.run(
        timestamp,
        queue?.jobsInQueue ?? null,
        queue?.activeJobsInQueue ?? null,
        queue?.waitingJobsInQueue ?? null,
        queue?.maxConcurrency ?? null,
        queue?.mostRecentSuccess ?? null,
        credit?.remaining_credits ?? null,
        credit?.plan_credits ?? null,
        token?.remaining_tokens ?? null,
        token?.plan_tokens ?? null,
        allOk ? 1 : 0,
      );
    } catch (err) {
      console.error('[snapshot-poller] insert failed:', err.message);
      return;
    }

    if (!allOk) {
      const failed = [];
      if (!queueOk)  failed.push('queue-status');
      if (!creditOk) failed.push('credit-usage');
      if (!tokenOk)  failed.push('token-usage');
      console.warn(`[snapshot-poller] partial snapshot at ${timestamp}; failed: ${failed.join(', ')}`);
    }
  }

  function start() {
    const interval = getSnapshotPollInterval(db);
    if (interval <= 0) {
      console.log('[snapshot-poller] disabled (snapshot_poll_interval=0)');
      return;
    }
    // First capture 10s after startup
    startupHandle = setTimeout(() => {
      captureSnapshot();
      intervalHandle = setInterval(captureSnapshot, interval);
      console.log(`[snapshot-poller] started; first tick done, interval=${interval}ms`);
    }, 10_000);
  }

  function stop() {
    if (startupHandle) { clearTimeout(startupHandle); startupHandle = null; }
    if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
  }

  return { start, stop, captureSnapshot };
}
