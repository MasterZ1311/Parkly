import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Login() {
  useDocumentTitle('Host Sign In');
  const navigate = useNavigate();
  const { requestOtp, login, isLoading, error, clearError } = useAuthStore();

  const [phone, setPhone] = useState('9840123456');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | undefined>(undefined);
  const [localError, setLocalError] = useState('');

  const normalizePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(-10);
    return digits.length === 10 ? `+91${digits}` : raw.trim();
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();
    const normalized = normalizePhone(phone);
    if (!/^\+91[6-9]\d{9}$/.test(normalized)) {
      setLocalError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    try {
      const { devOtp } = await requestOtp(normalized);
      setOtpSent(true);
      if (devOtp) {
        setDevOtpHint(devOtp);
        setOtp(devOtp);
      }
    } catch (err: any) {
      setLocalError(err.response?.data?.error?.message || 'Unable to request OTP.');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();
    if (!/^\d{6}$/.test(otp.trim())) {
      setLocalError('Enter the 6-digit OTP code.');
      return;
    }
    try {
      await login(normalizePhone(phone), otp.trim());
      navigate('/', { replace: true });
    } catch (err: any) {
      setLocalError(err.response?.data?.error?.message || err.message || 'Invalid OTP or insufficient permissions.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg-primary)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div className="logo-badge">
            <img src="/logo.png" alt="Parkly Logo" className="logo-img" />
          </div>
          <div>
            <div className="logo-name">Parkly</div>
            <div className="logo-sub">Host Portal</div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: 'var(--text-primary)' }}>
          {otpSent ? 'Verify One-Time Password' : 'Host Partner Sign In'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
          {otpSent
            ? `Enter the 6-digit verification code sent to ${normalizePhone(phone)}.`
            : 'Manage your parking spaces, live occupancy, pricing, and payouts.'}
        </p>

        {(localError || error) && (
          <div className="alert-error">{localError || error}</div>
        )}

        {!otpSent ? (
          <form onSubmit={handleRequestOtp}>
            <div className="form-group">
              <label className="form-label">Registered Mobile Number (+91)</label>
              <input
                type="tel"
                className="form-input"
                placeholder="9840123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} type="submit" disabled={isLoading}>
              {isLoading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            {devOtpHint && (
              <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#6EE7B7', fontSize: 12, fontWeight: 600 }}>
                Verification code auto-filled: {devOtpHint}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">6-Digit OTP</label>
              <input
                type="text"
                className="form-input"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} type="submit" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Verify & Open Dashboard'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                setOtpSent(false);
                setOtp('');
                setDevOtpHint(undefined);
                setLocalError('');
              }}
            >
              Change Phone Number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
