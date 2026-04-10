// src/components/metrics/TopClientsTable.jsx
import { useStore } from '../../store';
import { formatNumber, timeAgo } from '../../lib/format';

function truncate(s, n) {
  if (!s) return '\u2014';
  return s.length > n ? s.substring(0, n - 1) + '\u2026' : s;
}

// Accepts optional `clients` prop (prop-fed on Reports page) and an
// optional `onRowClick(client)` callback. When `clients` is omitted the
// component subscribes to the Dashboard's live store slice — keeping
// existing Dashboard usage unchanged.
export function TopClientsTable({ clients: clientsProp, onRowClick, subtitle }) {
  const storeClients = useStore(s => s.proxyStats.topClients);
  const clients = (clientsProp ?? storeClients) || [];
  const clickable = typeof onRowClick === 'function';

  return (
    <div className="apple-card">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Top clients</h3>
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
        {subtitle || 'grouped by IP + User-Agent · last 24h'}
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
              {clients.map((c, i) => {
                // Keyboard activation for the clickable row. <tr> isn't
                // a semantic button but accepts tabIndex={0} as a focus
                // stop in all modern browsers, which is the minimal
                // accessible path that doesn't require restructuring
                // the table into nested focusable cells.
                const handleKeyDown = clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(c);
                      }
                    }
                  : undefined;
                return (
                <tr
                  key={`${c.client_ip}-${c.client_ua}-${i}`}
                  onClick={clickable ? () => onRowClick(c) : undefined}
                  onKeyDown={handleKeyDown}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={clickable ? `Drill down by client ${c.client_ip || 'unknown'}` : undefined}
                  style={{
                    borderBottom: '1px solid var(--apple-separator)',
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                  onMouseEnter={clickable ? e => (e.currentTarget.style.background = 'var(--apple-surface)') : undefined}
                  onMouseLeave={clickable ? e => (e.currentTarget.style.background = 'transparent') : undefined}
                >
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
                );
              })}
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
