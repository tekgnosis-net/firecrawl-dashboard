/**
 * In-memory batched write queue for proxy_operations inserts.
 *
 * The proxy middleware enqueues rows on the request hot path (pure
 * array push, ~10 ns) and returns immediately. A flush worker drains
 * the buffer every flushMs ms or when it reaches maxRows, whichever
 * comes first, using a single db.transaction() to amortize fsync cost.
 *
 * Durability trade-off: rows live in JS memory for up to flushMs (250 ms
 * default) before hitting fsync. A process crash between enqueue and
 * flush loses those rows. This is acceptable for a monitoring log; it
 * would not be acceptable for a payment ledger.
 *
 * Graceful shutdown: call drain() on SIGTERM before exit. It flushes
 * whatever is in the buffer and clears the timer. Safe to call multiple
 * times.
 */

const INSERT_SQL = `
  INSERT INTO proxy_operations (
    timestamp, method, path, operation_type,
    client_ip, client_ua, client_auth_hash,
    target_url, target_host, query_text,
    request_body_size,
    response_status, response_size, success, error_message,
    firecrawl_id, credits_used, scraped_status_code, concurrency_limited,
    duration_ms, upstream_response_time_ms,
    request_body, response_body
  ) VALUES (
    @timestamp, @method, @path, @operation_type,
    @client_ip, @client_ua, @client_auth_hash,
    @target_url, @target_host, @query_text,
    @request_body_size,
    @response_status, @response_size, @success, @error_message,
    @firecrawl_id, @credits_used, @scraped_status_code, @concurrency_limited,
    @duration_ms, @upstream_response_time_ms,
    @request_body, @response_body
  )
`;

export function createWriteQueue(db, { flushMs = 250, maxRows = 500 } = {}) {
  const stmt = db.prepare(INSERT_SQL);
  const flushMany = db.transaction((rows) => {
    for (const r of rows) stmt.run(r);
  });

  let buffer = [];
  let timer = null;
  let stopped = false;
  let stats = { enqueued: 0, flushed: 0, failed: 0 };

  function tryFlush() {
    if (buffer.length === 0) return;
    const rows = buffer;
    buffer = [];
    try {
      flushMany(rows);
      stats.flushed += rows.length;
    } catch (err) {
      stats.failed += rows.length;
      console.error(`[write-queue] flush of ${rows.length} rows failed:`, err.message);
    }
  }

  function enqueue(row) {
    if (stopped) {
      // Post-shutdown enqueue: write synchronously as a fallback
      try { stmt.run(row); stats.enqueued++; stats.flushed++; }
      catch (err) { stats.failed++; }
      return;
    }
    buffer.push(row);
    stats.enqueued++;
    if (buffer.length >= maxRows) {
      tryFlush();
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(tryFlush, flushMs);
    timer.unref?.(); // don't block process exit
  }

  async function drain() {
    stopped = true;
    if (timer) { clearInterval(timer); timer = null; }
    tryFlush();
  }

  function depth() { return buffer.length; }
  function getStats() { return { ...stats, bufferDepth: buffer.length }; }

  start();
  return { enqueue, drain, depth, getStats };
}
