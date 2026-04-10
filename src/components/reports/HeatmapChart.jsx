// src/components/reports/HeatmapChart.jsx
//
// 7×24 day-of-week × hour-of-day traffic heatmap. Consumes the
// `heatmap` slot from the reports store: a flat array of
// { dow: 0..6, hour: 0..23, count } rows which we pivot into a matrix.
//
// Color scale is square-root-compressed so a few high-traffic cells
// don't flatten the rest of the grid to white. Hover any cell for
// the exact count; click a cell to drill down by that time window
// (wired via the onCellClick callback).
import { formatNumber } from '../../lib/format';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Build the 7×24 matrix from the flat list, filling missing cells with 0.
function pivot(rows) {
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  for (const r of rows) {
    if (r.dow >= 0 && r.dow < 7 && r.hour >= 0 && r.hour < 24) {
      matrix[r.dow][r.hour] = r.count;
      if (r.count > max) max = r.count;
    }
  }
  return { matrix, max };
}

// Color scale: hsl(210, 80%, L%) from ~96% (empty) to ~38% (peak).
// Square-root compression keeps small values visible when one cell dominates.
function cellColor(count, max) {
  if (max === 0 || count === 0) return 'var(--apple-surface)';
  const t = Math.sqrt(count / max);  // 0..1
  const lightness = 96 - t * 58;     // 96% → 38%
  return `hsl(210, 80%, ${lightness}%)`;
}

export function HeatmapChart({ heatmap, onCellClick }) {
  const rows = heatmap || [];
  const { matrix, max } = pivot(rows);
  const total = rows.reduce((s, r) => s + r.count, 0);

  // Grid cell geometry. Using viewBox-free sizing with CSS grid avoids
  // SVG alignment quirks across font sizes.
  const CELL_SIZE = 16;
  const CELL_GAP = 2;

  return (
    <div className="apple-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Traffic heatmap</h3>
        <span style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>
          {formatNumber(total)} requests · day of week × hour
        </span>
      </div>

      {total === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--apple-text-secondary)', fontSize: 12 }}>
          No data in the selected window.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'inline-block' }}>
            {/* Hour column header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `28px repeat(24, ${CELL_SIZE}px)`,
              gap: CELL_GAP,
              marginBottom: CELL_GAP,
              alignItems: 'center',
            }}>
              <div />
              {Array.from({ length: 24 }).map((_, h) => (
                <div
                  key={h}
                  style={{
                    fontSize: 9,
                    color: 'var(--apple-text-secondary)',
                    textAlign: 'center',
                    visibility: h % 3 === 0 ? 'visible' : 'hidden',
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Rows: one per day-of-week */}
            {DAYS.map((day, dow) => (
              <div
                key={day}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `28px repeat(24, ${CELL_SIZE}px)`,
                  gap: CELL_GAP,
                  marginBottom: CELL_GAP,
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--apple-text-secondary)', textAlign: 'right', paddingRight: 4 }}>
                  {day}
                </div>
                {matrix[dow].map((count, hour) => (
                  <div
                    key={hour}
                    onClick={() => onCellClick?.(dow, hour, count)}
                    title={`${day} ${hour}:00 — ${formatNumber(count)} requests`}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      borderRadius: 3,
                      background: cellColor(count, max),
                      cursor: onCellClick ? 'pointer' : 'default',
                      transition: 'transform 0.1s ease',
                    }}
                  />
                ))}
              </div>
            ))}

            {/* Color-scale legend */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              fontSize: 10,
              color: 'var(--apple-text-secondary)',
            }}>
              <span>less</span>
              {[0, 0.1, 0.3, 0.5, 0.7, 1.0].map((t, i) => (
                <div
                  key={i}
                  style={{
                    width: 14,
                    height: 10,
                    borderRadius: 2,
                    background: t === 0 ? 'var(--apple-surface)' : `hsl(210, 80%, ${96 - t * 58}%)`,
                  }}
                />
              ))}
              <span>more</span>
              <span style={{ marginLeft: 'auto' }}>peak: {formatNumber(max)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
