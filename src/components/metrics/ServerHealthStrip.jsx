// src/components/metrics/ServerHealthStrip.jsx
import { useStore } from '../../store';
import { formatUnlimited, timeAgo } from '../../lib/format';

function Dot({ color }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: color,
        marginRight: 8,
        verticalAlign: 'middle',
      }}
    />
  );
}

export function ServerHealthStrip() {
  const health = useStore(s => s.health);
  const queue = useStore(s => s.serverMetrics.queueStatus);
  const redis = useStore(s => s.serverMetrics.redisHealth);
  const redisReason = useStore(s => s.serverMetrics.redisHealthReason);
  const lastFetched = useStore(s => s.serverMetrics.lastFetchedAt);

  const firecrawlOk = health?.status === 'healthy' || health?.status === 'degraded';
  const firecrawlColor = firecrawlOk ? 'var(--apple-green)' : 'var(--apple-red)';
  const firecrawlLabel = firecrawlOk ? 'Connected' : 'Unavailable';

  let redisColor = 'var(--apple-text-secondary)';
  let redisLabel = 'Not configured';
  if (redisReason === 'not_configured') {
    redisColor = 'var(--apple-text-secondary)';
    redisLabel = 'Not configured';
  } else if (redis?.status === 'healthy') {
    redisColor = 'var(--apple-green)';
    redisLabel = 'Healthy';
  } else if (redis) {
    redisColor = 'var(--apple-red)';
    redisLabel = 'Degraded';
  }

  return (
    <div className="apple-card" style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex',
        gap: 32,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <Stat label="Firecrawl">
            <Dot color={firecrawlColor} />
            <span style={{ fontWeight: 600 }}>{firecrawlLabel}</span>
          </Stat>
          <Stat label="Redis">
            <Dot color={redisColor} />
            <span style={{ fontWeight: 600 }}>{redisLabel}</span>
          </Stat>
          <Stat label="Max concurrency">
            <span style={{ fontWeight: 600 }}>{formatUnlimited(queue?.maxConcurrency)}</span>
          </Stat>
          <Stat label="Last success">
            <span style={{ fontWeight: 600 }}>{timeAgo(queue?.mostRecentSuccess)}</span>
          </Stat>
        </div>
        <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>
          Updated {timeAgo(lastFetched)}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 15 }}>{children}</div>
    </div>
  );
}
