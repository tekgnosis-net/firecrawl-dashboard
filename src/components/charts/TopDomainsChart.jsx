// src/components/charts/TopDomainsChart.jsx
//
// Horizontal bar list of top target hostnames from the proxy log.
// Accepts an optional `data` prop (prop-fed by Reports page) and an
// optional `onRowClick(row)` callback. When `data` is omitted the
// component subscribes to the Dashboard's live store slice, keeping
// existing Dashboard usage unchanged.
import { useStore } from '../../store';

export function TopDomainsChart({ data: dataProp, onRowClick }) {
  const storeData = useStore(s => s.proxyStats.topDomains);
  const data = (dataProp ?? storeData) || [];
  const clickable = typeof onRowClick === 'function';

  if (!data.length) {
    return (
      <p style={{ color: 'var(--apple-text-secondary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
        No traffic yet
      </p>
    );
  }

  const max = data[0].count || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((row) => {
        const { target_host, count, successRate } = row;
        // Keyboard handler: when the row is clickable, Enter/Space
        // should activate the drill-down so keyboard users get the
        // same navigation path as mouse users.
        const handleKeyDown = clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRowClick(row);
              }
            }
          : undefined;
        return (
        <div
          key={target_host || '(unknown)'}
          onClick={clickable ? () => onRowClick(row) : undefined}
          onKeyDown={handleKeyDown}
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          aria-label={clickable ? `Drill down by target host ${target_host || 'unknown'}` : undefined}
          style={{
            cursor: clickable ? 'pointer' : 'default',
            padding: clickable ? '4px 6px' : 0,
            margin: clickable ? '-4px -6px' : 0,
            borderRadius: clickable ? 6 : 0,
          }}
          onMouseEnter={clickable ? e => (e.currentTarget.style.background = 'var(--apple-surface)') : undefined}
          onMouseLeave={clickable ? e => (e.currentTarget.style.background = 'transparent') : undefined}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span
              style={{
                fontSize: 12,
                color: 'var(--apple-text)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                marginRight: 8,
              }}
              title={target_host}
            >
              {target_host || '(unknown)'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--apple-text-secondary)', flexShrink: 0 }}>
              {count}{' '}
              <span style={{ fontSize: 10, opacity: 0.7 }}>
                ({Math.round((successRate || 0) * 100)}%)
              </span>
            </span>
          </div>
          <div style={{ height: 4, background: 'var(--apple-surface)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${(count / max) * 100}%`,
                background: successRate < 0.9 ? 'var(--apple-red)' : 'var(--apple-blue)',
                borderRadius: 2,
              }}
            />
          </div>
        </div>
        );
      })}
    </div>
  );
}
