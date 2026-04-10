// src/components/charts/TopDomainsChart.jsx
//
// Horizontal bar list of top target hostnames from the proxy log.
// Reads directly from the store's proxyStats.topDomains slice; no props.
import { useStore } from '../../store';

export function TopDomainsChart() {
  const data = useStore(s => s.proxyStats.topDomains) || [];

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
      {data.map(({ target_host, count, successRate }) => (
        <div key={target_host || '(unknown)'}>
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
      ))}
    </div>
  );
}
