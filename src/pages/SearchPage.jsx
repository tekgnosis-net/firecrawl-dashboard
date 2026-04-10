// src/pages/SearchPage.jsx
import { useState } from 'react';
import { useStore } from '../store';
import { buildProxyUrl } from '../lib/proxyUrl';

export function SearchPage() {
  const submitSearch = useStore(s => s.submitSearch);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const clearError = useStore(s => s.clearError);

  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(5);
  const [results, setResults] = useState(null);
  const [creditsUsed, setCreditsUsed] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await submitSearch(query, limit);
      // Response shape: { success, data: { web: [...] }, creditsUsed, id }
      setResults(r?.data?.web || []);
      setCreditsUsed(r?.creditsUsed ?? null);
    } catch (_) {}
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--apple-text)' }}>{'\u{1F50D}'} Search</h1>
        <p style={{ fontSize: 13, color: 'var(--apple-text-secondary)', marginTop: 4 }}>
          Search the web via Firecrawl. All queries flow through the transparent proxy.
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
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>New search</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Enter search query…"
              className="apple-input"
              required
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--apple-text-secondary)', whiteSpace: 'nowrap' }}>Results</label>
              <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="apple-input">
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
            <button type="submit" className="apple-button" disabled={loading}>
              {loading ? 'Searching\u2026' : 'Search'}
            </button>
          </form>
          <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 10 }}>
            POST {'\u2192'} {buildProxyUrl('/v2/search')}
          </div>
        </div>

        {results !== null && (
          <div className="apple-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                Results{' '}
                {results.length > 0 && (
                  <span style={{ fontWeight: 400, color: 'var(--apple-text-secondary)', fontSize: 13 }}>
                    ({results.length})
                  </span>
                )}
              </h3>
              {creditsUsed !== null && (
                <span style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>
                  {creditsUsed} credit(s) used
                </span>
              )}
            </div>
            {results.length === 0 ? (
              <p style={{ color: 'var(--apple-text-secondary)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                No results found
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 500, overflowY: 'auto' }}>
                {results.map((item, i) => (
                  <div key={i} style={{ paddingBottom: 14, borderBottom: '1px solid var(--apple-separator)' }}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 14, fontWeight: 600, color: 'var(--apple-blue)', textDecoration: 'none', display: 'block', marginBottom: 3 }}
                    >
                      {item.title || item.url}
                    </a>
                    <p style={{ fontSize: 11, color: 'var(--apple-green)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.url}
                    </p>
                    {item.description && (
                      <p style={{ fontSize: 12, color: 'var(--apple-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
