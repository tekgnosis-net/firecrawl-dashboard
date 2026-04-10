// src/components/metrics/RecentNotificationsCard.jsx
import { useStore } from '../../store';
import { timeAgo } from '../../lib/format';

const SEVERITY_STYLE = {
  critical: { dot: 'var(--apple-red)',  bg: 'var(--apple-badge-error-bg)',   fg: 'var(--apple-red)' },
  warning:  { dot: '#FFA500',           bg: 'var(--apple-badge-info-bg)',    fg: '#FFA500' },
  info:     { dot: 'var(--apple-blue)', bg: 'var(--apple-badge-info-bg)',    fg: 'var(--apple-blue)' },
};

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n - 1) + '\u2026' : s;
}

function DestinationIcons({ results }) {
  // results is { ntfy: { ok, status?, error? }, webhook: { ... } }
  return (
    <span style={{ display: 'inline-flex', gap: 6, fontSize: 10 }}>
      {Object.entries(results || {}).map(([dest, r]) => (
        <span
          key={dest}
          title={r.ok ? `${dest}: HTTP ${r.status}` : `${dest}: ${r.error || 'failed'}`}
          style={{
            padding: '1px 6px',
            borderRadius: 9999,
            background: r.ok ? 'var(--apple-badge-success-bg)' : 'var(--apple-badge-error-bg)',
            color: r.ok ? 'var(--apple-green)' : 'var(--apple-red)',
          }}
        >
          {r.ok ? '\u2713' : '\u2717'} {dest}
        </span>
      ))}
    </span>
  );
}

export function RecentNotificationsCard() {
  const recent = useStore(s => s.notifications.recent) || [];
  const fetchError = useStore(s => s.notifications.fetchError);

  return (
    <div className="apple-card">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Recent notifications</h3>
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
        alerts dispatched by the watcher
      </div>

      {fetchError && (
        <div style={{ fontSize: 12, color: 'var(--apple-red)', marginBottom: 10 }}>
          {fetchError}
        </div>
      )}

      {recent.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--apple-text-secondary)', fontSize: 13 }}>
          No notifications sent recently — everything healthy.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {recent.slice(0, 10).map(n => {
            const style = SEVERITY_STYLE[n.severity] || SEVERITY_STYLE.info;
            return (
              <div
                key={n.id}
                style={{
                  padding: '10px 12px',
                  background: 'var(--apple-surface)',
                  borderRadius: 8,
                  fontSize: 12,
                  borderLeft: `3px solid ${style.dot}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: style.dot }}
                    />
                    <span style={{ fontWeight: 600, color: 'var(--apple-text)' }}>
                      {truncate(n.title, 60)}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--apple-text-secondary)' }}>
                    {timeAgo(n.timestamp)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--apple-text-secondary)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                    {n.event_type}
                  </span>
                  <DestinationIcons results={n.results} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
