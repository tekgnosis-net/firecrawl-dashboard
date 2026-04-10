// src/components/metrics/ProcessStatusCard.jsx
import { useStore } from '../../store';
import { formatNumber } from '../../lib/format';

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '\u2014';
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function ProcessRow({ name, port, status, uptime, extra }) {
  const ok = status === 'healthy';
  const dotColor = ok ? 'var(--apple-green)' : status === 'degraded' ? '#FFA500' : 'var(--apple-red)';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--apple-separator)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: dotColor }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>port {port}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 12 }}>
        <div style={{ color: ok ? 'var(--apple-green)' : 'var(--apple-red)', fontWeight: 600 }}>
          {status || 'unknown'}
        </div>
        {uptime !== undefined && (
          <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>
            up {formatUptime(uptime)}
          </div>
        )}
        {extra && <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>{extra}</div>}
      </div>
    </div>
  );
}

export function ProcessStatusCard() {
  const processHealth = useStore(s => s.processHealth);
  const settings = useStore(s => s.settings);

  // /healthz returns { status, service: 'dashboard', uptimeSeconds, proxy: {...} }
  // with the proxy sub-object cross-pinged from the dashboard process.
  const dashboardStatus = processHealth?.status || 'unknown';
  const dashboardUptime = processHealth?.uptimeSeconds;
  const proxyHealth = processHealth?.proxy || null;
  const proxyStatus = proxyHealth?.status || 'unknown';
  const proxyUptime = proxyHealth?.uptimeSeconds;
  const proxyQueue = proxyHealth?.writeQueue;

  return (
    <div className="apple-card">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Dashboard processes</h3>
      <ProcessRow
        name="Dashboard"
        port={settings?.dashboardPort || 3001}
        status={dashboardStatus}
        uptime={dashboardUptime}
      />
      <ProcessRow
        name="Proxy"
        port={settings?.proxyPort || 3101}
        status={proxyStatus}
        uptime={proxyUptime}
        extra={proxyQueue ? `queue ${formatNumber(proxyQueue.bufferDepth)}` : null}
      />
    </div>
  );
}
