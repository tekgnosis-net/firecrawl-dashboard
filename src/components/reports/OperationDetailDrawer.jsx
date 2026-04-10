// src/components/reports/OperationDetailDrawer.jsx
//
// Slide-in drawer from the right showing the full detail of one
// proxy_operations row, plus (for crawl-related rows) the full
// lifecycle of other rows sharing the same firecrawl_id.
//
// Dismissed via X button, Esc key, or click on the backdrop.
import { useEffect } from 'react';
import { formatDuration, formatBytes, timeAgo } from '../../lib/format';

function Field({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 12 }}>
      <div style={{ flex: '0 0 140px', color: 'var(--apple-text-secondary)' }}>{label}</div>
      <div style={{
        flex: 1,
        fontFamily: mono ? 'ui-monospace, Menlo, monospace' : 'inherit',
        fontSize: mono ? 11 : 12,
        color: 'var(--apple-text)',
        wordBreak: 'break-all',
      }}>
        {value ?? <span style={{ color: 'var(--apple-text-secondary)' }}>\u2014</span>}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: 'var(--apple-text-secondary)',
        marginBottom: 8,
        fontWeight: 600,
      }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function CrawlLifecycleTimeline({ lifecycle, currentId, onSelectRow }) {
  if (!lifecycle || lifecycle.length === 0) {
    return (
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', fontStyle: 'italic' }}>
        No additional lifecycle rows found for this crawl.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {lifecycle.map((row, i) => {
        const isCurrent = row.id === currentId;
        const ok = row.success === 1;
        return (
          <button
            key={row.id}
            onClick={() => !isCurrent && onSelectRow(row.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              background: isCurrent ? 'var(--apple-badge-info-bg)' : 'transparent',
              border: 'none',
              borderLeft: `3px solid ${ok ? 'var(--apple-green)' : 'var(--apple-red)'}`,
              borderRadius: 4,
              cursor: isCurrent ? 'default' : 'pointer',
              textAlign: 'left',
              width: '100%',
              fontSize: 11,
              color: 'var(--apple-text)',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? 'var(--apple-green)' : 'var(--apple-red)', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{row.operation_type}</span>
              {' · '}
              <span style={{ color: 'var(--apple-text-secondary)' }}>{timeAgo(row.timestamp)}</span>
            </span>
            <span style={{ fontSize: 10, color: 'var(--apple-text-secondary)' }}>
              HTTP {row.response_status} · {formatDuration(row.duration_ms)}
              {row.credits_used != null && ` · ${row.credits_used} cr`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function OperationDetailDrawer({ detail, onClose, onSelectRow }) {
  // Close on Esc
  useEffect(() => {
    if (!detail) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [detail, onClose]);

  if (!detail) return null;

  const isCrawl = detail.firecrawl_id && String(detail.operation_type).startsWith('crawl_');
  const proxyOverhead = detail.duration_ms != null && detail.upstream_response_time_ms != null
    ? detail.duration_ms - detail.upstream_response_time_ms
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 1000,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(50%, 720px)',
          minWidth: 'min(100%, 420px)',
          background: 'var(--apple-card)',
          zIndex: 1001,
          overflowY: 'auto',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.2)',
          padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--apple-separator)' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {detail.operation_type}
            </h2>
            <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 4 }}>
              {detail.timestamp} · id {detail.id}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: 'var(--apple-text-secondary)',
              padding: 0,
              lineHeight: 1,
            }}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Identity */}
        <Section title="Client identity">
          <Field label="Client IP" value={detail.client_ip} mono />
          <Field label="User-Agent" value={detail.client_ua} mono />
          <Field label="Auth hash" value={detail.client_auth_hash ? detail.client_auth_hash.substring(0, 16) + '\u2026' : null} mono />
        </Section>

        {/* Request */}
        <Section title="Request">
          <Field label="Method" value={detail.method} mono />
          <Field label="Path" value={detail.path} mono />
          <Field label="Target URL" value={detail.target_url} mono />
          <Field label="Target host" value={detail.target_host} mono />
          <Field label="Query text" value={detail.query_text} mono />
          <Field label="Request size" value={formatBytes(detail.request_body_size)} />
        </Section>

        {/* Response */}
        <Section title="Response">
          <Field label="HTTP status" value={detail.response_status === 0 ? 'Transport error' : detail.response_status} />
          <Field label="Response size" value={formatBytes(detail.response_size)} />
          <Field label="Success" value={detail.success === 1 ? 'Yes' : 'No'} />
          <Field label="Error message" value={detail.error_message} mono />
        </Section>

        {/* Firecrawl-specific */}
        <Section title="Firecrawl">
          <Field label="Firecrawl ID" value={detail.firecrawl_id} mono />
          <Field label="Credits used" value={detail.credits_used ?? null} />
          <Field label="Scraped status code" value={detail.scraped_status_code ?? null} />
          <Field label="Concurrency limited" value={detail.concurrency_limited === 1 ? 'Yes' : 'No'} />
        </Section>

        {/* Timing */}
        <Section title="Timing">
          <Field label="Proxy duration" value={formatDuration(detail.duration_ms)} />
          <Field label="Upstream time" value={formatDuration(detail.upstream_response_time_ms)} />
          <Field label="Proxy overhead" value={proxyOverhead != null ? formatDuration(proxyOverhead) : null} />
        </Section>

        {/* Crawl lifecycle (conditional) */}
        {isCrawl && (
          <Section title={`Crawl lifecycle (firecrawl_id: ${detail.firecrawl_id.substring(0, 18)}\u2026)`}>
            <CrawlLifecycleTimeline
              lifecycle={detail.lifecycle}
              currentId={detail.id}
              onSelectRow={onSelectRow}
            />
          </Section>
        )}

        {/* Request body (if debug logged) */}
        {detail.request_body && (
          <Section title="Request body (debug)">
            <pre style={{
              background: '#1D1D1F',
              color: '#F5F5F7',
              padding: 10,
              borderRadius: 6,
              fontSize: 10,
              overflow: 'auto',
              maxHeight: 200,
              margin: 0,
            }}>
              {detail.request_body.substring(0, 10000)}
              {detail.request_body.length > 10000 && '\n... (truncated)'}
            </pre>
          </Section>
        )}

        {/* Response body (if debug logged) */}
        {detail.response_body && (
          <Section title="Response body (debug)">
            <pre style={{
              background: '#1D1D1F',
              color: '#F5F5F7',
              padding: 10,
              borderRadius: 6,
              fontSize: 10,
              overflow: 'auto',
              maxHeight: 300,
              margin: 0,
            }}>
              {detail.response_body.substring(0, 10000)}
              {detail.response_body.length > 10000 && '\n... (truncated)'}
            </pre>
          </Section>
        )}
      </div>
    </>
  );
}
