// src/components/metrics/QueueStatusCard.jsx
import { useStore } from '../../store';
import { formatNumber } from '../../lib/format';

export function QueueStatusCard() {
  const queue = useStore(s => s.serverMetrics.queueStatus);

  const stats = [
    { label: 'Jobs in queue', value: queue?.jobsInQueue },
    { label: 'Active', value: queue?.activeJobsInQueue },
    { label: 'Waiting', value: queue?.waitingJobsInQueue },
  ];

  return (
    <div className="apple-card">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Live queue</h3>
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
        /v1/team/queue-status
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {stats.map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--apple-text)', lineHeight: 1.1 }}>
              {formatNumber(s.value)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 4 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
