// src/components/metrics/BullQueuesTable.jsx
import { Link } from 'react-router-dom';
import { useStore } from '../../store';

function cleanName(name) {
  return name.replace(/[{}]/g, '');
}

function CountBadge({ count, kind = 'info' }) {
  if (!count) return <span style={{ color: 'var(--apple-text-secondary)' }}>0</span>;
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: 12,
    fontWeight: 600,
  };
  if (kind === 'success') {
    style.background = 'var(--apple-badge-success-bg)';
    style.color = 'var(--apple-green)';
  } else if (kind === 'error') {
    style.background = 'var(--apple-badge-error-bg)';
    style.color = 'var(--apple-red)';
  } else {
    style.background = 'var(--apple-badge-info-bg)';
    style.color = 'var(--apple-blue)';
  }
  return <span style={style}>{count.toLocaleString()}</span>;
}

export function BullQueuesTable() {
  const data = useStore(s => s.serverMetrics.bullQueues);
  const reason = useStore(s => s.serverMetrics.bullQueuesReason);

  return (
    <div className="apple-card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>BullMQ queues</h3>
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
        /admin/{'<BULL_AUTH>'}/queues
      </div>
      {reason === 'not_configured' ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--apple-text-secondary)' }}>
          BULL_AUTH not configured —{' '}
          <Link to="/settings" style={{ color: 'var(--apple-blue)', textDecoration: 'none' }}>
            set it in Settings
          </Link>{' '}
          to view queue metrics
        </div>
      ) : !data ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--apple-text-secondary)' }}>
          Loading…
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--apple-separator)' }}>
                <th style={thStyle}>Queue</th>
                <th style={thStyle}>Active</th>
                <th style={thStyle}>Waiting</th>
                <th style={thStyle}>Delayed</th>
                <th style={thStyle}>Completed</th>
                <th style={thStyle}>Failed</th>
              </tr>
            </thead>
            <tbody>
              {(data.queues || []).map(q => (
                <tr key={q.name} style={{ borderBottom: '1px solid var(--apple-separator)' }}>
                  <td style={{ ...tdStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
                    {cleanName(q.name)}
                  </td>
                  <td style={tdStyle}><CountBadge count={q.counts?.active} kind="info" /></td>
                  <td style={tdStyle}><CountBadge count={q.counts?.waiting} kind="info" /></td>
                  <td style={tdStyle}><CountBadge count={q.counts?.delayed} kind="info" /></td>
                  <td style={tdStyle}><CountBadge count={q.counts?.completed} kind="success" /></td>
                  <td style={tdStyle}><CountBadge count={q.counts?.failed} kind="error" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '8px 12px 8px 0',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--apple-text-secondary)',
  fontWeight: 500,
};
const tdStyle = {
  padding: '10px 12px 10px 0',
};
