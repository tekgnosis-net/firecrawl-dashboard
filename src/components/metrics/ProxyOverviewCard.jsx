// src/components/metrics/ProxyOverviewCard.jsx
import { useStore } from '../../store';
import { formatNumber, formatPercent, formatDuration } from '../../lib/format';

// Optional `overview` prop for prop-fed callers; optional `onClick` makes
// the whole card behave as a navigation target (used by Dashboard to
// drill down into /reports).
export function ProxyOverviewCard({ overview: overviewProp, onClick }) {
  const storeOverview = useStore(s => s.proxyStats.overview);
  const overview = overviewProp ?? storeOverview;

  const total = overview?.total || 0;
  const rate = overview?.successRate;
  const credits = overview?.creditsUsed || 0;
  const clients = overview?.uniqueClients || 0;
  const avgDur = overview?.avgDurationMs;
  const p95Dur = overview?.p95DurationMs;
  const clickable = typeof onClick === 'function';

  return (
    <div
      className="apple-card"
      onClick={clickable ? onClick : undefined}
      style={clickable ? { cursor: 'pointer', transition: 'transform 0.1s ease' } : undefined}
      onMouseEnter={clickable ? e => (e.currentTarget.style.transform = 'translateY(-1px)') : undefined}
      onMouseLeave={clickable ? e => (e.currentTarget.style.transform = 'translateY(0)') : undefined}
      title={clickable ? 'Click to drill down in Reports' : undefined}
    >
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Proxy traffic (last 24h)</h3>
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
        observed at /v1/*, /v2/*, /admin/*
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <Kpi label="Operations" value={formatNumber(total)} />
        <Kpi label="Success rate" value={formatPercent(rate)} accent={rate !== null && rate < 0.95 ? 'var(--apple-red)' : undefined} />
        <Kpi label="Credits used" value={formatNumber(credits)} />
        <Kpi label="Unique clients" value={formatNumber(clients)} />
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--apple-separator)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--apple-text-secondary)' }}>
        <div>avg {formatDuration(avgDur)}</div>
        <div>p95 {formatDuration(p95Dur)}</div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || 'var(--apple-text)', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
