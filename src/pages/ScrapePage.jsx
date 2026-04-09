import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { formatDistanceToNow } from 'date-fns';

const FORMATS = ['markdown', 'html', 'links'];

export function ScrapePage() {
  const { scrape, fetchHistory, scrapeHistory, loading, error, clearError } = useStore();
  const [url, setUrl] = useState('');
  const [formats, setFormats] = useState(['markdown']);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchHistory('scrape'); }, []);

  const toggleFormat = (fmt) => setFormats(prev => prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]);

  const displayContent = () => {
    if (!result) return '';
    if (formats.includes('markdown') && result.markdown) return result.markdown;
    if (formats.includes('html') && result.html) return result.html;
    if (formats.includes('links') && result.links) return result.links.join('\n');
    return JSON.stringify(result, null, 2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formats.length === 0) return;
    try { const r = await scrape(url, formats); setResult(r.data); fetchHistory('scrape'); } catch (_) {}
  };

  const handleCopy = () => {
    const c = displayContent();
    if (!c) return;
    navigator.clipboard.writeText(c).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const HistoryBadge = ({ success }) => (
    <span className="apple-badge" style={{ fontSize: '10px', flexShrink: 0, background: success ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.1)', color: success ? 'var(--apple-green)' : 'var(--apple-red)' }}>
      {success ? 'Success' : 'Failed'}
    </span>
  );

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--apple-text)' }}>📄 Scrape</h1>
        <p style={{ fontSize: '13px', color: 'var(--apple-text-secondary)', marginTop: '4px' }}>Extract content from a single URL</p>
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
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '12px' }}>New Scrape</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/page" className="apple-input" required />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {FORMATS.map(fmt => (
                  <button key={fmt} type="button" onClick={() => toggleFormat(fmt)}
                    style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid', borderColor: formats.includes(fmt) ? 'var(--apple-blue)' : 'var(--apple-separator)', background: formats.includes(fmt) ? 'var(--apple-blue)' : 'transparent', color: formats.includes(fmt) ? 'white' : 'var(--apple-text-secondary)', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize' }}>
                    {fmt}
                  </button>
                ))}
              </div>
              <button type="submit" className="apple-button" disabled={loading || formats.length === 0}>{loading ? 'Scraping…' : 'Scrape'}</button>
            </form>
          </div>

          {result && (
            <div className="apple-card" style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', margin: 0 }}>Result</h3>
                  {result.metadata?.title && <p style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', marginTop: '2px' }}>{result.metadata.title}</p>}
                </div>
                <button onClick={handleCopy} style={{ fontSize: '12px', color: 'var(--apple-blue)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>{copied ? '✓ Copied' : 'Copy'}</button>
              </div>
              <pre style={{ background: '#1D1D1F', borderRadius: '8px', padding: '12px', fontSize: '11px', color: '#F5F5F7', overflowY: 'auto', maxHeight: '360px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', margin: 0 }}>
                {displayContent()}
              </pre>
            </div>
          )}
        </div>

        <div className="apple-card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '12px' }}>History</h3>
          {scrapeHistory.length === 0
            ? <p style={{ color: 'var(--apple-text-secondary)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No scrapes yet</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '600px', overflowY: 'auto' }}>
                {scrapeHistory.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--apple-surface)', borderRadius: '8px', padding: '8px 10px', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', color: 'var(--apple-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{item.url}</p>
                      <p style={{ fontSize: '10px', color: 'var(--apple-text-secondary)', marginTop: '2px' }}>{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</p>
                    </div>
                    <HistoryBadge success={item.success} />
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  );
}
