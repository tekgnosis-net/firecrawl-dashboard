import { create } from 'zustand';
import axios from 'axios';
const API_BASE = '/api';

export const useStore = create((set) => ({
  health: null, stats: null, crawls: [], scrapeHistory: [], searchHistory: [], mapHistory: [],
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
    useStore.getState().fetchCrawls();
    useStore.getState().fetchStats();
    return response.data;
  },
  scrape: async (url) => {
    const response = await axios.post(`${API_BASE}/scrape`, { url });
    useStore.getState().fetchStats();
    return response.data;
  },
  search: async (query, limit = 5) => {
    const response = await axios.post(`${API_BASE}/search`, { query, limit });
    useStore.getState().fetchStats();
    return response.data;
  },
  map: async (url, limit = 100) => {
    const response = await axios.post(`${API_BASE}/map`, { url, limit });
    useStore.getState().fetchStats();
    return response.data;
  },
  fetchHistory: async (type) => {
    const response = await axios.get(`${API_BASE}/history/${type}`);
    if (type === 'scrape') set({ scrapeHistory: response.data.data });
    if (type === 'search') set({ searchHistory: response.data.data });
    if (type === 'map') set({ mapHistory: response.data.data });
  },
}));