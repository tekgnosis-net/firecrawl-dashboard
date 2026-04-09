export function TopDomainsChart({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--apple-text-secondary)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No scrape data yet</p>;
  const max = data[0].count || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {data.map(({ domain, count }) => (
        <div key={domain}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--apple-text)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px' }}>{domain}</span>
            <span style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', flexShrink: 0 }}>{count}</span>
          </div>
          <div style={{ height: '4px', background: 'var(--apple-surface)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: 'var(--apple-blue)', borderRadius: '2px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
