// src/components/charts/ProxyActivityChart.jsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useStore } from '../../store';

// Fixed color palette keyed to operation_type. Uses CSS variables so dark
// mode flips automatically. Unknown types fall back to gray.
const TYPE_COLORS = {
  scrape:            'var(--apple-blue)',
  crawl_create:      '#8A84FF',          // purple
  crawl_status:      '#5E5CE6',
  crawl_list_active: '#AF52DE',
  map:               '#FF9500',          // orange
  search:            'var(--apple-green)',
  extract:           '#FF2D55',          // pink
  batch_scrape:      '#64D2FF',
  team_query:        'var(--apple-gray)',
  admin_query:       'var(--apple-gray)',
  root:              'var(--apple-gray)',
  other:             'var(--apple-gray)',
};

// Preferred render order so crawls stack above scrapes etc.
const TYPE_ORDER = [
  'scrape', 'crawl_create', 'crawl_status', 'crawl_list_active',
  'map', 'search', 'extract', 'batch_scrape',
  'team_query', 'admin_query', 'root', 'other',
];

function formatBucketLabel(bucket) {
  try { return format(parseISO(bucket), 'HH:mm'); }
  catch { return bucket; }
}

// Optional `timeline` prop lets callers feed pre-fetched data (e.g. the
// Reports page, which reads from its own filter-aware store slice).
// When omitted, the chart subscribes to the Dashboard's live proxyStats
// slice — keeping existing callers unchanged.
//
// Optional `onBarClick(bucket, operationType)` callback fires when the
// user clicks a bar segment. Used by the Dashboard to navigate into
// /reports?hours=24&operation_type=<type>&from=<bucket> style URLs.
export function ProxyActivityChart({ timeline: timelineProp, height = 220, onBarClick }) {
  const storeTimeline = useStore(s => s.proxyStats.timeline);
  const timeline = (timelineProp ?? storeTimeline) || [];

  if (timeline.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--apple-text-secondary)', fontSize: 13 }}>
        No traffic yet. Point a Firecrawl client at the proxy URL to start logging operations.
      </div>
    );
  }

  // Figure out which types actually appear in the data — only draw those bars
  const typesPresent = new Set();
  for (const row of timeline) {
    for (const key of Object.keys(row)) {
      if (TYPE_COLORS[key] && row[key] > 0) typesPresent.add(key);
    }
  }
  const typesToRender = TYPE_ORDER.filter(t => typesPresent.has(t));

  // Keep the raw ISO bucket on each row under `_bucketRaw` so click
  // handlers can reconstruct the actual time range. The `bucket` field
  // itself holds the short label used by the x-axis.
  const formatted = timeline.map(row => ({
    ...row,
    _bucketRaw: row.bucket,
    bucket: formatBucketLabel(row.bucket),
  }));

  const handleBarClick = (type) => (data) => {
    if (!onBarClick) return;
    // Recharts' <Bar onClick> fires with (data, index, event). The
    // first argument is the bar-shape object, and the original data
    // row from the chart `data` prop lives on `.payload`. Prefer that;
    // fall back to `data` itself for defensive reading.
    const row = data?.payload || data;
    const bucketRaw = row?._bucketRaw || row?.bucket;
    onBarClick(bucketRaw, type);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={formatted} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
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
          cursor={{ fill: 'var(--apple-surface)' }}
        />
        <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--apple-text-secondary)' }} />
        {typesToRender.map((type, i) => (
          <Bar
            key={type}
            dataKey={type}
            name={type}
            fill={TYPE_COLORS[type]}
            stackId="a"
            radius={i === typesToRender.length - 1 ? [3, 3, 0, 0] : 0}
            onClick={onBarClick ? handleBarClick(type) : undefined}
            style={{ cursor: onBarClick ? 'pointer' : 'default' }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
