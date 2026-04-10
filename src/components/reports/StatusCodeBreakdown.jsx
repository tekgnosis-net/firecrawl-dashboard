// src/components/reports/StatusCodeBreakdown.jsx
//
// HTTP status code distribution. Consumes the `statusCodes` slot from
// the reports store: an array of { status, class, count } rows.
//
// Visual layout:
//   1. A single horizontal stacked bar showing the 2xx / 3xx / 4xx / 5xx
//      / transport_error proportions — one-glance health signal.
//   2. Underneath, the top individual status codes with their counts and
//      percentages, so you can see whether a 4xx spike is 429s or 404s.
import { formatNumber, formatPercent } from '../../lib/format';

const CLASS_ORDER = ['2xx', '3xx', '4xx', '5xx', '1xx', 'transport_error'];

const CLASS_COLORS = {
  '2xx':             'var(--apple-green)',
  '3xx':             'var(--apple-blue)',
  '4xx':             'var(--apple-orange, #FF9500)',
  '5xx':             'var(--apple-red)',
  '1xx':             'var(--apple-gray)',
  'transport_error': 'var(--apple-gray)',
};

const CLASS_LABELS = {
  '2xx':             '2xx success',
  '3xx':             '3xx redirect',
  '4xx':             '4xx client error',
  '5xx':             '5xx server error',
  '1xx':             '1xx informational',
  'transport_error': 'transport error',
};

export function StatusCodeBreakdown({ statusCodes }) {
  const rows = statusCodes || [];
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  // Aggregate counts per class for the stacked bar.
  const byClass = {};
  for (const r of rows) {
    byClass[r.class] = (byClass[r.class] || 0) + r.count;
  }
  const classEntries = CLASS_ORDER
    .filter(c => (byClass[c] || 0) > 0)
    .map(c => ({ class: c, count: byClass[c], pct: total > 0 ? byClass[c] / total : 0 }));

  // Top individual status codes for the detail list.
  const topCodes = [...rows].sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <div className="apple-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Status codes</h3>
        <span style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>
          {formatNumber(total)} responses
        </span>
      </div>

      {total === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--apple-text-secondary)', fontSize: 12 }}>
          No data in the selected window.
        </div>
      ) : (
        <>
          {/* Stacked bar */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: 22,
              borderRadius: 6,
              overflow: 'hidden',
              background: 'var(--apple-surface)',
              marginBottom: 10,
            }}
            title={classEntries.map(c => `${CLASS_LABELS[c.class]}: ${formatNumber(c.count)}`).join('  ')}
          >
            {classEntries.map(c => (
              <div
                key={c.class}
                style={{
                  width: `${c.pct * 100}%`,
                  background: CLASS_COLORS[c.class],
                  transition: 'width 0.3s ease',
                }}
                title={`${CLASS_LABELS[c.class]}: ${formatNumber(c.count)} (${formatPercent(c.pct)})`}
              />
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {classEntries.map(c => (
              <div key={c.class} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: CLASS_COLORS[c.class] }} />
                <span style={{ color: 'var(--apple-text)' }}>{CLASS_LABELS[c.class]}</span>
                <span style={{ color: 'var(--apple-text-secondary)' }}>
                  {formatNumber(c.count)} ({formatPercent(c.pct)})
                </span>
              </div>
            ))}
          </div>

          {/* Top individual codes */}
          <div style={{ borderTop: '1px solid var(--apple-separator)', paddingTop: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--apple-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Top codes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {topCodes.map(r => {
                const pct = total > 0 ? r.count / total : 0;
                const label = r.status === 0 ? 'ERR (transport)' : String(r.status);
                return (
                  <div key={r.status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      minWidth: 56,
                      color: CLASS_COLORS[r.class],
                      fontWeight: 600,
                    }}>
                      {label}
                    </span>
                    <div style={{ flex: 1, height: 4, background: 'var(--apple-surface)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct * 100}%`, height: '100%', background: CLASS_COLORS[r.class] }} />
                    </div>
                    <span style={{ color: 'var(--apple-text-secondary)', minWidth: 72, textAlign: 'right' }}>
                      {formatNumber(r.count)} ({formatPercent(pct)})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
