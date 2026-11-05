// src/lib/proxyUrl.js
//
// Build the base URL of the transparent Firecrawl proxy. External clients
// point their Firecrawl SDK at this URL instead of directly at the
// Firecrawl server; the dashboard's own UI pages also use this base
// URL so internal UI traffic is logged identically to external traffic.
//
// Resolution order:
//   1. The `proxy_public_url` setting, when set. This is the operator's
//      statement of where the proxy is reachable from outside — required
//      behind a reverse proxy, where the proxy is NOT at <host>:<proxy_port>
//      from the browser's point of view (issue #13).
//   2. Otherwise the current browser origin's protocol + hostname with the
//      proxy port stored in settings.
//
// The proxy is a different origin from the dashboard UI either way. In dev
// that means cross-origin requests (Vite on :3000, proxy on :3101) which
// the proxy's cors() middleware allows via `Access-Control-Allow-Origin: *`.
// In production the same holds (dashboard on :3001, proxy on :3101).

import { useStore } from '../store.js';

/**
 * Returns the proxy base URL with no trailing slash: the configured
 * proxy_public_url if there is one (e.g. "https://fc.example.com"), else
 * "http://localhost:3101"-style, derived from the current window location
 * + the configured proxy_port.
 *
 * Call at request time (not at module load) so settings changes propagate
 * without a page reload.
 */
export function getProxyBaseUrl() {
  const publicUrl = String(useStore.getState().settings?.proxyPublicUrl ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (publicUrl) return publicUrl;

  const proxyPort = useStore.getState().settings?.proxyPort || 3101;
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `${protocol}//${hostname}:${proxyPort}`;
}

/**
 * Convenience: build a full proxy URL for a given path.
 * buildProxyUrl('/v1/scrape') -> 'http://localhost:3101/v1/scrape'
 * (or 'https://fc.example.com/v1/scrape' when proxy_public_url is set)
 */
export function buildProxyUrl(path) {
  return `${getProxyBaseUrl()}${path.startsWith('/') ? path : '/' + path}`;
}

/**
 * Headers to attach to dashboard-initiated proxy requests. The custom
 * User-Agent lets TopClientsTable distinguish internal dashboard UI
 * traffic from external SDK / curl clients when the operator wants to
 * filter.
 */
export const INTERNAL_UI_HEADERS = {
  'User-Agent': 'firecrawl-dashboard-internal/1.0',
};
