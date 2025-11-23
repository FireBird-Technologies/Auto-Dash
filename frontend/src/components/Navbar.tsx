import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { config, getAuthHeaders, checkAuthResponse } from '../config';
import { useCreditsContext } from '../contexts/CreditsContext';
import { useNotification } from '../contexts/NotificationContext';

interface NavbarProps {
  onAccountClick?: () => void;
}

interface UserInfo {
  name: string | null;
  email: string;
  picture: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({ onAccountClick }) => {
  const navigate = useNavigate();
  const notification = useNotification();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { credits, loading: creditsLoading } = useCreditsContext();

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

      await checkAuthResponse(response);

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
      const response = await fetch(`${config.backendUrl}/api/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      await checkAuthResponse(response);
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

  const handleCreditsClick = () => {
    if (credits && credits.balance < 100) {
      notification.showConfirm({
        title: 'Low Credits',
        message: `You have ${credits.balance} credits remaining.\n\nWould you like to upgrade your plan for more credits?`,
        onConfirm: () => {
          navigate('/pricing');
        }
      });
    } else {
      navigate('/pricing');
    }
  };

  return (
    <nav className="navbar">
      <div className="brand">
        <img 
          src="/logo.svg" 
          alt="AutoDash" 
          className="logo" 
          style={{
            width: '150px',
            height: 'auto'
          }}
        />
      </div>

      <div className="navbar-right">
        {!user && (
          <a href="/pricing" className="navbar-pricing-link">
            Pricing
          </a>
        )}

        {user && credits && (
          <button 
            className={`credits-badge ${credits.balance < 10 ? 'low-credits' : ''}`}
            onClick={handleCreditsClick}
            title="Click to upgrade"
          >
            <span className="credits-count">
              {creditsLoading ? '...' : credits.balance}
            </span>
          </button>
        )}

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
              {credits && (
                <>
                  <div className="user-menu-divider" />
                  <div className="user-menu-credits">
                    <div className="credits-info">
                      <span className="credits-amount">{credits.balance} credits</span>
                      {credits.plan_name && (
                        <span className="credits-plan-badge">{credits.plan_name} Plan</span>
                      )}
                    </div>
                    <div className="credits-costs">
                      <small>Dashboard: {credits.credits_per_analyze} credits</small>
                      <small>Edit: {credits.credits_per_edit} credits</small>
                    </div>
                  </div>
                </>
              )}
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
      </div>
    </nav>
  );
};