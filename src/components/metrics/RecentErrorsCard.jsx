// src/components/metrics/RecentErrorsCard.jsx
import { useStore } from '../../store';
import { timeAgo } from '../../lib/format';

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n - 1) + '\u2026' : s;
}

// Accepts optional `errors` prop (prop-fed from Reports page) and an
// optional `onRowClick(errorRow)` callback. Backward-compatible: omit
// both to fall back to the store slice used by the Dashboard.
export function RecentErrorsCard({ errors: errorsProp, onRowClick }) {
  const storeErrors = useStore(s => s.proxyStats.recentErrors);
  const errors = (errorsProp ?? storeErrors) || [];
  const clickable = typeof onRowClick === 'function';

  return (
    <div className="apple-card">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Recent errors</h3>
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
        failed proxy operations · last 24h
      </div>
      {errors.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--apple-text-secondary)', fontSize: 13 }}>
          No errors — everything is working.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {errors.slice(0, 20).map(e => {
            // Keyboard activation for clickable error rows, matching
            // the pattern on the other Dashboard drill-down widgets.
            const handleKeyDown = clickable
              ? (ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    onRowClick(e);
                  }
                }
              : undefined;
            return (
            <div
              key={e.id}
              onClick={clickable ? () => onRowClick(e) : undefined}
              onKeyDown={handleKeyDown}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={clickable ? `Open detail for ${e.operation_type} error #${e.id}` : undefined}
              style={{
                padding: '8px 12px',
                background: 'var(--apple-error-bg)',
                border: '1px solid var(--apple-error-border)',
                borderRadius: 8,
                fontSize: 12,
                cursor: clickable ? 'pointer' : 'default',
                transition: 'transform 0.1s ease',
              }}
              onMouseEnter={clickable ? ev => (ev.currentTarget.style.transform = 'translateX(2px)') : undefined}
              onMouseLeave={clickable ? ev => (ev.currentTarget.style.transform = 'translateX(0)') : undefined}
              title={clickable ? 'Click to open full detail in Reports' : undefined}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: 'var(--apple-red)' }}>
                  {e.operation_type} {e.response_status || 'FAIL'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--apple-text-secondary)' }}>{timeAgo(e.timestamp)}</span>
              </div>
              {e.target_url && (
                <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', fontFamily: 'ui-monospace, Menlo, monospace', marginBottom: 2, wordBreak: 'break-all' }}>
                  {truncate(e.target_url, 80)}
                </div>
              )}
              {e.error_message && (
                <div style={{ fontSize: 11, color: 'var(--apple-text)', wordBreak: 'break-word' }}>
                  {truncate(e.error_message, 200)}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
