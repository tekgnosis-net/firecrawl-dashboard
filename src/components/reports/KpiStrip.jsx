// src/components/reports/KpiStrip.jsx
//
// 5-tile KPI row for the Reports page. Reads from `overview` data
// which comes from /api/stats/proxy/overview with the active filter
// applied. Mirrors ProxyOverviewCard but larger and with more tiles.
import { formatNumber, formatPercent, formatDuration } from '../../lib/format';

export function KpiStrip({ overview }) {
  const total = overview?.total ?? 0;
  const success = overview?.success ?? 0;
  const successRate = overview?.successRate;
  const credits = overview?.creditsUsed ?? 0;
  const clients = overview?.uniqueClients ?? 0;
  const domains = overview?.uniqueDomains ?? 0;
  const avgDur = overview?.avgDurationMs;
  const p95Dur = overview?.p95DurationMs;

  const tiles = [
    { label: 'Operations', value: formatNumber(total), sub: `${formatNumber(success)} successful` },
    { label: 'Success rate', value: formatPercent(successRate), sub: `${formatNumber(total - success)} failed`, accent: successRate !== null && successRate < 0.95 ? 'var(--apple-red)' : undefined },
    { label: 'Credits used', value: formatNumber(credits), sub: 'billed to Firecrawl' },
    { label: 'Unique clients', value: formatNumber(clients), sub: `${formatNumber(domains)} domains` },
    { label: 'Duration', value: formatDuration(avgDur), sub: `p95 ${formatDuration(p95Dur)}` },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12,
    }}>
      {tiles.map((t) => (
        <div key={t.label} className="apple-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            {t.label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: t.accent || 'var(--apple-text)', lineHeight: 1.1 }}>
            {t.value}
          </div>
          <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 6 }}>
            {t.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
