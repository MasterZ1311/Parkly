import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { initializeApiClient } from './utils/apiClient';
import { useAuthStore, useIsAuthenticated } from './utils/authStore';
import Dashboard from './pages/Dashboard';
import Listings from './pages/Listings';
import BookingsPage from './pages/BookingsPage';
import Revenue from './pages/Revenue';
import Settings from './pages/Settings';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: '🏠', label: 'Dashboard' },
  { path: '/listings', icon: '🅿️', label: 'My Listings' },
  { path: '/bookings', icon: '📅', label: 'Bookings' },
  { path: '/revenue', icon: '💰', label: 'Revenue' },
];

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
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-badge">
            <img src="/logo.png" alt="Parkly Logo" className="logo-img" />
          </div>
          <div>
            <div className="logo-name">Parkly</div>
            <div className="logo-sub">Host Portal</div>
          </div>
        </div>

        <div className="nav-section-title">Menu</div>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
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
              <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 10 }}>{user.role}</div>
            </div>
          )}
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="icon">⚙️</span>
            Settings
          </NavLink>
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

      {/* Main Content */}
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
