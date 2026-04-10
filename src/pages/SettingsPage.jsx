// src/pages/SettingsPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useStore } from '../store';
import { getProxyBaseUrl } from '../lib/proxyUrl';

const POLLING_OPTIONS = [
  { label: '5 seconds', value: 5000 },
  { label: '10 seconds', value: 10000 },
  { label: '30 seconds', value: 30000 },
  { label: '60 seconds', value: 60000 },
  { label: 'Off', value: 0 },
];

const SNAPSHOT_POLL_OPTIONS = [
  { label: '1 minute',   value: 60000 },
  { label: '5 minutes',  value: 300000 },
  { label: '15 minutes', value: 900000 },
  { label: '60 minutes', value: 3600000 },
  { label: 'Off',        value: 0 },
];

const PROXY_RETENTION_OPTIONS = [
  { label: '7 days',  value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
  { label: 'Unlimited', value: 0 },
];

const SNAPSHOT_RETENTION_OPTIONS = [
  { label: '7 days',  value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '365 days', value: 365 },
  { label: 'Unlimited', value: 0 },
];

const settingsSelector = (s) => ({
  settings: s.settings,
  settingsLoaded: s.settingsLoaded,
  saveSettings: s.saveSettings,
  loading: s.loading,
  error: s.error,
  clearError: s.clearError,
  runMaintenance: s.runMaintenance,
  testNotification: s.testNotification,
});

const NOTIFICATION_EVENTS = [
  { key: 'notifyOnProxyUnreachable',     label: 'Proxy unreachable',       severity: 'critical' },
  { key: 'notifyOnFirecrawlUnreachable', label: 'Firecrawl unreachable',   severity: 'critical' },
  { key: 'notifyOnBullAuthRejected',     label: 'BULL_AUTH rejected',      severity: 'critical' },
  { key: 'notifyOnRedisUnhealthy',       label: 'Redis degraded',          severity: 'warning' },
  { key: 'notifyOnHighErrorRate',        label: 'High proxy error rate',   severity: 'warning' },
];

const DEDUP_OPTIONS = [
  { label: '5 minutes',  value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour',     value: 60 },
  { label: '6 hours',    value: 360 },
];

const PRIORITY_OPTIONS = [
  { label: '1 — min',     value: 1 },
  { label: '2 — low',     value: 2 },
  { label: '3 — default', value: 3 },
  { label: '4 — high',    value: 4 },
  { label: '5 — urgent',  value: 5 },
];

// --- Helper components at MODULE SCOPE ---
// These used to live inside SettingsPage() which meant React created
// fresh component references on every render. That made React treat
// <Field>/<Card>/etc. as different component types each render, which
// unmounted and remounted the DOM subtree — destroying input focus on
// every keystroke (the user could only type one character before the
// input lost focus). Lifting them to module scope gives them stable
// references so React reconciles the inputs in place.

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--apple-text-secondary)', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 4 }}>{hint}</p>
      )}
    </div>
  );
}

function Card({ title, right, children }) {
  return (
    <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function ConfirmPair({ onConfirm, onCancel }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={onConfirm}
        style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--apple-red)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12 }}
      >
        Confirm
      </button>
      <button
        onClick={onCancel}
        style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--apple-surface)', color: 'var(--apple-text)', border: '1px solid var(--apple-separator)', cursor: 'pointer', fontSize: 12 }}
      >
        Cancel
      </button>
    </div>
  );
}

function SaveIndicator({ status }) {
  if (status === 'saving') return <span style={{ fontSize: 12, color: 'var(--apple-text-secondary)' }}>Saving…</span>;
  if (status === 'saved') return <span style={{ fontSize: 12, color: 'var(--apple-green)' }}>✓ Saved</span>;
  return null;
}

export function SettingsPage() {
  const { settings, settingsLoaded, saveSettings, loading, error, clearError, runMaintenance, testNotification } = useStore(settingsSelector);
  const [form, setForm] = useState({ ...settings });
  const [showKey, setShowKey] = useState(false);
  const [showBullKey, setShowBullKey] = useState(false);
  const [showNtfyPassword, setShowNtfyPassword] = useState(false);
  const [showWebhookAuth, setShowWebhookAuth] = useState(false);
  const [testStatus, setTestStatus] = useState(null); // null | 'sending' | 'done'
  const [testOutcome, setTestOutcome] = useState(null);
  const [connStatus, setConnStatus] = useState(null);
  const [connMsg, setConnMsg] = useState('');
  const [dbSize, setDbSize] = useState(null);
  const [maintenanceResult, setMaintenanceResult] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef(null);
  const formRef = useRef(form);
  formRef.current = form;
  const initialized = useRef(false);

  // Initialize the form from the store ONCE, as soon as loadSettings()
  // has successfully fetched the server-side values (signalled by the
  // `settingsLoaded` flag in the store). After that, `form` is the
  // source of truth for what the user is editing — we must NOT re-sync
  // from `settings` on subsequent store updates, because the user may
  // have typed characters during the debounce/save round-trip that
  // haven't been persisted yet, and re-syncing would clobber them with
  // a stale server-round-trip value.
  //
  // Using a dedicated `settingsLoaded` flag (rather than a content-based
  // heuristic) is essential: the default store `settings` object has
  // the same shape as a loaded one (empty strings + defaults), so
  // content checks cannot reliably distinguish them. Without this
  // flag, the form would initialize from empty defaults and then the
  // real server values would be silently ignored — causing data loss
  // when the user saved.
  useEffect(() => {
    if (initialized.current) return;
    if (settingsLoaded) {
      setForm(prev => ({ ...prev, ...settings }));
      initialized.current = true;
    }
  }, [settingsLoaded, settings]);

  const fetchDbSize = useCallback(() => {
    axios.get('/api/maintenance/dbsize')
      .then(r => { if (r.data.success) setDbSize(r.data.data.formatted); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchDbSize(); }, [fetchDbSize]);

  const persistSettings = useCallback((nextForm) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      await saveSettings(nextForm);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 1500);
    }, 600);
  }, [saveSettings]);

  const persistNow = useCallback(async (nextForm) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus('saving');
    await saveSettings(nextForm);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 1500);
  }, [saveSettings]);

  const updateText = (key) => (e) => {
    const next = { ...formRef.current, [key]: e.target.value };
    setForm(next);
    persistSettings(next);
  };
  const updateNumber = (key) => (e) => {
    const next = { ...formRef.current, [key]: Number(e.target.value) };
    setForm(next);
    persistSettings(next);
  };
  const updateSelect = (key) => (e) => {
    const next = { ...formRef.current, [key]: Number(e.target.value) };
    setForm(next);
    persistNow(next);
  };
  const updateBoolean = (key) => (e) => {
    const next = { ...formRef.current, [key]: e.target.checked };
    setForm(next);
    persistNow(next);
  };

  const handleTest = async () => {
    setConnStatus('testing'); setConnMsg('');
    try {
      const r = await axios.get('/api/health', {
        params: {
          url: form.firecrawlUrl,
          apiKey: form.apiKey,
          bullAuthKey: form.bullAuthKey,
        },
      });
      if (r.data.status === 'healthy') {
        setConnStatus('ok');
        setConnMsg(`Connection successful · bullAuth=${r.data.bullAuth}`);
      } else if (r.data.status === 'degraded') {
        setConnStatus('warn');
        setConnMsg(`Firecrawl OK, Redis/Bull degraded · bullAuth=${r.data.bullAuth}`);
      } else {
        setConnStatus('error');
        setConnMsg(r.data.firecrawl?.error || r.data.error || 'Unhealthy status');
      }
    } catch (e) {
      setConnStatus('error');
      setConnMsg(e.response?.data?.error || e.message);
    }
  };

  const handleMaintenance = async () => {
    setConfirmAction(null);
    const result = await runMaintenance();
    if (result?.data) { setMaintenanceResult(result.data); fetchDbSize(); }
  };

  const handleTestNotification = async () => {
    setTestStatus('sending');
    setTestOutcome(null);
    try {
      const result = await testNotification();
      setTestOutcome(result);
    } catch (err) {
      setTestOutcome({ success: false, error: err.message });
    } finally {
      setTestStatus('done');
    }
  };

  const copyProxyUrl = () => {
    const baseUrl = getProxyBaseUrl();
    navigator.clipboard.writeText(baseUrl)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {});
  };

  const proxyBaseUrl = getProxyBaseUrl();

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--apple-text)' }}>{'\u2699\uFE0F'} Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--apple-text-secondary)', marginTop: 4 }}>
          Configure Firecrawl connection, proxy behavior, and dashboard preferences
        </p>
      </div>

      {error && (
        <div className="apple-error-banner rounded-apple p-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 13 }}>{'\u26A0'} {error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: 'var(--apple-red)', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <Card title="Connection" right={<SaveIndicator status={saveStatus} />}>
          <Field label="Firecrawl URL" hint="The remote Firecrawl server the proxy forwards to.">
            <input
              type="url"
              value={form.firecrawlUrl || ''}
              onChange={updateText('firecrawlUrl')}
              className="apple-input"
              placeholder="http://10.0.20.66:3002"
            />
          </Field>
          <Field label="API Key" hint="Injected as Bearer fallback when incoming client requests have no Authorization header.">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey || ''}
                onChange={updateText('apiKey')}
                className="apple-input"
                placeholder="fc-… (leave empty if not required)"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowKey(s => !s)}
                style={{ padding: '0 14px', borderRadius: 8, border: '1px solid var(--apple-separator)', background: 'var(--apple-surface)', color: 'var(--apple-text-secondary)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
          <Field label="Bull Admin Auth Key" hint="Required for BullMQ queue + Redis health cards. Server-side BULL_AUTH_KEY env var.">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showBullKey ? 'text' : 'password'}
                value={form.bullAuthKey || ''}
                onChange={updateText('bullAuthKey')}
                className="apple-input"
                placeholder="(leave empty to disable Bull/Redis metrics)"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowBullKey(s => !s)}
                style={{ padding: '0 14px', borderRadius: 8, border: '1px solid var(--apple-separator)', background: 'var(--apple-surface)', color: 'var(--apple-text-secondary)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
              >
                {showBullKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={handleTest}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--apple-separator)', background: 'var(--apple-surface)', color: 'var(--apple-text)', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
            >
              {connStatus === 'testing' ? 'Testing\u2026' : 'Test connection'}
            </button>
            {connStatus === 'ok'    && <span style={{ fontSize: 13, color: 'var(--apple-green)' }}>{'\u2713'} {connMsg}</span>}
            {connStatus === 'warn'  && <span style={{ fontSize: 13, color: '#FFA500' }}>{'\u26A0'} {connMsg}</span>}
            {connStatus === 'error' && <span style={{ fontSize: 13, color: 'var(--apple-red)' }}>{'\u2717'} {connMsg}</span>}
          </div>
        </Card>

        <Card title="Proxy URL">
          <p style={{ fontSize: 12, color: 'var(--apple-text-secondary)', margin: 0 }}>
            Point your Firecrawl SDK / curl / other clients at this URL instead of the Firecrawl server directly.
            All traffic will be transparently proxied and logged.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--apple-surface)',
              borderRadius: 8,
              padding: '10px 12px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 13,
            }}
          >
            <code style={{ flex: 1, wordBreak: 'break-all' }}>{proxyBaseUrl}</code>
            <button
              onClick={copyProxyUrl}
              style={{ fontSize: 12, color: 'var(--apple-blue)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {copied ? '\u2713 Copied' : 'Copy'}
            </button>
          </div>
          <details style={{ fontSize: 12, color: 'var(--apple-text-secondary)' }}>
            <summary style={{ cursor: 'pointer' }}>Usage examples</summary>
            <pre style={{ marginTop: 8, padding: 10, background: '#1D1D1F', color: '#F5F5F7', borderRadius: 6, overflowX: 'auto', fontSize: 11 }}>
{`# Python
from firecrawl import Firecrawl
firecrawl = Firecrawl(api_url="${proxyBaseUrl}")

# Node.js
const firecrawl = new Firecrawl({ apiUrl: "${proxyBaseUrl}" });

# curl
curl -X POST ${proxyBaseUrl}/v1/scrape \\
  -H 'Content-Type: application/json' \\
  -d '{"url":"https://example.com","formats":["markdown"]}'`}
            </pre>
          </details>
        </Card>

        <Card title="Observation">
          <Field label="Client IP resolution" hint="Honor X-Forwarded-For from upstream proxies. Off if the dashboard is directly exposed to untrusted networks.">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!form.proxyTrustForwardedFor}
                onChange={updateBoolean('proxyTrustForwardedFor')}
              />
              Trust X-Forwarded-For
            </label>
          </Field>
          <Field label="Debug: log full request/response bodies" hint="Stores full JSON per request. High disk usage. For debugging only.">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!form.debugLogBodies}
                onChange={updateBoolean('debugLogBodies')}
              />
              Log bodies to proxy_operations
            </label>
          </Field>
        </Card>

        <Card title="Notifications">
          <Field label="Enable notifications" hint="Master toggle. When off, no events are dispatched even if individual checks are enabled.">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!form.notificationsEnabled}
                onChange={updateBoolean('notificationsEnabled')}
              />
              Watch for critical events and dispatch alerts
            </label>
          </Field>

          <Field label="Events to notify on">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {NOTIFICATION_EVENTS.map(ev => (
                <label key={ev.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={!!form[ev.key]}
                    onChange={updateBoolean(ev.key)}
                  />
                  <span>{ev.label}</span>
                  <span
                    className="apple-badge"
                    style={{
                      fontSize: 10,
                      padding: '1px 8px',
                      background: ev.severity === 'critical' ? 'var(--apple-badge-error-bg)' : 'var(--apple-badge-info-bg)',
                      color: ev.severity === 'critical' ? 'var(--apple-red)' : 'var(--apple-blue)',
                    }}
                  >
                    {ev.severity}
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Dedup window" hint="Minimum minutes between consecutive alerts for the same event type.">
            <select value={form.notificationDedupMinutes || 15} onChange={updateSelect('notificationDedupMinutes')} className="apple-input">
              {DEDUP_OPTIONS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>

          <div style={{ borderTop: '1px solid var(--apple-separator)', paddingTop: 12, marginTop: 4 }}>
            <Field label="ntfy.sh destination">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={!!form.ntfyEnabled}
                  onChange={updateBoolean('ntfyEnabled')}
                />
                Send alerts to a ntfy topic
              </label>
            </Field>
            {form.ntfyEnabled && (
              <>
                <Field label="Server URL" hint="Use https://ntfy.sh for the public service, or your self-hosted instance URL.">
                  <input
                    type="url"
                    value={form.ntfyUrl || ''}
                    onChange={updateText('ntfyUrl')}
                    className="apple-input"
                    placeholder="https://ntfy.sh"
                  />
                </Field>
                <Field label="Topic" hint="Anyone subscribed to this topic will see your alerts. Use a long random string on the public service.">
                  <input
                    type="text"
                    value={form.ntfyTopic || ''}
                    onChange={updateText('ntfyTopic')}
                    className="apple-input"
                    placeholder="firecrawl-alerts-abc123"
                  />
                </Field>
                <Field label="Authentication">
                  <select value={form.ntfyAuthType || 'none'} onChange={updateText('ntfyAuthType')} className="apple-input">
                    <option value="none">None (public topic)</option>
                    <option value="basic">Basic auth (username + password)</option>
                    <option value="bearer">Bearer token</option>
                  </select>
                </Field>
                {form.ntfyAuthType === 'basic' && (
                  <Field label="Username">
                    <input
                      type="text"
                      value={form.ntfyUsername || ''}
                      onChange={updateText('ntfyUsername')}
                      className="apple-input"
                    />
                  </Field>
                )}
                {(form.ntfyAuthType === 'basic' || form.ntfyAuthType === 'bearer') && (
                  <Field label={form.ntfyAuthType === 'bearer' ? 'Token' : 'Password'}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type={showNtfyPassword ? 'text' : 'password'}
                        value={form.ntfyPassword || ''}
                        onChange={updateText('ntfyPassword')}
                        className="apple-input"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNtfyPassword(s => !s)}
                        style={{ padding: '0 14px', borderRadius: 8, border: '1px solid var(--apple-separator)', background: 'var(--apple-surface)', color: 'var(--apple-text-secondary)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
                      >
                        {showNtfyPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </Field>
                )}
                <Field label="Default priority" hint="1=min, 3=default, 5=urgent. Critical events auto-escalate to 5.">
                  <select value={form.ntfyPriority || 4} onChange={updateSelect('ntfyPriority')} className="apple-input">
                    {PRIORITY_OPTIONS.map(({ label, value }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--apple-separator)', paddingTop: 12, marginTop: 4 }}>
            <Field label="Generic webhook destination">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={!!form.webhookEnabled}
                  onChange={updateBoolean('webhookEnabled')}
                />
                POST JSON to a webhook URL
              </label>
            </Field>
            {form.webhookEnabled && (
              <>
                <Field label="Webhook URL" hint="HTTPS endpoint that accepts POST application/json.">
                  <input
                    type="url"
                    value={form.webhookUrl || ''}
                    onChange={updateText('webhookUrl')}
                    className="apple-input"
                    placeholder="https://webhook.example.com/hook"
                  />
                </Field>
                <Field label="Authorization header" hint='Complete header value, e.g. "Bearer xyz" or "Basic abcd". Leave empty for no auth.'>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type={showWebhookAuth ? 'text' : 'password'}
                      value={form.webhookAuthHeader || ''}
                      onChange={updateText('webhookAuthHeader')}
                      className="apple-input"
                      placeholder="Bearer xyz..."
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowWebhookAuth(s => !s)}
                      style={{ padding: '0 14px', borderRadius: 8, border: '1px solid var(--apple-separator)', background: 'var(--apple-surface)', color: 'var(--apple-text-secondary)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
                    >
                      {showWebhookAuth ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </Field>
              </>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--apple-separator)', paddingTop: 12, marginTop: 4 }}>
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={testStatus === 'sending' || (!form.ntfyEnabled && !form.webhookEnabled)}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--apple-surface)', color: 'var(--apple-text)', border: '1px solid var(--apple-separator)', cursor: 'pointer', fontSize: 13 }}
            >
              {testStatus === 'sending' ? 'Sending\u2026' : 'Send test notification'}
            </button>
            {!form.ntfyEnabled && !form.webhookEnabled && (
              <p style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 6 }}>
                Enable at least one destination above to test.
              </p>
            )}
            {testOutcome && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: 'var(--apple-surface)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                {testOutcome.skipped && (
                  <div style={{ color: 'var(--apple-text-secondary)' }}>
                    Skipped: {testOutcome.reason || 'no destinations enabled'}
                  </div>
                )}
                {testOutcome.data?.results && Object.entries(testOutcome.data.results).map(([dest, r]) => (
                  <div key={dest} style={{ color: r.ok ? 'var(--apple-green)' : 'var(--apple-red)' }}>
                    {r.ok ? '\u2713' : '\u2717'} {dest}: {r.ok ? `HTTP ${r.status}` : (r.error || `HTTP ${r.status}`)}
                  </div>
                ))}
                {testOutcome.error && (
                  <div style={{ color: 'var(--apple-red)' }}>
                    {'\u2717'} {testOutcome.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card title="Auto-refresh">
          <Field label="Dashboard UI refresh" hint="How often the dashboard re-fetches live metrics.">
            <select value={form.pollingInterval || 5000} onChange={updateSelect('pollingInterval')} className="apple-input">
              {POLLING_OPTIONS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Snapshot poller" hint="How often the backend snapshots /v1/team/* into server_metrics_snapshots for trend charts. Requires proxy restart to take effect.">
            <select value={form.snapshotPollInterval || 300000} onChange={updateSelect('snapshotPollInterval')} className="apple-input">
              {SNAPSHOT_POLL_OPTIONS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        </Card>

        <Card title="Data retention">
          <Field label="Proxy log retention" hint="Rows in proxy_operations older than this are pruned during housekeeping.">
            <select value={form.proxyRetentionDays ?? 30} onChange={updateSelect('proxyRetentionDays')} className="apple-input">
              {PROXY_RETENTION_OPTIONS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Proxy log max rows" hint="Oldest rows pruned when the table exceeds this row count.">
            <input
              type="number"
              value={form.proxyRetentionMaxRows ?? 100000}
              onChange={updateNumber('proxyRetentionMaxRows')}
              min="1000"
              max="10000000"
              step="10000"
              className="apple-input"
            />
          </Field>
          <Field label="Snapshot retention" hint="Rows in server_metrics_snapshots older than this are pruned.">
            <select value={form.snapshotRetentionDays ?? 90} onChange={updateSelect('snapshotRetentionDays')} className="apple-input">
              {SNAPSHOT_RETENTION_OPTIONS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          {dbSize && (
            <p style={{ fontSize: 12, color: 'var(--apple-text-secondary)', margin: 0 }}>
              Database size: <strong style={{ color: 'var(--apple-text)' }}>{dbSize}</strong>
            </p>
          )}
        </Card>
      </div>

      {/* Maintenance */}
      <div className="apple-card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Maintenance</h3>
        {maintenanceResult && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--apple-text-secondary)',
              background: 'var(--apple-surface)',
              borderRadius: 8,
              padding: 10,
              marginBottom: 10,
            }}
          >
            Proxy ops pruned: {maintenanceResult.proxyOpsAgeDeleted} (age) + {maintenanceResult.proxyOpsRowLimitDeleted} (row limit).{' '}
            Snapshots pruned: {maintenanceResult.snapshotsAgeDeleted}.{' '}
            DB: {maintenanceResult.dbSizeBefore} {'\u2192'} {maintenanceResult.dbSizeAfter}
          </div>
        )}
        {confirmAction === 'maintenance' ? (
          <ConfirmPair onConfirm={handleMaintenance} onCancel={() => setConfirmAction(null)} />
        ) : (
          <button
            onClick={() => setConfirmAction('maintenance')}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--apple-surface)', color: 'var(--apple-text)', border: '1px solid var(--apple-separator)', cursor: 'pointer', fontSize: 13 }}
          >
            Run maintenance now
          </button>
        )}
      </div>
    </div>
  );
}
