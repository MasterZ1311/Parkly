import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { initializeApiClient, isDemoModeEnabled, setDemoModeEnabled } from './utils/apiClient';
import { useAuthStore, useIsAuthenticated } from './utils/authStore';
import Dashboard from './pages/Dashboard';
import Listings from './pages/Listings';
import BookingsPage from './pages/BookingsPage';
import Revenue from './pages/Revenue';
import Settings from './pages/Settings';
import Login from './pages/Login';
import VerificationStatus from './pages/VerificationStatus';
import Unauthorized from './pages/Unauthorized';
import Maintenance from './pages/Maintenance';
import Offline from './pages/Offline';
import ServerError from './pages/ServerError';
import NotFound from './pages/NotFound';
import {
  ParklyLogoMark,
  OverviewIcon,
  ParkingIcon,
  CalendarIcon,
  CurrencyIcon,
  SettingsIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
  WifiOffIcon,
} from './components/Icons';

const navItems = [
  { path: '/', label: 'Dashboard', exact: true, Icon: OverviewIcon },
  { path: '/listings', label: 'My Listings', Icon: ParkingIcon },
  { path: '/bookings', label: 'Bookings', Icon: CalendarIcon },
  { path: '/revenue', label: 'Revenue', Icon: CurrencyIcon },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, loadUserFromStorage } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [hydrated, setHydrated] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    initializeApiClient();
    loadUserFromStorage();
    setHydrated(true);
  }, [loadUserFromStorage]);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      setDemoModeEnabled(false);
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (!hydrated) {
    return null;
  }

  const publicPaths = ['/login', '/verification-status', '/unauthorized', '/maintenance', '/offline', '/server-error'];
  if (!isAuthenticated && !publicPaths.includes(location.pathname)) {
    return <Navigate to="/login" replace />;
  }

  if (publicPaths.includes(location.pathname)) {
    return (
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/verification-status" element={<VerificationStatus />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/offline" element={<Offline />} />
        <Route path="/server-error" element={<ServerError />} />
      </Routes>
    );
  }

  const demoActive = isDemoModeEnabled();

  return (
    <div className="layout">
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="logo-badge" style={{ width: 32, height: 32, borderRadius: 8 }}>
            <ParklyLogoMark size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#FFFFFF', lineHeight: 1.1 }}>Parkly</div>
            <div style={{ fontSize: 10, color: '#9FB0C7', fontWeight: 600, letterSpacing: '0.06em' }}>HOST PORTAL</div>
          </div>
        </div>
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((prev) => !prev)}
        >
          {navOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
        </button>
      </header>

      {navOpen && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setNavOpen(false)}
        />
      )}

      <nav className={`sidebar ${navOpen ? 'sidebar--open' : ''}`} aria-label="Host Navigation">
        <div className="sidebar-logo">
          <div className="logo-badge">
            <ParklyLogoMark size={24} />
          </div>
          <div>
            <div className="logo-name">Parkly</div>
            <div className="logo-sub">Host Portal</div>
          </div>
        </div>

        <div className="nav-section-title">Menu</div>
        {navItems.map(({ path, label, exact, Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={exact}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon className="icon" size={18} />
            {label}
          </NavLink>
        ))}

        <div className="sidebar-footer">
          {user && (
            <div style={{ padding: '0 12px 10px', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{user.name || user.phone}</div>
              <div style={{ color: '#9FB0C7', textTransform: 'uppercase', fontSize: 10 }}>{user.role}</div>
            </div>
          )}
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <SettingsIcon className="icon" size={18} />
            Settings
          </NavLink>
          <button type="button" className="nav-link nav-link--danger" onClick={handleLogout}>
            <LogoutIcon className="icon" size={18} />
            Logout
          </button>
        </div>
      </nav>

      <main className="main-content" id="main-content">
        {demoActive && (
          <div className="status-banner" style={{ marginBottom: 16, background: 'var(--yellow-soft)', borderColor: 'var(--yellow-border)', color: 'var(--yellow)' }}>
            <span>
              <strong>Demo Dataset Active</strong> — Displaying built-in Chennai partner fixtures. Sign out to switch back to live API Gateway.
            </span>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout}>
              Exit Demo
            </button>
          </div>
        )}
        {isOffline && (
          <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WifiOffIcon size={16} />
              Network connection lost — live reservation updates paused.
            </span>
            <Link to="/offline" className="btn btn-outline btn-sm">
              Diagnostics
            </Link>
          </div>
        )}
        <Routes>
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
