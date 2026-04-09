import { create } from 'zustand';
import axios from 'axios';
const API_BASE = '/api';

export const useStore = create((set, get) => ({
  health: null, stats: null, crawls: [], scrapeHistory: [], searchHistory: [], mapHistory: [],
  loading: false, error: null,
  theme: 'auto', themeMode: 'auto',
  settings: { firecrawlUrl: '', apiKey: '' },
  pollingInterval: null,

  clearError: () => set({ error: null }),

  // Theme management
  initTheme: () => {
    const saved = localStorage.getItem('firecrawl_theme') || 'auto';
    set({ themeMode: saved });
    get().applyTheme(saved);
  },
  applyTheme: (mode) => {
    const isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    set({ theme: isDark ? 'dark' : 'light' });
  },
  setThemeMode: (mode) => {
    localStorage.setItem('firecrawl_theme', mode);
    set({ themeMode: mode });
    get().applyTheme(mode);
  },
  setupThemeListener: () => {
    const listener = () => { if (get().themeMode === 'auto') get().applyTheme('auto'); };
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', listener);
    return listener;
  },

  // Settings management
  loadSettings: async () => {
    try {
      const response = await axios.get(`${API_BASE}/settings`);
      set({ settings: response.data.data });
    } catch (_) {}
  },
  saveSettings: async (settings) => {
    try {
      const response = await axios.post(`${API_BASE}/settings`, settings);
      if (response.data.success) { set({ settings }); return true; }
      return false;
    } catch (_) { return false; }
  },

  // Auto-refresh polling
  startPolling: (interval = 5000) => {
    if (get().pollingInterval) return;
    get().fetchAllData();
    const id = setInterval(() => get().fetchAllData(), interval);
    set({ pollingInterval: id });
  },
  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) { clearInterval(pollingInterval); set({ pollingInterval: null }); }
  },
  manualRefresh: () => get().fetchAllData(),
  fetchAllData: async () => {
    get().fetchHealth();
    get().fetchStats();
    get().fetchCrawls();
  },

  fetchHealth: async () => {
    try {
      const response = await axios.get(`${API_BASE}/health`);
      set({ health: response.data });
    } catch (error) { set({ error: error.message }); }
  },
  fetchStats: async () => {
    try {
      const response = await axios.get(`${API_BASE}/stats`);
      set({ stats: response.data.data });
    } catch (error) { set({ error: error.message }); }
  },
  fetchCrawls: async () => {
    try {
      const response = await axios.get(`${API_BASE}/crawls`);
      set({ crawls: response.data.data });
    } catch (error) { set({ error: error.message }); }
  },
  createCrawl: async (url, options = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE}/crawls`, { url, ...options });
      await get().fetchAllData();
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally { set({ loading: false }); }
  },
  scrape: async (url) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE}/scrape`, { url });
      await get().fetchStats();
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally { set({ loading: false }); }
  },
  search: async (query, limit = 5) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE}/search`, { query, limit });
      await get().fetchStats();
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally { set({ loading: false }); }
  },
  map: async (url, limit = 100) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE}/map`, { url, limit });
      await get().fetchStats();
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally { set({ loading: false }); }
  },
  fetchHistory: async (type) => {
    try {
      const response = await axios.get(`${API_BASE}/history/${type}`);
      if (type === 'scrape') set({ scrapeHistory: response.data.data });
      if (type === 'search') set({ searchHistory: response.data.data });
      if (type === 'map') set({ mapHistory: response.data.data });
    } catch (error) { set({ error: error.message }); }
  },
}));
