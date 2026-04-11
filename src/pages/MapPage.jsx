// src/pages/MapPage.jsx
import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { buildProxyUrl } from '../lib/proxyUrl';

// Module-scope helper — defined outside the component so its identity is stable
// across renders. Nested helper components/functions inside MapPage would be fine,
// but keeping it here also dodges any accidental focus-loss traps (see CLAUDE.md
// v2.0.3 inline-component note).
function parseUrl(href) {
  try {
    const u = new URL(href);
    return { host: u.host, path: (u.pathname + u.search + u.hash) || '/' };
  } catch {
    return { host: '', path: href };
  }
}

export function MapPage() {
  const submitMap = useStore(s => s.submitMap);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const clearError = useStore(s => s.clearError);

  const [url, setUrl] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);

  // Client-side filter — distinct from the server-side `search` param above.
  // Lets users narrow an already-returned result set without re-running the map.
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filter), 120);
    return () => clearTimeout(t);
  }, [filter]);

  const filteredResults = useMemo(() => {
    if (!results) return [];
    const q = debouncedFilter.trim().toLowerCase();
    if (!q) return results;
    return results.filter(h => h.toLowerCase().includes(q));
  }, [results, debouncedFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFilter('');
    try {
      const options = search ? { search } : {};
      const r = await submitMap(url, options);
      // Response shape: { success, links: [{ url: '...' }, ...] }
      // Older builds may return links as strings; handle both.
      const links = (r?.links || []).map(l => typeof l === 'string' ? l : l.url).filter(Boolean);
      setResults(links);
    } catch (_) {}
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--apple-text)' }}>{'\u{1F5FA}'} Map</h1>
        <p style={{ fontSize: 13, color: 'var(--apple-text-secondary)', marginTop: 4 }}>
          Discover URLs on a website. All requests flow through the transparent proxy.
        </p>
      </div>

      {error && (
        <div className="apple-error-banner rounded-apple p-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 13 }}>{'\u26A0'} {error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: 'var(--apple-red)', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
        <div className="apple-card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>New map</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="apple-input"
              required
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Optional: filter links by substring"
              className="apple-input"
            />
            <button type="submit" className="apple-button" disabled={loading}>
              {loading ? 'Mapping\u2026' : 'Map site'}
            </button>
          </form>
          <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 10 }}>
            POST {'\u2192'} {buildProxyUrl('/v2/map')}
          </div>
        </div>

        {results !== null && (
          <div className="apple-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Discovered URLs</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="apple-badge" style={{ fontSize: 11 }}>
                  {filteredResults.length === results.length
                    ? results.length
                    : `${filteredResults.length} / ${results.length}`}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(filteredResults.join('\n'))}
                  className="apple-button"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  disabled={filteredResults.length === 0}
                >
                  Copy all
                </button>
              </div>
            </div>
            {results.length === 0 ? (
              <p style={{ color: 'var(--apple-text-secondary)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                No URLs found
              </p>
            ) : (
              <>
                <input
                  type="text"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder={'Filter results\u2026'}
                  className="apple-input"
                  style={{ marginBottom: 10 }}
                />
                {filteredResults.length === 0 ? (
                  <p style={{ color: 'var(--apple-text-secondary)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                    No URLs match &ldquo;{filter}&rdquo;. Try a shorter query or clear the filter.
                  </p>
                ) : (
                  <div style={{ maxHeight: 600, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filteredResults.map((href, i) => {
                      const { host, path } = parseUrl(href);
                      return (
                        <a
                          key={i}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={href}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: 'var(--apple-surface)',
                            border: '1px solid var(--apple-separator)',
                            display: 'block',
                            textDecoration: 'none',
                          }}
                        >
                          <div style={{ fontSize: 12, color: 'var(--apple-text-secondary)', fontWeight: 500 }}>
                            {host}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--apple-blue)', fontWeight: 500, wordBreak: 'break-all', lineHeight: 1.35 }}>
                            {path}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
