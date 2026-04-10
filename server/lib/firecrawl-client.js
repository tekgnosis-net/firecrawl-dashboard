import axios from 'axios';
import { getFirecrawlUrl, getApiKey } from './settings.js';

/**
 * Hop-by-hop headers per RFC 7230 §6.1, plus Host and Content-Length which
 * axios recomputes on the outbound leg. These must not be forwarded from
 * the inbound request to the upstream call, or from the upstream response
 * back to the client.
 */
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

/**
 * Filter headers for forwarding — strips hop-by-hop and lowercases keys.
 * Used on both request and response legs by the proxy middleware.
 */
export function filterHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers || {})) {
    const lc = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lc)) continue;
    out[lc] = value;
  }
  return out;
}

/**
 * Build the set of headers to send upstream to Firecrawl.
 * Honors incoming Authorization header; falls back to the configured api_key.
 * Adds X-Forwarded-* headers per RFC 7239 conventions.
 */
export function buildForwardedHeaders(req, db) {
  const forwarded = filterHeaders(req.headers);

  // Fallback auth: if client didn't supply a Bearer token, inject ours
  if (!forwarded['authorization']) {
    const apiKey = getApiKey(db);
    if (apiKey) forwarded['authorization'] = `Bearer ${apiKey}`;
  }

  // X-Forwarded-For: append req.ip to any existing chain (RFC 7239)
  const existingXff = forwarded['x-forwarded-for'];
  forwarded['x-forwarded-for'] = existingXff
    ? `${existingXff}, ${req.ip}`
    : req.ip;

  forwarded['x-forwarded-proto'] = req.protocol || 'http';
  const host = req.get?.('host') || req.headers?.host;
  if (host) forwarded['x-forwarded-host'] = host;

  return forwarded;
}

/**
 * Simple internal GET against Firecrawl (used by the dashboard's live
 * metric fan-out routes: /api/firecrawl/queue-status etc). Does NOT go
 * through the proxy layer — these are dashboard-to-Firecrawl internal calls
 * that should not appear in the proxy_operations log.
 *
 * Throws a normalized error on failure so the caller can return 502/504.
 */
export async function internalGet(db, path, { timeoutMs = 5000 } = {}) {
  const url = `${getFirecrawlUrl(db)}${path}`;
  const apiKey = getApiKey(db);
  const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};

  try {
    const response = await axios.get(url, { timeout: timeoutMs, headers, validateStatus: () => true });
    if (response.status >= 400) {
      const err = new Error(response.data?.error || `Upstream ${response.status}`);
      err.kind = 'http';
      err.status = response.status;
      throw err;
    }
    return response.data;
  } catch (err) {
    if (err.kind) throw err;
    const normalized = new Error(err.message || 'Firecrawl unreachable');
    normalized.kind = err.code === 'ECONNABORTED' ? 'timeout' : 'unreachable';
    throw normalized;
  }
}

/**
 * Forward an inbound proxy request upstream to Firecrawl.
 * Returns { status, headers, body (Buffer), upstreamResponseTimeMs }.
 * On transport failure, throws a normalized error with { kind, message }.
 *
 * This is the hot-path helper called by the proxy middleware per request.
 * It uses responseType: 'arraybuffer' so we capture raw bytes and can
 * both (a) forward unchanged to the client and (b) parse for log fields.
 */
export async function forwardToFirecrawl(db, req, { maxBodyBytes, timeoutMs = 120000 }) {
  const firecrawlUrl = getFirecrawlUrl(db);
  const url = `${firecrawlUrl}${req.originalUrl}`;
  const headers = buildForwardedHeaders(req, db);

  // axios config
  const config = {
    method: req.method,
    url,
    headers,
    responseType: 'arraybuffer',
    maxContentLength: maxBodyBytes,
    maxBodyLength: maxBodyBytes,
    validateStatus: () => true,
    timeout: timeoutMs,
  };

  // Attach body for methods that have one
  if (req.body !== undefined && !['GET', 'HEAD', 'DELETE'].includes(req.method.toUpperCase())) {
    config.data = req.body;
  }

  let response;
  try {
    response = await axios(config);
  } catch (err) {
    const normalized = new Error(err.message || 'Firecrawl unreachable');
    if (err.code === 'ECONNABORTED') normalized.kind = 'timeout';
    else if (err.code === 'ERR_BAD_RESPONSE' || err.code === 'ERR_FR_MAX_CONTENT_LENGTH_EXCEEDED') normalized.kind = 'payload_too_large';
    else normalized.kind = 'unreachable';
    throw normalized;
  }

  const upstreamResponseTimeMs = parseFloat(response.headers['x-response-time']) || null;

  return {
    status: response.status,
    headers: response.headers,
    body: Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data),
    upstreamResponseTimeMs,
  };
}
