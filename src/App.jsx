// src/App.jsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useStore } from './store';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsPage } from './pages/ReportsPage';
import { CrawlPage } from './pages/CrawlPage';
import { ScrapePage } from './pages/ScrapePage';
import { SearchPage } from './pages/SearchPage';
import { MapPage } from './pages/MapPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  const loadSettings = useStore(s => s.loadSettings);
  const fetchHealth = useStore(s => s.fetchHealth);
  const fetchServerMetrics = useStore(s => s.fetchServerMetrics);
  const fetchProxyStats = useStore(s => s.fetchProxyStats);
  const fetchSnapshotHistory = useStore(s => s.fetchSnapshotHistory);
  const stopPolling = useStore(s => s.stopPolling);

  useEffect(() => {
    // loadSettings also starts the polling loop (which fires an initial fan-out)
    loadSettings();
    fetchHealth();
    fetchServerMetrics();
    fetchProxyStats();
    fetchSnapshotHistory();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/crawl" element={<CrawlPage />} />
          <Route path="/scrape" element={<ScrapePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
