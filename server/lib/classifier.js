/**
 * Classify an incoming HTTP request (method + path) into a coarse
 * operation type for stats aggregation.
 *
 * This is a deliberate whitelist: known paths get specific labels,
 * unknown paths fall through to 'other'. Adding new Firecrawl endpoints
 * in the future won't break the proxy — they just get counted as 'other'
 * until someone adds a case here.
 *
 * Path is the URL pathname only (no query string). Method is uppercase
 * HTTP verb. Returns a string key used in proxy_operations.operation_type.
 */

export function classifyOperation(method, path) {
  const m = (method || '').toUpperCase();

  // Strip query string defensively in case a caller passes it in
  const p = path.split('?')[0];

  // Scrape and batch scrape
  if (m === 'POST' && /^\/v[12]\/scrape$/.test(p))                 return 'scrape';
  if (m === 'POST' && /^\/v[12]\/batch\/scrape$/.test(p))          return 'batch_scrape';
  if (m === 'GET'  && /^\/v[12]\/batch\/scrape\/[^/]+/.test(p))    return 'batch_status';

  // Crawl lifecycle
  if (m === 'POST'   && /^\/v[12]\/crawl$/.test(p))                return 'crawl_create';
  if (m === 'GET'    && /^\/v[12]\/crawl\/active$/.test(p))        return 'crawl_list_active';
  if (m === 'GET'    && /^\/v[12]\/crawl\/[^/]+$/.test(p))         return 'crawl_status';
  if (m === 'DELETE' && /^\/v[12]\/crawl\/[^/]+$/.test(p))         return 'crawl_cancel';

  // Map and search
  if (m === 'POST' && /^\/v[12]\/map$/.test(p))                    return 'map';
  if (m === 'POST' && /^\/v[12]\/search$/.test(p))                 return 'search';

  // Extract
  if (m === 'POST' && /^\/v[12]\/extract$/.test(p))                return 'extract';
  if (m === 'GET'  && /^\/v[12]\/extract\/[^/]+/.test(p))          return 'extract_status';

  // Team and admin queries
  if (m === 'GET' && /^\/v[12]\/team\//.test(p))                   return 'team_query';
  if (m === 'GET' && /^\/admin\//.test(p))                         return 'admin_query';

  // Firecrawl root welcome page
  if (m === 'GET' && p === '/')                                    return 'root';

  return 'other';
}

/**
 * Operation types that consume a URL argument in their request body.
 * Used by the proxy middleware to extract target_url/target_host for
 * per-domain stats.
 */
export const URL_BEARING_OPERATIONS = new Set([
  'scrape',
  'crawl_create',
  'map',
  'extract',
]);

/**
 * Operation types where the request body has a 'query' field (search).
 */
export const QUERY_BEARING_OPERATIONS = new Set([
  'search',
]);
