import { useEffect, useState, type FormEvent } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { adminApi } from '../utils/apiClient';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Settings() {
  useDocumentTitle('System & Operational Settings');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    platformName: 'Parkly',
    supportEmail: 'support@parkly.in',
    city: 'Chennai',
    platformFee: '5',
    autoApprove: false,
    maintenanceMode: false,
  });

  useEffect(() => {
    adminApi
      .getSettings()
      .then((res) => {
        const s = res.data?.data?.settings || {};
        setForm({
          platformName: s.platformName || 'Parkly',
          supportEmail: s.supportEmail || 'support@parkly.in',
          city: s.defaultCity || s.city || 'Chennai',
          platformFee: s.platformFeePercent || s.platformFee || '5',
          autoApprove: s.autoApproveVerifiedHosts === 'true' || s.autoApprove === 'true',
          maintenanceMode: s.maintenanceMode === 'true',
        });
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message || err.message || 'Unable to load system settings');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await adminApi.updateSettings({
        platformName: form.platformName,
        supportEmail: form.supportEmail,
        defaultCity: form.city,
        platformFeePercent: form.platformFee,
        autoApproveVerifiedHosts: String(form.autoApprove),
        maintenanceMode: String(form.maintenanceMode),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to persist settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Settings' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">System &amp; Operational Settings</h1>
          <p className="page-subtitle">Database-persisted platform configuration.</p>
        </div>
      </div>

      {error && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
        </div>
      )}

      <form className="card" style={{ maxWidth: 560 }} onSubmit={handleSave}>
        <h2 className="card-title" style={{ marginBottom: 18 }}>General</h2>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 16 }}>Loading settings...</div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="set-name">Platform Name</label>
              <input
                id="set-name"
                className="form-input"
                value={form.platformName}
                onChange={(e) => setForm({ ...form, platformName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="set-email">Support Email</label>
              <input
                id="set-email"
                className="form-input"
                type="email"
                value={form.supportEmail}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="set-city">Default Active City</label>
              <input
                id="set-city"
                className="form-input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="set-fee">Platform Service Fee (%)</label>
              <input
                id="set-fee"
                className="form-input mono-num"
                type="number"
                value={form.platformFee}
                onChange={(e) => setForm({ ...form, platformFee: e.target.value })}
              />
            </div>

            <h2 className="card-title" style={{ margin: '20px 0 14px' }}>Operations</h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.autoApprove}
                onChange={(e) => setForm({ ...form, autoApprove: e.target.checked })}
              />
              <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Auto-approve AI-verified hosts</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.maintenanceMode}
                onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
              />
              <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Maintenance mode</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && <span className="badge badge-green">Changes saved</span>}
            </div>
          </>
        )}
      </form>
    </div>
  );
}
