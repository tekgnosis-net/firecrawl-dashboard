import React, { useEffect } from 'react';
import { useStore } from './store';

function App() {
  const { fetchHealth, fetchStats, fetchCrawls } = useStore();
  
  useEffect(() => {
    fetchHealth(); fetchStats(); fetchCrawls();
  }, []);

  return (
    <div className="min-h-screen bg-apple-bg">
      <header className="bg-apple-card shadow-apple sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">🔥</div>
            <div><h1 className="text-xl font-semibold">Firecrawl Dashboard</h1><p className="text-xs text-gray-500">Self-hosted monitoring</p></div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Dashboard />
      </main>
    </div>
  );
}

function Dashboard() {
  const { health, stats, crawls, createCrawl, scrape, search, map, fetchHistory } = useStore();
  const [url, setUrl] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('crawls');

  return (
    <div className="space-y-6">
      {health?.status === 'unhealthy' && <div className="bg-red-50 border border-red-200 rounded-lg p-4">⚠️ Firecrawl API is unavailable</div>}
      
      <div className="grid grid-cols-4 gap-4">
        <div className="apple-card"><p className="text-gray-500 text-sm">Active Crawls</p><p className="text-3xl font-semibold">{stats?.crawls?.total || 0}</p></div>
        <div className="apple-card"><p className="text-gray-500 text-sm">Scrapes</p><p className="text-3xl font-semibold">{stats?.scrapes?.total || 0}</p></div>
        <div className="apple-card"><p className="text-gray-500 text-sm">Searches</p><p className="text-3xl font-semibold">{stats?.searches?.total || 0}</p></div>
        <div className="apple-card"><p className="text-gray-500 text-sm">Uptime</p><p className="text-3xl font-semibold">{Math.round(stats?.uptime || 0)}s</p></div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="apple-card">
          <h3 className="text-lg font-semibold mb-4">🕸️ Crawl Jobs</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await createCrawl(url); setUrl(''); }} className="flex space-x-2 mb-4">
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL to crawl" className="apple-input flex-1" required />
            <button type="submit" className="apple-button">Start</button>
          </form>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {crawls.map((crawl) => (
              <div key={crawl.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between"><span className="text-sm font-mono">{crawl.id.slice(0,8)}...</span><span className="text-xs bg-blue-100 px-2 py-1 rounded-full">{crawl.status}</span></div>
                <p className="text-sm truncate">{crawl.url}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="apple-card">
          <h3 className="text-lg font-semibold mb-4">📄 Scrape</h3>
          <form onSubmit={async (e) => { e.preventDefault(); const r = await scrape(url); setResult(r.data); setUrl(''); }} className="flex space-x-2 mb-4">
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL to scrape" className="apple-input flex-1" required />
            <button type="submit" className="apple-button">Scrape</button>
          </form>
          {result && <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto"><p className="text-sm font-medium mb-2">{result.metadata?.title}</p><pre className="text-xs whitespace-pre-wrap">{result.markdown?.slice(0,500)}</pre></div>}
        </div>
      </div>

      <div className="apple-card">
        <h3 className="text-lg font-semibold mb-4">📜 History</h3>
        <div className="flex space-x-2 border-b border-gray-200 mb-4">
          {['scrape','search','map'].map(t => <button key={t} onClick={() => { setActiveTab(t); fetchHistory(t); }} className={`px-4 py-2 text-sm ${activeTab===t?'text-blue-600 border-b-2 border-blue-600':'text-gray-500'}`}>{t}</button>)}
        </div>
      </div>
    </div>
  );
}

export default App;