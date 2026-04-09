import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export function SuccessRateChart({ stats }) {
  const success = (stats?.scrapes?.success || 0) + (stats?.searches?.success || 0) + (stats?.maps?.success || 0);
  const failed  = (stats?.scrapes?.failed  || 0) + (stats?.searches?.failed  || 0) + (stats?.maps?.failed  || 0);
  const total = success + failed;
  const rate = total > 0 ? Math.round((success / total) * 100) : 0;
  const chartData = total === 0
    ? [{ name: 'No data', value: 1 }]
    : [{ name: 'Success', value: success }, { name: 'Failed', value: failed }];
  const colors = total === 0 ? ['var(--apple-separator)'] : ['var(--apple-green)', 'var(--apple-red)'];

  return (
    <div style={{ position: 'relative', height: '160px' }}>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={68} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
            {chartData.map((_, i) => <Cell key={i} fill={colors[i]} />)}
          </Pie>
          {total > 0 && <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: 'var(--apple-card)', border: '1px solid var(--apple-separator)', borderRadius: '8px', fontSize: '12px' }} />}
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: '24px', fontWeight: '700', color: 'var(--apple-text)' }}>{rate}%</span>
        <span style={{ fontSize: '11px', color: 'var(--apple-text-secondary)' }}>success</span>
      </div>
    </div>
  );
}
