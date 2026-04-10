// src/components/charts/CreditsChart.jsx
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useStore } from '../../store';

function formatBucketLabel(bucket, span) {
  try {
    const d = parseISO(bucket);
    return span === 'day' ? format(d, 'MMM d') : format(d, 'HH:mm');
  } catch {
    return bucket;
  }
}

export function CreditsChart() {
  const series = useStore(s => s.proxyStats.creditsSeries) || [];

  if (series.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--apple-text-secondary)', fontSize: 13 }}>
        No credit usage observed yet.
      </div>
    );
  }

  const data = series.map(row => ({
    bucket: formatBucketLabel(row.bucket),
    creditsUsed: Number(row.creditsUsed) || 0,
    operations: Number(row.operations) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="creditsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--apple-blue)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--apple-blue)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--apple-separator)" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: 'var(--apple-text-secondary)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--apple-text-secondary)' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: 'var(--apple-card)',
            border: '1px solid var(--apple-separator)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--apple-text)',
          }}
          cursor={{ stroke: 'var(--apple-separator)' }}
        />
        <Area
          type="monotone"
          dataKey="creditsUsed"
          name="Credits"
          stroke="var(--apple-blue)"
          strokeWidth={2}
          fill="url(#creditsGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
