import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
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
          <div className="nav-link">
            <span className="icon">⚙️</span>
            Settings
          </div>
          <div className="nav-link" style={{ color: 'var(--red)' }}>
            <span className="icon">🚪</span>
            Logout
          </div>
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
