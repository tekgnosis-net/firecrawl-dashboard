import { useState, useEffect } from 'react';
import axios from 'axios';
import { useStore } from '../store';

const POLLING_OPTIONS = [
  { label: '5 seconds', value: 5000 },
  { label: '10 seconds', value: 10000 },
  { label: '30 seconds', value: 30000 },
  { label: '60 seconds', value: 60000 },
  { label: 'Off', value: 0 },
];

const RETENTION_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
  { label: 'Unlimited', value: 0 },
];

export function SettingsPage() {
  const { settings, saveSettings, loading, error, clearError, clearHistory, runMaintenance } = useStore();
  const [form, setForm] = useState({ ...settings });
  const [showKey, setShowKey] = useState(false);
  const [connStatus, setConnStatus] = useState(null);
  const [connMsg, setConnMsg] = useState('');
  const [dbSize, setDbSize] = useState(null);
  const [maintenanceResult, setMaintenanceResult] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchDbSize = () => {
    axios.get('/api/stats/dbsize').then(r => { if (r.data.success) setDbSize(r.data.data.formatted); }).catch(() => {});
  };

  useEffect(() => { setForm({ ...settings }); fetchDbSize(); }, [settings]);

  const handleTest = async () => {
    setConnStatus('testing'); setConnMsg('');
    try {
      const r = await axios.get('/api/health');
      if (r.data.status === 'healthy') { setConnStatus('ok'); setConnMsg('Connection successful'); }
      else { setConnStatus('error'); setConnMsg(r.data.error || 'Unhealthy status'); }
    } catch (e) { setConnStatus('error'); setConnMsg(e.response?.data?.error || e.message); }
  };

  const handleSave = async (e) => { e.preventDefault(); await saveSettings(form); };

  const handleClearHistory = async (type) => {
    setConfirmAction(null);
    await clearHistory(type);
    fetchDbSize();
  };

  const handleMaintenance = async () => {
    setConfirmAction(null);
    const result = await runMaintenance();
    if (result?.data) { setMaintenanceResult(result.data); fetchDbSize(); }
  };

  const Field = ({ label, children }) => (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', display: 'block', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );

  const Card = ({ title, children }) => (
    <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', margin: 0 }}>{title}</h3>
      {children}
    </div>
  );

  const ConfirmPair = ({ onConfirm }) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={onConfirm} style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--apple-red)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Confirm</button>
      <button onClick={() => setConfirmAction(null)} style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--apple-surface)', color: 'var(--apple-text)', border: '1px solid var(--apple-separator)', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
    </div>
  );

  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--apple-text)' }}>⚙️ Settings</h1>
        <p style={{ fontSize: '13px', color: 'var(--apple-text-secondary)', marginTop: '4px' }}>Configure your Firecrawl connection and dashboard preferences</p>
      </div>

      {error && (
        <div className="apple-error-banner rounded-apple p-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px' }}>⚠️ {error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: 'var(--apple-red)', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Card title="Connection">
          <Field label="Firecrawl URL">
            <input type="url" value={form.firecrawlUrl} onChange={e => setForm(f => ({ ...f, firecrawlUrl: e.target.value }))} className="apple-input" placeholder="http://10.0.20.66:3002" />
          </Field>
          <Field label="API Key">
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type={showKey ? 'text' : 'password'} value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} className="apple-input" placeholder="fc-… (leave empty if not required)" style={{ flex: 1 }} />
              <button type="button" onClick={() => setShowKey(s => !s)} style={{ padding: '0 14px', borderRadius: '8px', border: '1px solid var(--apple-separator)', background: 'var(--apple-surface)', color: 'var(--apple-text-secondary)', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>{showKey ? 'Hide' : 'Show'}</button>
            </div>
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" onClick={handleTest} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--apple-separator)', background: 'var(--apple-surface)', color: 'var(--apple-text)', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}>
              {connStatus === 'testing' ? 'Testing…' : 'Test Connection'}
            </button>
            {connStatus === 'ok'    && <span style={{ fontSize: '13px', color: 'var(--apple-green)' }}>✓ {connMsg}</span>}
            {connStatus === 'error' && <span style={{ fontSize: '13px', color: 'var(--apple-red)' }}>✗ {connMsg}</span>}
          </div>
        </Card>

        <Card title="Auto-Refresh">
          <Field label="Refresh interval">
            <select value={form.pollingInterval} onChange={e => setForm(f => ({ ...f, pollingInterval: Number(e.target.value) }))} className="apple-input">
              {POLLING_OPTIONS.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
        </Card>

        <Card title="Data Retention">
          <Field label="Keep history for">
            <select value={form.retentionDays} onChange={e => setForm(f => ({ ...f, retentionDays: Number(e.target.value) }))} className="apple-input">
              {RETENTION_OPTIONS.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Max rows per history table">
            <input type="number" value={form.retentionMaxRows} onChange={e => setForm(f => ({ ...f, retentionMaxRows: Number(e.target.value) }))} min="100" max="100000" step="500" className="apple-input" />
            <p style={{ fontSize: '11px', color: 'var(--apple-text-secondary)', marginTop: '4px' }}>Oldest rows pruned automatically when limit exceeded.</p>
          </Field>
          {dbSize && <p style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', margin: 0 }}>Database size: <strong style={{ color: 'var(--apple-text)' }}>{dbSize}</strong></p>}
        </Card>

        <button type="submit" className="apple-button" disabled={loading}>{loading ? 'Saving…' : 'Save Settings'}</button>
      </form>

      {/* Data Management (outside form — destructive actions) */}
      <div className="apple-card" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--apple-text)', marginBottom: '12px' }}>Data Management</h3>
        {['scrape', 'search', 'map'].map(type => (
          <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--apple-separator)' }}>
            <span style={{ fontSize: '13px', color: 'var(--apple-text)', textTransform: 'capitalize' }}>Clear {type} history</span>
            {confirmAction === type
              ? <ConfirmPair onConfirm={() => handleClearHistory(type)} />
              : <button onClick={() => setConfirmAction(type)} style={{ padding: '6px 14px', borderRadius: '6px', background: 'transparent', color: 'var(--apple-red)', border: '1px solid var(--apple-red)', cursor: 'pointer', fontSize: '12px' }}>Clear</button>
            }
          </div>
        ))}
        <div style={{ paddingTop: '12px' }}>
          {maintenanceResult && (
            <div style={{ fontSize: '12px', color: 'var(--apple-text-secondary)', background: 'var(--apple-surface)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
              Pruned: {maintenanceResult.scrapes} scrapes, {maintenanceResult.searches} searches, {maintenanceResult.maps} maps, {maintenanceResult.crawls} crawls.
              {maintenanceResult.dbSizeBefore && ` DB: ${maintenanceResult.dbSizeBefore} → ${maintenanceResult.dbSizeAfter}`}
            </div>
          )}
          {confirmAction === 'maintenance'
            ? <ConfirmPair onConfirm={handleMaintenance} />
            : <button onClick={() => setConfirmAction('maintenance')} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--apple-surface)', color: 'var(--apple-text)', border: '1px solid var(--apple-separator)', cursor: 'pointer', fontSize: '13px' }}>Run Maintenance Now</button>
          }
        </div>
      </div>
    </div>
  );
}
