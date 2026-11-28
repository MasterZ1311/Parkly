import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
    ifscCode: '',
    notifyBookings: true,
    notifyPayouts: true,
  });

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const { data } = await commonApi.updateProfile({
        name: form.name.trim() || undefined,
        email: form.email.trim() || undefined,
        bankAccount: form.bankAccount.trim() || undefined,
        ifscCode: form.ifscCode.trim() || undefined,
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
          <p className="page-subtitle">
            Manage host verification profile, registered bank details, and notification channels.
          </p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 560 }} onSubmit={handleSave}>
        <h2 className="card-title" style={{ marginBottom: 18 }}>Profile</h2>

        <div className="form-group">
          <label className="form-label" htmlFor="host-set-name">Full Name</label>
          <input
            id="host-set-name"
            className="form-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full Name"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="host-set-phone">Verified Phone</label>
          <input
            id="host-set-phone"
            className="form-input mono-num"
            value={form.phone}
            disabled
            style={{ opacity: 0.65 }}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="host-set-email">Email</label>
          <input
            id="host-set-email"
            className="form-input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="host@parkly.in"
          />
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="host-set-bank">Payout Bank Account</label>
            <input
              id="host-set-bank"
              className="form-input mono-num"
              value={form.bankAccount}
              onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              placeholder="Optional account number"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="host-set-ifsc">IFSC Code</label>
            <input
              id="host-set-ifsc"
              className="form-input mono-num"
              value={form.ifscCode}
              onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })}
              placeholder="SBIN0001234"
            />
          </div>
        </div>

        <h2 className="card-title" style={{ margin: '20px 0 14px' }}>Notifications</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.notifyBookings}
            onChange={(e) => setForm({ ...form, notifyBookings: e.target.checked })}
          />
          <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Notify me on new bookings</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.notifyPayouts}
            onChange={(e) => setForm({ ...form, notifyPayouts: e.target.checked })}
          />
          <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>Notify me on payout processed</span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
