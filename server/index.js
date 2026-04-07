import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
const FIRECRAWL_URL = process.env.FIRECRAWL_URL || 'http://10.0.20.66:3002';

// In-memory storage
const crawlJobs = new Map();
const scrapeHistory = [];
const searchHistory = [];
const mapHistory = [];

app.get('/api/health', async (req, res) => {
  try {
    const response = await axios.get(`${FIRECRAWL_URL}/`, { timeout: 5000 });
    res.json({ status: 'healthy', firecrawl: response.data });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
  res.json({ success: true, data: {
    crawls: { total: crawlJobs.size, active: 0, completed: 0 },
    scrapes: { total: scrapeHistory.length, success: scrapeHistory.filter(s => s.success).length, failed: scrapeHistory.filter(s => !s.success).length },
    searches: { total: searchHistory.length, success: searchHistory.filter(s => s.success).length, failed: searchHistory.filter(s => !s.success).length },
    maps: { total: mapHistory.length, success: mapHistory.filter(s => s.success).length, failed: mapHistory.filter(s => !s.success).length },
    uptime: process.uptime()
  }});
});

app.get('/api/crawls', (req, res) => {
  res.json({ success: true, data: Array.from(crawlJobs.entries()).map(([id, job]) => ({ id, ...job })) });
});

app.post('/api/crawls', async (req, res) => {
  const { url, limit = 10 } = req.body;
  try {
    const response = await axios.post(`${FIRECRAWL_URL}/v1/crawl`, { url, limit });
    if (response.data.success) {
      crawlJobs.set(response.data.id, { url, limit, status: 'pending', createdAt: new Date().toISOString() });
      res.json({ success: true, data: response.data });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/crawls/:id', async (req, res) => {
  try {
    const response = await axios.get(`${FIRECRAWL_URL}/v1/crawl/${req.params.id}`);
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scrape', async (req, res) => {
  const { url, formats = ['markdown'] } = req.body;
  try {
    const response = await axios.post(`${FIRECRAWL_URL}/v1/scrape`, { url, formats });
    scrapeHistory.unshift({ url, success: response.data.success, timestamp: new Date().toISOString() });
    res.json({ success: true, data: response.data.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/search', async (req, res) => {
  const { query, limit = 5 } = req.body;
  try {
    const response = await axios.post(`${FIRECRAWL_URL}/v2/search`, { query, limit });
    searchHistory.unshift({ query, success: response.data.success, timestamp: new Date().toISOString() });
    res.json({ success: true, data: response.data.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/map', async (req, res) => {
  const { url, limit = 100 } = req.body;
  try {
    const response = await axios.post(`${FIRECRAWL_URL}/v2/map`, { url, limit });
    mapHistory.unshift({ url, success: response.data.success, timestamp: new Date().toISOString() });
    res.json({ success: true, data: response.data.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/history/scrape', (req, res) => res.json({ success: true, data: scrapeHistory }));
app.get('/api/history/search', (req, res) => res.json({ success: true, data: searchHistory }));
app.get('/api/history/map', (req, res) => res.json({ success: true, data: mapHistory }));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get('*', (req, res) => res.sendFile(join(__dirname, '../dist/index.html')));
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
