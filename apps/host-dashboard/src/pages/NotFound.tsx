import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { ParkingIcon } from '../components/Icons';

export default function NotFound() {
  useDocumentTitle('404 Page Not Found');

  return (
    <div style={{ maxWidth: 660, margin: '36px auto' }}>
      <Breadcrumbs items={[{ label: '404 Not Found' }]} />

      <div className="card" style={{ padding: '44px 32px', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            background: 'var(--surface-light)',
            border: '1px solid var(--border)',
            color: 'var(--accent-cta)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <ParkingIcon size={30} />
        </div>
        <div className="card-meta" style={{ marginBottom: 8 }}>HTTP 404</div>
        <h1 className="page-title" style={{ fontSize: 26, marginBottom: 10 }}>
          Parking Route or Resource Not Found
        </h1>
        <p className="page-subtitle" style={{ lineHeight: 1.6, maxWidth: 460, margin: '0 auto 28px' }}>
          The parking management view or resource you requested does not exist, has been archived, or uses an expired link.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-primary">
            Back to Dashboard
          </Link>
          <Link to="/listings" className="btn btn-outline">
            View My Spaces
          </Link>
          <Link to="/bookings" className="btn btn-outline">
            Check Reservations
          </Link>
        </div>

        <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 18, fontSize: 12.5, color: 'var(--text-muted)' }}>
          Need assistance with your listing? Contact{' '}
          <a href="mailto:host-support@parkly.in" style={{ color: 'var(--accent-cta)', fontWeight: 700, textDecoration: 'none' }}>
            host-support@parkly.in
          </a>
        </div>
      </div>
    </div>
  );
}
