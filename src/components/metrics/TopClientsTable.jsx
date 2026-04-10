// src/components/metrics/TopClientsTable.jsx
import { useStore } from '../../store';
import { formatNumber, timeAgo } from '../../lib/format';

function truncate(s, n) {
  if (!s) return '\u2014';
  return s.length > n ? s.substring(0, n - 1) + '\u2026' : s;
}

export function TopClientsTable() {
  const clients = useStore(s => s.proxyStats.topClients) || [];

  return (
    <div className="apple-card">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Top clients</h3>
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
        grouped by IP + User-Agent · last 24h
      </div>
      {clients.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--apple-text-secondary)', fontSize: 13 }}>
          No traffic yet. Point a Firecrawl client at the proxy to start logging.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--apple-separator)' }}>
                <th style={thStyle}>Client</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Count</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Failed</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Credits</th>
                <th style={thStyle}>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={`${c.client_ip}-${c.client_ua}-${i}`} style={{ borderBottom: '1px solid var(--apple-separator)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>
                      {c.client_ip || '(unknown)'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>
                      {truncate(c.client_ua, 50)}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatNumber(c.count)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: c.failed > 0 ? 'var(--apple-red)' : 'var(--apple-text-secondary)' }}>
                    {formatNumber(c.failed)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(c.creditsUsed)}</td>
                  <td style={{ ...tdStyle, color: 'var(--apple-text-secondary)', fontSize: 11 }}>{timeAgo(c.lastSeenAt)}</td>
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
  padding: '8px 8px 8px 0',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--apple-text-secondary)',
  fontWeight: 500,
};
const tdStyle = {
  padding: '8px 8px 8px 0',
  verticalAlign: 'top',
};
