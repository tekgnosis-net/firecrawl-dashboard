// src/components/reports/FilterToolbar.jsx
//
// Compact horizontal strip of filter controls for the Reports page.
// Filter state lives in the URL query params — this component just
// reads `filters` and calls `onChange(patch)` to update them.
//
// Text inputs debounce their onChange by 600 ms so typing in a client
// IP or search box doesn't fire a network request for every keystroke.
import { useState, useEffect, useRef } from 'react';

const TIME_PRESETS = [
  { label: 'Last 1h',     value: 1 },
  { label: 'Last 6h',     value: 6 },
  { label: 'Last 24h',    value: 24 },
  { label: 'Last 7d',     value: 168 },
  { label: 'Last 30d',    value: 720 },
];

const OP_TYPES = [
  { label: 'All operations', value: '' },
  { label: 'Scrape',         value: 'scrape' },
  { label: 'Crawl (create)', value: 'crawl_create' },
  { label: 'Crawl (status)', value: 'crawl_status' },
  { label: 'Crawl (active)', value: 'crawl_list_active' },
  { label: 'Crawl (cancel)', value: 'crawl_cancel' },
  { label: 'Map',            value: 'map' },
  { label: 'Search',         value: 'search' },
  { label: 'Extract',        value: 'extract' },
  { label: 'Batch scrape',   value: 'batch_scrape' },
  { label: 'Team query',     value: 'team_query' },
  { label: 'Admin query',    value: 'admin_query' },
  { label: 'Root (/)',       value: 'root' },
  { label: 'Other',          value: 'other' },
];

const STATUS_CLASSES = [
  { label: 'Any status', value: '' },
  { label: '2xx success', value: '2xx' },
  { label: '3xx redirect', value: '3xx' },
  { label: '4xx client error', value: '4xx' },
  { label: '5xx server error', value: '5xx' },
  { label: 'Transport error', value: 'transport_error' },
];

const SUCCESS_VALUES = [
  { label: 'Any outcome', value: '' },
  { label: 'Success only', value: 'true' },
  { label: 'Failures only', value: 'false' },
];

// Tiny debounced text input wrapper — keeps local focus stable (inline
// definitions would cause focus loss on every keystroke; this is at
// module scope so React reconciles the same DOM node across renders).
function DebouncedText({ value, onChange, placeholder, delay = 600, style }) {
  const [local, setLocal] = useState(value ?? '');
  const debounceRef = useRef(null);
  // Keep the local value in sync if the parent forcibly updates (e.g. Clear button)
  useEffect(() => { setLocal(value ?? ''); }, [value]);

  function handleChange(e) {
    const next = e.target.value;
    setLocal(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(next), delay);
  }

  return (
    <input
      type="text"
      value={local}
      onChange={handleChange}
      placeholder={placeholder}
      className="apple-input"
      style={style}
    />
  );
}

export function FilterToolbar({ filters, onChange, onClear, onExport }) {
  // Helper to emit a filter patch with the current value (or remove
  // the key entirely if the new value is empty).
  function patch(key, value) {
    onChange({ [key]: value === '' ? undefined : value });
  }

  return (
    <div className="apple-card" style={{
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center',
      padding: 12,
    }}>
      <select
        value={
          // When the URL uses explicit from/to, the preset doesn't
          // represent the active window — surface that by selecting
          // the synthetic 'custom' option instead of lying with '24'.
          filters.from || filters.to
            ? 'custom'
            : (filters.hours ?? 24)
        }
        onChange={e => {
          const v = e.target.value;
          if (v === 'custom') return; // no-op: custom comes from from/to
          onChange({ hours: Number(v), from: undefined, to: undefined });
        }}
        className="apple-input"
        style={{ width: 'auto', minWidth: 140 }}
        title={
          filters.from || filters.to
            ? `Custom range: ${filters.from || '\u2026'} \u2192 ${filters.to || '\u2026'}`
            : 'Select time window'
        }
      >
        {TIME_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        {(filters.from || filters.to) && (
          <option value="custom">Custom range</option>
        )}
      </select>

      <select
        value={filters.operation_type || ''}
        onChange={e => patch('operation_type', e.target.value)}
        className="apple-input"
        style={{ width: 'auto', minWidth: 160 }}
      >
        {OP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <DebouncedText
        value={filters.client_ip || ''}
        onChange={v => patch('client_ip', v)}
        placeholder="client IP"
        style={{ width: 140 }}
      />

      <DebouncedText
        value={filters.target_host || ''}
        onChange={v => patch('target_host', v)}
        placeholder="target host"
        style={{ width: 180 }}
      />

      <select
        value={filters.status_class || ''}
        onChange={e => patch('status_class', e.target.value)}
        className="apple-input"
        style={{ width: 'auto', minWidth: 140 }}
      >
        {STATUS_CLASSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <select
        value={filters.success || ''}
        onChange={e => patch('success', e.target.value)}
        className="apple-input"
        style={{ width: 'auto', minWidth: 140 }}
      >
        {SUCCESS_VALUES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <DebouncedText
        value={filters.q || ''}
        onChange={v => patch('q', v)}
        placeholder="search url, query, error..."
        style={{ flex: 1, minWidth: 180 }}
      />

      <button
        onClick={onClear}
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid var(--apple-separator)',
          background: 'var(--apple-surface)',
          color: 'var(--apple-text)',
          cursor: 'pointer',
          fontSize: 12,
          whiteSpace: 'nowrap',
        }}
      >
        Clear
      </button>

      <button
        onClick={onExport}
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid var(--apple-blue)',
          background: 'var(--apple-blue)',
          color: 'white',
          cursor: 'pointer',
          fontSize: 12,
          whiteSpace: 'nowrap',
        }}
      >
        Export CSV
      </button>
    </div>
  );
}
