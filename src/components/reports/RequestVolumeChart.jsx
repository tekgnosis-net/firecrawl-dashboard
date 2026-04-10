// src/components/reports/RequestVolumeChart.jsx
//
// Request-volume-over-time tile for the Reports page. Delegates the
// actual bar rendering to the existing ProxyActivityChart (which we
// parameterized with an optional `timeline` prop) and wraps it in the
// standard apple-card chrome so all Reports tiles share the same shell.
import { ProxyActivityChart } from '../charts/ProxyActivityChart';
import { formatNumber } from '../../lib/format';

export function RequestVolumeChart({ timeline }) {
  const rows = timeline || [];

  // Sum counts across all operation-type columns for the header stat.
  // A timeline row looks like { bucket: '...', scrape: 3, crawl_status: 1, ... }
  let total = 0;
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (k !== 'bucket' && typeof v === 'number') total += v;
    }
  }

  return (
    <div className="apple-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Request volume</h3>
        <span style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>
          {formatNumber(total)} requests, stacked by operation type
        </span>
      </div>
      <ProxyActivityChart timeline={rows} height={200} />
    </div>
  );
}
