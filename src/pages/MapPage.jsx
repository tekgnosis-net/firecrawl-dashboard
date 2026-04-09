// src/pages/MapPage.jsx
import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { formatDistanceToNow } from 'date-fns';

export function MapPage() {
  const { map, fetchHistory, mapHistory, loading, error, clearError } = useStore();
  const [url, setUrl] = useState('');
  const [limit, setLimit] = useState(100);
  const [results, setResults] = useState(null);

  useEffect(() => { fetchHistory('map'); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { const r = await map(url, limit); setResults(r.data); } catch (_) {}
    finally { fetchHistory('map'); }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--apple-text)' }}>🗺️ Map</h1>
        <p style={{ fontSize: '13px', color: 'var(--apple-text-secondary)', marginTop: '4px' }}>Discover all URLs on a website</p>
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
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '12px' }}>New Map</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="apple-input" required />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', whiteSpace: 'nowrap' }}>Max links</label>
                <input type="number" value={limit} onChange={e => setLimit(Math.max(1, Number(e.target.value)))} min="1" max="5000" className="apple-input" />
              </div>
              <button type="submit" className="apple-button" disabled={loading}>{loading ? 'Mapping…' : 'Map Site'}</button>
            </form>
          </div>

          {results !== null && (
            <div className="apple-card" style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', margin: 0 }}>Discovered URLs</h3>
                <span className="apple-badge" style={{ fontSize: '11px' }}>{results.length}</span>
              </div>
              {results.length === 0
                ? <p style={{ color: 'var(--apple-text-secondary)', fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>No URLs found</p>
                : <div style={{ maxHeight: '440px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {results.map((href, i) => (
                      <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--apple-blue)', padding: '5px 8px', borderRadius: '5px', background: 'var(--apple-surface)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{href}</a>
                    ))}
                  </div>
              }
            </div>
          )}
        </div>

        <div className="apple-card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '12px' }}>History</h3>
          {mapHistory.length === 0
            ? <p style={{ color: 'var(--apple-text-secondary)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No maps yet</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '600px', overflowY: 'auto' }}>
                {mapHistory.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--apple-surface)', borderRadius: '8px', padding: '8px 10px', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', color: 'var(--apple-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{item.url}</p>
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
