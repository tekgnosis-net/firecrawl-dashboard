// src/pages/MapPage.jsx
import { useState } from 'react';
import { useStore } from '../store';
import { buildProxyUrl } from '../lib/proxyUrl';

export function MapPage() {
  const submitMap = useStore(s => s.submitMap);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const clearError = useStore(s => s.clearError);

  const [url, setUrl] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Discovered URLs</h3>
              <span className="apple-badge" style={{ fontSize: 11 }}>{results.length}</span>
            </div>
            {results.length === 0 ? (
              <p style={{ color: 'var(--apple-text-secondary)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                No URLs found
              </p>
            ) : (
              <div style={{ maxHeight: 440, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {results.map((href, i) => (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 11,
                      color: 'var(--apple-blue)',
                      padding: '5px 8px',
                      borderRadius: 5,
                      background: 'var(--apple-surface)',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textDecoration: 'none',
                    }}
                  >
                    {href}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
