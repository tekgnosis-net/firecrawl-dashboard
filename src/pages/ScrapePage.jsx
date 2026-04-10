// src/pages/ScrapePage.jsx
import { useState } from 'react';
import { useStore } from '../store';
import { buildProxyUrl } from '../lib/proxyUrl';

const FORMATS = ['markdown', 'html', 'links'];

export function ScrapePage() {
  const submitScrape = useStore(s => s.submitScrape);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const clearError = useStore(s => s.clearError);

  const [url, setUrl] = useState('');
  const [formats, setFormats] = useState(['markdown']);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const toggleFormat = (fmt) => setFormats(prev =>
    prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]
  );

  const displayContent = () => {
    if (!result) return '';
    if (formats.includes('markdown') && result.markdown) return result.markdown;
    if (formats.includes('html') && result.html) return result.html;
    if (formats.includes('links') && result.links) return result.links.join('\n');
    return JSON.stringify(result, null, 2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formats.length === 0) return;
    try {
      const r = await submitScrape(url, formats);
      setResult(r.data);
    } catch (_) {}
  };

  const handleCopy = () => {
    const c = displayContent();
    if (!c) return;
    navigator.clipboard.writeText(c)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {});
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--apple-text)' }}>{'\u{1F4C4}'} Scrape</h1>
        <p style={{ fontSize: 13, color: 'var(--apple-text-secondary)', marginTop: 4 }}>
          Extract content from a single URL. Request flows through the transparent proxy and appears in the dashboard's activity log.
        </p>
      </div>

      {error && (
        <div className="apple-error-banner rounded-apple p-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 13 }}>{'\u26A0'} {error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: 'var(--apple-red)', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
        <div className="apple-card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>New scrape</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              className="apple-input"
              required
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FORMATS.map(fmt => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => toggleFormat(fmt)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: formats.includes(fmt) ? 'var(--apple-blue)' : 'var(--apple-separator)',
                    background: formats.includes(fmt) ? 'var(--apple-blue)' : 'transparent',
                    color: formats.includes(fmt) ? 'white' : 'var(--apple-text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>
            <button type="submit" className="apple-button" disabled={loading || formats.length === 0}>
              {loading ? 'Scraping\u2026' : 'Scrape'}
            </button>
          </form>
          <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 10 }}>
            POST {'\u2192'} {buildProxyUrl('/v1/scrape')}
          </div>
        </div>

        {result && (
          <div className="apple-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Result</h3>
                {result.metadata?.title && (
                  <p style={{ fontSize: 12, color: 'var(--apple-text-secondary)', marginTop: 2 }}>
                    {result.metadata.title}
                  </p>
                )}
                {result.metadata?.creditsUsed !== undefined && (
                  <p style={{ fontSize: 11, color: 'var(--apple-text-secondary)' }}>
                    {result.metadata.creditsUsed} credit(s) · scrapeId {result.metadata.scrapeId?.substring(0, 18)}\u2026
                  </p>
                )}
              </div>
              <button
                onClick={handleCopy}
                style={{ fontSize: 12, color: 'var(--apple-blue)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              >
                {copied ? '\u2713 Copied' : 'Copy'}
              </button>
            </div>
            <pre
              style={{
                background: '#1D1D1F',
                borderRadius: 8,
                padding: 12,
                fontSize: 11,
                color: '#F5F5F7',
                overflowY: 'auto',
                maxHeight: 360,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                margin: 0,
              }}
            >
              {displayContent()}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
