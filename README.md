# Firecrawl Dashboard

A self-hosted monitoring dashboard for [Firecrawl](https://github.com/mendableai/firecrawl) instances. Crafted with an Apple-inspired design system featuring semantic color tokens, adaptive dark mode, frosted-glass sidebar, and smooth transitions throughout.

![Dashboard](./screenshots/dashboard.png?v=3)

## Design

The UI follows Apple Human Interface Guidelines with purposeful restraint:

- **Semantic color system** — All colors are CSS custom properties that automatically adapt between light and dark mode. No hardcoded hex values in components.
- **Dark-first aesthetic** — True black backgrounds (`#000000`) with elevated card surfaces (`#1C1C1E`), matching the depth and contrast of native macOS/iOS apps.
- **Adaptive theming** — Three-state theme selector (Auto / Light / Dark) in the sidebar. Auto follows system `prefers-color-scheme`, or manually override.
- **Apple typography** — SF Pro font stack (`-apple-system`) with precise weight hierarchy (700 for headings, 600 for card titles, 400 for body).
- **Subtle interactions** — `color-mix()` hover states on list items, spring-like button feedback, and smooth sidebar collapse transitions.

## Features

- **Crawl Management** — Create, monitor, and cancel crawl jobs with live progress bars
- **URL Scraping** — Scrape any URL and view results in markdown, HTML, or raw links
- **Web Search** — Search the web through Firecrawl with configurable result limits
- **Site Mapping** — Discover all URLs on a website
- **Dashboard Analytics** — Activity charts, success/failure donut with per-type breakdown, top domains, live crawl progress
- **Auto-Save Settings** — Apple HIG-style instant-apply settings with debounced text inputs and connection testing
- **Theme Selector** — Auto / Light / Dark with sidebar toggle and `localStorage` persistence
- **Persistent Storage** — SQLite database for operation history, settings, and crawl state
- **Auto-Maintenance** — Configurable data retention with scheduled pruning and manual VACUUM

## Screenshots

| Dashboard | Crawl | Scrape |
|:-:|:-:|:-:|
| ![Dashboard](./screenshots/dashboard.png?v=3) | ![Crawl](./screenshots/crawl.png?v=3) | ![Scrape](./screenshots/scrape.png?v=3) |

| Search | Map | Settings |
|:-:|:-:|:-:|
| ![Search](./screenshots/search.png?v=3) | ![Map](./screenshots/map.png?v=3) | ![Settings](./screenshots/settings.png?v=3) |

## Quick Start

### Docker Compose (Recommended)

Create a `docker-compose.yml`:

```yaml
services:
  firecrawl-dashboard:
    image: ghcr.io/tekgnosis-net/firecrawl-dashboard:latest
    pull_policy: always
    container_name: firecrawl-dashboard
    ports:
      - "3003:3000"
    environment:
      - FIRECRAWL_URL=http://your-firecrawl-host:3002
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

```bash
docker compose up -d
```

Open **http://localhost:3003** and configure your Firecrawl connection in Settings.

### From Source

```bash
git clone https://github.com/tekgnosis-net/firecrawl-dashboard.git
cd firecrawl-dashboard
npm install
npm run dev    # Vite on :3000 + Express on :3001
```

## Configuration

### First-Time Setup

1. Open the dashboard at http://localhost:3003
2. Go to **Settings** (sidebar)
3. Enter your Firecrawl URL and API key (if auth is enabled)
4. Settings save automatically — no save button needed
5. Use **Test Connection** to verify

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port (internal) |
| `FIRECRAWL_URL` | — | Firecrawl API URL (fallback if not set in Settings) |
| `FIRECRAWL_API_KEY` | — | API key (fallback if not set in Settings) |

Settings configured via the UI are persisted in SQLite and take priority over environment variables.

### Data Persistence

The SQLite database is stored at `/app/data/dashboard.db` inside the container. Mount a volume to `./data:/app/data` to persist data across container restarts. The entrypoint script automatically fixes directory permissions if the host directory is created by Docker as root.

## Architecture

```
Browser  ──►  Vite (dev) / Express (prod)  ──►  Firecrawl API
                     │
                     ▼
               SQLite (data/dashboard.db)
```

**Frontend** — React 18 SPA with React Router v7, Zustand state management, Recharts data visualization, and Tailwind CSS with a full Apple Design System token layer. Six pages: Dashboard, Crawl, Scrape, Search, Map, Settings.

**Backend** — Express.js proxy to Firecrawl API. Persists operation history, crawl jobs, and settings to SQLite via `better-sqlite3`. Automatic housekeeping prunes old records based on configurable retention.

**API proxy** — Frontend calls `/api/*` which Vite proxies in dev, Express handles directly in production. SPA fallback serves `index.html` for client-side routes.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check and Firecrawl connectivity |
| `/api/stats` | GET | Aggregate statistics |
| `/api/stats/daily` | GET | Daily activity breakdown |
| `/api/stats/domains` | GET | Top scraped domains |
| `/api/stats/dbsize` | GET | Database size |
| `/api/settings` | GET/POST | Read/write dashboard settings |
| `/api/crawls` | GET/POST | List/create crawl jobs |
| `/api/crawls/:id` | GET | Crawl job detail with progress |
| `/api/crawls/:id/cancel` | POST | Cancel a running crawl |
| `/api/scrape` | POST | Scrape a URL |
| `/api/search` | POST | Search the web |
| `/api/map` | POST | Map URLs from a site |
| `/api/history/:type` | GET/DELETE | Operation history (scrape/search/map) |
| `/api/maintenance` | POST | Trigger manual housekeeping |

## Star History

If you find this dashboard useful, please consider giving it a star — it helps others discover the project!

[![Star History Chart](https://api.star-history.com/svg?repos=tekgnosis-net/firecrawl-dashboard&type=Date)](https://star-history.com/#tekgnosis-net/firecrawl-dashboard&Date)

## License

MIT — see [LICENSE](./LICENSE)

---

Built with ❤️ by [Tekgnosis](https://tekgnosis.net)
