// src/pages/CrawlPage.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useStore } from '../store';
import { formatDistanceToNow } from 'date-fns';

const STATUS_STYLE = {
  completed: { background: 'var(--apple-badge-success-bg)', color: 'var(--apple-green)' },
  failed:    { background: 'var(--apple-badge-error-bg)',   color: 'var(--apple-red)' },
  cancelled: { background: 'var(--apple-badge-error-bg)',   color: 'var(--apple-red)' },
  pending:   { background: 'var(--apple-badge-info-bg)',    color: 'var(--apple-blue)' },
  scraping:  { background: 'var(--apple-badge-info-bg)',    color: 'var(--apple-blue)' },
};

export function CrawlPage() {
  const { crawls, createCrawl, cancelCrawl, fetchCrawls, loading, error, clearError } = useStore();
  const [url, setUrl] = useState('');
  const [limit, setLimit] = useState(10);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { fetchCrawls(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await createCrawl(url, { limit }); setUrl(''); } catch (_) {}
  };

  const totals = {
    All:       crawls.length,
    Active:    crawls.filter(c => ['pending','scraping'].includes(c.status)).length,
    Completed: crawls.filter(c => c.status === 'completed').length,
    Failed:    crawls.filter(c => ['failed','cancelled'].includes(c.status)).length,
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--apple-text)' }}>🕸️ Crawl</h1>
        <p style={{ fontSize: '13px', color: 'var(--apple-text-secondary)', marginTop: '4px' }}>Start and monitor recursive crawl jobs</p>
      </div>

      {error && (
        <div className="apple-error-banner rounded-apple p-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px' }}>⚠️ {error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: 'var(--apple-red)', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: form + job list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="apple-card">
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '12px' }}>New Crawl</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="apple-input" required />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', whiteSpace: 'nowrap' }}>Max pages</label>
                <input type="number" value={limit} onChange={e => setLimit(Math.max(1, Number(e.target.value)))} min="1" max="1000" className="apple-input" />
              </div>
              <button type="submit" className="apple-button" disabled={loading}>{loading ? 'Starting…' : 'Start Crawl'}</button>
            </form>
          </div>

          <div className="apple-card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '12px' }}>Jobs</h3>
            {crawls.length === 0
              ? <p style={{ color: 'var(--apple-text-secondary)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No crawl jobs yet</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '520px', overflowY: 'auto' }}>
                  {crawls.map(crawl => (
                    <div key={crawl.id}>
                      <div onClick={() => setExpandedId(expandedId === crawl.id ? null : crawl.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--apple-surface)', borderRadius: expandedId === crawl.id ? '8px 8px 0 0' : '8px', padding: '8px 10px', cursor: 'pointer', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '12px', color: 'var(--apple-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{crawl.url}</p>
                          <p style={{ fontSize: '10px', color: 'var(--apple-text-secondary)', marginTop: '2px' }}>{formatDistanceToNow(new Date(crawl.created_at), { addSuffix: true })}</p>
                        </div>
                        <span className="apple-badge" style={{ fontSize: '10px', flexShrink: 0, ...STATUS_STYLE[crawl.status] }}>{crawl.status}</span>
                      </div>
                      {expandedId === crawl.id && <CrawlDetail crawl={crawl} onCancel={() => { cancelCrawl(crawl.id); setExpandedId(null); }} />}
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        {/* Right: summary */}
        <div className="apple-card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '16px' }}>Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Object.entries(totals).map(([label, value], i, arr) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--apple-separator)' : 'none' }}>
                <span style={{ fontSize: '13px', color: 'var(--apple-text-secondary)' }}>{label}</span>
                <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--apple-text)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CrawlDetail({ crawl, onCancel }) {
  const [detail, setDetail] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);
  const isActive = ['pending', 'scraping'].includes(crawl.status);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await axios.get(`/api/crawls/${crawl.id}`);
        if (alive && r.data.success) setDetail(r.data.data);
      } catch (_) {}
    };
    poll();
    if (!isActive) return () => { alive = false; };
    const timer = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [crawl.id, isActive]);

  if (!detail) return (
    <div style={{ background: 'var(--apple-surface)', borderRadius: '0 0 8px 8px', padding: '12px', borderTop: '1px solid var(--apple-separator)' }}>
      <p style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', textAlign: 'center', margin: 0 }}>Loading…</p>
    </div>
  );

  const completed = detail.completed || 0;
  const rawTotal = detail.total ?? crawl.max_pages ?? 0;
  const pct = rawTotal > 0 ? Math.min(100, Math.round((completed / rawTotal) * 100)) : 0;
  const displayTotal = rawTotal > 0 ? rawTotal : crawl.max_pages || '?';
  const hasData = detail.data?.length > 0;
  const isExpired = !isActive && !hasData && detail.status !== 'failed' && detail.status !== 'cancelled';

  return (
    <div style={{ background: 'var(--apple-surface)', borderRadius: '0 0 8px 8px', padding: '12px', borderTop: '1px solid var(--apple-separator)' }}>
      {isActive && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--apple-text-secondary)' }}>{completed} / {displayTotal} pages</span>
            <span style={{ fontSize: '11px', color: 'var(--apple-text-secondary)' }}>{pct}%</span>
          </div>
          <div style={{ height: '4px', background: 'var(--apple-separator)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--apple-blue)', borderRadius: '2px', transition: 'width 0.5s' }} />
          </div>
          <button onClick={onCancel} style={{ marginTop: '8px', fontSize: '12px', color: 'var(--apple-red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cancel crawl</button>
        </div>
      )}
      {isExpired && <p style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', fontStyle: 'italic', margin: 0 }}>Results expired — crawl data is no longer available on the Firecrawl instance.</p>}
      {!isActive && !hasData && detail.status === 'cancelled' && (
        <p style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', fontStyle: 'italic', margin: 0 }}>Crawl was cancelled before any pages were collected.</p>
      )}
      {hasData && (
        selectedPage !== null ? (
          <div>
            <button onClick={() => setSelectedPage(null)} style={{ fontSize: '12px', color: 'var(--apple-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px 0', display: 'block' }}>← Back to pages</button>
            <pre style={{ background: '#1D1D1F', borderRadius: '8px', padding: '10px', fontSize: '10px', color: '#F5F5F7', overflowY: 'auto', maxHeight: '280px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
              {detail.data[selectedPage]?.markdown || 'No markdown for this page'}
            </pre>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '11px', color: 'var(--apple-text-secondary)', marginBottom: '8px' }}>{detail.data.length} pages — click to view content</p>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {detail.data.map((page, i) => (
                <button key={i} onClick={() => setSelectedPage(i)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: 'var(--apple-card)', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <span style={{ fontSize: '10px', flexShrink: 0 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '11px', color: 'var(--apple-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{page.metadata?.title || page.metadata?.sourceURL || `Page ${i + 1}`}</p>
                    <p style={{ fontSize: '10px', color: 'var(--apple-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{page.metadata?.sourceURL}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
