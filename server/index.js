import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// SQLite database setup — ensure data/ directory exists
const dbPath = join(__dirname, '../data/dashboard.db');
mkdirSync(join(__dirname, '../data'), { recursive: true });
const db = Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS scrapes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    success INTEGER NOT NULL,
    timestamp TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    success INTEGER NOT NULL,
    timestamp TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS maps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    success INTEGER NOT NULL,
    timestamp TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS crawls (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    max_pages INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Initialize default settings if not exists, migrate new keys for existing installs
const existingCount = db.prepare('SELECT COUNT(*) as c FROM settings').get().c;
if (existingCount === 0) {
  const ins = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  ins.run('firecrawl_url', process.env.FIRECRAWL_URL || 'http://10.0.20.66:3002');
  ins.run('api_key', process.env.FIRECRAWL_API_KEY || '');
  ins.run('polling_interval', '5000');
  ins.run('retention_days', '30');
  ins.run('retention_max_rows', '10000');
} else {
  const upsertIfMissing = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  upsertIfMissing.run('polling_interval', '5000');
  upsertIfMissing.run('retention_days', '30');
  upsertIfMissing.run('retention_max_rows', '10000');
}

// Firecrawl API URL (can be overridden by settings)
function getFirecrawlUrl() {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('firecrawl_url');
  return setting?.value || process.env.FIRECRAWL_URL || 'http://10.0.20.66:3002';
}

function getApiKey() {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('api_key');
  return setting?.value || process.env.FIRECRAWL_API_KEY || '';
}

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
}

app.get('/api/health', async (req, res) => {
  try {
    const response = await axios.get(`${getFirecrawlUrl()}/`, { timeout: 5000 });
    res.json({ status: 'healthy', firecrawl: response.data });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Settings API
app.get('/api/settings', (req, res) => {
  res.json({ success: true, data: {
    firecrawlUrl: getSetting('firecrawl_url') || '',
    apiKey: getSetting('api_key') || '',
    pollingInterval: Number(getSetting('polling_interval')) || 5000,
    retentionDays: Number(getSetting('retention_days')) || 30,
    retentionMaxRows: Number(getSetting('retention_max_rows')) || 10000,
  }});
});

app.post('/api/settings', (req, res) => {
  const { firecrawlUrl, apiKey, pollingInterval, retentionDays, retentionMaxRows } = req.body;
  try {
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    upsert.run('firecrawl_url', firecrawlUrl ?? '');
    upsert.run('api_key', apiKey ?? '');
    upsert.run('polling_interval', String(pollingInterval ?? 5000));
    upsert.run('retention_days', String(retentionDays ?? 30));
    upsert.run('retention_max_rows', String(retentionMaxRows ?? 10000));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
  const scrapes = db.prepare('SELECT * FROM scrapes').all();
  const searches = db.prepare('SELECT * FROM searches').all();
  const maps = db.prepare('SELECT * FROM maps').all();
  const crawls = db.prepare('SELECT * FROM crawls').all();
  
  res.json({ success: true, data: {
    crawls: { total: crawls.length, active: crawls.filter(c => c.status === 'pending').length, completed: crawls.filter(c => c.status === 'completed').length },
    scrapes: { total: scrapes.length, success: scrapes.filter(s => s.success).length, failed: scrapes.filter(s => !s.success).length },
    searches: { total: searches.length, success: searches.filter(s => s.success).length, failed: searches.filter(s => !s.success).length },
    maps: { total: maps.length, success: maps.filter(s => s.success).length, failed: maps.filter(s => !s.success).length },
    uptime: process.uptime()
  }});
});

app.get('/api/crawls', (req, res) => {
  const crawls = db.prepare('SELECT * FROM crawls ORDER BY created_at DESC').all();
  res.json({ success: true, data: crawls });
});

app.post('/api/crawls', async (req, res) => {
  const { url, limit = 10 } = req.body;
  try {
    const headers = { 'Authorization': `Bearer ${getApiKey()}` };
    const response = await axios.post(`${getFirecrawlUrl()}/v1/crawl`, { url, limit }, { headers });
    if (response.data.success) {
      const crawlId = response.data.id;
      const insert = db.prepare('INSERT INTO crawls (id, url, max_pages, status, created_at) VALUES (?, ?, ?, ?, ?)');
      insert.run(crawlId, url, limit, 'pending', new Date().toISOString());
      res.json({ success: true, data: response.data });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/crawls/:id', async (req, res) => {
  try {
    const headers = { 'Authorization': `Bearer ${getApiKey()}` };
    const response = await axios.get(`${getFirecrawlUrl()}/v1/crawl/${req.params.id}`, { headers });
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scrape', async (req, res) => {
  const { url, formats = ['markdown'] } = req.body;
  try {
    const headers = { 'Authorization': `Bearer ${getApiKey()}` };
    const response = await axios.post(`${getFirecrawlUrl()}/v1/scrape`, { url, formats }, { headers });
    const insert = db.prepare('INSERT INTO scrapes (url, success, timestamp) VALUES (?, ?, ?)');
    insert.run(url, response.data.success ? 1 : 0, new Date().toISOString());
    res.json({ success: true, data: response.data.data });
  } catch (error) {
    const insert = db.prepare('INSERT INTO scrapes (url, success, timestamp) VALUES (?, ?, ?)');
    insert.run(url, 0, new Date().toISOString());
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/search', async (req, res) => {
  const { query, limit = 5 } = req.body;
  try {
    const headers = { 'Authorization': `Bearer ${getApiKey()}` };
    const response = await axios.post(`${getFirecrawlUrl()}/v2/search`, { query, limit }, { headers });
    const insert = db.prepare('INSERT INTO searches (query, success, timestamp) VALUES (?, ?, ?)');
    insert.run(query, response.data.success ? 1 : 0, new Date().toISOString());
    res.json({ success: true, data: response.data.data });
  } catch (error) {
    const insert = db.prepare('INSERT INTO searches (query, success, timestamp) VALUES (?, ?, ?)');
    insert.run(query, 0, new Date().toISOString());
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/map', async (req, res) => {
  const { url, limit = 100 } = req.body;
  try {
    const headers = { 'Authorization': `Bearer ${getApiKey()}` };
    const response = await axios.post(`${getFirecrawlUrl()}/v2/map`, { url, limit }, { headers });
    const insert = db.prepare('INSERT INTO maps (url, success, timestamp) VALUES (?, ?, ?)');
    insert.run(url, response.data.success ? 1 : 0, new Date().toISOString());
    res.json({ success: true, data: response.data.data });
  } catch (error) {
    const insert = db.prepare('INSERT INTO maps (url, success, timestamp) VALUES (?, ?, ?)');
    insert.run(url, 0, new Date().toISOString());
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/history/scrape', (req, res) => {
  const data = db.prepare('SELECT * FROM scrapes ORDER BY timestamp DESC LIMIT 50').all();
  res.json({ success: true, data });
});

app.get('/api/history/search', (req, res) => {
  const data = db.prepare('SELECT * FROM searches ORDER BY timestamp DESC LIMIT 50').all();
  res.json({ success: true, data });
});

app.get('/api/history/map', (req, res) => {
  const data = db.prepare('SELECT * FROM maps ORDER BY timestamp DESC LIMIT 50').all();
  res.json({ success: true, data });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get('*', (req, res) => res.sendFile(join(__dirname, '../dist/index.html')));
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
