// src/components/metrics/ActiveCrawlsCard.jsx
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { formatNumber } from '../../lib/format';

export function ActiveCrawlsCard() {
  const active = useStore(s => s.serverMetrics.activeCrawls);
  const details = useStore(s => s.activeCrawlsDetails);

  const crawls = active?.crawls || [];
  const count = crawls.length;
  const ids = crawls.map(c => c.id || c).slice(0, 5);

  return (
    <div className="apple-card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Active crawls</h3>
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
        /v1/crawl/active · includes crawls triggered from outside this dashboard
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, marginBottom: 8 }}>
        {formatNumber(count)}
      </div>
      <div style={{ fontSize: 12, color: 'var(--apple-text-secondary)', marginBottom: 12 }}>
        server-wide · Firecrawl expires crawl data after 24h
      </div>
      {count > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ids.map(id => {
            const d = details[id];
            const progress = d?.total > 0 ? d.completed / d.total : null;
            return (
              <Link
                key={id}
                to="/crawl"
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  background: 'var(--apple-surface)',
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: 'var(--apple-text)',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: progress !== null ? 4 : 0 }}>
                  <code style={{ fontSize: 11 }}>{String(id).substring(0, 18)}…</code>
                  {d && (
                    <span style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>
                      {d.completed || 0} / {d.total || '?'}
                    </span>
                  )}
                </div>
                {progress !== null && (
                  <div style={{ height: 3, background: 'var(--apple-separator)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--apple-blue)' }} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
