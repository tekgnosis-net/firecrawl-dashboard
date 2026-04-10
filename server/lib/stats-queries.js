/**
 * SQL queries powering the /api/stats/proxy/* endpoints.
 *
 * Each exported function takes the db handle + a small params object
 * and returns a plain JSON-serializable object. The dashboard route
 * handlers just wrap the result in { success, data }.
 *
 * Time windows are expressed in hours (numeric). All queries use
 * parameterized values; no string interpolation of user input.
 *
 * The timeline and credits queries support two bucket granularities:
 *   - 'hour'  → YYYY-MM-DDTHH:00:00Z
 *   - '5min'  → YYYY-MM-DDTHH:MM:00Z rounded to nearest 5 minutes
 */

function clampHours(hours, max = 720) {
  // Accept fractional hours (e.g. 5/60 for a 5-minute window used by
  // checkHighErrorRate) and treat null/undefined/NaN as "use default 24".
  // We avoid `parseInt` + `|| 24` because parseInt(0.083) === 0 which
  // then triggers the fallback and silently turns a 5-minute window into
  // a 24-hour window.
  const parsed = hours == null || hours === '' ? 24 : Number(hours);
  const n = Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
  // Clamp to a sensible minimum (1 minute = 1/60 hour) so "0" or negative
  // inputs don't disable the filter entirely.
  return Math.min(Math.max(1 / 60, n), max);
}

function clampLimit(limit, fallback = 10, max = 200) {
  const n = Math.max(1, parseInt(limit, 10) || fallback);
  return Math.min(n, max);
}

/**
 * Overview — single-row summary of activity in the last N hours.
 */
export function getOverview(db, { hours = 24 } = {}) {
  const h = clampHours(hours);

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(success), 0) AS success,
      COALESCE(SUM(1 - success), 0) AS failed,
      COALESCE(SUM(credits_used), 0) AS creditsUsed,
      COUNT(DISTINCT client_ip) AS uniqueClients,
      COUNT(DISTINCT target_host) AS uniqueDomains,
      COALESCE(AVG(duration_ms), 0) AS avgDurationMs
    FROM proxy_operations
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
  `).get(h);

  // p95 duration — SQLite has no PERCENTILE_CONT; use OFFSET trick
  const p95Row = db.prepare(`
    SELECT duration_ms FROM proxy_operations
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
    ORDER BY duration_ms
    LIMIT 1 OFFSET (
      SELECT CAST(COUNT(*) * 95 / 100 AS INTEGER)
      FROM proxy_operations
      WHERE timestamp >= datetime('now', '-' || ? || ' hours')
    )
  `).get(h, h);

  // byType breakdown
  const byTypeRows = db.prepare(`
    SELECT operation_type, COUNT(*) AS count, SUM(success) AS success
    FROM proxy_operations
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
    GROUP BY operation_type
    ORDER BY count DESC
  `).all(h);

  const byType = {};
  for (const row of byTypeRows) byType[row.operation_type] = { count: row.count, success: row.success };

  const total = summary.total || 0;
  const successRate = total > 0 ? (summary.success / total) : null;

  return {
    hours: h,
    total,
    success: summary.success,
    failed: summary.failed,
    successRate,
    creditsUsed: summary.creditsUsed,
    uniqueClients: summary.uniqueClients,
    uniqueDomains: summary.uniqueDomains,
    avgDurationMs: Math.round(summary.avgDurationMs),
    p95DurationMs: p95Row?.duration_ms ?? null,
    byType,
  };
}

/**
 * Timeline — buckets of operation counts pivoted by type.
 * Returns an array of rows: [{ bucket, total, success, failed, <type1>, <type2>, ... }, ...]
 */
export function getTimeline(db, { hours = 24, bucket = '5min' } = {}) {
  const h = clampHours(hours);

  // Bucket expression depends on granularity
  let bucketExpr;
  if (bucket === 'hour') {
    bucketExpr = `strftime('%Y-%m-%dT%H:00:00Z', timestamp)`;
  } else {
    // 5-minute buckets: round the minute component to the nearest lower multiple of 5
    bucketExpr = `strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d:00Z', (CAST(strftime('%M', timestamp) AS INTEGER) / 5) * 5)`;
  }

  const rows = db.prepare(`
    SELECT
      ${bucketExpr} AS bucket,
      operation_type,
      COUNT(*) AS n,
      SUM(success) AS successes
    FROM proxy_operations
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
    GROUP BY bucket, operation_type
    ORDER BY bucket
  `).all(h);

  // Pivot in JS: one row per bucket, columns per operation_type
  const byBucket = new Map();
  for (const row of rows) {
    if (!byBucket.has(row.bucket)) {
      byBucket.set(row.bucket, { bucket: row.bucket, total: 0, success: 0, failed: 0 });
    }
    const entry = byBucket.get(row.bucket);
    entry[row.operation_type] = row.n;
    entry.total += row.n;
    entry.success += row.successes;
    entry.failed += (row.n - row.successes);
  }

  return Array.from(byBucket.values());
}

/**
 * Clients — top clients by request count in the window.
 */
export function getClients(db, { hours = 24, limit = 20 } = {}) {
  const h = clampHours(hours);
  const l = clampLimit(limit, 20);

  return db.prepare(`
    SELECT
      client_ip,
      client_ua,
      COUNT(*) AS count,
      SUM(success) AS success,
      SUM(1 - success) AS failed,
      COALESCE(SUM(credits_used), 0) AS creditsUsed,
      MAX(timestamp) AS lastSeenAt
    FROM proxy_operations
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
    GROUP BY client_ip, client_ua
    ORDER BY count DESC
    LIMIT ?
  `).all(h, l);
}

/**
 * Domains — top target hostnames in the window.
 */
export function getDomains(db, { hours = 24, limit = 10 } = {}) {
  const h = clampHours(hours);
  const l = clampLimit(limit, 10);

  return db.prepare(`
    SELECT
      target_host,
      COUNT(*) AS count,
      CAST(SUM(success) AS REAL) / COUNT(*) AS successRate
    FROM proxy_operations
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
      AND target_host IS NOT NULL
    GROUP BY target_host
    ORDER BY count DESC
    LIMIT ?
  `).all(h, l);
}

/**
 * Errors — recent failures with their details.
 */
export function getErrors(db, { hours = 24, limit = 50 } = {}) {
  const h = clampHours(hours);
  const l = clampLimit(limit, 50, 500);

  return db.prepare(`
    SELECT
      id, timestamp, operation_type, target_url, client_ip,
      response_status, error_message, duration_ms
    FROM proxy_operations
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
      AND success = 0
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(h, l);
}

/**
 * Credits — credit usage time series, summed per bucket.
 */
export function getCredits(db, { hours = 168, bucket = 'hour' } = {}) {
  const h = clampHours(hours, 720);

  let bucketExpr;
  if (bucket === 'day') {
    bucketExpr = `strftime('%Y-%m-%dT00:00:00Z', timestamp)`;
  } else if (bucket === '5min') {
    bucketExpr = `strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d:00Z', (CAST(strftime('%M', timestamp) AS INTEGER) / 5) * 5)`;
  } else {
    bucketExpr = `strftime('%Y-%m-%dT%H:00:00Z', timestamp)`;
  }

  return db.prepare(`
    SELECT
      ${bucketExpr} AS bucket,
      COALESCE(SUM(credits_used), 0) AS creditsUsed,
      COUNT(*) AS operations
    FROM proxy_operations
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
      AND credits_used IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket
  `).all(h);
}

/**
 * Recent — most recent operations, with optional type filter.
 */
export function getRecent(db, { limit = 50, type = null, client = null } = {}) {
  const l = clampLimit(limit, 50, 500);

  const where = ['1=1'];
  const params = [];
  if (type) { where.push('operation_type = ?'); params.push(type); }
  if (client) { where.push('client_ip = ?'); params.push(client); }

  const sql = `
    SELECT
      id, timestamp, method, path, operation_type,
      client_ip, client_ua,
      target_url, target_host, query_text,
      response_status, success, error_message,
      firecrawl_id, credits_used, duration_ms, upstream_response_time_ms
    FROM proxy_operations
    WHERE ${where.join(' AND ')}
    ORDER BY timestamp DESC
    LIMIT ?
  `;
  params.push(l);

  return db.prepare(sql).all(...params);
}

/**
 * Snapshots — server_metrics_snapshots in the window.
 * Returns rows ordered ascending for trend charts.
 */
export function getSnapshots(db, { hours = 168 } = {}) {
  const h = clampHours(hours, 720);

  return db.prepare(`
    SELECT
      timestamp, jobs_in_queue, active_jobs, waiting_jobs,
      max_concurrency, most_recent_success,
      remaining_credits, plan_credits,
      remaining_tokens, plan_tokens,
      fetch_ok
    FROM server_metrics_snapshots
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
    ORDER BY timestamp ASC
  `).all(h);
}
