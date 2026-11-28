import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import { isDemoModeEnabled, setDemoModeEnabled } from '../utils/apiClient';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { ParklyLogoMark, PhoneIcon, CheckCircleIcon } from '../components/Icons';

export default function Login() {
  useDocumentTitle('Operator Sign In');
  const navigate = useNavigate();
  const { requestOtp, login, isLoading, error, clearError } = useAuthStore();

  const [phone, setPhone] = useState('9840000001');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [localError, setLocalError] = useState('');
  const [demoMode, setDemoMode] = useState(() => isDemoModeEnabled());

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(-10);
    return digits.length === 10 ? `+91${digits}` : raw.trim();
  };

  const handleToggleDemo = (next: boolean) => {
    setDemoModeEnabled(next);
    setDemoMode(next);
    clearError();
    setLocalError('');
    setStatusMsg('');
  };

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError('');
    const formatted = formatPhone(phone);
    if (!/^\+91[6-9]\d{9}$/.test(formatted)) {
      setLocalError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    try {
      const { devOtp } = await requestOtp(formatted);
      setOtpSent(true);
      setStatusMsg(devOtp ? `OTP dispatched (dev code: ${devOtp}).` : '6-digit verification code sent via DLT SMS.');
      if (devOtp) setOtp(String(devOtp));
    } catch (err: any) {
      setLocalError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Unable to reach Parkly Auth Gateway. Check connectivity or enable Demo Mode below.',
      );
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError('');
    const trimmed = otp.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setLocalError('Enter the 6-digit OTP code.');
      return;
    }

    try {
      await login(formatPhone(phone), trimmed);
      navigate('/', { replace: true });
    } catch (err: any) {
      setLocalError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          'Invalid OTP or insufficient admin privileges.',
      );
    }
  };

  const handleEnterDemoConsole = async () => {
    handleToggleDemo(true);
    try {
      await login('+919840000001', '123456');
      navigate('/', { replace: true });
    } catch (err: any) {
      setLocalError(err.message || 'Unable to enter demo console.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', padding: '32px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#FFFFFF', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ParklyLogoMark size={24} />
          </div>
          <div>
            <div className="card-meta">GCC OPERATIONS COMMAND</div>
            <h1 className="page-title" style={{ fontSize: 22 }}>Parkly Admin Sign In</h1>
          </div>
        </div>

        <p className="page-subtitle" style={{ marginBottom: 20, lineHeight: 1.55 }}>
          Sign in with an authorized Admin operator number to inspect host KYC queues, dispute arbitration, and corridor telemetry.
        </p>

        {statusMsg && (
          <div className="status-banner status-banner--success" style={{ marginBottom: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleIcon size={16} />
              {statusMsg}
            </span>
          </div>
        )}

        {(localError || error) && (
          <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
            <span>{localError || error}</span>
          </div>
        )}

        {!otpSent ? (
          <form onSubmit={handleRequestOtp}>
            <div className="form-group">
              <label className="form-label" htmlFor="admin-phone">Operator Mobile (+91)</label>
              <input
                id="admin-phone"
                className="form-input mono-num"
                type="tel"
                maxLength={13}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9840000001"
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading}>
              <PhoneIcon size={16} />
              {isLoading ? 'Sending OTP...' : 'Send Operator OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <div className="form-group">
              <label className="form-label" htmlFor="admin-otp">6-Digit OTP for {formatPhone(phone)}</label>
              <input
                id="admin-otp"
                className="form-input mono-num"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setOtpSent(false);
                  setStatusMsg('');
                  setOtp('');
                }}
              >
                Change Number
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify & Enter Console'}
              </button>
            </div>
          </form>
        )}

        {/* Opt-in Demo Mode Switch */}
        <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: 'var(--surface-light)', border: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Demo Mode (Offline Sample Dataset)
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                Off by default. Enable to explore command center with built-in Chennai fixtures.
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Enable Demo Mode"
              checked={demoMode}
              onChange={(e) => handleToggleDemo(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
          </label>
          {demoMode && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', marginTop: 10 }}
              onClick={handleEnterDemoConsole}
              disabled={isLoading}
            >
              Enter Demo Admin Console
            </button>
          )}
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 12.5 }}>
          <Link to="/unauthorized" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
            RBAC Access Policy
          </Link>
          <Link to="/offline" style={{ color: 'var(--accent-cta)', fontWeight: 700, textDecoration: 'none' }}>
            Gateway Diagnostics
          </Link>
        </div>
      </div>
    </div>
  );
}
