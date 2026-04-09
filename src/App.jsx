import React, { useEffect, useState } from 'react';
import { useStore } from './store';

function App() {
  const {
    initTheme, setupThemeListener, theme, themeMode, setThemeMode,
    startPolling, stopPolling, manualRefresh, loadSettings,
    pollingInterval,
  } = useStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    initTheme();
    const listener = setupThemeListener();
    loadSettings();
    startPolling(5000);
    return () => stopPolling();
  }, []);

  return (
    <div className={`min-h-screen bg-apple-bg ${theme === 'dark' ? 'dark' : ''}`}>
      <header className="bg-apple-card sticky top-0 z-50" style={{ boxShadow: '0 1px 0 var(--apple-separator)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">🔥</div>
              <div>
                <h1 className="text-xl font-semibold text-apple-text">Firecrawl Dashboard</h1>
                <p className="text-xs text-apple-text-secondary">Self-hosted monitoring</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={manualRefresh} className="apple-button text-sm px-3 py-1.5" title="Refresh now">
                🔄 {pollingInterval ? 'Live' : 'Paused'}
              </button>
              <ThemeSelector mode={themeMode} setMode={setThemeMode} />
            </div>
          </div>
          <nav className="flex space-x-1">
            {['dashboard', 'settings'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-apple-blue border-b-2 border-apple-blue -mb-px'
                    : 'text-apple-text-secondary hover:text-apple-text'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' ? <Dashboard /> : <SettingsPanel />}
      </main>
    </div>
  );
}

function ThemeSelector({ mode, setMode }) {
  const themes = [
    { key: 'auto', icon: '🖥️', label: 'System' },
    { key: 'light', icon: '☀️', label: 'Light' },
    { key: 'dark', icon: '🌙', label: 'Dark' },
  ];
  return (
    <div className="flex items-center bg-apple-surface rounded-full p-1">
      {themes.map((t) => (
        <button
          key={t.key}
          onClick={() => setMode(t.key)}
          title={t.label}
          className={`px-3 py-1.5 rounded-full text-sm transition-all ${
            mode === t.key
              ? 'bg-apple-card shadow-apple text-apple-blue'
              : 'text-apple-text-secondary hover:text-apple-text'
          }`}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

function Dashboard() {
  const {
    health, stats, crawls, createCrawl, scrape, fetchHistory,
    loading, error, clearError,
    scrapeHistory, searchHistory, mapHistory,
  } = useStore();

  const [crawlUrl, setCrawlUrl] = React.useState('');
  const [scrapeUrl, setScrapeUrl] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('scrape');

  useEffect(() => { fetchHistory('scrape'); }, []);

  const historyData = { scrape: scrapeHistory, search: searchHistory, map: mapHistory };
  const currentHistory = historyData[activeTab] || [];

  return (
    <div className="space-y-6">
      {health?.status === 'unhealthy' && (
        <div className="apple-error-banner rounded-apple p-4">⚠️ Firecrawl API is unavailable</div>
      )}
      {error && (
        <div className="apple-error-banner rounded-apple p-4 flex justify-between items-center">
          <span className="text-sm">⚠️ {error}</span>
          <button onClick={clearError} className="text-apple-red text-sm font-medium ml-4">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="apple-card"><p className="text-apple-text-secondary text-sm">Active Crawls</p><p className="text-3xl font-semibold text-apple-text">{stats?.crawls?.total || 0}</p></div>
        <div className="apple-card"><p className="text-apple-text-secondary text-sm">Scrapes</p><p className="text-3xl font-semibold text-apple-text">{stats?.scrapes?.total || 0}</p></div>
        <div className="apple-card"><p className="text-apple-text-secondary text-sm">Searches</p><p className="text-3xl font-semibold text-apple-text">{stats?.searches?.total || 0}</p></div>
        <div className="apple-card"><p className="text-apple-text-secondary text-sm">Uptime</p><p className="text-3xl font-semibold text-apple-text">{Math.round(stats?.uptime || 0)}s</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="apple-card">
          <h3 className="text-lg font-semibold text-apple-text mb-4">🕸️ Crawl Jobs</h3>
          <form
            onSubmit={async (e) => { e.preventDefault(); try { await createCrawl(crawlUrl); setCrawlUrl(''); } catch (_) {} }}
            className="flex space-x-2 mb-4"
          >
            <input type="url" value={crawlUrl} onChange={(e) => setCrawlUrl(e.target.value)} placeholder="URL to crawl" className="apple-input flex-1" required />
            <button type="submit" className="apple-button" disabled={loading}>{loading ? 'Starting…' : 'Start'}</button>
          </form>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {crawls.length === 0 && <p className="text-apple-text-secondary text-sm text-center py-4">No crawl jobs yet</p>}
            {crawls.map((crawl) => (
              <div key={crawl.id} className="apple-surface rounded-apple p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-mono text-apple-text">{crawl.id.slice(0, 8)}…</span>
                  <span className="apple-badge text-xs">{crawl.status}</span>
                </div>
                <p className="text-sm text-apple-text-secondary truncate mt-1">{crawl.url}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="apple-card">
          <h3 className="text-lg font-semibold text-apple-text mb-4">📄 Scrape</h3>
          <form
            onSubmit={async (e) => { e.preventDefault(); try { const r = await scrape(scrapeUrl); setResult(r.data); setScrapeUrl(''); } catch (_) {} }}
            className="flex space-x-2 mb-4"
          >
            <input type="url" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} placeholder="URL to scrape" className="apple-input flex-1" required />
            <button type="submit" className="apple-button" disabled={loading}>{loading ? 'Scraping…' : 'Scrape'}</button>
          </form>
          {result ? (
            <div className="apple-surface rounded-apple p-3 max-h-48 overflow-y-auto">
              <p className="text-sm font-medium text-apple-text mb-2">{result.metadata?.title}</p>
              <pre className="text-xs whitespace-pre-wrap text-apple-text-secondary">{result.markdown?.slice(0, 500)}</pre>
            </div>
          ) : (
            <p className="text-apple-text-secondary text-sm text-center py-4">Enter a URL to scrape its content</p>
          )}
        </div>
      </div>

      <div className="apple-card">
        <h3 className="text-lg font-semibold text-apple-text mb-4">📜 History</h3>
        <div className="flex space-x-1 border-b border-apple-separator mb-4">
          {['scrape', 'search', 'map'].map((t) => (
            <button
              key={t}
              onClick={() => { setActiveTab(t); fetchHistory(t); }}
              className={`px-4 py-2 text-sm capitalize transition-colors ${
                activeTab === t ? 'text-apple-blue border-b-2 border-apple-blue -mb-px' : 'text-apple-text-secondary hover:text-apple-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {currentHistory.length === 0 ? (
            <p className="text-apple-text-secondary text-sm text-center py-4">No {activeTab} history yet</p>
          ) : (
            currentHistory.map((item, i) => (
              <div key={i} className="apple-surface rounded-apple p-3 flex justify-between items-center gap-3">
                <span className="text-sm text-apple-text truncate flex-1">{item.url || item.query || '—'}</span>
                <span
                  className="apple-badge text-xs shrink-0"
                  style={!item.success ? { background: 'var(--apple-error-bg)', color: 'var(--apple-red)' } : {}}
                >
                  {item.success ? 'Success' : 'Failed'}
                </span>
                {item.timestamp && (
                  <span className="text-xs text-apple-text-secondary shrink-0">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const { settings, saveSettings } = useStore();
  const [formData, setFormData] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { setFormData(settings); }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const success = await saveSettings(formData);
    setSaving(false);
    if (success) {
      setMessage('✅ Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('❌ Failed to save settings');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="apple-card">
        <h2 className="text-2xl font-semibold text-apple-text mb-6">⚙️ Settings</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-apple-text mb-1">Firecrawl API URL</label>
            <input
              type="url"
              value={formData.firecrawlUrl || ''}
              onChange={(e) => setFormData({ ...formData, firecrawlUrl: e.target.value })}
              placeholder="http://10.0.20.66:3002"
              className="apple-input"
              required
            />
            <p className="text-xs text-apple-text-secondary mt-1">The URL of your self-hosted Firecrawl instance</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-apple-text mb-1">API Key (Optional)</label>
            <input
              type="password"
              value={formData.apiKey || ''}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="Leave empty if authentication is disabled"
              className="apple-input"
            />
            <p className="text-xs text-apple-text-secondary mt-1">Only required if USE_DB_AUTHENTICATION=true</p>
          </div>
          {message && (
            <div className={`p-3 rounded-apple text-sm ${message.startsWith('✅') ? 'bg-apple-green/10 text-apple-green' : 'apple-error-banner'}`}>
              {message}
            </div>
          )}
          <div className="flex space-x-3">
            <button type="submit" disabled={saving} className="apple-button min-w-[120px]">
              {saving ? '💾 Saving…' : '💾 Save Settings'}
            </button>
            <button
              type="button"
              onClick={() => setFormData(settings)}
              className="px-4 py-2 rounded-apple border border-apple-separator text-apple-text-secondary hover:text-apple-text"
            >
              Cancel
            </button>
          </div>
        </form>
        <div className="mt-8 pt-6 border-t border-apple-separator">
          <h3 className="text-lg font-semibold text-apple-text mb-4">📊 Current Connection Status</h3>
          <div className="apple-surface rounded-apple p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${settings.firecrawlUrl ? 'bg-apple-green' : 'bg-apple-red'}`}></span>
              <span className="text-sm font-medium text-apple-text">Firecrawl URL:</span>
              <span className="text-sm text-apple-text-secondary">{settings.firecrawlUrl || 'Not configured'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${settings.apiKey ? 'bg-apple-blue' : 'bg-apple-gray'}`}></span>
              <span className="text-sm font-medium text-apple-text">API Key:</span>
              <span className="text-sm text-apple-text-secondary">{settings.apiKey ? '✓ Configured' : 'Not set (no-auth mode)'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
