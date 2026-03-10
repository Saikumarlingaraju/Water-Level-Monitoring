import React from 'react';
import config from '../config';

const Navbar = ({ onToggleSidebar }) => {
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
        <h1 className="navbar-title">{config.BRAND_NAME}</h1>
        <p className="navbar-subtitle">{config.BRAND_TAGLINE}</p>
      </div>

      <div className="navbar-right">
        <div className="brand-chip">HITAM</div>
      </div>
    </nav>
  );
};

export default Navbar;