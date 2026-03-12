import React from 'react';
import { useAuth } from '../auth';
import config from '../config';

const Navbar = ({ onToggleSidebar, theme, onToggleTheme }) => {
  const { logout, user } = useAuth();
  const isDark = theme === 'dark';

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="hamburger-btn" onClick={onToggleSidebar}>
          <div className="hamburger-line"></div>
          <div className="hamburger-line"></div>
          <div className="hamburger-line"></div>
        </button>
        
        <div className="logo">
          <img src="/hitam-logo.png" alt="HITAM Logo" className="logo-img" />
        </div>
      </div>
      
      <div className="navbar-center">
        <h1 className="navbar-title">{config.COLLEGE_NAME}</h1>
        <p className="navbar-subtitle">{config.BRAND_NAME}</p>
        <p className="navbar-tagline">{config.BRAND_TAGLINE}</p>
      </div>

      <div className="navbar-right">
        <button
          className="theme-toggle-btn"
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2" />
              <path d="M12 21v2" />
              <path d="M4.22 4.22l1.42 1.42" />
              <path d="M18.36 18.36l1.42 1.42" />
              <path d="M1 12h2" />
              <path d="M21 12h2" />
              <path d="M4.22 19.78l1.42-1.42" />
              <path d="M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          <span>{isDark ? 'Light' : 'Dark'}</span>
        </button>
        <div className="brand-chip">{user?.full_name || config.BRAND_SHORT_NAME}</div>
        <button className="logout-btn" type="button" onClick={logout}>Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;