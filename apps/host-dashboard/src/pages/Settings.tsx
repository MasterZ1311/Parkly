import React, { useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { commonApi } from '../utils/apiClient';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Settings() {
  useDocumentTitle('Account & Spot Settings');
  const { user, setUser } = useAuthStore();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    bankAccount: '',
    notifyBookings: true,
    notifyPayouts: true,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await commonApi.updateProfile({
        name: form.name.trim() || undefined,
        email: form.email.trim() || undefined,
        bankAccount: form.bankAccount.trim() || undefined,
      });
      const updatedUser = data?.data?.user;
      if (updatedUser) {
        setUser(updatedUser);
      } else if (user) {
        setUser({ ...user, name: form.name.trim(), email: form.email.trim() });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Could not save changes.');
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
          <p className="page-subtitle">Manage host verification profile, registered bank details, and notification channels.</p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 560 }} onSubmit={handleSave}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>Profile</h3>

        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full Name" />
        </div>
        <div className="form-group">
          <label className="form-label">Verified Phone</label>
          <input className="form-input" value={form.phone} disabled style={{ opacity: 0.65 }} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="host@parkly.in" />
        </div>
        <div className="form-group">
          <label className="form-label">Payout Bank Account / Reference</label>
          <input className="form-input" value={form.bankAccount} onChange={e => setForm({ ...form, bankAccount: e.target.value })} placeholder="Optional bank account reference" />
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '20px 0', color: 'var(--text-primary)' }}>Notifications</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.notifyBookings} onChange={e => setForm({ ...form, notifyBookings: e.target.checked })} />
          <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Notify me on new bookings</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.notifyPayouts} onChange={e => setForm({ ...form, notifyPayouts: e.target.checked })} />
          <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Notify me on payout processed</span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>✅ Saved</span>}
          {error && <span style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>{error}</span>}
        </div>
      </form>
    </div>
  );
}
