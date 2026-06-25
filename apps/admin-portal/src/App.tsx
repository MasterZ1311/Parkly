import React from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Overview from './pages/Overview';
import Verifications from './pages/Verifications';
import UsersPage from './pages/UsersPage';
import BookingsAdmin from './pages/BookingsAdmin';

export default function App() {
  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">P</div>
          <div>
            <div className="logo-name">Parkly</div>
            <div className="logo-sub">Admin Portal</div>
          </div>
        </div>

        <div className="nav-section-title">Operations</div>
        {[
          { path: '/', icon: '📊', label: 'Overview', exact: true },
          { path: '/verifications', icon: '✅', label: 'Verifications' },
          { path: '/users', icon: '👥', label: 'Users' },
          { path: '/bookings', icon: '📅', label: 'Bookings' },
        ].map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="nav-section-title" style={{ marginTop: 16 }}>System</div>
        {[
          { icon: '⚙️', label: 'Settings' },
          { icon: '📋', label: 'Audit Logs' },
          { icon: '🔔', label: 'Alerts' },
        ].map(item => (
          <button key={item.label} className="nav-link">
            <span className="icon">{item.icon}</span>
            {item.label}
          </button>
        ))}

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button className="nav-link" style={{ color: 'var(--red)' }}>
            <span className="icon">🚪</span>
            Logout
          </button>
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/verifications" element={<Verifications />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/bookings" element={<BookingsAdmin />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
