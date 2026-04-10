/**
 * Parse a Firecrawl response body buffer to extract log fields for the
 * proxy_operations row. Returns a plain object with nullable fields —
 * callers merge this with their own timing/identity fields.
 *
 * This parser is intentionally forgiving:
 * - Binary/non-JSON bodies return success based on HTTP status code only.
 * - JSON parse failures return the same fallback.
 * - Field extraction uses optional chaining throughout; missing fields
 *   become null in the log row.
 *
 * Operation-specific response shapes verified by live probes against
 * http://10.0.20.66:3002 (Firecrawl self-hosted):
 *   scrape      → { success, data: { markdown, metadata: { scrapeId, creditsUsed, statusCode, concurrencyLimited } } }
 *   search      → { success, data: { web: [...] }, creditsUsed, id }
 *   crawl_create→ { success, id, url }
 *   crawl_status→ { success, status, total, completed, creditsUsed, data: [...] }
 *   map         → { success, links: [...] }   (no id, no credits on this build)
 */

export function parseFirecrawlResponse(operationType, bodyBuffer, httpStatus) {
  const base = {
    success: httpStatus >= 200 && httpStatus < 400 ? 1 : 0,
    firecrawlId: null,
    creditsUsed: null,
    scrapedStatusCode: null,
    concurrencyLimited: null,
    errorMessage: null,
  };

  if (!bodyBuffer || bodyBuffer.length === 0) return base;

  // Decode + parse
  let body;
  try {
    body = JSON.parse(bodyBuffer.toString('utf8'));
  } catch (_) {
    return base;
  }

  // success flag: prefer Firecrawl's explicit field, fall back to HTTP status
  if (typeof body.success === 'boolean') {
    base.success = body.success ? 1 : 0;
  }

  // error message (Firecrawl uses top-level `error` on 4xx/5xx envelopes)
  if (typeof body.error === 'string') {
    base.errorMessage = body.error;
  }

  // Operation-specific field extraction
  switch (operationType) {
    case 'scrape': {
      const meta = body.data?.metadata || {};
      base.firecrawlId = meta.scrapeId || null;
      base.creditsUsed = typeof meta.creditsUsed === 'number' ? meta.creditsUsed : null;
      base.scrapedStatusCode = typeof meta.statusCode === 'number' ? meta.statusCode : null;
      base.concurrencyLimited = typeof meta.concurrencyLimited === 'boolean'
        ? (meta.concurrencyLimited ? 1 : 0)
        : null;
      break;
    }

    case 'search': {
      base.firecrawlId = typeof body.id === 'string' ? body.id : null;
      base.creditsUsed = typeof body.creditsUsed === 'number' ? body.creditsUsed : null;
      break;
    }

    case 'crawl_create': {
      base.firecrawlId = typeof body.id === 'string' ? body.id : null;
      // Credits unknown until the first status poll; leave null.
      break;
    }

    case 'crawl_status': {
      // firecrawl_id is available from the request path, not the response;
      // the caller sets it before calling this function.
      base.creditsUsed = typeof body.creditsUsed === 'number'
        ? body.creditsUsed
        : (typeof body.data?.creditsUsed === 'number' ? body.data.creditsUsed : null);
      break;
    }

    case 'batch_scrape': {
      base.firecrawlId = typeof body.id === 'string' ? body.id : null;
      break;
    }

    case 'batch_status': {
      base.creditsUsed = typeof body.creditsUsed === 'number' ? body.creditsUsed : null;
      break;
    }

    case 'extract': {
      base.firecrawlId = typeof body.id === 'string' ? body.id : null;
      break;
    }

    // map, team_query, admin_query, crawl_cancel, crawl_list_active, root, other:
    // no specific fields to extract beyond the base envelope
    default:
      break;
  }

  return base;
}

/**
 * Extract request-body fields (target_url, target_host, query_text) from
 * the parsed request body. Called by the proxy middleware on the inbound
 * leg before forwarding.
 *
 * Returns { targetUrl, targetHost, queryText } — all nullable strings.
 */
export function extractRequestFields(operationType, requestBody) {
  const out = { targetUrl: null, targetHost: null, queryText: null };
  if (!requestBody || typeof requestBody !== 'object') return out;

  // URL-bearing operations
  if (typeof requestBody.url === 'string') {
    out.targetUrl = requestBody.url;
    try {
      out.targetHost = new URL(requestBody.url).hostname;
    } catch (_) {
      // malformed URL; host stays null
    }
  } else if (Array.isArray(requestBody.urls) && requestBody.urls.length > 0 && typeof requestBody.urls[0] === 'string') {
    // batch_scrape: representative URL is the first in the array
    out.targetUrl = requestBody.urls[0];
    try {
      out.targetHost = new URL(requestBody.urls[0]).hostname;
    } catch (_) {}
  }

  // Query-bearing operations
  if (typeof requestBody.query === 'string') {
    out.queryText = requestBody.query;
  }

  return out;
}
