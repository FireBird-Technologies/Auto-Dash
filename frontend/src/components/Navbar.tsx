import React, { useState, useEffect, useRef } from 'react';
import { config, getAuthHeaders } from '../config';

interface NavbarProps {
  onAccountClick?: () => void;
}

interface UserInfo {
  name: string | null;
  email: string;
  picture: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({ onAccountClick }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetchUserInfo();
    }
  }, []);

  useEffect(() => {
    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch(`${config.backendUrl}/api/auth/me`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setUser({
          name: data.name,
          email: data.email,
          picture: data.picture,
        });
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${config.backendUrl}/api/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear token and redirect
      localStorage.removeItem('auth_token');
      sessionStorage.clear();
      window.location.href = '/';
    }
  };

  const handleAccountClick = () => {
    setMenuOpen(false);
    if (onAccountClick) {
      onAccountClick();
    }
  };

  return (
    <nav className="navbar">
      <div className="brand">
        <div className="logo" />
        <span>AutoDash</span>
      </div>

      {user && (
        <div className="user-menu" ref={menuRef}>
          <button
            className="user-menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="User menu"
          >
            {user.picture ? (
              <img src={user.picture} alt={user.name || 'User'} className="user-avatar" />
            ) : (
              <div className="user-avatar-placeholder">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </div>
            )}
            <span className="user-name">{user.name || user.email}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              style={{ transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </button>

          {menuOpen && (
            <div className="user-menu-dropdown">
              <div className="user-menu-header">
                <div className="user-menu-name">{user.name || 'User'}</div>
                <div className="user-menu-email">{user.email}</div>
              </div>
              <div className="user-menu-divider" />
              <button onClick={handleAccountClick} className="user-menu-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Account Settings
              </button>
              <div className="user-menu-divider" />
              <button onClick={handleLogout} className="user-menu-item logout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};