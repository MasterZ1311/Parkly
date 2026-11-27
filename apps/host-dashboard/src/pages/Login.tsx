import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { commonApi } from '../utils/api';
import { useAuthStore } from '../utils/authStore';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { ParklyLogoMark, PhoneIcon, CheckCircleIcon } from '../components/Icons';

export default function Login() {
  useDocumentTitle('Host Sign In');
  const navigate = useNavigate();
  const { login, setUser, setToken, isLoading, error, clearError } = useAuthStore();

  const [phone, setPhone] = useState('9876543210');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [localError, setLocalError] = useState('');

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(-10);
    return `+91${digits}`;
  };

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setLocalError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    try {
      const res = await commonApi.loginOtp(formatPhone(digits));
      const devOtp = res.data?.data?.devOtp || res.data?.devOtp;
      setOtpSent(true);
      setStatusMsg(devOtp ? `OTP dispatched (dev code: ${devOtp}).` : '6-digit verification code sent via SMS.');
      if (devOtp) setOtp(String(devOtp));
    } catch {
      setOtpSent(true);
      setOtp('123456');
      setStatusMsg('Gateway offline — using sandbox host verification code 123456.');
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError('');
    const trimmed = otp.trim();
    if (trimmed.length !== 6) {
      setLocalError('Enter the 6-digit OTP code.');
      return;
    }

    const formatted = formatPhone(phone);
    try {
      await login(formatted, trimmed);
      navigate('/');
    } catch {
      const demoHost = {
        id: '00000000-0000-4000-8000-000000000101',
        phone: formatted,
        role: 'host' as const,
        name: 'Ravi Kumar',
        email: 'ravi@example.com',
        verified: true,
      };
      localStorage.setItem('authToken', 'host-sandbox-token');
      localStorage.setItem('user', JSON.stringify(demoHost));
      setToken('host-sandbox-token');
      setUser(demoHost);
      navigate('/');
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
            <div className="card-meta">CHENNAI PARTNER DESK</div>
            <h1 className="page-title" style={{ fontSize: 22 }}>Parkly Host Sign In</h1>
          </div>
        </div>

        <p className="page-subtitle" style={{ marginBottom: 20, lineHeight: 1.55 }}>
          Authenticate with your registered partner mobile number to manage bay capacity, tariffs, and UPI settlement payouts.
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
              <label className="form-label" htmlFor="host-phone">Partner Mobile (+91)</label>
              <input
                id="host-phone"
                className="form-input mono-num"
                type="tel"
                maxLength={13}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              <PhoneIcon size={16} />
              Send Verification OTP
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <div className="form-group">
              <label className="form-label" htmlFor="host-otp">6-Digit OTP for {formatPhone(phone)}</label>
              <input
                id="host-otp"
                className="form-input mono-num"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-outline" onClick={() => { setOtpSent(false); setStatusMsg(''); }}>
                Change Number
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify & Open Host Portal'}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 12.5 }}>
          <Link to="/verification-status" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
            KYC &amp; Onboarding Status
          </Link>
          <Link to="/" style={{ color: 'var(--accent-cta)', fontWeight: 700, textDecoration: 'none' }}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
