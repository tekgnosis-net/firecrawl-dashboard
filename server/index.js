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
  const url = req.query.url || getFirecrawlUrl();
  const apiKey = req.query.apiKey || getApiKey();
  try {
    const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
    const response = await axios.get(`${url}/`, { timeout: 5000, headers });
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
    crawls: { total: crawls.length, active: crawls.filter(c => ['pending','scraping'].includes(c.status)).length, completed: crawls.filter(c => c.status === 'completed').length },
    scrapes: { total: scrapes.length, success: scrapes.filter(s => s.success).length, failed: scrapes.filter(s => !s.success).length },
    searches: { total: searches.length, success: searches.filter(s => s.success).length, failed: searches.filter(s => !s.success).length },
    maps: { total: maps.length, success: maps.filter(s => s.success).length, failed: maps.filter(s => !s.success).length },
    uptime: process.uptime()
  }});
});

app.get('/api/stats/daily', (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 7, 90);
  try {
    const rows = db.prepare(`
      SELECT date(timestamp) as date,
        SUM(CASE WHEN type = 'scrape' THEN 1 ELSE 0 END) as scrapes,
        SUM(CASE WHEN type = 'search' THEN 1 ELSE 0 END) as searches,
        SUM(CASE WHEN type = 'map'    THEN 1 ELSE 0 END) as maps
      FROM (
        SELECT timestamp, 'scrape' as type FROM scrapes
        UNION ALL SELECT timestamp, 'search' FROM searches
        UNION ALL SELECT timestamp, 'map'    FROM maps
      )
      WHERE timestamp >= datetime('now', '-' || ? || ' days')
      GROUP BY date ORDER BY date
    `).all(days);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats/domains', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  try {
    const rows = db.prepare('SELECT url FROM scrapes').all();
    const counts = {};
    for (const { url } of rows) {
      try { const h = new URL(url).hostname; counts[h] = (counts[h] || 0) + 1; }
      catch (_) {}
    }
    const data = Object.entries(counts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats/dbsize', (req, res) => {
  try { res.json({ success: true, data: getDbSize() }); }
  catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/maintenance', (req, res) => {
  try { res.json({ success: true, data: runHousekeeping() }); }
  catch (error) { res.status(500).json({ success: false, error: error.message }); }
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
    if (['completed', 'failed', 'scraping'].includes(response.data.status)) {
      db.prepare('UPDATE crawls SET status = ? WHERE id = ?').run(response.data.status, req.params.id);
    }
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/crawls/:id', async (req, res) => {
  try {
    const headers = { 'Authorization': `Bearer ${getApiKey()}` };
    await axios.delete(`${getFirecrawlUrl()}/v1/crawl/${req.params.id}`, { headers });
  } catch (_) {
    // Best-effort — still update local status even if Firecrawl unreachable
  } finally {
    db.prepare('UPDATE crawls SET status = ? WHERE id = ?').run('cancelled', req.params.id);
  }
  res.json({ success: true });
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

app.delete('/api/history/:type', (req, res) => {
  const tableMap = { scrape: 'scrapes', search: 'searches', map: 'maps' };
  const table = tableMap[req.params.type];
  if (!table) return res.status(400).json({ success: false, error: 'Invalid type. Use scrape, search, or map.' });
  try {
    const result = db.prepare(`DELETE FROM ${table}`).run();
    res.json({ success: true, deleted: result.changes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get('{*path}', (req, res) => res.sendFile(join(__dirname, '../dist/index.html')));
}

function getDbSize() {
  const pageCount = db.pragma('page_count', { simple: true });
  const pageSize = db.pragma('page_size', { simple: true });
  const bytes = pageCount * pageSize;
  const formatted = bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return { bytes, formatted };
}

function runHousekeeping() {
  const retentionDays = Number(getSetting('retention_days')) || 30;
  const maxRows = Number(getSetting('retention_max_rows')) || 10000;
  const sizeBefore = getDbSize().formatted;
  const results = { scrapes: 0, searches: 0, maps: 0, crawls: 0 };

  if (retentionDays > 0) {
    results.scrapes += db.prepare(`DELETE FROM scrapes WHERE timestamp < datetime('now', '-' || ? || ' days')`).run(retentionDays).changes;
    results.searches += db.prepare(`DELETE FROM searches WHERE timestamp < datetime('now', '-' || ? || ' days')`).run(retentionDays).changes;
    results.maps += db.prepare(`DELETE FROM maps WHERE timestamp < datetime('now', '-' || ? || ' days')`).run(retentionDays).changes;
    results.crawls += db.prepare(`DELETE FROM crawls WHERE status IN ('completed','failed','cancelled') AND created_at < datetime('now', '-' || ? || ' days')`).run(retentionDays).changes;
  }

  for (const table of ['scrapes', 'searches', 'maps']) {
    const count = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
    if (count > maxRows) {
      results[table] += db.prepare(
        `DELETE FROM ${table} WHERE id NOT IN (SELECT id FROM ${table} ORDER BY timestamp DESC LIMIT ?)`
      ).run(maxRows).changes;
    }
  }

  const totalDeleted = results.scrapes + results.searches + results.maps + results.crawls;
  db.pragma('wal_checkpoint(TRUNCATE)');
  if (totalDeleted > 0) db.prepare('VACUUM').run();

  const sizeAfter = getDbSize().formatted;
  console.log(`[housekeeping] scrapes=${results.scrapes} searches=${results.searches} maps=${results.maps} crawls=${results.crawls} db=${sizeBefore}→${sizeAfter}`);
  return { ...results, dbSizeBefore: sizeBefore, dbSizeAfter: sizeAfter };
}

// Run housekeeping 60s after startup, then every 6 hours
setTimeout(() => {
  runHousekeeping();
  setInterval(runHousekeeping, 6 * 60 * 60 * 1000);
}, 60 * 1000);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
