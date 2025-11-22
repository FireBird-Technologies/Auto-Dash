import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { config, getAuthHeaders, checkAuthResponse } from '../config';
import { useNotification } from '../contexts/NotificationContext';
import { useCreditsContext } from '../contexts/CreditsContext';
import { SubscriptionDetails } from './SubscriptionDetails';

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

interface SubscriptionData {
  has_subscription: boolean;
  status: string | null;
  plan: {
    id: number;
    name: string;
    price_monthly: number;
    price_yearly: number | null;
    credits_per_month: number;
    credits_per_analyze: number;
    credits_per_edit: number;
  } | null;
  credits: {
    balance: number;
    credits_per_month: number;
  } | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_amount: number | null;
  billing_period: string | null;
  cancel_at_period_end: boolean;
  available_plans: any[];
}

export const Account: React.FC<AccountProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const notification = useNotification();
  const { refetch: refetchCredits } = useCreditsContext();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      setLoadingSubscription(true);
      const response = await fetch(`${config.backendUrl}/api/payment/subscription-status`, {
        headers: getAuthHeaders(),
      });

      await checkAuthResponse(response);

      if (response.ok) {
        const data = await response.json();
        setSubscriptionData(data);
        
        // Refetch credits when subscription data changes
        refetchCredits();
      }
    } catch (err: any) {
      console.error('Failed to fetch subscription status:', err);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${config.backendUrl}/api/auth/me`, {
        headers: getAuthHeaders(),
      });

      await checkAuthResponse(response);

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

      await checkAuthResponse(response);

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
    notification.showConfirm({
      title: 'Deactivate Account',
      message: 'Are you sure you want to deactivate your account? This action cannot be easily undone.',
      onConfirm: async () => {
        try {
          const response = await fetch(`${config.backendUrl}/api/auth/me`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });

          await checkAuthResponse(response);

          if (!response.ok) {
            throw new Error('Failed to deactivate account');
          }

          // Clear token and redirect
          localStorage.removeItem('auth_token');
          window.location.href = '/';
        } catch (err: any) {
          setError(err.message || 'Failed to deactivate account');
          notification.error(err.message || 'Failed to deactivate account');
        }
      }
    });
  };


  const handleCancelSubscription = async () => {
    if (!subscriptionData) return;

    const periodEnd = subscriptionData.current_period_end
      ? new Date(subscriptionData.current_period_end).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'the end of your billing period';

    notification.showConfirm({
      title: 'Cancel Subscription',
      message: `Are you sure you want to cancel your subscription? Your access will continue until ${periodEnd}. You can reactivate at any time before then.`,
      onConfirm: async () => {
        try {
          setLoadingSubscription(true);
          const response = await fetch(`${config.backendUrl}/api/payment/cancel-subscription`, {
            method: 'POST',
            headers: getAuthHeaders(),
          });

          await checkAuthResponse(response);

          if (response.ok) {
            notification.success('Subscription will be canceled at the end of your billing period');
            await fetchSubscriptionStatus();
            await fetchProfile();
          } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to cancel subscription');
          }
        } catch (err: any) {
          notification.error(err.message || 'Failed to cancel subscription');
        } finally {
          setLoadingSubscription(false);
        }
      }
    });
  };

  const handleReactivateSubscription = async () => {
    notification.showConfirm({
      title: 'Reactivate Subscription',
      message: 'Are you sure you want to reactivate your subscription?',
      onConfirm: async () => {
        try {
          setLoadingSubscription(true);
          const response = await fetch(`${config.backendUrl}/api/payment/reactivate-subscription`, {
            method: 'POST',
            headers: getAuthHeaders(),
          });

          await checkAuthResponse(response);

          if (response.ok) {
            notification.success('Subscription reactivated successfully!');
            await fetchSubscriptionStatus();
            await fetchProfile();
          } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to reactivate subscription');
          }
        } catch (err: any) {
          notification.error(err.message || 'Failed to reactivate subscription');
        } finally {
          setLoadingSubscription(false);
        }
      }
    });
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
              x
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
              
              {loadingSubscription ? (
                <div className="loading">Loading subscription details...</div>
              ) : subscriptionData ? (
                <>
                  <div className="subscription-card">
                    <SubscriptionDetails subscription={subscriptionData} />
                    
                    <div className="subscription-actions">
                      {subscriptionData.plan && subscriptionData.plan.name !== 'Free' && (
                        <>
                          {subscriptionData.cancel_at_period_end ? (
                            <button
                              onClick={handleReactivateSubscription}
                              className="cta-button-primary"
                              disabled={loadingSubscription}
                            >
                              Reactivate Subscription
                            </button>
                          ) : (
                            <button
                              onClick={handleCancelSubscription}
                              className="cta-button-secondary danger"
                              disabled={loadingSubscription}
                            >
                              Cancel Subscription
                            </button>
                          )}
                        </>
                      )}
                      
                      {subscriptionData.plan && subscriptionData.plan.name === 'Free' && (
                        <button
                          onClick={() => navigate('/pricing')}
                          className="cta-button-primary"
                        >
                          Upgrade Plan
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="error-message">Failed to load subscription details</div>
              )}
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

