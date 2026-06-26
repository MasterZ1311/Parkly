import React, { useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { initializeApiClient } from './utils/api';
import { useAuthStore } from './utils/authStore';
import Dashboard from './pages/Dashboard';
import Listings from './pages/Listings';
import BookingsPage from './pages/BookingsPage';
import Revenue from './pages/Revenue';

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
  const { logout, loadUserFromStorage } = useAuthStore();

  // Initialize API client and load auth on mount
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
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">P</div>
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
