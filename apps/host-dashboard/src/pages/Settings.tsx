import React, { useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { commonApi } from '../utils/api';

export default function Settings() {
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
      // Keep the in-memory user in sync with the saved profile.
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and preferences</p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 560 }} onSubmit={handleSave}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>Profile</h3>

        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Payout Bank Account</label>
          <input className="form-input" value={form.bankAccount} onChange={e => setForm({ ...form, bankAccount: e.target.value })} />
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '20px 0', color: 'var(--text-primary)' }}>Notifications</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.notifyBookings} onChange={e => setForm({ ...form, notifyBookings: e.target.checked })} />
          <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Email me on new bookings</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.notifyPayouts} onChange={e => setForm({ ...form, notifyPayouts: e.target.checked })} />
          <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Email me on payout processed</span>
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
