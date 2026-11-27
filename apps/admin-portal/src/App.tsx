import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { initializeApiClient } from './utils/api';
import { useAuthStore } from './utils/authStore';
import Overview from './pages/Overview';
import Verifications from './pages/Verifications';
import UsersPage from './pages/UsersPage';
import BookingsAdmin from './pages/BookingsAdmin';
import CityAnalytics from './pages/CityAnalytics';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import Alerts from './pages/Alerts';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import Maintenance from './pages/Maintenance';
import Offline from './pages/Offline';
import ServerError from './pages/ServerError';
import NotFound from './pages/NotFound';
import {
  ParklyLogoMark,
  OverviewIcon,
  CheckCircleIcon,
  UsersIcon,
  CalendarIcon,
  CityIcon,
  SettingsIcon,
  FileLogIcon,
  BellIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
  WifiOffIcon,
} from './components/Icons';

const opsNav = [
  { path: '/', label: 'Overview', exact: true, Icon: OverviewIcon },
  { path: '/verifications', label: 'Verifications', Icon: CheckCircleIcon },
  { path: '/users', label: 'Users', Icon: UsersIcon },
  { path: '/bookings', label: 'Bookings', Icon: CalendarIcon },
  { path: '/city-analytics', label: 'City Analytics', Icon: CityIcon },
];

const systemNav = [
  { path: '/settings', label: 'Settings', Icon: SettingsIcon },
  { path: '/audit-logs', label: 'Audit Logs', Icon: FileLogIcon },
  { path: '/alerts', label: 'Alerts', Icon: BellIcon },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, loadUserFromStorage } = useAuthStore();
  const [navOpen, setNavOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    initializeApiClient();
    loadUserFromStorage();
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
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (location.pathname === '/login') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="layout">
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="logo-badge" style={{ width: 32, height: 32, borderRadius: 8 }}>
            <ParklyLogoMark size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#FFFFFF', lineHeight: 1.1 }}>Parkly</div>
            <div style={{ fontSize: 10, color: '#9FB0C7', fontWeight: 600, letterSpacing: '0.06em' }}>ADMIN PORTAL</div>
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

      <nav className={`sidebar ${navOpen ? 'sidebar--open' : ''}`} aria-label="Admin Navigation">
        <div className="sidebar-logo">
          <div className="logo-badge">
            <ParklyLogoMark size={24} />
          </div>
          <div>
            <div className="logo-name">Parkly</div>
            <div className="logo-sub">Admin Portal</div>
          </div>
        </div>

        <div className="nav-section-title">Operations</div>
        {opsNav.map(({ path, label, exact, Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={exact}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className="nav-link-content">
                  <Icon size={17} />
                  <span>{label}</span>
                </span>
                {isActive && <span className="nav-active-dot" aria-hidden="true" />}
              </>
            )}
          </NavLink>
        ))}

        <div className="nav-section-title" style={{ marginTop: 12 }}>System</div>
        {systemNav.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className="nav-link-content">
                  <Icon size={17} />
                  <span>{label}</span>
                </span>
                {isActive && <span className="nav-active-dot" aria-hidden="true" />}
              </>
            )}
          </NavLink>
        ))}

        <div className="sidebar-footer">
          <button type="button" className="nav-link nav-logout" onClick={handleLogout}>
            <span className="nav-link-content">
              <LogoutIcon size={17} />
              <span>Logout</span>
            </span>
          </button>
        </div>
      </nav>

      <main className="main-content">
        {isOffline && location.pathname !== '/offline' && (
          <div className="status-banner status-banner--error" role="status">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WifiOffIcon size={16} />
              Offline Mode — Console lost network connectivity. Telemetry updates paused.
            </span>
            <Link to="/offline" className="btn btn-outline btn-sm">
              Diagnostics
            </Link>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/verifications" element={<Verifications />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/bookings" element={<BookingsAdmin />} />
          <Route path="/city-analytics" element={<CityAnalytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/offline" element={<Offline />} />
          <Route path="/server-error" element={<ServerError />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
