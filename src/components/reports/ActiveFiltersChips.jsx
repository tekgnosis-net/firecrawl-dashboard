// src/components/reports/ActiveFiltersChips.jsx
//
// Visual row of dismissable chips representing currently-active filters.
// Click a chip's × to remove just that filter without touching others.
// Skips the default-24h time filter (always present) and the `limit`/
// `offset` pagination keys (not user-visible "filters").

const HIDDEN_KEYS = new Set(['limit', 'offset', 'bucket', 'hours', 'page']);

// Human-friendly labels for each filter key
const LABELS = {
  operation_type: 'type',
  client_ip: 'client',
  target_host: 'host',
  status_class: 'status',
  status_min: 'status ≥',
  status_max: 'status ≤',
  success: 'outcome',
  q: 'search',
  firecrawl_id: 'crawl',
  from: 'from',
  to: 'to',
};

// Display transform for values (e.g. success=true → "success only")
function formatValue(key, value) {
  if (key === 'success') {
    if (value === 'true' || value === true) return 'success only';
    if (value === 'false' || value === false) return 'failures only';
  }
  return String(value);
}

export function ActiveFiltersChips({ filters, onRemove }) {
  const chips = [];
  for (const [key, value] of Object.entries(filters || {})) {
    if (HIDDEN_KEYS.has(key)) continue;
    if (value === '' || value === null || value === undefined) continue;
    chips.push({ key, value });
  }

  if (chips.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginRight: 4 }}>Active filters:</span>
      {chips.map(({ key, value }) => (
        <span
          key={key}
          className="apple-badge"
          style={{
            fontSize: 11,
            padding: '2px 10px 2px 10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--apple-badge-info-bg)',
            color: 'var(--apple-blue)',
          }}
        >
          <span>{LABELS[key] || key}: <strong>{formatValue(key, value)}</strong></span>
          <button
            onClick={() => onRemove(key)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 0,
              fontSize: 13,
              lineHeight: 1,
              opacity: 0.7,
            }}
            title={`Remove ${LABELS[key] || key} filter`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
