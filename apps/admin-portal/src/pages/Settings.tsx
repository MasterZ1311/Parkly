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
          <p className="page-subtitle">Regional commission parameters, onboarding controls, and operational toggles.</p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 560 }} onSubmit={handleSave}>
        <h2 className="card-title" style={{ marginBottom: 18 }}>General Parameters</h2>

        <div className="form-group">
          <label className="form-label" htmlFor="cfg-name">Platform Name</label>
          <input
            id="cfg-name"
            className="form-input"
            value={form.platformName}
            onChange={(e) => setForm({ ...form, platformName: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cfg-email">Support Email</label>
          <input
            id="cfg-email"
            className="form-input"
            type="email"
            value={form.supportEmail}
            onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cfg-city">Active Region / City</label>
          <input
            id="cfg-city"
            className="form-input"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cfg-fee">Platform Fee (%)</label>
          <input
            id="cfg-fee"
            className="form-input mono-num"
            type="number"
            value={form.platformFee}
            onChange={(e) => setForm({ ...form, platformFee: e.target.value })}
          />
        </div>

        <h2 className="card-title" style={{ margin: '22px 0 12px' }}>Operational Controls</h2>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.autoApprove}
            onChange={(e) => setForm({ ...form, autoApprove: e.target.checked })}
          />
          <span>Auto-approve KYC verified hosts</span>
        </label>
        <label className="checkbox-row" style={{ marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={form.maintenanceMode}
            onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
          />
          <span>Maintenance mode (pause new bookings)</span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} aria-live="polite">
          <button className="btn btn-primary" type="submit">
            Save Changes
          </button>
          {saved && <span className="badge badge-green">Configuration saved</span>}
        </div>
      </form>
    </div>
  );
}
