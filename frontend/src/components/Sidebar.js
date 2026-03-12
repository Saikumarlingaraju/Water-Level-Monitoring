import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../auth';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      <div className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h3>Menu</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <nav className="sidebar-nav">
          <button
            className={`sidebar-btn ${location.pathname === '/' ? 'active' : ''}`}
            onClick={() => handleNavigation('/')}
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            Home
          </button>
          
          <button
            className={`sidebar-btn ${location.pathname === '/node-creation' ? 'active' : ''}`}
            onClick={() => handleNavigation('/node-creation')}
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
            </svg>
            Node Creation
          </button>

          <button
            className={`sidebar-btn ${location.pathname === '/prediction' ? 'active' : ''}`}
            onClick={() => handleNavigation('/prediction')}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 19h16" />
              <path d="M7 15l3-3 3 2 4-6" />
              <circle cx="7" cy="15" r="1" fill="currentColor" />
              <circle cx="10" cy="12" r="1" fill="currentColor" />
              <circle cx="13" cy="14" r="1" fill="currentColor" />
              <circle cx="17" cy="8" r="1" fill="currentColor" />
            </svg>
            Prediction Lab
          </button>

          <button
            className="sidebar-btn sidebar-btn-logout"
            onClick={() => {
              logout();
              onClose();
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;