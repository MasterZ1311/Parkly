import React, { useEffect, useState } from 'react';
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
    supportEmail: 'support@parkly.app',
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
          supportEmail: s.supportEmail || 'support@parkly.app',
          city: s.defaultCity || s.city || 'Chennai',
          platformFee: s.platformFeePercent || s.platformFee || '5',
          autoApprove: s.autoApproveVerifiedHosts === 'true',
          maintenanceMode: s.maintenanceMode === 'true',
        });
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message || 'Unable to load system settings');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
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
      setError(err.response?.data?.error?.message || 'Failed to persist settings');
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
          <p className="page-subtitle">Database-persisted platform configuration</p>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <form className="card" style={{ maxWidth: 560 }} onSubmit={handleSave}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>General</h3>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 16 }}>Loading settings...</div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Platform Name</label>
              <input className="form-input" value={form.platformName} onChange={e => setForm({ ...form, platformName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Support Email</label>
              <input className="form-input" type="email" value={form.supportEmail} onChange={e => setForm({ ...form, supportEmail: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Default Active City</label>
              <input className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Platform Service Fee (%)</label>
              <input className="form-input" type="number" value={form.platformFee} onChange={e => setForm({ ...form, platformFee: e.target.value })} />
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '20px 0', color: 'var(--text-primary)' }}>Operations</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.autoApprove} onChange={e => setForm({ ...form, autoApprove: e.target.checked })} />
              <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Auto-approve AI-verified hosts</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.maintenanceMode} onChange={e => setForm({ ...form, maintenanceMode: e.target.checked })} />
              <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Maintenance mode</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>✅ Saved</span>}
            </div>
          </>
        )}
      </form>
    </div>
  );
}
