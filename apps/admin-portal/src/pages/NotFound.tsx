import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { SearchIcon, ShieldIcon } from '../components/Icons';

const ADMIN_ROUTES = [
  { path: '/', label: 'City Operations Overview' },
  { path: '/verifications', label: 'Space & Host Verifications' },
  { path: '/users', label: 'Platform Users & RBAC' },
  { path: '/bookings', label: 'Global Bookings & Disputes' },
  { path: '/city-analytics', label: 'GCC City Analytics' },
  { path: '/alerts', label: 'System & Sensor Alerts' },
  { path: '/audit-logs', label: 'Security Audit Logs' },
  { path: '/settings', label: 'Operational Settings' },
];

export default function NotFound() {
  useDocumentTitle('404 Page Not Found');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const matches = ADMIN_ROUTES.filter((r) =>
    r.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    if (matches.length > 0) {
      navigate(matches[0].path);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '36px auto' }}>
      <Breadcrumbs items={[{ label: '404 Not Found' }]} />

      <div className="card" style={{ padding: '40px 32px', textAlign: 'center' }}>
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
          <ShieldIcon size={30} />
        </div>
        <div className="card-meta" style={{ marginBottom: 8 }}>HTTP 404</div>
        <h1 className="page-title" style={{ fontSize: 26, marginBottom: 10 }}>
          Admin Resource Not Found
        </h1>
        <p className="page-subtitle" style={{ lineHeight: 1.6, maxWidth: 460, margin: '0 auto 24px' }}>
          The operational telemetry route, user record, or verification audit page does not exist or has been relocated.
        </p>

        <form onSubmit={handleJump} style={{ maxWidth: 420, margin: '0 auto 22px', display: 'flex', gap: 8 }}>
          <input
            type="search"
            className="form-input"
            aria-label="Filter Admin Portal routes"
            placeholder="Jump to verifications, users, alerts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" disabled={matches.length === 0}>
            <SearchIcon size={15} />
            Go
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          {matches.slice(0, 4).map((route, idx) => (
            <Link
              key={route.path}
              to={route.path}
              className={idx === 0 ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
            >
              {route.label}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 18, fontSize: 12.5, color: 'var(--text-muted)' }}>
          Unrecognized route traversals within the Admin Portal are recorded in the security audit trail.
        </div>
      </div>
    </div>
  );
}
