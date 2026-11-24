import React, { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Settings() {
  useDocumentTitle('System & Operational Settings');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    platformName: 'Parkly',
    supportEmail: 'support@parkly.app',
    city: 'Chennai',
    platformFee: '20',
    autoApprove: false,
    maintenanceMode: false,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Settings' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">System &amp; Operational Settings</h1>
          <p className="page-subtitle">Platform configuration</p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 560 }} onSubmit={handleSave}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>General</h3>

        <div className="form-group">
          <label className="form-label">Platform Name</label>
          <input className="form-input" value={form.platformName} onChange={e => setForm({ ...form, platformName: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Support Email</label>
          <input className="form-input" type="email" value={form.supportEmail} onChange={e => setForm({ ...form, supportEmail: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Active City</label>
          <input className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Platform Fee (%)</label>
          <input className="form-input" type="number" value={form.platformFee} onChange={e => setForm({ ...form, platformFee: e.target.value })} />
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '20px 0', color: 'var(--text-primary)' }}>Operations</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.autoApprove} onChange={e => setForm({ ...form, autoApprove: e.target.checked })} />
          <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Auto-approve verified hosts</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.maintenanceMode} onChange={e => setForm({ ...form, maintenanceMode: e.target.checked })} />
          <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Maintenance mode</span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-primary" type="submit">Save Changes</button>
          {saved && <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>✅ Saved</span>}
        </div>
      </form>
    </div>
  );
}
