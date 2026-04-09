# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs both Vite dev server on :3000 and Express server on :3001 concurrently)
npm run dev

# Build frontend only
npm run build

# Production server (serves built dist/ as static + API)
npm start

# Docker (recommended for full stack)
docker-compose up -d        # Access at http://localhost:3003
docker-compose up --build   # Rebuild after Dockerfile changes
```

There is no test suite. The project uses semantic-release on the `main` branch — commits following Conventional Commits format (`feat:`, `fix:`, `chore:`) will trigger automated versioning on push.

## Architecture

Two-process architecture in development, single process in production:

**Frontend** (`src/`) — React 18 SPA built with Vite. Uses React Router v7 for client-side routing across 6 pages (`/`, `/crawl`, `/scrape`, `/search`, `/map`, `/settings`). `App.jsx` contains only the Router and Layout wrapper. Pages live in `src/pages/`, shared components in `src/components/` (with a `charts/` subdirectory for Recharts wrappers). State management via Zustand (`src/store.js`).

**Backend** (`server/index.js`) — Express.js on port 3001 (dev) / configured by PORT env (prod). Proxies to the Firecrawl API. Persists operation history, crawl jobs, and settings to SQLite via `better-sqlite3`. Housekeeping runs 60s after startup then every 6 hours (age + row-count pruning + VACUUM).

**API proxy pattern**: Frontend calls `/api/*` which Vite proxies to `http://localhost:3001` in dev. In production, Express handles `/api/*` directly and serves `dist/index.html` for all other routes.

**Firecrawl API**: Configured via Settings page (persisted in SQLite `settings` table), falling back to `FIRECRAWL_URL` / `FIRECRAWL_API_KEY` env vars.

## Styling System

Apple Design System via Tailwind CSS. **All colors are CSS custom properties** defined in `src/index.css` `:root`. Tailwind color tokens (`apple-bg`, `apple-card`, `apple-text`, etc.) reference `var(--apple-*)`. Dark mode is handled by `@media (prefers-color-scheme: dark)` overriding those variables — there is no `darkMode` key in `tailwind.config.js`.

Reusable component classes (`.apple-card`, `.apple-button`, `.apple-input`, `.apple-badge`, `.apple-surface`, `.apple-error-banner`) are in `src/index.css` `@layer components`. Always use these.

Do not add hardcoded hex colors or raw Tailwind color utilities. Exception: `Sidebar.jsx` uses fixed dark values (`#1C1C1E`, `#38383A`, `#98989D`) by intentional design — the sidebar is always dark regardless of system theme.
