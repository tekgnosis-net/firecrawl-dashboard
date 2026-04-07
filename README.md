# 🔥 Firecrawl Dashboard

A beautiful monitoring dashboard for self-hosted Firecrawl instances with Apple Design System styling.

## ✨ Features

- **🕸️ Crawl Job Management** - Create and monitor crawl jobs in real-time
- **📄 URL Scraping** - Scrape any URL and view markdown content
- **🔍 Web Search** - Search the web using Firecrawl
- **🗺️ Site Mapping** - Discover all URLs on a website
- **📊 Statistics** - Real-time stats on crawls, scrapes, searches
- **🍎 Apple Design** - Beautiful UI inspired by Apple's design language

## 🚀 Quick Start

### Docker Compose (Recommended)

```bash
git clone https://github.com/tekgnosis-net/firecrawl-dashboard.git
cd firecrawl-dashboard
docker-compose up -d
```

Access the dashboard at **http://localhost:3003**

## 📖 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Dashboard server port |
| `FIRECRAWL_URL` | `http://firecrawl:3002` | Firecrawl API URL |

## 🐳 Docker Services

- **firecrawl-dashboard** - The monitoring dashboard (port 3003)
- **firecrawl** - Firecrawl scraping engine (port 3002)
- **firecrawl-db** - PostgreSQL database
- **firecrawl-redis** - Redis cache

## 🛠️ Usage

### Creating a Crawl Job
1. Enter the URL to crawl
2. Click "Start"
3. Monitor progress in real-time

### Scraping a URL
1. Enter the URL to scrape
2. Click "Scrape"
3. View markdown content and metadata

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/stats` | GET | Get statistics |
| `/api/crawls` | GET/POST | List/create crawl jobs |
| `/api/scrape` | POST | Scrape a URL |
| `/api/search` | POST | Search the web |
| `/api/map` | POST | Map URLs from a site |

## 📄 License

MIT License - see [LICENSE](./LICENSE) file

---

Built with ❤️ by [Tekgnosis Pty Ltd](https://tekgnosis.net)
