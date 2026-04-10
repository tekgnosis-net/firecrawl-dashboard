// src/pages/DashboardPage.jsx
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ServerHealthStrip } from '../components/metrics/ServerHealthStrip';
import { QueueStatusCard } from '../components/metrics/QueueStatusCard';
import { CreditsTokensCard } from '../components/metrics/CreditsTokensCard';
import { ProxyOverviewCard } from '../components/metrics/ProxyOverviewCard';
import { BullQueuesTable } from '../components/metrics/BullQueuesTable';
import { ActiveCrawlsCard } from '../components/metrics/ActiveCrawlsCard';
import { TopClientsTable } from '../components/metrics/TopClientsTable';
import { RecentErrorsCard } from '../components/metrics/RecentErrorsCard';
import { ProcessStatusCard } from '../components/metrics/ProcessStatusCard';
import { RecentNotificationsCard } from '../components/metrics/RecentNotificationsCard';
import { ProxyActivityChart } from '../components/charts/ProxyActivityChart';
import { CreditsChart } from '../components/charts/CreditsChart';
import { TopDomainsChart } from '../components/charts/TopDomainsChart';

// Build a /reports URL with the given filter bag, defaulting to last 24h.
// All drill-downs share this helper so the URL shape is consistent.
function reportsUrl(filters = {}) {
  const merged = { hours: '24', ...filters };
  const qs = new URLSearchParams(
    Object.entries(merged).filter(([, v]) => v !== '' && v != null)
  ).toString();
  return `/reports?${qs}`;
}

// Add 5 minutes to an ISO timestamp string — used to close the from/to
// window when drilling down from a 5-minute timeline bucket.
function plusFiveMinutes(iso) {
  try {
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + 5);
    return d.toISOString();
  } catch {
    return iso;
  }
}

export function DashboardPage() {
  const navigate = useNavigate();
  const error = useStore(s => s.error);
  const clearError = useStore(s => s.clearError);
  const proxyFetchError = useStore(s => s.proxyStats.fetchError);
  const serverFetchError = useStore(s => s.serverMetrics.fetchError);

  const bannerText = error || proxyFetchError || serverFetchError;

  // ------ Drill-down handlers -----------------------------------------

  const drillOverview  = () => navigate(reportsUrl({}));
  const drillTimeline  = (bucketRaw, operationType) => {
    if (!bucketRaw) return navigate(reportsUrl({ operation_type: operationType }));
    navigate(reportsUrl({
      operation_type: operationType,
      from: bucketRaw,
      to: plusFiveMinutes(bucketRaw),
      hours: '',  // explicit from/to supersedes hours
    }));
  };
  const drillClient    = (c) => navigate(reportsUrl({ client_ip: c.client_ip }));
  const drillDomain    = (d) => navigate(reportsUrl({ target_host: d.target_host }));
  const drillError     = (e) => navigate(reportsUrl({ success: 'false', detail: String(e.id) }));

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--apple-text)' }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: 'var(--apple-text-secondary)', marginTop: 4 }}>
          Live metrics from your self-hosted Firecrawl server
        </p>
      </div>

      {bannerText && (
        <div
          className="apple-error-banner rounded-apple p-4"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ fontSize: 13 }}>{'\u26A0'} {bannerText}</span>
          {error && (
            <button
              onClick={clearError}
              style={{ background: 'none', border: 'none', color: 'var(--apple-red)', cursor: 'pointer', fontSize: 13 }}
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Section 1: Live server health + process status */}
      <ServerHealthStrip />

      {/* 3-col grid: Queue status + Credits/Tokens + Proxy overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QueueStatusCard />
        <CreditsTokensCard />
        <ProxyOverviewCard onClick={drillOverview} />
      </div>

      {/* Proxy activity chart */}
      <div className="apple-card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Proxy activity</h3>
        <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
          operations observed at /v1/*, /v2/*, /admin/* · last 24 h · 5-min buckets · click a bar to drill down
        </div>
        <ProxyActivityChart onBarClick={drillTimeline} />
      </div>

      {/* 2-col: Credit burn chart + Top domains */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="apple-card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Credit usage</h3>
          <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
            credits charged per bucket · last 7 days · hourly
          </div>
          <CreditsChart />
        </div>
        <div className="apple-card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Top domains</h3>
          <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
            most-scraped hostnames · last 24 h
          </div>
          <TopDomainsChart onRowClick={drillDomain} />
        </div>
      </div>

      {/* 2-col: Top clients + Recent errors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TopClientsTable onRowClick={drillClient} />
        <RecentErrorsCard onRowClick={drillError} />
      </div>

      {/* Bull queues (full-width) */}
      <BullQueuesTable />

      {/* 2-col: Active crawls + Process status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActiveCrawlsCard />
        <ProcessStatusCard />
      </div>

      {/* Recent notifications (full width — visible proof that alerting is working) */}
      <RecentNotificationsCard />
    </div>
  );
}
