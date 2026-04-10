// src/components/metrics/ProxyOverviewCard.jsx
import { useStore } from '../../store';
import { formatNumber, formatPercent, formatDuration } from '../../lib/format';

export function ProxyOverviewCard() {
  const overview = useStore(s => s.proxyStats.overview);

  const total = overview?.total || 0;
  const rate = overview?.successRate;
  const credits = overview?.creditsUsed || 0;
  const clients = overview?.uniqueClients || 0;
  const avgDur = overview?.avgDurationMs;
  const p95Dur = overview?.p95DurationMs;

  return (
    <div className="apple-card">
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
