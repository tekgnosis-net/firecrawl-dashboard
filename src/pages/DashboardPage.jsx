// src/pages/DashboardPage.jsx
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

export function DashboardPage() {
  const error = useStore(s => s.error);
  const clearError = useStore(s => s.clearError);
  const proxyFetchError = useStore(s => s.proxyStats.fetchError);
  const serverFetchError = useStore(s => s.serverMetrics.fetchError);

  const bannerText = error || proxyFetchError || serverFetchError;

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
        <ProxyOverviewCard />
      </div>

      {/* Proxy activity chart */}
      <div className="apple-card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Proxy activity</h3>
        <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
          operations observed at /v1/*, /v2/*, /admin/* · last 24 h · 5-min buckets
        </div>
        <ProxyActivityChart />
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
          <TopDomainsChart />
        </div>
      </div>

      {/* 2-col: Top clients + Recent errors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TopClientsTable />
        <RecentErrorsCard />
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
