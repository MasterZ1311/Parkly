import React, { useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { initializeApiClient } from './utils/api';
import { useAuthStore } from './utils/authStore';
import Overview from './pages/Overview';
import Verifications from './pages/Verifications';
import UsersPage from './pages/UsersPage';
import BookingsAdmin from './pages/BookingsAdmin';

export default function App() {
  const navigate = useNavigate();
  const { logout, loadUserFromStorage } = useAuthStore();

  useEffect(() => {
    initializeApiClient();
    loadUserFromStorage();
  }, [loadUserFromStorage]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

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
          { path: '/settings', icon: '⚙️', label: 'Settings' },
          { path: '/audit-logs', icon: '📋', label: 'Audit Logs' },
          { path: '/alerts', icon: '🔔', label: 'Alerts' },
        ].map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button
            className="nav-link"
            style={{ color: 'var(--red)', width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
            onClick={handleLogout}
          >
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
