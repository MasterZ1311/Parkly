import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import { useListings } from '../hooks/useHostData';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { ShieldCheckIcon, CheckCircleIcon, ClockIcon } from '../components/Icons';

export default function VerificationStatus() {
  useDocumentTitle('Host KYC & Space Verification Status');
  const { listings } = useListings();
  const pendingSpaces = listings.filter((item) => item.status !== 'active');

  const checklist = [
    { step: 'Partner Identity & GST / PAN KYC', state: 'Verified', tone: 'badge-green', detail: 'Partner account authenticated via DLT SMS and PAN checksum verified.' },
    { step: 'AI Visual Bay & Surface Audit', state: pendingSpaces.length > 0 ? 'Action Needed' : 'Completed', tone: pendingSpaces.length > 0 ? 'badge-yellow' : 'badge-green', detail: 'Requires clear daytime entry photo and bay marking verification for Anna Nagar Multi-Level.' },
    { step: 'UPI / NEFT Settlement Mandate', state: 'Verified', tone: 'badge-green', detail: 'Configured for automated weekly T+2 INR settlement runs.' },
  ];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Settings', path: '/settings' }, { label: 'Verification & KYC' }]} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Host Onboarding &amp; KYC Status</h1>
          <p className="page-subtitle">Track property compliance, AI visual audits, and Razorpay Route payout eligibility.</p>
        </div>
        <Link to="/listings" className="btn btn-primary">
          Open My Spaces
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheckIcon size={18} />
            Compliance Milestones
          </h2>
          <span className={`badge ${pendingSpaces.length > 0 ? 'badge-yellow' : 'badge-green'}`}>
            {pendingSpaces.length > 0 ? `${pendingSpaces.length} Pending Listing Review` : 'All Spaces Live'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {checklist.map((item) => (
            <div key={item.step} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, padding: 14, borderRadius: 8, background: 'var(--surface-light)', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
                  {item.tone === 'badge-green' ? <CheckCircleIcon size={15} /> : <ClockIcon size={15} />}
                  {item.step}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{item.detail}</p>
              </div>
              <span className={`badge ${item.tone}`}>{item.state}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="card-title">Need Document Re-Evaluation?</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Trigger AI visual inspection from My Spaces or update bank details in Account Settings.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/settings" className="btn btn-outline btn-sm">Account &amp; Bank Settings</Link>
          <a href="mailto:host-support@parkly.in" className="btn btn-secondary btn-sm">Contact Onboarding Desk</a>
        </div>
      </div>
    </div>
  );
}
