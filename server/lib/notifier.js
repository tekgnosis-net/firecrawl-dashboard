import axios from 'axios';
import { getNtfyConfig, getWebhookConfig } from './settings.js';

/**
 * Provider-agnostic notification dispatch.
 *
 * Sends a prepared event object to all enabled destinations (ntfy and/or
 * generic webhook) in parallel via Promise.allSettled, and records one row
 * in notification_log per dispatch with the per-destination outcome.
 *
 * The event shape is:
 *   {
 *     event_type: string,        // proxy_unreachable, test, etc.
 *     severity: 'critical'|'warning'|'info',
 *     title: string,             // short human label for headlines
 *     message: string,           // full body text
 *     details: object?,          // event-specific context (serialized to JSON)
 *     timestamp: string,         // ISO 8601
 *   }
 *
 * This module is stateless beyond the DB handle it receives. It does not
 * apply dedup itself — dedup is the notification-watcher's responsibility.
 */

// Severity → ntfy priority (1=min, 3=default, 5=urgent)
const SEVERITY_PRIORITY = {
  critical: 5,
  warning:  4,
  info:     3,
};

// Priority → ntfy tag short-codes for visual distinction
const PRIORITY_TAGS = {
  1: ['arrow_down'],
  2: ['arrow_down'],
  3: [],
  4: ['warning'],
  5: ['rotating_light', 'warning'],
};

/**
 * Send a notification to a ntfy topic. Returns { ok, status } on completion
 * or { ok:false, error } on failure. Never throws.
 */
async function sendNtfy(config, event) {
  if (!config.url || !config.topic) {
    return { ok: false, error: 'ntfy url or topic missing' };
  }

  const base = config.url.replace(/\/+$/, '');
  const url = `${base}/${encodeURIComponent(config.topic)}`;
  const priority = event.priority ?? SEVERITY_PRIORITY[event.severity] ?? 3;
  const tags = [...(PRIORITY_TAGS[priority] || []), event.event_type].filter(Boolean);

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Title': event.title,
    'Priority': String(priority),
    'Tags': tags.join(','),
  };

  // Auth: basic or bearer. ntfy supports both via Authorization header.
  if (config.authType === 'basic' && (config.username || config.password)) {
    const token = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  } else if (config.authType === 'bearer' && config.password) {
    headers['Authorization'] = `Bearer ${config.password}`;
  }

  try {
    const r = await axios.post(url, event.message, {
      headers,
      timeout: 5000,
      validateStatus: () => true,
    });
    const ok = r.status >= 200 && r.status < 300;
    return ok
      ? { ok: true, status: r.status }
      : { ok: false, status: r.status, error: `ntfy returned HTTP ${r.status}` };
  } catch (err) {
    return { ok: false, error: err.message || 'ntfy request failed' };
  }
}

/**
 * Send a notification to a generic webhook. Always POSTs a standard JSON
 * envelope so the receiving end can parse it without guessing shape.
 * Returns { ok, status } or { ok:false, error }. Never throws.
 */
async function sendWebhook(config, event) {
  if (!config.url) {
    return { ok: false, error: 'webhook url missing' };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (config.authHeader) {
    headers['Authorization'] = config.authHeader;
  }

  const body = {
    source: 'firecrawl-dashboard',
    event_type: event.event_type,
    severity: event.severity,
    title: event.title,
    message: event.message,
    timestamp: event.timestamp,
    details: event.details || null,
  };

  try {
    const r = await axios.post(config.url, body, {
      headers,
      timeout: 5000,
      validateStatus: () => true,
    });
    const ok = r.status >= 200 && r.status < 300;
    return ok
      ? { ok: true, status: r.status }
      : { ok: false, status: r.status, error: `webhook returned HTTP ${r.status}` };
  } catch (err) {
    return { ok: false, error: err.message || 'webhook request failed' };
  }
}

/**
 * Dispatch an event to all enabled destinations and record the outcome
 * in notification_log. Returns a summary with per-destination results.
 *
 * The caller (notification-watcher or the test endpoint) is responsible
 * for deduplication and for deciding whether an event is worth sending.
 */
export async function dispatch(db, event) {
  const destinations = [];
  const tasks = [];

  const ntfy = getNtfyConfig(db);
  if (ntfy.enabled && ntfy.topic) {
    destinations.push('ntfy');
    tasks.push(sendNtfy(ntfy, event));
  }

  const webhook = getWebhookConfig(db);
  if (webhook.enabled && webhook.url) {
    destinations.push('webhook');
    tasks.push(sendWebhook(webhook, event));
  }

  if (destinations.length === 0) {
    return { skipped: true, reason: 'no_destinations_enabled', destinations: [], results: {}, success: 0 };
  }

  const outcomes = await Promise.all(tasks);
  const results = Object.fromEntries(destinations.map((name, i) => [name, outcomes[i]]));
  const success = outcomes.every(o => o.ok) ? 1 : 0;

  // Persist the dispatch to notification_log (audit + dedup source of truth).
  try {
    db.prepare(`
      INSERT INTO notification_log
        (timestamp, event_type, severity, title, message, details, destinations, results, success)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.timestamp,
      event.event_type,
      event.severity,
      event.title,
      event.message,
      event.details ? JSON.stringify(event.details) : null,
      JSON.stringify(destinations),
      JSON.stringify(results),
      success,
    );
  } catch (dbErr) {
    console.error('[notifier] failed to insert notification_log row:', dbErr.message);
  }

  return { destinations, results, success };
}

// Exported for unit-style testing and for the health check endpoint.
export { sendNtfy, sendWebhook };
