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
 * Build a SQL WHERE clause fragment from a filter bag.
 *
 * Returns { sql, params } where `sql` is a string that always begins
 * with `1=1` so callers can unconditionally prepend `WHERE ${sql}` or
 * append ` AND <other>` without worrying about empty-filter edge cases.
 * `params` is the ordered positional parameter array ready to pass to
 * better-sqlite3's `.all(...)` / `.get(...)` / `.iterate(...)`.
 *
 * Supported filter keys (all optional):
 *   hours             — fractional hours, defaults to 24 when no explicit range
 *   from, to          — ISO 8601 range, overrides `hours` when both present
 *   operation_type    — string; comma-separated list for IN (...) matching
 *   client_ip         — exact match
 *   target_host       — exact match
 *   firecrawl_id      — exact match (used by the crawl lifecycle view)
 *   status_class      — '2xx' | '3xx' | '4xx' | '5xx', shorthand for a 100-wide range
 *   status_min        — response_status >= ?
 *   status_max        — response_status <= ?
 *   success           — 'true'/'false'/'1'/'0'/boolean
 *   q                 — free-text LIKE across target_url, query_text, error_message
 *
 * Unknown keys are ignored silently, so this is safe to call with
 * `req.query` objects that include unrelated params (like `limit`,
 * `offset`, `bucket`) which each caller handles separately.
 */
function buildFilterClause(filters = {}) {
  const conditions = ['1=1'];
  const params = [];

  // Time range: explicit from/to wins over `hours`
  if (filters.from && filters.to) {
    conditions.push('timestamp >= ? AND timestamp < ?');
    params.push(filters.from, filters.to);
  } else {
    const hours = clampHours(filters.hours, 720);
    conditions.push("timestamp >= datetime('now', '-' || ? || ' hours')");
    params.push(hours);
  }

  if (filters.operation_type) {
    const types = String(filters.operation_type).split(',').map(s => s.trim()).filter(Boolean);
    if (types.length === 1) {
      conditions.push('operation_type = ?');
      params.push(types[0]);
    } else if (types.length > 1) {
      conditions.push(`operation_type IN (${types.map(() => '?').join(',')})`);
      params.push(...types);
    }
  }

  if (filters.client_ip) {
    conditions.push('client_ip = ?');
    params.push(filters.client_ip);
  }

  if (filters.target_host) {
    conditions.push('target_host = ?');
    params.push(filters.target_host);
  }

  if (filters.firecrawl_id) {
    conditions.push('firecrawl_id = ?');
    params.push(filters.firecrawl_id);
  }

  // HTTP status code filtering — either a shorthand class or explicit bounds
  if (filters.status_class) {
    const classMap = { '2xx': [200, 300], '3xx': [300, 400], '4xx': [400, 500], '5xx': [500, 600] };
    const range = classMap[String(filters.status_class)];
    if (range) {
      conditions.push('response_status >= ? AND response_status < ?');
      params.push(range[0], range[1]);
    }
  }
  // status_min / status_max are only applied when the parsed value is
  // a finite number. A non-numeric input (e.g. ?status_min=abc) would
  // otherwise bind NaN into the query, producing surprising results.
  if (filters.status_min !== undefined && filters.status_min !== '') {
    const n = parseInt(filters.status_min, 10);
    if (Number.isFinite(n)) {
      conditions.push('response_status >= ?');
      params.push(n);
    }
  }
  if (filters.status_max !== undefined && filters.status_max !== '') {
    const n = parseInt(filters.status_max, 10);
    if (Number.isFinite(n)) {
      conditions.push('response_status <= ?');
      params.push(n);
    }
  }

  // Success flag — accept strings or booleans
  if (filters.success === 'true' || filters.success === '1' || filters.success === true) {
    conditions.push('success = 1');
  } else if (filters.success === 'false' || filters.success === '0' || filters.success === false) {
    conditions.push('success = 0');
  }

  // Free-text LIKE across user-visible fields. This is a linear scan but
  // the preceding time-range filter bounds the set to whatever matched
  // `from/to` or `hours`, so the scan is cheap in practice.
  if (filters.q && String(filters.q).trim().length > 0) {
    conditions.push('(target_url LIKE ? OR query_text LIKE ? OR error_message LIKE ?)');
    const like = `%${String(filters.q).trim()}%`;
    params.push(like, like, like);
  }

  return { sql: conditions.join(' AND '), params };
}

/**
 * Overview — single-row summary of activity under the given filter.
 * Accepts the full filter bag (time range + all the drill-down filters);
 * backward-compatible with the old `{hours}` shape.
 */
export function getOverview(db, filters = {}) {
  const { sql: where, params } = buildFilterClause(filters);

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
    WHERE ${where}
  `).get(...params);

  // p95 duration — SQLite has no PERCENTILE_CONT; use OFFSET trick.
  // The subquery needs the same WHERE clause with the same params, so
  // we pass the params twice (once for the outer SELECT, once for the
  // inner OFFSET COUNT).
  const p95Row = db.prepare(`
    SELECT duration_ms FROM proxy_operations
    WHERE ${where}
    ORDER BY duration_ms
    LIMIT 1 OFFSET (
      SELECT CAST(COUNT(*) * 95 / 100 AS INTEGER)
      FROM proxy_operations
      WHERE ${where}
    )
  `).get(...params, ...params);

  // byType breakdown
  const byTypeRows = db.prepare(`
    SELECT operation_type, COUNT(*) AS count, SUM(success) AS success
    FROM proxy_operations
    WHERE ${where}
    GROUP BY operation_type
    ORDER BY count DESC
  `).all(...params);

  const byType = {};
  for (const row of byTypeRows) byType[row.operation_type] = { count: row.count, success: row.success };

  const total = summary.total || 0;
  const successRate = total > 0 ? (summary.success / total) : null;

  return {
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
export function getTimeline(db, filters = {}) {
  const { sql: where, params } = buildFilterClause(filters);
  const bucket = filters.bucket || '5min';

  // Bucket expression depends on granularity
  let bucketExpr;
  if (bucket === 'hour') {
    bucketExpr = `strftime('%Y-%m-%dT%H:00:00Z', timestamp)`;
  } else if (bucket === 'day') {
    bucketExpr = `strftime('%Y-%m-%dT00:00:00Z', timestamp)`;
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
    WHERE ${where}
    GROUP BY bucket, operation_type
    ORDER BY bucket
  `).all(...params);

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
 * Clients — top clients by request count under the given filter.
 */
export function getClients(db, filters = {}) {
  const { sql: where, params } = buildFilterClause(filters);
  const l = clampLimit(filters.limit, 20);

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
    WHERE ${where}
    GROUP BY client_ip, client_ua
    ORDER BY count DESC
    LIMIT ?
  `).all(...params, l);
}

/**
 * Domains — top target hostnames under the given filter.
 */
export function getDomains(db, filters = {}) {
  const { sql: where, params } = buildFilterClause(filters);
  const l = clampLimit(filters.limit, 10);

  return db.prepare(`
    SELECT
      target_host,
      COUNT(*) AS count,
      CAST(SUM(success) AS REAL) / COUNT(*) AS successRate
    FROM proxy_operations
    WHERE ${where}
      AND target_host IS NOT NULL
    GROUP BY target_host
    ORDER BY count DESC
    LIMIT ?
  `).all(...params, l);
}

/**
 * Errors — recent failures with their details.
 *
 * Note: this helper forces `success = 0` regardless of the caller's
 * filter, because it's specifically the "recent failures" view. If a
 * caller wants success=true rows, they should use getRecent instead.
 */
export function getErrors(db, filters = {}) {
  const { sql: where, params } = buildFilterClause({ ...filters, success: 'false' });
  const l = clampLimit(filters.limit, 50, 500);

  return db.prepare(`
    SELECT
      id, timestamp, operation_type, target_url, client_ip,
      response_status, error_message, duration_ms
    FROM proxy_operations
    WHERE ${where}
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(...params, l);
}

/**
 * Credits — credit usage time series, summed per bucket.
 * Default window is 168 hours (7 days) — override via filters.hours.
 */
export function getCredits(db, filters = {}) {
  // Default 168h (7 days) when caller didn't provide hours
  const effective = filters.hours === undefined && !filters.from
    ? { ...filters, hours: 168 }
    : filters;
  const { sql: where, params } = buildFilterClause(effective);
  const bucket = filters.bucket || 'hour';

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
    WHERE ${where}
      AND credits_used IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket
  `).all(...params);
}

/**
 * Recent — paginated operations under the given filter, with total count.
 * Returns { rows, total, limit, offset } so the client can render
 * "Page X of N" + "< Prev / Next >" controls.
 *
 * Legacy shape support: if a caller passes { type, client } (the old
 * getRecent API from before Reports), they're remapped to operation_type
 * and client_ip for backward compatibility.
 */
export function getRecent(db, filters = {}) {
  // Legacy-shape remapping
  const effective = { ...filters };
  if (effective.type && !effective.operation_type) effective.operation_type = effective.type;
  if (effective.client && !effective.client_ip) effective.client_ip = effective.client;

  const { sql: where, params } = buildFilterClause(effective);
  const limit = clampLimit(effective.limit, 50, 500);
  const offset = Math.max(parseInt(effective.offset, 10) || 0, 0);

  const rows = db.prepare(`
    SELECT
      id, timestamp, method, path, operation_type,
      client_ip, client_ua,
      target_url, target_host, query_text,
      response_status, response_size, success, error_message,
      firecrawl_id, credits_used, scraped_status_code, concurrency_limited,
      duration_ms, upstream_response_time_ms
    FROM proxy_operations
    WHERE ${where}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Backward-compatible: the default return shape is a plain array of
  // rows, because Dashboard polling (`proxyStats.recentOps` in the
  // store) and CrawlPage both iterate this as an array. The Reports
  // page opts in to the paginated envelope by passing `paginated=1`
  // in the query string, which also triggers the COUNT query used
  // for pagination metadata.
  const paginated = filters.paginated === '1'
    || filters.paginated === 'true'
    || filters.paginated === true;
  if (!paginated) return rows;

  const { total } = db.prepare(`
    SELECT COUNT(*) AS total FROM proxy_operations WHERE ${where}
  `).get(...params);

  return { rows, total, limit, offset };
}

/**
 * Snapshots — server_metrics_snapshots in the window.
 * Returns rows ordered ascending for trend charts.
 * (Reads from a different table so it doesn't go through buildFilterClause.)
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

// ============================================================
// New analytical queries for the Reports page
// ============================================================

// Fixed exponential duration buckets, picked to cover the realistic
// Firecrawl request range from <10ms (trivial metadata calls) up to
// >60s (long crawls). Each bucket is a label + an exclusive upper
// bound in milliseconds. The last bucket catches everything slower.
const DURATION_BUCKETS = [
  { label: '0-10ms',    max: 10 },
  { label: '10-50ms',   max: 50 },
  { label: '50-100ms',  max: 100 },
  { label: '100-500ms', max: 500 },
  { label: '500ms-1s',  max: 1000 },
  { label: '1-5s',      max: 5000 },
  { label: '5-10s',     max: 10000 },
  { label: '10-30s',    max: 30000 },
  { label: '30-60s',    max: 60000 },
  { label: '60s+',      max: null },
];

/**
 * Distribution — duration histogram + percentile summary.
 * Returns { buckets: [{label, count}], percentiles: {p50, p90, p95, p99}, total }
 */
export function getDistribution(db, filters = {}) {
  const { sql: where, params } = buildFilterClause(filters);

  // Build a CASE expression from the bucket config so all buckets get
  // a row even if they're empty (LEFT JOIN-like behavior).
  const caseExpr = `CASE
    ${DURATION_BUCKETS.map((b, i) => {
      if (b.max === null) return `ELSE '${b.label}'`;
      return `WHEN duration_ms < ${b.max} THEN '${b.label}'`;
    }).join('\n    ')}
  END`;

  const rows = db.prepare(`
    SELECT ${caseExpr} AS bucket, COUNT(*) AS count
    FROM proxy_operations
    WHERE ${where}
    GROUP BY bucket
  `).all(...params);

  // Map to the canonical bucket order and fill in zeros for missing buckets
  const countByBucket = Object.fromEntries(rows.map(r => [r.bucket, r.count]));
  const buckets = DURATION_BUCKETS.map(b => ({ label: b.label, count: countByBucket[b.label] || 0 }));
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  // Percentiles via the OFFSET trick
  function percentile(p) {
    if (total === 0) return null;
    const offsetRow = db.prepare(`
      SELECT duration_ms FROM proxy_operations
      WHERE ${where}
      ORDER BY duration_ms
      LIMIT 1 OFFSET (
        SELECT CAST(COUNT(*) * ? / 100 AS INTEGER)
        FROM proxy_operations
        WHERE ${where}
      )
    `).get(...params, p, ...params);
    return offsetRow?.duration_ms ?? null;
  }

  return {
    buckets,
    total,
    percentiles: {
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
    },
  };
}

/**
 * Status codes — breakdown by HTTP status, with a class key for grouping.
 * Returns an array of rows: [{ status, class, count }, ...]
 */
export function getStatusCodes(db, filters = {}) {
  const { sql: where, params } = buildFilterClause(filters);

  const rows = db.prepare(`
    SELECT
      response_status AS status,
      CASE
        WHEN response_status = 0 THEN 'transport_error'
        WHEN response_status < 200 THEN '1xx'
        WHEN response_status < 300 THEN '2xx'
        WHEN response_status < 400 THEN '3xx'
        WHEN response_status < 500 THEN '4xx'
        ELSE '5xx'
      END AS class,
      COUNT(*) AS count
    FROM proxy_operations
    WHERE ${where}
    GROUP BY response_status
    ORDER BY count DESC
  `).all(...params);

  return rows;
}

/**
 * Heatmap — day-of-week × hour-of-day request counts.
 * Returns an array of rows: [{ dow: 0..6, hour: 0..23, count }, ...]
 * (The client pivots into a 7×24 matrix.)
 */
export function getHeatmap(db, filters = {}) {
  const { sql: where, params } = buildFilterClause(filters);

  return db.prepare(`
    SELECT
      CAST(strftime('%w', timestamp) AS INTEGER) AS dow,
      CAST(strftime('%H', timestamp) AS INTEGER) AS hour,
      COUNT(*) AS count
    FROM proxy_operations
    WHERE ${where}
    GROUP BY dow, hour
    ORDER BY dow, hour
  `).all(...params);
}

/**
 * Operation detail — single row by primary key, all 24 columns.
 * Returns the row object or undefined if not found.
 */
export function getOperationDetail(db, id) {
  return db.prepare(`
    SELECT * FROM proxy_operations WHERE id = ?
  `).get(id);
}

/**
 * Crawl lifecycle — all rows sharing a firecrawl_id, ordered chronologically.
 * Used by the detail drawer to show the full create→status→cancel timeline.
 */
export function getCrawlLifecycle(db, firecrawlId) {
  return db.prepare(`
    SELECT
      id, timestamp, method, path, operation_type,
      client_ip, response_status, success, error_message,
      credits_used, duration_ms
    FROM proxy_operations
    WHERE firecrawl_id = ?
    ORDER BY timestamp ASC
  `).all(firecrawlId);
}

/**
 * Export filtered rows as CSV by streaming to a writable sink.
 * Used by GET /api/stats/proxy/export.csv — the route passes res as
 * the sink and this helper writes chunks directly, avoiding a memory
 * spike for large exports.
 *
 * Hard cap at maxRows (default 10,000). If the filter matches more,
 * only the first maxRows (ordered by timestamp DESC) are written and
 * a trailing comment line notes the truncation.
 */
export function exportRowsAsCsv(db, filters, sink, maxRows = 10000) {
  const { sql: where, params } = buildFilterClause(filters);

  // Write header
  const headers = [
    'id', 'timestamp', 'method', 'path', 'operation_type',
    'client_ip', 'client_ua', 'client_auth_hash',
    'target_url', 'target_host', 'query_text',
    'request_body_size', 'response_status', 'response_size',
    'success', 'error_message',
    'firecrawl_id', 'credits_used', 'scraped_status_code', 'concurrency_limited',
    'duration_ms', 'upstream_response_time_ms',
  ];
  sink.write(headers.join(',') + '\n');

  function csvEscape(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    // Quote if contains comma, quote, or newline; double-up embedded quotes
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // Stream rows via better-sqlite3's .iterate() so we never load more
  // than one row into memory at a time.
  const iter = db.prepare(`
    SELECT ${headers.join(', ')}
    FROM proxy_operations
    WHERE ${where}
    ORDER BY timestamp DESC
    LIMIT ?
  `).iterate(...params, maxRows);

  let written = 0;
  for (const row of iter) {
    const line = headers.map(h => csvEscape(row[h])).join(',');
    sink.write(line + '\n');
    written++;
  }

  // Check if the filter matched more than maxRows — write a truncation notice
  if (written === maxRows) {
    const { total } = db.prepare(`
      SELECT COUNT(*) AS total FROM proxy_operations WHERE ${where}
    `).get(...params);
    if (total > maxRows) {
      sink.write(`# truncated: ${total - maxRows} more rows match; narrow the filter to see them\n`);
    }
  }

  return written;
}
