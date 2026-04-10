// src/components/reports/ActiveFiltersChips.jsx
//
// Visual row of dismissable chips representing currently-active filters.
// Click a chip's × to remove just that filter without touching others.
// Pagination keys (`limit`, `offset`, `page`, `bucket`) and the opt-in
// `paginated` flag are never user-facing filters, so they're always
// hidden. The `detail` key also never appears as a chip — opening the
// detail drawer would otherwise create a confusing "filter" entry.
// The `hours` key is hidden ONLY when it matches the default (24),
// so a non-default time window (e.g. Last 1h) still shows up as a chip.

const DEFAULT_HOURS = 24;
const HIDDEN_KEYS = new Set([
  'limit', 'offset', 'bucket', 'page', 'paginated', 'detail',
]);

// Human-friendly labels for each filter key
const LABELS = {
  hours: 'window',
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
  if (key === 'hours') return `last ${value}h`;
  return String(value);
}

export function ActiveFiltersChips({ filters, onRemove }) {
  const chips = [];
  for (const [key, value] of Object.entries(filters || {})) {
    if (HIDDEN_KEYS.has(key)) continue;
    if (value === '' || value === null || value === undefined) continue;
    // Hide `hours` ONLY at the default value. Non-default windows
    // (e.g. `hours=1`) are real user-visible filters and deserve a chip.
    if (key === 'hours' && Number(value) === DEFAULT_HOURS) continue;
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
