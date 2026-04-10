# [2.3.0](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v2.2.0...v2.3.0) (2026-04-10)


### Features

* **sidebar:** show current version in the footer above the attribution ([8ec94bd](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/8ec94bdad3fef4728877a9630d9759494b16d3ce))

# [2.2.0](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v2.1.1...v2.2.0) (2026-04-10)


### Features

* **settings:** surface auto-save feedback as a floating toast ([5537e55](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/5537e55ae59b48956d87703fb73c83d4a144efb0))

## [2.1.1](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v2.1.0...v2.1.1) (2026-04-10)


### Bug Fixes

* **ui:** render unicode characters correctly + sync README docker-compose with PROXY_HOST ([e29fe59](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/e29fe59e775a676266f4781cb66c715bc041ec90))

# [2.1.0](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v2.0.3...v2.1.0) (2026-04-10)


### Features

* **reports:** URL-driven deep-dive page with drill-down, charts, CSV export ([#8](https://github.com/tekgnosis-net/firecrawl-dashboard/issues/8)) ([befdc33](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/befdc33a8ea2ddcf8ba986784ca241b7e913b2c8))

## [2.0.3](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v2.0.2...v2.0.3) (2026-04-10)


### Bug Fixes

* **settings:** init form from server values, not store defaults ([bacc0b0](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/bacc0b0e8616951e82720e1c4cef7ce163cb3501))

## [2.0.2](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v2.0.1...v2.0.2) (2026-04-10)


### Bug Fixes

* **settings:** text inputs lose focus on every keystroke ([4bd0840](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/4bd0840fff71025b9cd29fe6b171987e16768eb9))

## [2.0.1](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v2.0.0...v2.0.1) (2026-04-10)


### Bug Fixes

* **docker:** cross-ping the proxy via PROXY_HOST env, not localhost ([9ad501d](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/9ad501d6e50ac8baddaf555734d88b01b4fdc614))

# [2.0.0](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.5.1...v2.0.0) (2026-04-10)


### chore

* mark v1.5.1 backend rebuild as a breaking change ([a3953d1](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/a3953d19a465344066e820d9b5c962df3aab241c))


### BREAKING CHANGES

* This release contains a complete backend rebuild into
a two-process transparent Firecrawl proxy. Operators upgrading from
v1.5.0 or earlier MUST:

1. Update docker-compose.yml: publish ports 3001 (dashboard UI) and
   3101 (proxy) instead of the old 3003:3000 mapping. Two services
   are now declared, sharing a SQLite volume.

2. Reconfigure Firecrawl clients (SDK / curl / other tools) to point
   at the new proxy URL `http://<host>:3101` instead of directly at
   the Firecrawl server. Paths, methods, bodies, and headers are
   unchanged.

3. Accept that the schema migration drops the legacy activity tables
   (`scrapes`, `searches`, `maps`, `crawls`) — this data cannot be
   recovered after upgrade. Pre-upgrade backup:
   `sqlite3 dashboard.db ".dump scrapes" > pre-upgrade.sql`

4. Note that the old /api/scrape, /api/crawls, /api/search, /api/map,
   /api/history/* routes are removed. Operation submissions now flow
   through the transparent proxy at /v1/*, /v2/*, /admin/* instead.

See the 1.5.1 CHANGELOG entry and the commit message on 17d45b88 for
the full scope of what changed.

## [1.5.1](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.5.0...v1.5.1) (2026-04-10)


### Bug Fixes

* address Copilot review feedback ([2a5e8d7](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/2a5e8d725ff2d54e9ad26760953494e38b0fe884)), closes [#3](https://github.com/tekgnosis-net/firecrawl-dashboard/issues/3) [#4](https://github.com/tekgnosis-net/firecrawl-dashboard/issues/4) [#1](https://github.com/tekgnosis-net/firecrawl-dashboard/issues/1) [#5](https://github.com/tekgnosis-net/firecrawl-dashboard/issues/5) [#6](https://github.com/tekgnosis-net/firecrawl-dashboard/issues/6) [#7](https://github.com/tekgnosis-net/firecrawl-dashboard/issues/7) [#2](https://github.com/tekgnosis-net/firecrawl-dashboard/issues/2)

# [1.5.0](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.4.0...v1.5.0) (2026-04-09)


### Features

* add GitHub link with star CTA in sidebar + star history in README ([123d746](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/123d746536b64195b1ec307beb5122475f8ff09e))

# [1.4.0](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.3.4...v1.4.0) (2026-04-09)


### Features

* add dark/light/auto theme selector ([9e47db2](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/9e47db25803a630199c0186797556ea7aa73e287))

## [1.3.4](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.3.3...v1.3.4) (2026-04-09)


### Bug Fixes

* settings focus loss + auto-save (Apple HIG pattern) ([8acabe3](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/8acabe3480b105ff1f1d090ee0de8f76e0af3d63))

## [1.3.3](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.3.2...v1.3.3) (2026-04-09)


### Bug Fixes

* settings data retention validation + dashboard failure breakdown ([c6b5d01](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/c6b5d0154e276305d24dbba099c1c128c7d8cdd2))

## [1.3.2](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.3.1...v1.3.2) (2026-04-09)


### Bug Fixes

* use named wildcard for Express catch-all route ([60f3f89](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/60f3f890b1043038cb2d6d14163fd6ff4a887f27))

## [1.3.1](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.3.0...v1.3.1) (2026-04-09)


### Bug Fixes

* Apple HIG compliance + Docker restart loop ([592e202](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/592e2024051b444f04aa0ab287a1a6e10703edd6))

# [1.3.0](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.2.5...v1.3.0) (2026-04-09)


### Bug Fixes

* address PR review — stopPolling cleanup, immediate fetch on poll start, test connection uses form values, conditional VACUUM, fix router version in docs ([896a347](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/896a3473260d6bbea530008d4d71468cec371a99))
* correct progress pct guard, alive flag for chart fetches, live status badge ([f81f425](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/f81f42545cecd143f084a8ef12286d3bb4ed5575))
* handle clipboard API rejection in ScrapePage copy button ([c374e28](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/c374e281d5d4d6cf95dff15c3a427fabd92a3a4b))
* persist scraping status to SQLite and count it as active in stats ([025ea5a](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/025ea5aa274cc340d5b4da125b3b07bf4dcba386))
* refresh search history after failed requests too ([ffca194](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/ffca1947249e23cf024ab44c117bca6d1d345ab2))
* **server:** auto-create data/ directory before opening SQLite DB ([ee8dbe6](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/ee8dbe6ffd49138bb5fe40724a8c39e684f79ac5))
* **server:** move CORS middleware first, extend settings with retention fields ([67a37e1](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/67a37e19a892d63d3e54ba1c2dc4283bc29844f3))
* show correct message for cancelled crawls with no data ([a378d5e](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/a378d5e614f58126a52087aa1897b4d5c8182dde))
* **store:** validate saveSettings response, add loading state to cancelCrawl and clearHistory ([016a278](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/016a278207fd4128cdc7d29737be8e51ef795ce3))
* use RELEASE_TOKEN for semantic-release to bypass branch protection ([1aef1e7](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/1aef1e77035f88129396ba85535a11698b3f52f7))


### Features

* add ActivityChart, SuccessRateChart, TopDomainsChart components ([9cc5368](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/9cc536846e2ee42451302ac6b1b1157645bde1d3))
* add collapsible Sidebar navigation component ([981adbe](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/981adbe65c60664025a6c536732a2f9f552b6dd7))
* add Router, Layout, Sidebar, and stub pages for all 6 routes ([0542ca3](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/0542ca3bf48c6e3d7cc649c9c366b600855c56a2))
* implement CrawlPage with live polling, results browser, cancel ([ef2351b](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/ef2351bc59d7ab381a7596f91618c9e6c3b215f3))
* implement DashboardPage with KPI cards, charts, live crawl progress ([0cfe977](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/0cfe977d0c110e1c1f8c76cbce340d90367eb787))
* implement MapPage with URL list and history ([abe5c5b](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/abe5c5b3c7295c0f0c543cf3eeb14332cc153b2d))
* implement ScrapePage with format toggle, result preview, copy button ([3cbb712](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/3cbb7124c19b2f200a27fe063dc7bed842331005))
* implement SearchPage with result cards and history ([7736b4f](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/7736b4f83e2fa118ca3a8a1177e448a56e7c1280))
* implement SettingsPage — connection test, polling, retention, data management ([37614f0](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/37614f0b5026176d2bad18edb0a166f6f3b8b206))
* **server:** add /api/stats/daily and /api/stats/domains ([5b1c150](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/5b1c15085f06d57e7ab26fa08ce8f89529555e61))
* **server:** add DELETE history/:type, DELETE crawls/:id, crawl status sync ([ead6da1](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/ead6da1bb6be2d5f9835b75451414f55ba5515aa))
* **server:** add housekeeping, /api/stats/dbsize, /api/maintenance ([a51893c](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/a51893c5e729f10fb7552a55a0b8547b8cabe546))

## [1.2.5](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.2.4...v1.2.5) (2026-04-09)


### Bug Fixes

* **ci:** add actions:write permission so GITHUB_TOKEN can dispatch Docker Publish workflow ([9ec4400](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/9ec440015c654d9c62c016f30684faedda51b7e9))

## [1.2.4](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.2.3...v1.2.4) (2026-04-09)


### Bug Fixes

* **ci:** trigger Docker Publish workflow after semantic-release creates a tag ([9ee4248](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/9ee42482458dddbdf291f0b3f17c7bf83fca04ed))

## [1.2.3](https://github.com/tekgnosis-net/firecrawl-dashboard/compare/v1.2.2...v1.2.3) (2026-04-09)


### Bug Fixes

* **ci:** resolve duplicate Docker builds, update actions, fix semantic-release config ([7bbeab4](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/7bbeab4153ec9d4922e22cc892fb98a4810ae07e))
* **docker:** add non-root user, reproducible builds, healthcheck ([da56807](https://github.com/tekgnosis-net/firecrawl-dashboard/commit/da56807362dde45726334324fe2ceb64ee71d1b8))
