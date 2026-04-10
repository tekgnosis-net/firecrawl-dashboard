// src/components/reports/OperationsTable.jsx
//
// Paginated table of proxy_operations rows. Click a row to open the
// detail drawer. Column set is the "scanning" view — enough context
// to know what each row is, but not the full 24 fields (that's in the
// drawer). Pagination is server-side via offset/limit.
import { formatDuration, timeAgo } from '../../lib/format';

const PAGE_SIZE = 50;

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n - 1) + '\u2026' : s;
}

function StatusBadge({ status, success }) {
  if (status === 0) {
    return <span style={{ color: 'var(--apple-red)', fontWeight: 600 }}>ERR</span>;
  }
  const ok = success === 1 || (status >= 200 && status < 400);
  return (
    <span style={{ color: ok ? 'var(--apple-green)' : 'var(--apple-red)', fontWeight: 600 }}>
      {status}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span
      className="apple-badge"
      style={{
        fontSize: 10,
        padding: '1px 8px',
        background: 'var(--apple-badge-info-bg)',
        color: 'var(--apple-blue)',
      }}
    >
      {type}
    </span>
  );
}

export function OperationsTable({ data, loading, onRowClick, onPageChange }) {
  const rows = data?.rows || [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? PAGE_SIZE;
  const offset = data?.offset ?? 0;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  // True "first load" skeleton: loading flag is on AND we don't yet have rows.
  // Subsequent loads (pagination, filter change) keep the stale rows visible
  // behind a dimmed table to avoid content jumping.
  const firstLoad = loading && rows.length === 0;

  return (
    <div className="apple-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
          Operations
          {loading && (
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--apple-text-secondary)', marginLeft: 8 }}>
              loading…
            </span>
          )}
        </h3>
        <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>
          Click a row for full detail · showing {rows.length === 0 ? 0 : offset + 1}–{offset + rows.length} of {total.toLocaleString()}
        </div>
      </div>

      {firstLoad ? (
        // Shimmer skeleton: 6 placeholder rows with faint gradient stripes
        // while the first fan-out is in flight.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 20,
                borderRadius: 4,
                background: 'linear-gradient(90deg, var(--apple-surface) 0%, var(--apple-separator) 50%, var(--apple-surface) 100%)',
                backgroundSize: '200% 100%',
                animation: 'reportsShimmer 1.2s ease-in-out infinite',
                opacity: 0.8 - i * 0.08,
              }}
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--apple-text-secondary)', fontSize: 13 }}>
          No operations match the current filter.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--apple-separator)' }}>
                <th style={thStyle}>Time</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Target</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Duration</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Credits</th>
                <th style={{ ...thStyle, width: 28 }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                // Mouse users click anywhere on the row via <tr onClick>.
                // Keyboard / screen-reader users tab to the explicit
                // action <button> in the last cell. This preserves the
                // native <tr> row semantics instead of overriding them
                // with an incompatible role="button".
                <tr
                  key={row.id}
                  onClick={() => onRowClick(row.id)}
                  style={{
                    borderBottom: '1px solid var(--apple-separator)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--apple-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>{timeAgo(row.timestamp)}</span>
                  </td>
                  <td style={tdStyle}>
                    <TypeBadge type={row.operation_type} />
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11 }}>
                      {row.client_ip || '\u2014'}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 11, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.target_url || row.query_text || ''}>
                      {truncate(row.target_url || row.query_text || row.target_host || '', 60)}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <StatusBadge status={row.response_status} success={row.success} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {formatDuration(row.duration_ms)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--apple-text-secondary)' }}>
                    {row.credits_used ?? '\u2014'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', verticalAlign: 'middle' }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRowClick(row.id); }}
                      aria-label={`Open detail for ${row.operation_type} operation #${row.id}`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '2px 6px',
                        cursor: 'pointer',
                        color: 'var(--apple-text-secondary)',
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                      title="Open detail"
                    >
                      {'\u2192'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--apple-separator)' }}>
          <button
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            disabled={offset === 0}
            style={paginationButtonStyle(offset === 0)}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: 'var(--apple-text-secondary)', padding: '0 8px' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(offset + limit)}
            disabled={offset + limit >= total}
            style={paginationButtonStyle(offset + limit >= total)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '8px 10px 8px 0',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--apple-text-secondary)',
  fontWeight: 500,
};

const tdStyle = {
  padding: '10px 10px 10px 0',
  verticalAlign: 'middle',
};

function paginationButtonStyle(disabled) {
  return {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid var(--apple-separator)',
    background: disabled ? 'var(--apple-surface)' : 'var(--apple-card)',
    color: disabled ? 'var(--apple-text-secondary)' : 'var(--apple-text)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
    opacity: disabled ? 0.6 : 1,
  };
}
