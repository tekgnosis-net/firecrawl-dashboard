import { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../store';
import { ActivityChart } from '../components/charts/ActivityChart';
import { SuccessRateChart } from '../components/charts/SuccessRateChart';
import { TopDomainsChart } from '../components/charts/TopDomainsChart';

export function DashboardPage() {
  const { health, stats, crawls, error, clearError } = useStore();
  const [dailyData, setDailyData] = useState([]);
  const [domainsData, setDomainsData] = useState([]);
  const activeCrawls = (crawls || []).filter(c => ['pending', 'scraping'].includes(c.status));

  useEffect(() => {
    axios.get('/api/stats/daily?days=7').then(r => { if (r.data.success) setDailyData(r.data.data); }).catch(() => {});
    axios.get('/api/stats/domains?limit=10').then(r => { if (r.data.success) setDomainsData(r.data.data); }).catch(() => {});
  }, [stats]);

  const successRate = (() => {
    if (!stats) return 0;
    const s = (stats.scrapes?.success || 0) + (stats.searches?.success || 0) + (stats.maps?.success || 0);
    const t = (stats.scrapes?.total  || 0) + (stats.searches?.total  || 0) + (stats.maps?.total  || 0);
    return t > 0 ? Math.round((s / t) * 100) : 0;
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--apple-text)' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: health?.status === 'healthy' ? 'var(--apple-green)' : 'var(--apple-red)', marginTop: '4px' }}>
          {health?.status === 'healthy' ? '● Connected to Firecrawl' : '● Firecrawl unavailable'}
        </p>
      </div>

      {error && (
        <div className="apple-error-banner rounded-apple p-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px' }}>⚠️ {error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: 'var(--apple-red)', cursor: 'pointer', fontSize: '13px' }}>Dismiss</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Crawls',  value: stats?.crawls?.total    ?? 0, sub: `${stats?.crawls?.active   ?? 0} active` },
          { label: 'Scrapes',       value: stats?.scrapes?.total   ?? 0, sub: `${stats?.scrapes?.success ?? 0} successful` },
          { label: 'Searches',      value: stats?.searches?.total  ?? 0, sub: `${stats?.searches?.success ?? 0} successful` },
          { label: 'Success Rate',  value: `${successRate}%`,            sub: 'all operations', color: successRate >= 90 ? 'var(--apple-green)' : successRate >= 70 ? 'var(--apple-text)' : 'var(--apple-red)' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="apple-card">
            <p style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', marginBottom: '6px' }}>{label}</p>
            <p style={{ fontSize: '28px', fontWeight: '700', color: color || 'var(--apple-text)', lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: '11px', color: 'var(--apple-text-secondary)', marginTop: '4px' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Activity Chart */}
      <div className="apple-card">
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '16px' }}>Activity — Last 7 Days</h3>
        {dailyData.length > 0
          ? <ActivityChart data={dailyData} />
          : <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--apple-text-secondary)', fontSize: '13px' }}>
              Trigger some scrapes, searches, or maps to see activity
            </div>
        }
      </div>

      {/* Success Rate + Top Domains */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="apple-card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '8px' }}>Success Rate</h3>
          <SuccessRateChart stats={stats} />
        </div>
        <div className="apple-card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '16px' }}>Top Domains</h3>
          <TopDomainsChart data={domainsData} />
        </div>
      </div>

      {/* Live Crawl Progress */}
      <div className="apple-card">
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '12px' }}>Live Crawl Jobs</h3>
        {activeCrawls.length === 0
          ? <p style={{ color: 'var(--apple-text-secondary)', fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>No active crawls</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeCrawls.map(crawl => <CrawlProgressRow key={crawl.id} crawl={crawl} />)}
            </div>
        }
      </div>
    </div>
  );
}

function CrawlProgressRow({ crawl }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const poll = async () => {
      try { const r = await axios.get(`/api/crawls/${crawl.id}`); if (r.data.success) setDetail(r.data.data); } catch (_) {}
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [crawl.id]);

  const completed = detail?.completed || 0;
  const total = detail?.total || crawl.max_pages || 1;
  const pct = Math.min(100, Math.round((completed / total) * 100));
  const domain = (() => { try { return new URL(crawl.url).hostname; } catch { return crawl.url; } })();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--apple-surface)', borderRadius: '8px', padding: '10px 12px' }}>
      <span style={{ fontSize: '12px', color: 'var(--apple-text)', flex: '0 0 160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{domain}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, height: '4px', background: 'var(--apple-separator)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--apple-blue)', borderRadius: '2px', transition: 'width 0.5s' }} />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--apple-text-secondary)', whiteSpace: 'nowrap' }}>{completed}/{total}</span>
      </div>
      <span className="apple-badge" style={{ fontSize: '10px', flexShrink: 0 }}>{crawl.status}</span>
    </div>
  );
}
