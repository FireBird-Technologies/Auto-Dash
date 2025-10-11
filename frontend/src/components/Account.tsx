import React, { useState, useEffect } from 'react';
import { config, getAuthHeaders } from '../config';

interface SubscriptionInfo {
  tier: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string | null;
}

interface UserProfile {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  provider: string | null;
  is_active: boolean;
  created_at: string;
  subscription: SubscriptionInfo;
  dashboards_this_month: number;
}

interface AccountProps {
  onClose?: () => void;
}

export const Account: React.FC<AccountProps> = ({ onClose }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${config.backendUrl}/api/auth/me`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data);
      setEditName(data.name || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) {
      setError('Name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`${config.backendUrl}/api/auth/me`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editName }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();
      setProfile(prev => prev ? { ...prev, name: data.user.name } : null);
      setEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (!confirm('Are you sure you want to deactivate your account? This action cannot be easily undone.')) {
      return;
    }

    try {
      const response = await fetch(`${config.backendUrl}/api/auth/me`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate account');
      }

      // Clear token and redirect
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate account');
    }
  };

  if (loading) {
    return (
      <div className="account-container">
        <div className="account-card">
          <div className="loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="account-container">
        <div className="account-card">
          <div className="error-message">{error}</div>
          <button onClick={fetchProfile} className="cta-button-secondary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="account-container">
      <div className="account-card">
        <div className="account-header">
          <h1>Account Settings</h1>
          {onClose && (
            <button onClick={onClose} className="close-button" aria-label="Close">
              ×
            </button>
          )}
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {profile && (
          <div className="account-content">
            {/* Profile Picture */}
            <div className="profile-section">
              {profile.picture && (
                <img 
                  src={profile.picture} 
                  alt={profile.name || 'Profile'} 
                  className="profile-picture"
                />
              )}
            </div>

            {/* Profile Info */}
            <div className="info-section">
              <div className="info-group">
                <label>Email</label>
                <div className="info-value">{profile.email}</div>
              </div>

              <div className="info-group">
                <label>Name</label>
                {editing ? (
                  <div className="edit-group">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="edit-input"
                      placeholder="Enter your name"
                    />
                    <div className="edit-actions">
                      <button
                        onClick={handleUpdateProfile}
                        disabled={saving}
                        className="cta-button-primary"
                        style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditName(profile.name || '');
                          setError(null);
                        }}
                        disabled={saving}
                        className="cta-button-secondary"
                        style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="info-value-with-action">
                    <span>{profile.name || 'Not set'}</span>
                    <button
                      onClick={() => setEditing(true)}
                      className="edit-button"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              <div className="info-group">
                <label>Member Since</label>
                <div className="info-value">
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>

              <div className="info-group">
                <label>Dashboards This Month</label>
                <div className="info-value">
                  {profile.dashboards_this_month || 0}
                </div>
              </div>

              <div className="info-group">
                <label>Account Status</label>
                <div className="info-value">
                  <span className={`status-badge ${profile.is_active ? 'active' : 'inactive'}`}>
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Subscription Section */}
            <div className="subscription-section">
              <h2>Subscription Plan</h2>
              <div className="subscription-card">
                <div className="subscription-header">
                  <div>
                    <div className="subscription-tier">
                      {profile.subscription.tier.charAt(0).toUpperCase() + profile.subscription.tier.slice(1)} Plan
                    </div>
                    <div className="subscription-status">
                      Status: <span className={`status-badge ${profile.subscription.status === 'active' ? 'active' : 'inactive'}`}>
                        {profile.subscription.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // Navigate to subscription management or Stripe portal
                      window.location.href = `${config.backendUrl}/api/payment/portal`;
                    }}
                    className="cta-button-primary"
                  >
                    {profile.subscription.tier === 'free' ? 'Upgrade Plan' : 'Manage Subscription'}
                  </button>
                </div>
                
                {profile.subscription.tier === 'free' && (
                  <div className="subscription-benefits">
                    <h4>Upgrade to Pro for:</h4>
                    <ul>
                      <li>Unlimited visualizations</li>
                      <li>Advanced chart types</li>
                      <li>Real-time data updates</li>
                      <li>Persistent data storage</li>
                      <li>Custom themes and branding</li>
                      <li>Priority support</li>
                    </ul>
                  </div>
                )}
                
                {profile.subscription.created_at && (
                  <div className="subscription-footer">
                    <small>
                      Subscription since: {new Date(profile.subscription.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </small>
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="danger-zone">
              <h3>Danger Zone</h3>
              <p>Once you deactivate your account, there is no going back. Please be certain.</p>
              <button
                onClick={handleDeactivateAccount}
                className="danger-button"
              >
                Deactivate Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

