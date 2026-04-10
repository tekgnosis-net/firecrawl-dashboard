// src/pages/ReportsPage.jsx
//
// Detailed reporting page — the deep-analysis counterpart to the
// Dashboard. Filters are driven by URL query params so the page is
// deep-linkable from Dashboard drill-down clicks, shareable, and
// back-button-friendly.
//
// Layout:
//   1. FilterToolbar         — time/type/client/host/status/search controls
//   2. ActiveFiltersChips    — dismissable chips for currently-active filters
//   3. KpiStrip              — 5 top-line KPIs (total, success rate, credits, clients, duration)
//   4. Charts grid (TBD Phase C — placeholder for now)
//   5. OperationsTable       — paginated rows, click to drill into drawer
//   6. OperationDetailDrawer — slide-in panel with full row + crawl lifecycle
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import { FilterToolbar } from '../components/reports/FilterToolbar';
import { ActiveFiltersChips } from '../components/reports/ActiveFiltersChips';
import { KpiStrip } from '../components/reports/KpiStrip';
import { RequestVolumeChart } from '../components/reports/RequestVolumeChart';
import { DurationHistogram } from '../components/reports/DurationHistogram';
import { StatusCodeBreakdown } from '../components/reports/StatusCodeBreakdown';
import { HeatmapChart } from '../components/reports/HeatmapChart';
import { TopClientsTable } from '../components/metrics/TopClientsTable';
import { TopDomainsChart } from '../components/charts/TopDomainsChart';
import { OperationsTable } from '../components/reports/OperationsTable';
import { OperationDetailDrawer } from '../components/reports/OperationDetailDrawer';

// Parse a URLSearchParams object into the plain filter bag shape that
// the store and toolbar components understand. String-typed query params
// are coerced where the backend expects numbers (hours, limit, offset).
//
// Non-numeric, empty, or non-positive values for numeric keys are
// dropped rather than propagated — otherwise the filter bag would
// round-trip to the URL as `hours=NaN` or `hours=0`, polluting
// shareable links, producing controlled-component mismatches in the
// time-window <select>, and triggering the backend's clampHours
// fallback so the UI and data diverge.
function coerceNumber(raw, key, out, { min = null, integer = false } = {}) {
  if (raw[key] === undefined || raw[key] === '') {
    delete out[key];
    return;
  }
  const n = Number(raw[key]);
  if (!Number.isFinite(n)) {
    delete out[key];
    return;
  }
  if (integer && !Number.isInteger(n)) {
    delete out[key];
    return;
  }
  if (min !== null && n < min) {
    delete out[key];
    return;
  }
  out[key] = n;
}

function parseFiltersFromUrl(searchParams) {
  const raw = Object.fromEntries(searchParams.entries());
  const filters = { ...raw };
  // `hours` must be a positive finite number — 0 and negatives would
  // produce a controlled-component mismatch in the time-window select
  // (which has no `0` option) and the backend clampHours would
  // silently fall back to a different default, making the UI and the
  // data diverge. Drop any invalid value and fall through to the
  // default-24 below.
  coerceNumber(raw, 'hours', filters, { min: 0.01 });
  coerceNumber(raw, 'limit', filters, { min: 1, integer: true });
  coerceNumber(raw, 'offset', filters, { min: 0, integer: true });
  // Default: last 24h window. Applied only if no explicit hours AND
  // no from/to range was provided.
  if (filters.hours === undefined && !filters.from && !filters.to) {
    filters.hours = 24;
  }
  return filters;
}

// Serialize a filter bag back to URL query params, omitting empty keys
// so the URL stays clean.
function filtersToUrlParams(filters) {
  const out = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === '' || v === null || v === undefined) continue;
    out[k] = String(v);
  }
  return out;
}

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFiltersFromUrl(searchParams), [searchParams]);

  const reports = useStore(s => s.reports);
  const setReportFilters = useStore(s => s.setReportFilters);
  const fetchReports = useStore(s => s.fetchReports);
  const fetchOperationDetail = useStore(s => s.fetchOperationDetail);
  const closeOperationDetail = useStore(s => s.closeOperationDetail);
  const exportReportsCsv = useStore(s => s.exportReportsCsv);
  // Note: the Reports error banner needs its own clear action because
  // the global `clearError` only touches state.error, not reports.fetchError.
  const clearReportsError = useStore(s => s.clearReportsError);

  // On mount and whenever URL params change, push the parsed filter bag
  // into the store and trigger a fetch. The store action re-fetches all
  // 8 report endpoints in parallel.
  useEffect(() => {
    setReportFilters(filters);
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle URL-driven detail drawer: if ?detail=<id> is present AND
  // parses as a finite integer, load it. A hand-edited URL with a
  // non-numeric value (e.g. `?detail=abc`) would otherwise fire a
  // request for `/api/stats/proxy/operation/NaN`, which is wasted
  // network + log noise.
  const detailId = searchParams.get('detail');
  useEffect(() => {
    if (!detailId) {
      closeOperationDetail();
      return;
    }
    const parsed = Number(detailId);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      closeOperationDetail();
      return;
    }
    fetchOperationDetail(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId]);

  // ------ Handlers -----------------------------------------------------

  function updateFilters(patch) {
    // Merge the patch into current filters, drop undefined/empty values,
    // reset pagination to page 1 whenever a non-pagination filter changes.
    const paginationKeys = new Set(['limit', 'offset']);
    const isFilterChange = Object.keys(patch).some(k => !paginationKeys.has(k));
    const next = { ...filters, ...patch };
    if (isFilterChange) next.offset = 0;
    setSearchParams(filtersToUrlParams(next));
  }

  function clearFilters() {
    setSearchParams({ hours: '24' });
  }

  function removeFilter(key) {
    const next = { ...filters };
    delete next[key];
    // If we removed the last explicit time filter, keep the default
    if (!next.hours && !next.from && !next.to) next.hours = 24;
    setSearchParams(filtersToUrlParams(next));
  }

  function openDetail(operationId) {
    const next = { ...filters, detail: String(operationId) };
    setSearchParams(filtersToUrlParams(next));
  }

  function closeDetail() {
    const next = { ...filters };
    delete next.detail;
    setSearchParams(filtersToUrlParams(next));
  }

  function changePage(newOffset) {
    setSearchParams(filtersToUrlParams({ ...filters, offset: newOffset }));
  }

  function selectLifecycleRow(operationId) {
    // Replace the detail drawer contents with a different row (used when
    // clicking a sibling row in the crawl lifecycle section).
    openDetail(operationId);
  }

  // In-page drill-downs: clicking a client row or domain row further
  // narrows the current Reports filter instead of navigating away.
  function drillIntoClient(client) {
    updateFilters({ client_ip: client.client_ip });
  }

  function drillIntoDomain(domain) {
    updateFilters({ target_host: domain.target_host });
  }

  // ------ Render -------------------------------------------------------

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--apple-text)' }}>
          📈 Reports
        </h1>
        <p style={{ fontSize: 13, color: 'var(--apple-text-secondary)', marginTop: 4 }}>
          Deep-dive analysis of proxy traffic. Click any widget on the Dashboard to drill down here.
        </p>
      </div>

      {reports.fetchError && (
        <div
          className="apple-error-banner rounded-apple p-4"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ fontSize: 13 }}>{'\u26A0'} {reports.fetchError}</span>
          <button
            onClick={clearReportsError}
            style={{ background: 'none', border: 'none', color: 'var(--apple-red)', cursor: 'pointer', fontSize: 13 }}
          >
            Dismiss
          </button>
        </div>
      )}

      <FilterToolbar
        filters={filters}
        onChange={updateFilters}
        onClear={clearFilters}
        onExport={exportReportsCsv}
      />

      <ActiveFiltersChips filters={filters} onRemove={removeFilter} />

      <KpiStrip overview={reports.overview} />

      {/* Charts grid — 2 columns on desktop, 1 on mobile. Uses CSS grid
          auto-fit with a min track width so the layout reflows without
          breakpoints. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 16,
        }}
      >
        <RequestVolumeChart timeline={reports.timeline} />
        <DurationHistogram distribution={reports.distribution} />
        <StatusCodeBreakdown statusCodes={reports.statusCodes} />
        <HeatmapChart heatmap={reports.heatmap} />
        <TopClientsTable
          clients={reports.topClients}
          onRowClick={drillIntoClient}
          subtitle="click a row to narrow by client"
        />
        <div className="apple-card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Top domains</h3>
          <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
            most-scraped hostnames · click a row to narrow by host
          </div>
          <TopDomainsChart data={reports.topDomains} onRowClick={drillIntoDomain} />
        </div>
      </div>

      <OperationsTable
        data={reports.operations}
        loading={reports.loading}
        onRowClick={openDetail}
        onPageChange={changePage}
      />

      <OperationDetailDrawer
        detail={reports.detail}
        onClose={closeDetail}
        onSelectRow={selectLifecycleRow}
      />
    </div>
  );
}
