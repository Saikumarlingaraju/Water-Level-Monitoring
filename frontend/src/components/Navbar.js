import React from 'react';
import { useAuth } from '../auth';
import config from '../config';

const Navbar = ({ onToggleSidebar }) => {
  const { logout, user } = useAuth();

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
        <div className="brand-chip">{user?.full_name || config.BRAND_SHORT_NAME}</div>
        <button className="logout-btn" type="button" onClick={logout}>Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;