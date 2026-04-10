// src/pages/CrawlPage.jsx
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { useStore } from '../store';
import { buildProxyUrl, INTERNAL_UI_HEADERS } from '../lib/proxyUrl';

const STATUS_STYLE = {
  completed: { background: 'var(--apple-badge-success-bg)', color: 'var(--apple-green)' },
  failed:    { background: 'var(--apple-badge-error-bg)',   color: 'var(--apple-red)' },
  cancelled: { background: 'var(--apple-badge-error-bg)',   color: 'var(--apple-red)' },
  expired:   { background: 'var(--apple-surface)',          color: 'var(--apple-text-secondary)' },
  pending:   { background: 'var(--apple-badge-info-bg)',    color: 'var(--apple-blue)' },
  scraping:  { background: 'var(--apple-badge-info-bg)',    color: 'var(--apple-blue)' },
};

/**
 * Build the unified crawl list from three sources, deduped by firecrawl_id:
 *   1. serverMetrics.activeCrawls — currently-running crawls (server truth)
 *   2. sessionCrawlIds            — crawls submitted this session
 *   3. proxyStats.recentOps       — recent crawl_create rows from the proxy log
 *
 * Each entry is enriched with whatever activeCrawlsDetails has for it
 * (progress, credits, page list).
 */
function useUnifiedCrawls() {
  const activeCrawls = useStore(s => s.serverMetrics.activeCrawls);
  const sessionIds = useStore(s => s.sessionCrawlIds);
  const details = useStore(s => s.activeCrawlsDetails);
  const recentOps = useStore(s => s.proxyStats.recentOps);

  return useMemo(() => {
    const byId = new Map();

    // 1. Server-active crawls (authoritative for in-flight)
    for (const c of activeCrawls?.crawls || []) {
      const id = c.id || c;
      const url = c.url || details[id]?.url || null;
      const createdAt = c.created_at || details[id]?.createdAt || null;
      byId.set(id, {
        id,
        url,
        createdAt,
        source: 'server_active',
        detail: details[id] || null,
      });
    }

    // 2. Crawls we submitted this session (may be active or recently completed)
    for (const id of sessionIds) {
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          url: details[id]?.url || null,
          createdAt: details[id]?.fetchedAt || null,
          source: 'session',
          detail: details[id] || null,
        });
      }
    }

    // 3. Recent crawl_create operations from the proxy log (cross-session history)
    for (const op of recentOps || []) {
      if (op.operation_type !== 'crawl_create') continue;
      if (!op.firecrawl_id) continue;
      if (!byId.has(op.firecrawl_id)) {
        byId.set(op.firecrawl_id, {
          id: op.firecrawl_id,
          url: op.target_url,
          createdAt: op.timestamp,
          source: 'proxy_log',
          detail: details[op.firecrawl_id] || null,
        });
      }
    }

    // Sort: in-flight first, then by createdAt desc
    const list = Array.from(byId.values());
    list.sort((a, b) => {
      const aActive = ['pending', 'scraping'].includes(a.detail?.status);
      const bActive = ['pending', 'scraping'].includes(b.detail?.status);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    return list;
  }, [activeCrawls, sessionIds, details, recentOps]);
}

export function CrawlPage() {
  const submitCrawl = useStore(s => s.submitCrawl);
  const cancelCrawl = useStore(s => s.cancelCrawl);
  const fetchActiveCrawlsDetail = useStore(s => s.fetchActiveCrawlsDetail);
  const fetchProxyStats = useStore(s => s.fetchProxyStats);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const clearError = useStore(s => s.clearError);

  const crawls = useUnifiedCrawls();

  const [url, setUrl] = useState('');
  const [limit, setLimit] = useState(10);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchActiveCrawlsDetail();
    fetchProxyStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await submitCrawl(url, { limit });
      setUrl('');
    } catch (_) {}
  };

  const totals = {
    All: crawls.length,
    Active: crawls.filter(c => ['pending', 'scraping'].includes(c.detail?.status)).length,
    Completed: crawls.filter(c => c.detail?.status === 'completed').length,
    Failed: crawls.filter(c => ['failed', 'cancelled'].includes(c.detail?.status)).length,
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--apple-text)' }}>{'\u{1F577}'} Crawl</h1>
        <p style={{ fontSize: 13, color: 'var(--apple-text-secondary)', marginTop: 4 }}>
          Recursive crawl jobs. All requests flow through the transparent proxy — external clients see the same list here.
        </p>
      </div>

      {error && (
        <div className="apple-error-banner rounded-apple p-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 13 }}>{'\u26A0'} {error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: 'var(--apple-red)', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: form + job list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="apple-card">
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>New crawl</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="apple-input" required />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--apple-text-secondary)', whiteSpace: 'nowrap' }}>Max pages</label>
                <input type="number" value={limit} onChange={e => setLimit(Math.max(1, Number(e.target.value)))} min="1" max="1000" className="apple-input" />
              </div>
              <button type="submit" className="apple-button" disabled={loading}>
                {loading ? 'Starting\u2026' : 'Start crawl'}
              </button>
            </form>
            <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 10 }}>
              POST {'\u2192'} {buildProxyUrl('/v1/crawl')}
            </div>
          </div>

          <div className="apple-card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Jobs</h3>
            <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 12 }}>
              Firecrawl expires completed crawl data after 24h; older crawls show as "expired".
            </div>
            {crawls.length === 0 ? (
              <p style={{ color: 'var(--apple-text-secondary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                No crawl jobs observed yet
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
                {crawls.map(crawl => {
                  const status = crawl.detail?.status || (crawl.detail?.expired ? 'expired' : 'unknown');
                  const badgeStyle = STATUS_STYLE[status] || STATUS_STYLE.expired;
                  const isExpanded = expandedId === crawl.id;
                  return (
                    <div key={crawl.id}>
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : crawl.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'var(--apple-surface)',
                          borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          gap: 8,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: 'var(--apple-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                            {crawl.url || <code>{String(crawl.id).substring(0, 18)}…</code>}
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--apple-text-secondary)', marginTop: 2 }}>
                            {crawl.createdAt ? formatDistanceToNow(new Date(crawl.createdAt), { addSuffix: true }) : crawl.source}
                          </p>
                        </div>
                        <span className="apple-badge" style={{ fontSize: 10, flexShrink: 0, ...badgeStyle }}>{status}</span>
                      </div>
                      {isExpanded && (
                        <CrawlDetail
                          crawlId={crawl.id}
                          onCancel={() => { cancelCrawl(crawl.id); setExpandedId(null); }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: summary */}
        <div className="apple-card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Object.entries(totals).map(([label, value], i, arr) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--apple-separator)' : 'none',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--apple-text-secondary)' }}>{label}</span>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CrawlDetail({ crawlId, onCancel }) {
  const details = useStore(s => s.activeCrawlsDetails);
  const [localDetail, setLocalDetail] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);

  const storeDetail = details[crawlId];
  const detail = localDetail || storeDetail;
  const isActive = ['pending', 'scraping'].includes(detail?.status);

  // Fetch fresh detail on expand, and if still active, poll every 5s
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await axios.get(buildProxyUrl(`/v1/crawl/${crawlId}`), { headers: INTERNAL_UI_HEADERS });
        if (alive) setLocalDetail(r.data);
      } catch (_) {
        if (alive) setLocalDetail({ expired: true });
      }
    };
    poll();
    const timer = setInterval(() => { if (isActive) poll(); }, 5000);
    return () => { alive = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crawlId, isActive]);

  if (!detail) {
    return (
      <div style={{ background: 'var(--apple-surface)', borderRadius: '0 0 8px 8px', padding: 12, borderTop: '1px solid var(--apple-separator)' }}>
        <p style={{ fontSize: 12, color: 'var(--apple-text-secondary)', textAlign: 'center', margin: 0 }}>Loading…</p>
      </div>
    );
  }

  if (detail.expired) {
    return (
      <div style={{ background: 'var(--apple-surface)', borderRadius: '0 0 8px 8px', padding: 12, borderTop: '1px solid var(--apple-separator)' }}>
        <p style={{ fontSize: 12, color: 'var(--apple-text-secondary)', fontStyle: 'italic', margin: 0 }}>
          Results expired — Firecrawl no longer holds this crawl's data (24h retention).
        </p>
      </div>
    );
  }

  const completed = detail.completed || 0;
  const rawTotal = detail.total ?? 0;
  const pct = rawTotal > 0 ? Math.min(100, Math.round((completed / rawTotal) * 100)) : 0;
  const hasData = Array.isArray(detail.data) && detail.data.length > 0;

  return (
    <div style={{ background: 'var(--apple-surface)', borderRadius: '0 0 8px 8px', padding: 12, borderTop: '1px solid var(--apple-separator)' }}>
      {isActive && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>{completed} / {rawTotal || '?'} pages</span>
            <span style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>{pct}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--apple-separator)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--apple-blue)', borderRadius: 2, transition: 'width 0.5s' }} />
          </div>
          <button
            onClick={onCancel}
            style={{ marginTop: 8, fontSize: 12, color: 'var(--apple-red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Cancel crawl
          </button>
        </div>
      )}
      {detail.creditsUsed !== undefined && (
        <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 8 }}>
          Credits used: {detail.creditsUsed}
        </div>
      )}
      {hasData && (
        selectedPage !== null ? (
          <div>
            <button
              onClick={() => setSelectedPage(null)}
              style={{ fontSize: 12, color: 'var(--apple-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px 0' }}
            >
              {'\u2190'} Back to pages
            </button>
            <pre
              style={{
                background: '#1D1D1F',
                borderRadius: 8,
                padding: 10,
                fontSize: 10,
                color: '#F5F5F7',
                overflowY: 'auto',
                maxHeight: 280,
                whiteSpace: 'pre-wrap',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                margin: 0,
              }}
            >
              {detail.data[selectedPage]?.markdown || 'No markdown for this page'}
            </pre>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 8 }}>
              {detail.data.length} pages — click to view content
            </p>
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {detail.data.map((page, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPage(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'var(--apple-card)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: 'var(--apple-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                      {page.metadata?.title || page.metadata?.sourceURL || `Page ${i + 1}`}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--apple-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                      {page.metadata?.sourceURL}
                    </p>
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
