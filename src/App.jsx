// src/App.jsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useStore } from './store';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { CrawlPage } from './pages/CrawlPage';
import { ScrapePage } from './pages/ScrapePage';
import { SearchPage } from './pages/SearchPage';
import { MapPage } from './pages/MapPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  const { loadSettings, fetchHealth, fetchStats, fetchCrawls } = useStore();

  useEffect(() => {
    loadSettings(); // loads settings then starts polling
    fetchHealth();
    fetchStats();
    fetchCrawls();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
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
