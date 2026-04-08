import { create } from 'zustand';
import axios from 'axios';
const API_BASE = '/api';

export const useStore = create((set, get) => ({
  health: null, stats: null, crawls: [], scrapeHistory: [], searchHistory: [], mapHistory: [], 
  theme: 'auto', themeMode: 'auto', // themeMode: 'auto' | 'light' | 'dark'
  settings: { firecrawlUrl: '', apiKey: '' },
  pollingInterval: null,
  
  // Theme management with system preference detection
  initTheme: () => {
    const saved = localStorage.getItem('firecrawl_theme') || 'auto';
    set({ themeMode: saved });
    get().applyTheme(saved);
  },
  
  applyTheme: (mode) => {
    const html = document.documentElement;
    let isDark = false;
    
    if (mode === 'auto') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else if (mode === 'dark') {
      isDark = true;
    } else {
      isDark = false;
    }
    
    if (isDark) {
      html.classList.add('dark');
      html.classList.remove('theme-light');
    } else {
      html.classList.remove('dark');
      if (mode === 'light') {
        html.classList.add('theme-light');
      } else {
        html.classList.remove('theme-light');
      }
    }
    set({ theme: isDark ? 'dark' : 'light' });
  },
  
  setThemeMode: (mode) => {
    localStorage.setItem('firecrawl_theme', mode);
    set({ themeMode: mode });
    get().applyTheme(mode);
  },
  
  // Listen for system theme changes
  setupThemeListener: () => {
    const listener = (e) => {
      if (get().themeMode === 'auto') {
        get().applyTheme('auto');
      }
    };
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', listener);
    return listener;
  },
  
  // Settings management
  loadSettings: async () => {
    try {
      const response = await axios.get(`${API_BASE}/settings`);
      set({ settings: response.data.data });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },
  
  saveSettings: async (settings) => {
    try {
      const response = await axios.post(`${API_BASE}/settings`, settings);
      if (response.data.success) {
        set({ settings });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  },
  
  // Auto-refresh functionality
  startPolling: (interval = 5000) => {
    const state = get();
    if (state.pollingInterval) return;
    
    state.fetchAllData();
    const intervalId = setInterval(() => {
      get().fetchAllData();
    }, interval);
    
    set({ pollingInterval: intervalId });
  },
  
  stopPolling: () => {
    const state = get();
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval);
      set({ pollingInterval: null });
    }
  },
  
  manualRefresh: () => {
    get().fetchAllData();
  },
  
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
    const response = await axios.post(`${API_BASE}/crawls`, { url, ...options });
    useStore.getState().fetchAllData();
    return response.data;
  },
  scrape: async (url) => {
    const response = await axios.post(`${API_BASE}/scrape`, { url });
    useStore.getState().fetchAllData();
    return response.data;
  },
  search: async (query, limit = 5) => {
    const response = await axios.post(`${API_BASE}/search`, { query, limit });
    useStore.getState().fetchAllData();
    return response.data;
  },
  map: async (url, limit = 100) => {
    const response = await axios.post(`${API_BASE}/map`, { url, limit });
    useStore.getState().fetchAllData();
    return response.data;
  },
  fetchHistory: async (type) => {
    const response = await axios.get(`${API_BASE}/history/${type}`);
    if (type === 'scrape') set({ scrapeHistory: response.data.data });
    if (type === 'search') set({ searchHistory: response.data.data });
    if (type === 'map') set({ mapHistory: response.data.data });
  },
}));