// src/components/reports/DurationHistogram.jsx
//
// Log-scaled duration histogram for the Reports page. Consumes the
// `distribution` slot from the reports store, which is the payload of
// GET /api/stats/proxy/distribution: exponential buckets (0-10ms through
// 60s+) plus p50/p90/p95/p99 percentile summaries.
//
// Percentiles are rendered as a small strip *above* the chart so you
// can see distribution shape AND quantile summary at the same time.
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatDuration, formatNumber } from '../../lib/format';

// Color tiers matching the latency "traffic light" convention.
// Under 500ms: green (fast). Under 5s: blue (normal). Over 5s: orange (slow).
function bucketColor(label) {
  const fast = new Set(['0-10ms', '10-50ms', '50-100ms', '100-500ms']);
  const normal = new Set(['500ms-1s', '1-5s']);
  if (fast.has(label)) return 'var(--apple-green)';
  if (normal.has(label)) return 'var(--apple-blue)';
  return 'var(--apple-orange, #FF9500)';
}

function PercentileTile({ label, value }) {
  return (
    <div style={{
      flex: 1,
      padding: '6px 10px',
      borderRadius: 6,
      background: 'var(--apple-surface)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: 'var(--apple-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--apple-text)', marginTop: 2 }}>
        {value != null ? formatDuration(value) : '\u2014'}
      </div>
    </div>
  );
}

export function DurationHistogram({ distribution }) {
  const buckets = distribution?.buckets || [];
  const percentiles = distribution?.percentiles || {};
  const total = distribution?.total ?? 0;

  return (
    <div className="apple-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Duration distribution</h3>
        <span style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>
          {formatNumber(total)} samples
        </span>
      </div>

      {/* Percentile strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <PercentileTile label="p50" value={percentiles.p50} />
        <PercentileTile label="p90" value={percentiles.p90} />
        <PercentileTile label="p95" value={percentiles.p95} />
        <PercentileTile label="p99" value={percentiles.p99} />
      </div>

      {total === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--apple-text-secondary)', fontSize: 12 }}>
          No data in the selected window.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={buckets} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--apple-separator)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--apple-text-secondary)' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--apple-text-secondary)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--apple-card)',
                border: '1px solid var(--apple-separator)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--apple-text)',
              }}
              cursor={{ fill: 'var(--apple-surface)' }}
              formatter={(value) => [formatNumber(value), 'requests']}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {buckets.map((b, i) => (
                <Cell key={i} fill={bucketColor(b.label)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
