// src/lib/format.js
//
// Small formatting helpers used by the metric components.

/**
 * Firecrawl's self-hosted build uses 99999999 as a sentinel for "unlimited"
 * (credits, tokens, maxConcurrency). Rendering 99,999,999 in the UI is ugly;
 * show ∞ when we detect it.
 */
export function formatUnlimited(n, { symbol = '\u221E' } = {}) {
  if (n === null || n === undefined) return '\u2014'; // em-dash placeholder
  const num = Number(n);
  if (Number.isNaN(num)) return '\u2014';
  if (num >= 1e8) return symbol;
  return num.toLocaleString();
}

/** Format a number with thousands separators, or em-dash for null. */
export function formatNumber(n) {
  if (n === null || n === undefined) return '\u2014';
  return Number(n).toLocaleString();
}

/** Format a millisecond duration compactly. */
export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '\u2014';
  const n = Number(ms);
  if (n < 1000) return `${Math.round(n)}ms`;
  if (n < 60_000) return `${(n / 1000).toFixed(1)}s`;
  return `${(n / 60_000).toFixed(1)}m`;
}

/** Format bytes into KB/MB/GB. */
export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '\u2014';
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Format a percentage (0-1 input) with one decimal. */
export function formatPercent(p) {
  if (p === null || p === undefined) return '\u2014';
  return `${(Number(p) * 100).toFixed(1)}%`;
}

/**
 * Format a timestamp as relative ("5m ago", "2h ago"). Falls back to
 * an absolute local time for very old timestamps.
 */
export function timeAgo(isoString) {
  if (!isoString) return '\u2014';
  try {
    const then = new Date(isoString).getTime();
    const now = Date.now();
    const diffSec = Math.round((now - then) / 1000);
    if (diffSec < 0)   return 'just now';
    if (diffSec < 5)   return 'just now';
    if (diffSec < 60)  return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return new Date(isoString).toLocaleDateString();
  } catch (_) {
    return isoString;
  }
}
