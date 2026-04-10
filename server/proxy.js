import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { openDb, waitForSchemaVersion, CURRENT_SCHEMA_VERSION } from './lib/db.js';
import {
  getProxyPort, getFirecrawlUrl,
  getProxyWriteQueueFlushMs, getProxyWriteQueueMaxRows,
  getProxyMaxBodyBytes,
} from './lib/settings.js';
import { createWriteQueue } from './lib/write-queue.js';
import { createProxyMiddleware } from './lib/proxy-middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, '../data/dashboard.db');

async function main() {
  const db = openDb(DB_PATH);

  // Wait for dashboard migration to complete (belt-and-suspenders with
  // docker-compose depends_on: service_healthy)
  console.log(`[proxy] waiting for schema version ${CURRENT_SCHEMA_VERSION}...`);
  await waitForSchemaVersion(db, CURRENT_SCHEMA_VERSION, { timeoutMs: 30_000 });
  console.log(`[proxy] schema ready`);

  // Initialize write queue from current settings
  const writeQueue = createWriteQueue(db, {
    flushMs: getProxyWriteQueueFlushMs(db),
    maxRows: getProxyWriteQueueMaxRows(db),
  });

  const proxyMiddleware = createProxyMiddleware(db, writeQueue);

  const app = express();

  // CORS: mirror Firecrawl's permissive default so browser-based SDKs
  // continue to work. Same as the upstream's Access-Control-Allow-Origin: *.
  app.use(cors());

  // JSON body parser. Derive the limit from `proxy_max_body_bytes` so the
  // inbound parser and the outbound forwarding cap agree on the same value.
  // Read once at startup; changing this setting requires a proxy restart
  // (documented in the Settings UI).
  const maxBodyBytes = getProxyMaxBodyBytes(db);
  app.use(express.json({ limit: maxBodyBytes }));

  // Local health probe — not proxied. Used by Docker healthcheck and by
  // the dashboard process to surface proxy status in the UI.
  app.get('/healthz', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'proxy',
      schema_version: CURRENT_SCHEMA_VERSION,
      uptimeSeconds: process.uptime(),
      forwardingTo: getFirecrawlUrl(db),
      writeQueue: writeQueue.getStats(),
    });
  });

  // Mount proxy on all known Firecrawl path prefixes. Express route order
  // matters: /healthz is registered first so it cannot be shadowed.
  app.all(/^\/v[12]\/.*/, proxyMiddleware);
  app.all(/^\/admin\/.*/, proxyMiddleware);
  app.all('/', proxyMiddleware); // Firecrawl root welcome / SDK health ping

  // 404 for anything else — dashboard UI lives on a different port
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: `Not found: ${req.method} ${req.originalUrl}`,
      hint: 'This is the Firecrawl proxy port. The dashboard UI is on the dashboard port.',
    });
  });

  const port = parseInt(process.env.PROXY_PORT, 10) || getProxyPort(db);
  const server = app.listen(port, () => {
    console.log(`[proxy] listening on :${port}, forwarding to ${getFirecrawlUrl(db)}`);
  });

  // Graceful shutdown: drain write queue before exit
  async function shutdown(signal) {
    console.log(`[proxy] ${signal} received, draining write queue...`);
    server.close(async () => {
      await writeQueue.drain();
      console.log(`[proxy] drained, final stats:`, writeQueue.getStats());
      db.close();
      process.exit(0);
    });
    // Safety timeout
    setTimeout(() => {
      console.error('[proxy] forced exit after timeout');
      process.exit(1);
    }, 10_000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

main().catch(err => {
  console.error('[proxy] fatal startup error:', err);
  process.exit(1);
});
