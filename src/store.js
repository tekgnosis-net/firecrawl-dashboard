// src/store.js
import { create } from 'zustand';
import axios from 'axios';
// Import the shared proxy-URL helpers from lib/proxyUrl.js. This is a
// circular import with that module (it imports useStore from here), but
// ESM handles the cycle correctly because neither module accesses the
// imported binding at module-load time — both `getProxyBaseUrl()` and
// `useStore.getState()` are only invoked from within function bodies,
// which execute after both modules have finished loading.
import { getProxyBaseUrl, INTERNAL_UI_HEADERS } from './lib/proxyUrl.js';

const API_BASE = '/api';
const SIDEBAR_KEY = 'firecrawl_sidebar_collapsed';
const THEME_KEY = 'firecrawl_theme';

function applyTheme(theme) {
  if (theme === 'dark' || theme === 'light') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// Apply saved theme immediately on load
applyTheme(localStorage.getItem(THEME_KEY) || 'auto');

export const useStore = create((set, get) => ({
  // --- UI state (persisted to localStorage) ---
  sidebarCollapsed: localStorage.getItem(SIDEBAR_KEY) === 'true',
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem(SIDEBAR_KEY, String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },

  theme: localStorage.getItem(THEME_KEY) || 'auto',
  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },

  // --- Settings (loaded from dashboard backend) ---
  settings: {
    firecrawlUrl: '',
    apiKey: '',
    bullAuthKey: '',
    dashboardPort: 3001,
    proxyPort: 3101,
    pollingInterval: 5000,
    snapshotPollInterval: 300000,
    proxyRetentionDays: 30,
    proxyRetentionMaxRows: 100000,
    snapshotRetentionDays: 90,
    debugLogBodies: false,
    proxyTrustForwardedFor: true,
    proxyMaxBodyBytes: 52428800,

    // Notification settings (v3)
    notificationsEnabled: false,
    notificationCheckIntervalMs: 60000,
    notificationDedupMinutes: 15,
    notificationStartupGraceSeconds: 90,
    notificationRetentionDays: 90,
    notifyOnProxyUnreachable: true,
    notifyOnFirecrawlUnreachable: true,
    notifyOnRedisUnhealthy: false,
    notifyOnBullAuthRejected: true,
    notifyOnHighErrorRate: false,
    notificationErrorRateThreshold: 0.5,
    notificationErrorRateMinOps: 10,
    ntfyEnabled: false,
    ntfyUrl: 'https://ntfy.sh',
    ntfyTopic: '',
    ntfyAuthType: 'none',
    ntfyUsername: '',
    ntfyPassword: '',
    ntfyPriority: 4,
    webhookEnabled: false,
    webhookUrl: '',
    webhookAuthHeader: '',
  },

  // --- Notifications (from notification_log via dashboard API) ---
  notifications: {
    recent: [],
    fetchError: null,
    lastFetchedAt: null,
    testResult: null,   // last outcome from the Settings test button
  },

  // --- Live server state (from dashboard API live metric fan-out) ---
  health: null,           // /api/health — Firecrawl + Redis connectivity
  processHealth: null,    // /healthz — dashboard + proxy process state
  serverMetrics: {
    queueStatus: null,
    creditUsage: null,
    tokenUsage: null,
    activeCrawls: null,
    bullQueues: null,
    bullQueuesReason: null,
    redisHealth: null,
    redisHealthReason: null,
    lastFetchedAt: null,
    fetchError: null,
  },

  // --- Proxy-derived stats (from proxy_operations table via dashboard) ---
  proxyStats: {
    overview: null,
    timeline: [],
    topClients: [],
    topDomains: [],
    recentErrors: [],
    creditsSeries: [],
    recentOps: [],
    lastFetchedAt: null,
    fetchError: null,
  },

  // --- Snapshot history (aggregate trend from server_metrics_snapshots) ---
  snapshotHistory: {
    hours: 168,
    rows: [],
    lastFetchedAt: null,
  },

  // --- Active crawl drill-down (keyed by firecrawl_id) ---
  activeCrawlsDetails: {},     // { [id]: { id, status, total, completed, creditsUsed, data, fetchedAt } }
  sessionCrawlIds: [],         // crawl IDs submitted via this browser session

  // --- Transport state ---
  loading: false,
  error: null,
  // Explicit flag: has loadSettings() successfully fetched from the server?
  // The default `settings` object above has the SAME shape as a loaded
  // one (empty strings + defaults), so components cannot detect "loaded
  // vs default" from content. This flag is the signal. SettingsPage's
  // form-init effect waits for this to become true before seeding the
  // form, which prevents it from initializing from empty defaults and
  // then ignoring the real values when they arrive (data-loss bug).
  settingsLoaded: false,
  clearError: () => set({ error: null }),

  // ============================================================
  // Settings load/save
  // ============================================================

  loadSettings: async () => {
    try {
      const r = await axios.get(`${API_BASE}/settings`);
      if (r.data.success) {
        set({
          settings: { ...get().settings, ...r.data.data },
          settingsLoaded: true,
        });
        get().startPolling(r.data.data.pollingInterval);
      }
    } catch (_) {}
  },

  saveSettings: async (newSettings) => {
    set({ loading: true, error: null });
    try {
      const r = await axios.post(`${API_BASE}/settings`, newSettings);
      if (r.data.success) {
        set({ settings: { ...get().settings, ...newSettings } });
        if (newSettings.pollingInterval !== undefined) {
          get().startPolling(newSettings.pollingInterval);
        }
      } else {
        set({ error: r.data.error || 'Failed to save settings' });
      }
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    } finally {
      set({ loading: false });
    }
  },

  // ============================================================
  // Polling loop
  // ============================================================

  _pollingTimer: null,
  _pollingTickCount: 0,
  startPolling: (interval) => {
    const ms = interval ?? get().settings.pollingInterval;
    const { _pollingTimer } = get();
    if (_pollingTimer) clearInterval(_pollingTimer);
    if (!ms || ms === 0) { set({ _pollingTimer: null }); return; }

    // Initial fan-out
    get().fetchHealth();
    get().fetchServerMetrics();
    get().fetchProxyStats();
    get().fetchSnapshotHistory();
    get().fetchActiveCrawlsDetail();
    get().fetchNotifications();

    const timer = setInterval(() => {
      const tick = get()._pollingTickCount + 1;
      set({ _pollingTickCount: tick });
      // Every tick: fast live reads
      get().fetchHealth();
      get().fetchServerMetrics();
      // Every 2nd tick: slower/heavier reads
      if (tick % 2 === 0) {
        get().fetchProxyStats();
        get().fetchActiveCrawlsDetail();
        get().fetchNotifications();
      }
      // Every 12th tick (~1 min at 5s interval): snapshot trend refresh
      if (tick % 12 === 0) {
        get().fetchSnapshotHistory();
      }
    }, ms);
    set({ _pollingTimer: timer });
  },
  stopPolling: () => {
    const { _pollingTimer } = get();
    if (_pollingTimer) clearInterval(_pollingTimer);
    set({ _pollingTimer: null });
  },

  // ============================================================
  // Live server state fetches
  // ============================================================

  fetchHealth: async () => {
    // Use /api/healthz (alias of /healthz exposed by the dashboard backend)
    // so the Vite dev proxy — which only forwards /api/* to :3001 — can
    // reach it in dev without extra config. Production is unaffected
    // since the backend serves both paths identically.
    const [apiHealthRes, processHealthRes] = await Promise.allSettled([
      axios.get(`${API_BASE}/health`),
      axios.get(`${API_BASE}/healthz`),
    ]);
    if (apiHealthRes.status === 'fulfilled') {
      set({ health: apiHealthRes.value.data });
    } else {
      set({ health: { status: 'unhealthy', error: apiHealthRes.reason?.message } });
    }
    if (processHealthRes.status === 'fulfilled') {
      set({ processHealth: processHealthRes.value.data });
    }
  },

  fetchServerMetrics: async () => {
    const endpoints = [
      ['queueStatus',  `${API_BASE}/firecrawl/queue-status`],
      ['creditUsage',  `${API_BASE}/firecrawl/credit-usage`],
      ['tokenUsage',   `${API_BASE}/firecrawl/token-usage`],
      ['activeCrawls', `${API_BASE}/firecrawl/active-crawls`],
      ['bullQueues',   `${API_BASE}/firecrawl/bull-queues`],
      ['redisHealth',  `${API_BASE}/firecrawl/redis-health`],
    ];
    const results = await Promise.allSettled(endpoints.map(([_, url]) => axios.get(url)));
    const patch = {};
    let anySuccess = false;
    results.forEach((result, i) => {
      const [slot] = endpoints[i];
      if (result.status === 'fulfilled' && result.value.data.success) {
        const { data, reason } = result.value.data;
        if (slot === 'bullQueues') {
          if (data === null) { patch.bullQueuesReason = reason || 'not_configured'; }
          else { patch.bullQueues = data; patch.bullQueuesReason = null; }
        } else if (slot === 'redisHealth') {
          if (data === null) { patch.redisHealthReason = reason || 'not_configured'; }
          else { patch.redisHealth = data; patch.redisHealthReason = null; }
        } else {
          patch[slot] = data;
        }
        anySuccess = true;
      }
      // On rejection: leave last-known value intact (no patch key set)
    });
    patch.lastFetchedAt = new Date().toISOString();
    patch.fetchError = anySuccess ? null : 'Server metrics unreachable';
    set(state => ({ serverMetrics: { ...state.serverMetrics, ...patch } }));
  },

  // ============================================================
  // Proxy-derived stats
  // ============================================================

  fetchProxyStats: async (hours = 24) => {
    const endpoints = [
      ['overview',     `${API_BASE}/stats/proxy/overview?hours=${hours}`],
      ['timeline',     `${API_BASE}/stats/proxy/timeline?hours=${hours}&bucket=5min`],
      ['topClients',   `${API_BASE}/stats/proxy/clients?hours=${hours}&limit=10`],
      ['topDomains',   `${API_BASE}/stats/proxy/domains?hours=${hours}&limit=10`],
      ['recentErrors', `${API_BASE}/stats/proxy/errors?hours=${hours}&limit=50`],
      ['creditsSeries',`${API_BASE}/stats/proxy/credits?hours=${Math.max(hours, 168)}&bucket=hour`],
      ['recentOps',    `${API_BASE}/stats/proxy/recent?limit=50`],
    ];
    const results = await Promise.allSettled(endpoints.map(([_, url]) => axios.get(url)));
    const patch = {};
    let anySuccess = false;
    results.forEach((result, i) => {
      const [slot] = endpoints[i];
      if (result.status === 'fulfilled' && result.value.data.success) {
        patch[slot] = result.value.data.data;
        anySuccess = true;
      }
    });
    patch.lastFetchedAt = new Date().toISOString();
    patch.fetchError = anySuccess ? null : 'Proxy stats unreachable';
    set(state => ({ proxyStats: { ...state.proxyStats, ...patch } }));
  },

  fetchSnapshotHistory: async (hours = 168) => {
    try {
      const r = await axios.get(`${API_BASE}/stats/snapshots?hours=${hours}`);
      if (r.data.success) {
        set({ snapshotHistory: { hours, rows: r.data.data, lastFetchedAt: new Date().toISOString() } });
      }
    } catch (_) {}
  },

  // ============================================================
  // Notifications (v3)
  // ============================================================

  fetchNotifications: async (limit = 20) => {
    try {
      const r = await axios.get(`${API_BASE}/notifications/recent?limit=${limit}`);
      if (r.data.success) {
        set(state => ({
          notifications: {
            ...state.notifications,
            recent: r.data.data,
            lastFetchedAt: new Date().toISOString(),
            fetchError: null,
          },
        }));
      }
    } catch (err) {
      set(state => ({
        notifications: { ...state.notifications, fetchError: err.message },
      }));
    }
  },

  testNotification: async () => {
    try {
      const r = await axios.post(`${API_BASE}/notifications/test`);
      set(state => ({
        notifications: { ...state.notifications, testResult: r.data },
      }));
      // Refresh recent list so the test row shows up immediately
      await get().fetchNotifications();
      return r.data;
    } catch (err) {
      const errorResult = {
        success: false,
        error: err.response?.data?.error || err.message,
      };
      set(state => ({
        notifications: { ...state.notifications, testResult: errorResult },
      }));
      return errorResult;
    }
  },

  // ============================================================
  // Active crawl drill-down
  // ============================================================

  fetchActiveCrawlsDetail: async () => {
    const state = get();
    const activeIds = state.serverMetrics.activeCrawls?.crawls?.map(c => c.id || c) || [];
    const sessionIds = state.sessionCrawlIds;
    const allIds = Array.from(new Set([...activeIds, ...sessionIds])).filter(Boolean);
    if (allIds.length === 0) return;

    const base = getProxyBaseUrl();
    const results = await Promise.allSettled(
      allIds.map(id => axios.get(`${base}/v1/crawl/${id}`, { headers: INTERNAL_UI_HEADERS }))
    );
    const patch = {};
    results.forEach((result, i) => {
      const id = allIds[i];
      if (result.status === 'fulfilled') {
        patch[id] = { id, ...result.value.data, fetchedAt: new Date().toISOString() };
      } else {
        // Preserve last-known detail if the crawl 404s (expired after 24h)
        const existing = state.activeCrawlsDetails[id];
        if (existing) patch[id] = { ...existing, expired: true };
      }
    });
    set(st => ({ activeCrawlsDetails: { ...st.activeCrawlsDetails, ...patch } }));
  },

  // ============================================================
  // Operation submission (goes through the transparent proxy)
  // ============================================================

  submitScrape: async (url, formats = ['markdown']) => {
    set({ loading: true, error: null });
    try {
      const base = getProxyBaseUrl();
      const r = await axios.post(`${base}/v1/scrape`, { url, formats }, { headers: INTERNAL_UI_HEADERS });
      get().fetchProxyStats();
      return r.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  submitSearch: async (query, limit = 5) => {
    set({ loading: true, error: null });
    try {
      const base = getProxyBaseUrl();
      const r = await axios.post(`${base}/v2/search`, { query, limit }, { headers: INTERNAL_UI_HEADERS });
      get().fetchProxyStats();
      return r.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  submitMap: async (url, options = {}) => {
    set({ loading: true, error: null });
    try {
      const base = getProxyBaseUrl();
      const body = { url, ...options };
      const r = await axios.post(`${base}/v2/map`, body, { headers: INTERNAL_UI_HEADERS });
      get().fetchProxyStats();
      return r.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  submitCrawl: async (url, options = {}) => {
    set({ loading: true, error: null });
    try {
      const base = getProxyBaseUrl();
      const r = await axios.post(`${base}/v1/crawl`, { url, ...options }, { headers: INTERNAL_UI_HEADERS });
      const id = r.data?.id;
      if (id) {
        set(state => ({ sessionCrawlIds: [id, ...state.sessionCrawlIds.filter(x => x !== id)].slice(0, 50) }));
        get().fetchActiveCrawlsDetail();
      }
      get().fetchServerMetrics();
      return r.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  cancelCrawl: async (id) => {
    set({ loading: true, error: null });
    try {
      const base = getProxyBaseUrl();
      await axios.delete(`${base}/v1/crawl/${id}`, { headers: INTERNAL_UI_HEADERS });
      get().fetchServerMetrics();
      get().fetchActiveCrawlsDetail();
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    } finally {
      set({ loading: false });
    }
  },

  // ============================================================
  // Maintenance
  // ============================================================

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
