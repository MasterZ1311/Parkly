import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import { commonApi } from '../utils/api';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Settings() {
  useDocumentTitle('Account & Spot Settings');
  const { user, setUser } = useAuthStore();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: user?.name || 'Ravi Kumar',
    phone: user?.phone || '+91 98765 43210',
    email: user?.email || 'ravi@example.com',
    bankAccount: 'SBI ***1234',
    notifyBookings: true,
    notifyPayouts: true,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await commonApi.updateProfile({
        name: form.name,
        phone: form.phone,
        email: form.email,
        bankAccount: form.bankAccount,
        notifyBookings: form.notifyBookings,
        notifyPayouts: form.notifyPayouts,
      });
      if (user) {
        const updated = { ...user, name: form.name, phone: form.phone, email: form.email };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(data?.user ?? updated));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Settings' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Account &amp; Spot Settings</h1>
          <p className="page-subtitle">
            Manage host verification profile, registered bank account details, and notification channels.
          </p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 560 }} onSubmit={handleSave}>
        <h2 className="card-title" style={{ marginBottom: 18 }}>Host Profile</h2>

        <div className="form-group">
          <label className="form-label" htmlFor="host-name">Full Name</label>
          <input
            id="host-name"
            className="form-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="host-phone">Phone Number</label>
          <input
            id="host-phone"
            className="form-input mono-num"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="host-email">Email Address</label>
          <input
            id="host-email"
            className="form-input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="host-bank">Payout Bank Account</label>
          <input
            id="host-bank"
            className="form-input mono-num"
            value={form.bankAccount}
            onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
          />
        </div>

        <h2 className="card-title" style={{ margin: '22px 0 12px' }}>Alert Preferences</h2>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.notifyBookings}
            onChange={(e) => setForm({ ...form, notifyBookings: e.target.checked })}
          />
          <span>Email me when a new reservation is created</span>
        </label>
        <label className="checkbox-row" style={{ marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={form.notifyPayouts}
            onChange={(e) => setForm({ ...form, notifyPayouts: e.target.checked })}
          />
          <span>Email me when bank settlements complete</span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }} aria-live="polite">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link to="/verification-status" className="btn btn-outline">
            KYC &amp; Verification Status
          </Link>
          {saved && <span className="badge badge-green">Changes saved</span>}
          {error && <span className="badge badge-red">{error}</span>}
        </div>
      </form>
    </div>
  );
}
