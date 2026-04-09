import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

export function ActivityChart({ data }) {
  const formatted = data.map(row => ({
    ...row,
    date: (() => { try { return format(parseISO(row.date), 'EEE'); } catch { return row.date; } })(),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--apple-separator)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--apple-text-secondary)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--apple-text-secondary)' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: 'var(--apple-card)', border: '1px solid var(--apple-separator)', borderRadius: '8px', fontSize: '12px', color: 'var(--apple-text)' }} cursor={{ fill: 'var(--apple-surface)' }} />
        <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--apple-text-secondary)' }} />
        <Bar dataKey="scrapes" name="Scrapes" fill="var(--apple-blue)" radius={[3, 3, 0, 0]} stackId="a" />
        <Bar dataKey="searches" name="Searches" fill="var(--apple-green)" radius={[3, 3, 0, 0]} stackId="a" />
        <Bar dataKey="maps" name="Maps" fill="var(--apple-gray)" radius={[3, 3, 0, 0]} stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  );
}
