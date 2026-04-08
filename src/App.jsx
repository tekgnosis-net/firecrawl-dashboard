import React, { useEffect, useState } from 'react';
import { useStore } from './store';

function App() {
  const { 
    initTheme, setupThemeListener, theme, themeMode, setThemeMode, 
    startPolling, stopPolling, manualRefresh, loadSettings,
    pollingInterval 
  } = useStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  useEffect(() => {
    initTheme();
    const listener = setupThemeListener();
    loadSettings();
    startPolling(5000); // Auto-refresh every 5 seconds
    
    return () => {
      stopPolling();
    };
  }, []);

  return (
    <div className={`min-h-screen bg-apple-bg ${theme === 'dark' ? 'dark' : ''}`}>
      <header className="bg-apple-card shadow-apple sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">🔥</div>
              <div><h1 className="text-xl font-semibold">Firecrawl Dashboard</h1><p className="text-xs text-gray-500">Self-hosted monitoring</p></div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={manualRefresh} className="apple-button text-sm px-3 py-1" title="Refresh now">
                🔄 {pollingInterval ? 'Refreshing...' : 'Paused'}
              </button>
              <ThemeSelector mode={themeMode} setMode={setThemeMode} />
            </div>
          </div>
          <nav className="flex space-x-2 border-t border-gray-200 dark:border-gray-700 pt-2">
            {['dashboard', 'settings'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm capitalize ${
                  activeTab === tab 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
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
    { key: 'dark', icon: '🌙', label: 'Dark' }
  ];
  
  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-1">
      {themes.map(t => (
        <button
          key={t.key}
          onClick={() => setMode(t.key)}
          className={`px-3 py-1.5 rounded-full text-sm transition-all ${
            mode === t.key 
              ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' 
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

function Dashboard() {
  const { health, stats, crawls, createCrawl, scrape, search, map, fetchHistory, scrapeHistory, searchHistory, mapHistory } = useStore();
  const [url, setUrl] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('crawls');

  const history = {
    scrape: scrapeHistory,
    search: searchHistory,
    map: mapHistory
  };

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
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {activeTab === 'scrape' && history?.scrape?.map((item, i) => (
            <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{item.url}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${item.success?'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200':'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                  {item.success ? '✓ Success' : '✗ Failed'}
                </span>
              </div>
            </div>
          ))}
          {activeTab === 'search' && history?.search?.map((item, i) => (
            <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{item.query}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${item.success?'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200':'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                  {item.success ? '✓ Success' : '✗ Failed'}
                </span>
              </div>
            </div>
          ))}
          {activeTab === 'map' && history?.map?.map((item, i) => (
            <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{item.url}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${item.success?'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200':'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                  {item.success ? '✓ Success' : '✗ Failed'}
                </span>
              </div>
            </div>
          ))}
          {(!history || history[activeTab]?.length === 0) && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No {activeTab} history yet! Start some operations above~ (◕‿◕)</p>}
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

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

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
        <h2 className="text-2xl font-semibold mb-6">⚙️ Settings</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="form-label">Firecrawl API URL</label>
            <input
              type="url"
              value={formData.firecrawlUrl || ''}
              onChange={(e) => setFormData({ ...formData, firecrawlUrl: e.target.value })}
              placeholder="http://10.0.20.66:3002"
              className="apple-input"
              required
            />
            <p className="text-xs text-gray-500 mt-1">The URL of your self-hosted Firecrawl instance</p>
          </div>

          <div>
            <label className="form-label">API Key (Optional)</label>
            <input
              type="password"
              value={formData.apiKey || ''}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="Leave empty if authentication is disabled"
              className="apple-input"
            />
            <p className="text-xs text-gray-500 mt-1">Only required if USE_DB_AUTHENTICATION=true</p>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.startsWith('✅') 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div className="flex space-x-3">
            <button 
              type="submit" 
              disabled={saving}
              className="apple-button min-w-[120px]"
            >
              {saving ? '💾 Saving...' : '💾 Save Settings'}
            </button>
            <button 
              type="button" 
              onClick={() => setFormData(settings)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">📊 Current Connection Status</h3>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`w-3 h-3 rounded-full ${
                settings.firecrawlUrl ? 'bg-green-500' : 'bg-red-500'
              }`}></span>
              <span className="text-sm font-medium">Firecrawl URL:</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {settings.firecrawlUrl || 'Not configured'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${
                settings.apiKey ? 'bg-blue-500' : 'bg-gray-400'
              }`}></span>
              <span className="text-sm font-medium">API Key:</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {settings.apiKey ? '✓ Configured' : 'Not set (using no-auth mode)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;