import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { formatDistanceToNow } from 'date-fns';

export function SearchPage() {
  const { search, fetchHistory, searchHistory, loading, error, clearError } = useStore();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(5);
  const [results, setResults] = useState(null);

  useEffect(() => { fetchHistory('search'); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { const r = await search(query, limit); setResults(r.data); } catch (_) {}
    finally { fetchHistory('search'); }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--apple-text)' }}>🔍 Search</h1>
        <p style={{ fontSize: '13px', color: 'var(--apple-text-secondary)', marginTop: '4px' }}>Search the web via Firecrawl</p>
      </div>

      {error && (
        <div className="apple-error-banner rounded-apple p-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px' }}>⚠️ {error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: 'var(--apple-red)', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="apple-card">
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '12px' }}>New Search</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Enter search query…" className="apple-input" required />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', whiteSpace: 'nowrap' }}>Results</label>
                <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="apple-input">
                  <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
                </select>
              </div>
              <button type="submit" className="apple-button" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
            </form>
          </div>

          {results !== null && (
            <div className="apple-card" style={{ flex: 1 }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '12px' }}>
                Results {results.length > 0 && <span style={{ fontWeight: '400', color: 'var(--apple-text-secondary)', fontSize: '13px' }}>({results.length})</span>}
              </h3>
              {results.length === 0
                ? <p style={{ color: 'var(--apple-text-secondary)', fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>No results found</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '500px', overflowY: 'auto' }}>
                    {results.map((item, i) => (
                      <div key={i} style={{ paddingBottom: '14px', borderBottom: '1px solid var(--apple-separator)' }}>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '14px', fontWeight: '600', color: 'var(--apple-blue)', textDecoration: 'none', display: 'block', marginBottom: '3px' }}>{item.title || item.url}</a>
                        <p style={{ fontSize: '11px', color: 'var(--apple-green)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.url}</p>
                        {item.description && <p style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', lineHeight: '1.5', margin: 0 }}>{item.description}</p>}
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}
        </div>

        <div className="apple-card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '12px' }}>History</h3>
          {searchHistory.length === 0
            ? <p style={{ color: 'var(--apple-text-secondary)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No searches yet</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '600px', overflowY: 'auto' }}>
                {searchHistory.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--apple-surface)', borderRadius: '8px', padding: '8px 10px', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', color: 'var(--apple-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{item.query}</p>
                      <p style={{ fontSize: '10px', color: 'var(--apple-text-secondary)', marginTop: '2px' }}>{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</p>
                    </div>
                    <span className="apple-badge" style={{ fontSize: '10px', flexShrink: 0, background: item.success ? 'var(--apple-badge-success-bg)' : 'var(--apple-badge-error-bg)', color: item.success ? 'var(--apple-green)' : 'var(--apple-red)' }}>{item.success ? 'Success' : 'Failed'}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  );
}
