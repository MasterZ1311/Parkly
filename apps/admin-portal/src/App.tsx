import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { initializeApiClient } from './utils/apiClient';
import { useAuthStore, useIsAuthenticated } from './utils/authStore';
import Overview from './pages/Overview';
import Verifications from './pages/Verifications';
import UsersPage from './pages/UsersPage';
import BookingsAdmin from './pages/BookingsAdmin';
import CityAnalytics from './pages/CityAnalytics';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import Alerts from './pages/Alerts';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

export default function App() {
  const navigate = useNavigate();
  const { user, logout, loadUserFromStorage } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    initializeApiClient();
    loadUserFromStorage();
    setHydrated(true);
  }, [loadUserFromStorage]);

  if (!hydrated) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-badge">
            <img src="/logo.png" alt="Parkly Logo" className="logo-img" />
          </div>
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
          { path: '/city-analytics', icon: '🏙️', label: 'City Analytics' },
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
          {user && (
            <div style={{ padding: '0 12px 10px', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.name || user.phone}</div>
              <div style={{ color: 'var(--accent)', textTransform: 'uppercase', fontSize: 10 }}>{user.role}</div>
            </div>
          )}
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
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={<Overview />} />
          <Route path="/verifications" element={<Verifications />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/bookings" element={<BookingsAdmin />} />
          <Route path="/city-analytics" element={<CityAnalytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
