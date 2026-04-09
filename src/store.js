// src/store.js
import { create } from 'zustand';
import axios from 'axios';

const API_BASE = '/api';
const SIDEBAR_KEY = 'firecrawl_sidebar_collapsed';

export const useStore = create((set, get) => ({
  // UI state
  sidebarCollapsed: localStorage.getItem(SIDEBAR_KEY) === 'true',
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem(SIDEBAR_KEY, String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },

  // Server state
  health: null,
  stats: null,
  crawls: [],
  scrapeHistory: [],
  searchHistory: [],
  mapHistory: [],
  loading: false,
  error: null,

  // Settings (loaded from backend)
  settings: {
    firecrawlUrl: '',
    apiKey: '',
    pollingInterval: 5000,
    retentionDays: 30,
    retentionMaxRows: 10000,
  },

  clearError: () => set({ error: null }),

  loadSettings: async () => {
    try {
      const r = await axios.get(`${API_BASE}/settings`);
      if (r.data.success) {
        set({ settings: r.data.data });
        get().startPolling(r.data.data.pollingInterval);
      }
    } catch (_) {}
  },

  saveSettings: async (newSettings) => {
    set({ loading: true, error: null });
    try {
      await axios.post(`${API_BASE}/settings`, newSettings);
      set({ settings: newSettings });
      get().startPolling(newSettings.pollingInterval);
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    } finally {
      set({ loading: false });
    }
  },

  _pollingTimer: null,
  startPolling: (interval) => {
    const ms = interval ?? get().settings.pollingInterval;
    const { _pollingTimer } = get();
    if (_pollingTimer) clearInterval(_pollingTimer);
    if (!ms || ms === 0) { set({ _pollingTimer: null }); return; }
    const timer = setInterval(() => {
      get().fetchHealth();
      get().fetchStats();
      get().fetchCrawls();
    }, ms);
    set({ _pollingTimer: timer });
  },
  stopPolling: () => {
    const { _pollingTimer } = get();
    if (_pollingTimer) clearInterval(_pollingTimer);
    set({ _pollingTimer: null });
  },

  fetchHealth: async () => {
    try {
      const r = await axios.get(`${API_BASE}/health`);
      set({ health: r.data });
    } catch (error) {
      set({ health: { status: 'unhealthy', error: error.message } });
    }
  },

  fetchStats: async () => {
    try {
      const r = await axios.get(`${API_BASE}/stats`);
      if (r.data.success) set({ stats: r.data.data });
    } catch (_) {}
  },

  fetchCrawls: async () => {
    try {
      const r = await axios.get(`${API_BASE}/crawls`);
      if (r.data.success) set({ crawls: r.data.data });
    } catch (_) {}
  },

  fetchHistory: async (type) => {
    try {
      const r = await axios.get(`${API_BASE}/history/${type}`);
      if (type === 'scrape') set({ scrapeHistory: r.data.data });
      if (type === 'search') set({ searchHistory: r.data.data });
      if (type === 'map') set({ mapHistory: r.data.data });
    } catch (_) {}
  },

  createCrawl: async (url, options = {}) => {
    set({ loading: true, error: null });
    try {
      const r = await axios.post(`${API_BASE}/crawls`, { url, ...options });
      await get().fetchCrawls();
      await get().fetchStats();
      return r.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  cancelCrawl: async (id) => {
    try {
      await axios.delete(`${API_BASE}/crawls/${id}`);
      await get().fetchCrawls();
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    }
  },

  scrape: async (url, formats = ['markdown']) => {
    set({ loading: true, error: null });
    try {
      const r = await axios.post(`${API_BASE}/scrape`, { url, formats });
      await get().fetchStats();
      return r.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  search: async (query, limit = 5) => {
    set({ loading: true, error: null });
    try {
      const r = await axios.post(`${API_BASE}/search`, { query, limit });
      await get().fetchStats();
      return r.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  map: async (url, limit = 100) => {
    set({ loading: true, error: null });
    try {
      const r = await axios.post(`${API_BASE}/map`, { url, limit });
      await get().fetchStats();
      return r.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  clearHistory: async (type) => {
    try {
      await axios.delete(`${API_BASE}/history/${type}`);
      await get().fetchHistory(type);
      await get().fetchStats();
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    }
  },

  runMaintenance: async () => {
    set({ loading: true });
    try {
      const r = await axios.post(`${API_BASE}/maintenance`);
      return r.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    } finally {
      set({ loading: false });
    }
  },
}));
