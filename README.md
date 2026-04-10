# Firecrawl Dashboard

A self-hosted monitoring dashboard **and transparent HTTP proxy** for [Firecrawl](https://github.com/mendableai/firecrawl) instances. Point your Firecrawl clients (SDK, curl, other tools) at the dashboard's proxy URL and every request gets transparently forwarded to the real Firecrawl server while being observed and recorded. The dashboard then surfaces rich real-time metrics — operation counts by type, per-client traffic, credit usage over time, top domains, recent errors, live queue depth, Redis health — all derived from the actual traffic it sees, not from guesswork. Crafted with an Apple-inspired design system featuring semantic color tokens, adaptive dark mode, frosted-glass sidebar, and smooth transitions throughout.

![Dashboard](./screenshots/dashboard.png?v=4)

## Design

The UI follows Apple Human Interface Guidelines with purposeful restraint:

- **Semantic color system** — All colors are CSS custom properties that automatically adapt between light and dark mode. No hardcoded hex values in components.
- **Dark-first aesthetic** — True black backgrounds (`#000000`) with elevated card surfaces (`#1C1C1E`), matching the depth and contrast of native macOS/iOS apps.
- **Adaptive theming** — Three-state theme selector (Auto / Light / Dark) in the sidebar. Auto follows system `prefers-color-scheme`, or manually override.
- **Apple typography** — SF Pro font stack (`-apple-system`) with precise weight hierarchy (700 for headings, 600 for card titles, 400 for body).
- **Subtle interactions** — `color-mix()` hover states on list items, spring-like button feedback, and smooth sidebar collapse transitions.

## Features

- **Transparent Firecrawl Proxy** — A separate Node process (port `3101` by default) mirrors the Firecrawl API byte-for-byte. Clients swap only the base URL; paths, methods, bodies, and headers stay identical. Every request is logged into SQLite with per-client IP, User-Agent, auth-token hash, operation type, target URL, response status, Firecrawl-assigned IDs, credit cost, proxy-observed duration, and Firecrawl's own `X-Response-Time` header.
- **Real-Time Dashboard** — Server health strip, live queue depth, credits/tokens remaining, proxy traffic overview, stacked activity chart by operation type, credit burn-rate line chart, top domains, top clients table, recent errors feed, BullMQ queue table, active crawls list with drill-down, dashboard+proxy process health, recent notifications feed. Every tile is a drill-down entry point into the Reports page — click a client, domain, error, crawl, KPI card, or activity bar to pivot into the deep-dive view with the matching filter pre-applied.
- **Reports & Deep Drill-Down** — Dedicated `/reports` page for deep-dive analysis of proxy traffic. URL-driven filters (time range, operation type, client IP, target host, HTTP status class, success/failure, free-text search) are deep-linkable and back-button-friendly. Six analytical tiles (request volume over time, log-scaled duration histogram with p50/p90/p95/p99, status code breakdown, day-of-week × hour-of-day traffic heatmap, top clients, top domains), a server-paginated operations table, and a slide-in detail drawer showing all 24 fields of any row plus the reconstructed crawl lifecycle when the row has a `firecrawl_id`. One-click CSV export of the current filter set (streamed, 10k-row cap). All aggregation happens server-side so the page stays responsive at 100k+ rows.
- **Critical-Event Notifications** — Background watcher in the dashboard process evaluates conditions every 60 seconds and dispatches alerts to configurable destinations when the proxy crashes, Firecrawl becomes unreachable, Redis degrades, BULL_AUTH is rejected, or the proxy error rate spikes. Supports **ntfy.sh** (public and self-hosted, with optional basic or bearer auth) and **generic webhooks** (any HTTPS endpoint that accepts JSON POST). Notifications are deduped per-event-type via a DB-backed query, so a sustained outage produces one alert instead of spam. A test button in Settings validates configuration end-to-end without waiting for a real incident.
- **Crawl Management** — Create, monitor, and cancel crawl jobs with live progress bars. The crawl list is the union of `/v1/crawl/active` (server truth) + in-session submissions + proxy log history.
- **URL Scraping / Web Search / Site Mapping** — Single-URL or single-query operation pages that submit through the transparent proxy, so internal dashboard UI traffic appears in the stats alongside external clients.
- **Two-Process Architecture** — Dashboard UI and Firecrawl proxy run as independent Node processes with crash isolation. Shared SQLite volume, WAL mode for multi-process concurrency.
- **Async Write Queue** — Proxy logs are enqueued on the request hot path (~10 ns) and flushed in batched `db.transaction()` every 250 ms. Request latency is decoupled from DB latency.
- **Per-Client Metrics** — Groups traffic by client IP + User-Agent, with per-client request count, success/failure rate, credit usage. Honors `X-Forwarded-For` per RFC 7239 for client identification.
- **Server Snapshot Poller** — Dashboard backend polls `/v1/team/*` every 5 minutes into a `server_metrics_snapshots` table. Cross-checks the proxy log: if server-reported credit delta exceeds proxy-observed delta, clients are bypassing the proxy.
- **Auto-Save Settings** — Apple HIG-style instant-apply settings with debounced text inputs and combined connection/Redis/Bull auth testing.
- **Theme Selector** — Auto / Light / Dark with sidebar toggle and `localStorage` persistence.
- **Auto-Maintenance** — Configurable retention with scheduled pruning, WAL checkpoint, and VACUUM. Covers `proxy_operations`, `server_metrics_snapshots`, and `notification_log` tables.

## Screenshots

The headline feature in v2.1.0 is the **Reports** page — a URL-driven deep-dive analytics view with six server-aggregated chart tiles (request volume, log-scaled duration histogram with p50/p90/p95/p99 strip, status code breakdown, day-of-week × hour-of-day traffic heatmap, top clients, top domains), a paginated operations table, and a slide-in detail drawer showing all 24 fields of any operation. Every Dashboard widget is a drill-down entry point into Reports with the matching filter pre-applied.

| Dashboard | Reports | Reports — detail drawer |
|:-:|:-:|:-:|
| ![Dashboard](./screenshots/dashboard.png?v=4) | ![Reports](./screenshots/reports.png?v=4) | ![Reports Detail](./screenshots/reports-detail.png?v=4) |

| Crawl | Scrape | Search |
|:-:|:-:|:-:|
| ![Crawl](./screenshots/crawl.png?v=4) | ![Scrape](./screenshots/scrape.png?v=4) | ![Search](./screenshots/search.png?v=4) |

| Map | Settings |
|:-:|:-:|
| ![Map](./screenshots/map.png?v=4) | ![Settings](./screenshots/settings.png?v=4) |

## Quick Start

### Docker Compose (Recommended)

The dashboard runs as **two containers** that share a SQLite volume — a UI service and a proxy service with independent restart policies and resource limits.

```yaml
services:
  dashboard:
    image: ghcr.io/tekgnosis-net/firecrawl-dashboard:latest
    command: ["node", "server/dashboard.js"]
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - FIRECRAWL_URL=http://your-firecrawl-host:3002
      - DASHBOARD_PORT=3001
      - DB_PATH=/app/data/dashboard.db
    volumes:
      - ./data:/app/data
    restart: on-failure
    mem_limit: 512m
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/healthz"]
      interval: 30s

  proxy:
    image: ghcr.io/tekgnosis-net/firecrawl-dashboard:latest
    command: ["node", "server/proxy.js"]
    ports:
      - "3101:3101"
    environment:
      - NODE_ENV=production
      - FIRECRAWL_URL=http://your-firecrawl-host:3002
      - PROXY_PORT=3101
      - DB_PATH=/app/data/dashboard.db
    volumes:
      - ./data:/app/data
    restart: always
    mem_limit: 2g
    depends_on:
      dashboard:
        condition: service_healthy
```

```bash
docker compose up -d
```

- **Dashboard UI:** open **http://localhost:3001** and set your Firecrawl URL + (optional) Bull Auth Key in Settings.
- **Proxy URL for your clients:** point your Firecrawl SDK at **http://localhost:3101** (same-origin paths — e.g. `POST /v1/scrape`). Every request gets logged and appears in the dashboard within seconds.

### From Source

```bash
git clone https://github.com/tekgnosis-net/firecrawl-dashboard.git
cd firecrawl-dashboard
npm install
npm run dev    # starts dashboard (:3001), proxy (:3101), and vite (:3000) concurrently
```

## Configuration

### First-Time Setup

1. Open the dashboard at **http://localhost:3001**
2. Go to **Settings** (sidebar)
3. Enter your Firecrawl URL and API key (if auth is enabled)
4. Optional: enter the Bull Admin Auth Key to surface BullMQ queue + Redis health metrics
5. Settings save automatically — no save button needed
6. Use **Test Connection** to verify Firecrawl + Redis + Bull auth all in one probe
7. Point your Firecrawl clients at **http://localhost:3101** (the proxy port) — nothing else in their code needs to change

### Notifications Setup (optional but recommended)

The dashboard runs a background watcher that can alert you when critical events happen — most importantly, when the proxy process itself crashes. To enable:

1. In **Settings → Notifications**, toggle **Enable notifications**.
2. Choose which events should fire alerts (proxy unreachable and Firecrawl unreachable are on by default).
3. Enable at least one destination:
   - **ntfy.sh** — enter a topic name (a long random string for the public service, or use a self-hosted instance URL). Select `none` / `basic` / `bearer` auth for private topics. Subscribe to the same topic on your phone via the [ntfy mobile app](https://ntfy.sh/).
   - **Generic webhook** — paste any HTTPS endpoint that accepts `POST application/json`. Optionally add an `Authorization` header value (e.g. `Bearer xyz`).
4. Click **Send test notification** to verify the end-to-end path. The test row appears in the Dashboard's "Recent notifications" card within one polling tick.
5. Tune **Dedup window** (default 15 minutes) to control how often the same event can re-fire during a sustained outage.

The watcher uses a DB-backed dedup query, so a 2-hour outage produces one alert instead of 120. The master toggle is a clean kill-switch for maintenance windows.

### Environment Variables

| Variable | Default | Used by | Description |
|----------|---------|---------|-------------|
| `DASHBOARD_PORT` | `3001` | dashboard | Dashboard UI + `/api/*` port |
| `PROXY_PORT` | `3101` | proxy | Transparent Firecrawl proxy port |
| `FIRECRAWL_URL` | `http://10.0.20.66:3002` | both | Upstream Firecrawl server |
| `FIRECRAWL_API_KEY` | — | both | Bearer token fallback when clients don't provide one |
| `FIRECRAWL_BULL_AUTH_KEY` | — | dashboard | BULL_AUTH key for Bull queue + Redis health metrics |
| `DB_PATH` | `./data/dashboard.db` | both | SQLite database path (shared between processes) |

Settings configured via the UI are persisted in SQLite and take priority over environment variables.

### Data Persistence

The SQLite database is stored at `/app/data/dashboard.db` inside the container. Mount a volume to `./data:/app/data` to persist data across container restarts. The entrypoint script automatically fixes directory permissions if the host directory is created by Docker as root.

## Architecture

```
┌─ Container A: dashboard (node server/dashboard.js, :3001) ──┐
│  /api/settings, /api/health                                 │
│  /api/firecrawl/queue-status  ← direct live reads to        │
│  /api/firecrawl/credit-usage    Firecrawl /v1/team/*        │
│  /api/firecrawl/bull-queues   ← direct admin reads          │
│  /api/stats/proxy/overview    ← reads proxy_operations      │
│  /api/stats/proxy/timeline      (the transparent proxy log) │
│  /api/stats/proxy/clients                                   │
│  /api/stats/proxy/domains                                   │
│  /api/stats/snapshots         ← reads server_metrics_snap…  │
│  snapshot poller (5 min)  ┐                                 │
│  housekeeping (6 h)       ├─────────┐                       │
└───────────────────────────┼─────────┼───────────────────────┘
                            │         │
                            ▼         ▼
                data/dashboard.db  (SQLite, WAL mode)
                            ▲         ▲
                            │         │
┌─ Container B: proxy (node server/proxy.js, :3101) ──────────┤
│  ALL /v1/* /v2/* /admin/* → proxyMiddleware                 │
│    1. Extract client identity (XFF, sha256(Bearer))         │
│    2. Classify operation from method+path                   │
│    3. Forward via axios to Firecrawl                        │
│    4. Parse response for scrapeId, creditsUsed, etc.        │
│    5. ENQUEUE row onto async write queue                    │
│    6. Forward response to client                            │
│  write queue flushes every 250ms via db.transaction()       │
└──────────────────────────────────────────────────────────────┘

External clients (SDK, curl, other tools)
  ──► http://dashboard-host:3101/v1/scrape  (proxy)
  ──► http://dashboard-host:3101/v1/crawl   (proxy)
  etc.
```

**Frontend** — React 18 SPA with React Router v7, Zustand state management, Recharts data visualization, and Tailwind CSS with a full Apple Design System token layer. Six pages: Dashboard, Crawl, Scrape, Search, Map, Settings. The operation pages (Scrape/Search/Map/Crawl) all submit through the transparent proxy on port `3101`, so internal UI traffic is logged identically to external client traffic.

**Dashboard backend** (`server/dashboard.js`) — Express on `:3001`. Runs migration, snapshot poller, and housekeeping. Hosts the `/api/*` routes that live-read Firecrawl metrics and serve stats derived from the proxy log.

**Proxy backend** (`server/proxy.js`) — Express on `:3101`. Stateless apart from the SQLite write queue. Mirrors Firecrawl's path surface byte-for-byte so clients only change the base URL.

**Shared code** (`server/lib/`) — `db.js`, `settings.js`, `classifier.js`, `response-parser.js`, `firecrawl-client.js`, `write-queue.js`, `proxy-middleware.js`, `snapshot-poller.js`, `housekeeping.js`, `stats-queries.js`, `notifier.js`, `notification-watcher.js`.

**SQLite schema** (migration-guarded at `settings.schema_version = 3`) — Three tables plus the `settings` key-value store:
- **`proxy_operations`** — primary observation log, one row per proxied request. Indexed by timestamp, (operation_type, timestamp), (client_ip, timestamp), target_host, firecrawl_id, (success, timestamp).
- **`server_metrics_snapshots`** — aggregate trends from `/v1/team/*` polled every 5 minutes. Used for credit burn rate + queue depth over time.
- **`notification_log`** — one row per dispatched notification (including failures). Used for audit and for dedup queries. Indexed by timestamp, (event_type, timestamp), (success, event_type, timestamp).

WAL mode enables concurrent reads while the proxy writes. `busy_timeout = 5000ms` handles write contention between processes. Housekeeping prunes all three tables on a 6-hour schedule using per-table retention settings.

## API surface

The dashboard backend (`:3001`) exposes the control and reporting API under `/api/*`. The proxy backend (`:3101`) is a transparent byte-for-byte mirror of Firecrawl — use it exactly as you'd use Firecrawl itself.

### Dashboard API (port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/healthz` | GET | Dashboard process health + cross-ping to proxy |
| `/api/health` | GET | Firecrawl connectivity + Redis health + bullAuth state |
| `/api/settings` | GET / POST | Read/write dashboard + proxy settings |
| `/api/firecrawl/queue-status` | GET | Live `/v1/team/queue-status` passthrough |
| `/api/firecrawl/credit-usage` | GET | Live `/v1/team/credit-usage` passthrough |
| `/api/firecrawl/token-usage` | GET | Live `/v1/team/token-usage` passthrough |
| `/api/firecrawl/active-crawls` | GET | Live `/v1/crawl/active` passthrough |
| `/api/firecrawl/bull-queues` | GET | Bull Board JSON (requires `bull_auth_key`) |
| `/api/firecrawl/redis-health` | GET | Redis health (requires `bull_auth_key`) |
| `/api/stats/proxy/overview` | GET | Aggregates over the proxy log (24h by default) |
| `/api/stats/proxy/timeline` | GET | Bucketed operation counts pivoted by type |
| `/api/stats/proxy/clients` | GET | Per-client traffic, grouped by IP + UA |
| `/api/stats/proxy/domains` | GET | Top target hostnames |
| `/api/stats/proxy/errors` | GET | Recent failed operations |
| `/api/stats/proxy/credits` | GET | Credit usage time series |
| `/api/stats/proxy/recent` | GET | Paginated recent operations |
| `/api/stats/snapshots` | GET | Server metric snapshot history (7-day default) |
| `/api/notifications/recent` | GET | Recent notification_log rows (audit + dashboard widget) |
| `/api/notifications/test` | POST | Dispatch a synthetic test event to all enabled destinations |
| `/api/maintenance/dbsize` | GET | Current SQLite file size |
| `/api/maintenance` | POST | Trigger manual housekeeping run |

### Proxy (port 3101) — transparent Firecrawl mirror

| Endpoint | Description |
|----------|-------------|
| `/healthz` | Local proxy process health + write queue stats |
| `/v1/scrape`, `/v2/scrape` | Forwarded to Firecrawl, logged |
| `/v1/crawl`, `/v1/crawl/:id` | Forwarded to Firecrawl, logged |
| `/v1/crawl/active` | Forwarded to Firecrawl, logged |
| `/v2/map`, `/v2/search` | Forwarded to Firecrawl, logged |
| `/v1/extract`, `/v1/batch/scrape` | Forwarded to Firecrawl, logged |
| `/v1/team/*`, `/admin/*` | Forwarded to Firecrawl, logged |
| `GET /` | Firecrawl welcome message (for SDK health pings) |

Every request through the proxy is enqueued into `proxy_operations` with the row shape documented in `server/lib/db.js`.

## Star History

If you find this dashboard useful, please consider giving it a star — it helps others discover the project!

[![Star History Chart](https://api.star-history.com/svg?repos=tekgnosis-net/firecrawl-dashboard&type=Date)](https://star-history.com/#tekgnosis-net/firecrawl-dashboard&Date)

## License

MIT — see [LICENSE](./LICENSE)

---

Built with ❤️ by [Tekgnosis](https://tekgnosis.net)
