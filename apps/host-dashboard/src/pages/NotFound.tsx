import React from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function NotFound() {
  useDocumentTitle('404 Page Not Found');

  return (
    <div style={{ maxWidth: 680, margin: '40px auto', textAlign: 'center' }}>
      <Breadcrumbs items={[{ label: '404 Not Found' }]} />

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '48px 32px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }}>🅿️❓</div>
        <h1 className="page-title" style={{ fontSize: 28, marginBottom: 12 }}>
          404 — Parking Spot or Page Not Found
        </h1>
        <p className="page-subtitle" style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 480, margin: '0 auto 28px' }}>
          The parking management page or resource you are searching for does not exist, has been archived, or you may have followed an expired link.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-primary" style={{ padding: '10px 24px' }}>
            Back to Dashboard
          </Link>
          <Link to="/listings" className="btn btn-secondary" style={{ padding: '10px 24px' }}>
            View My Spaces
          </Link>
          <Link to="/bookings" className="btn btn-secondary" style={{ padding: '10px 24px' }}>
            Check Reservations
          </Link>
        </div>

        <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          Need assistance with your parking listing? Contact <a href="mailto:host-support@parkly.in" style={{ color: 'var(--primary)', textDecoration: 'none' }}>host-support@parkly.in</a>
        </div>
      </div>
    </div>
  );
}
