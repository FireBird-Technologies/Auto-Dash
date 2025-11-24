import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlotlyChartRenderer } from '../components/PlotlyChartRenderer';
import { MarkdownMessage } from '../components/MarkdownMessage';
import { config } from '../config';

export const PublicDashboard: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesVisible, setNotesVisible] = useState<Record<number, boolean>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [dashboardData, setDashboardData] = useState<{
    dataset_id: string;
    filename: string;
    dashboard_title: string | null;
    figures_data: Array<{
      chart_index: number;
      figure: any;
      title: string;
      chart_type: string;
      notes?: string;
    }>;
    owner_name: string;
    created_at: string;
  } | null>(null);

  useEffect(() => {
    // Check if user is logged in
    const authToken = localStorage.getItem('auth_token');
    const loggedIn = !!authToken;
    setIsLoggedIn(loggedIn);

    // Show login popup if not logged in and not dismissed
    if (!loggedIn && !sessionStorage.getItem('login_popup_dismissed')) {
      setShowLoginPopup(true);
    }

    const fetchDashboard = async () => {
      if (!token) {
        setError('Invalid share token');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${config.backendUrl}/api/data/public/dashboard/${token}`, {
          method: 'GET',
          credentials: 'include'
        });

        if (response.status === 404) {
          setError('Dashboard not found');
          setLoading(false);
          return;
        }

        if (response.status === 410) {
          setError('This dashboard link has expired');
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard');
        }

        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        console.error('Error fetching public dashboard:', err);
        setError('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [token]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '32px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          maxWidth: '500px'
        }}>
          <h2 style={{ marginBottom: '16px', color: '#dc2626' }}>Error</h2>
          <p style={{ marginBottom: '24px', color: '#666' }}>{error || 'Dashboard not found'}</p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Sort figures by chart_index
  const sortedFigures = [...dashboardData.figures_data].sort((a, b) => a.chart_index - b.chart_index);

  const handleLogin = () => {
    sessionStorage.setItem('auth_callback', 'true');
    sessionStorage.setItem('auth_redirect_to', `/shared/${token}`);
    window.location.href = `${config.backendUrl}/api/auth/google/login`;
  };

  const handleSeeWithoutLogin = () => {
    setShowLoginPopup(false);
    sessionStorage.setItem('login_popup_dismissed', 'true');
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Login Popup */}
      {showLoginPopup && !isLoggedIn && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={handleSeeWithoutLogin}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '450px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: '#1f2937',
                marginBottom: '8px'
              }}>
                Welcome to AutoDash
              </h2>
              <p style={{
                margin: 0,
                fontSize: '15px',
                color: '#6b7280',
                lineHeight: '1.5'
              }}>
                Log in to create your own dashboards or continue viewing without logging in.
              </p>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <button
                onClick={handleLogin}
                style={{
                  padding: '14px 24px',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'white',
                  background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Log in with Google
              </button>

              <button
                onClick={handleSeeWithoutLogin}
                style={{
                  padding: '14px 24px',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#374151',
                  background: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                See without login
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="visualization-container-large" style={{
        flex: 1,
        overflow: 'auto'
      }}>
        <div className="chart-display">
          {/* Dashboard Title */}
          <div style={{ 
            padding: '24px 20px 0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#1f2937',
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 20px',
              borderRadius: '12px',
              border: '2px solid transparent'
            }}>
              {dashboardData.dashboard_title || 'Dashboard'}
            </h2>
          </div>
          
          {/* Charts Grid - Same layout as dashboard with notes icon */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 1000px), 1fr))',
            gap: '24px',
            padding: '20px',
            alignItems: 'start',
            position: 'relative'
          }}>
            {sortedFigures.map((spec) => (
              <div
                key={`chart-wrapper-${spec.chart_index}`}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}
              >
                {/* Chart */}
                <div style={{
                  flex: 1,
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  minHeight: '600px'
                }}>
                  <PlotlyChartRenderer
                    chartSpec={{
                      chart_spec: '',
                      chart_type: spec.chart_type,
                      title: spec.title,
                      chart_index: spec.chart_index,
                      figure: spec.figure
                    }}
                    data={[]}
                    chartIndex={spec.chart_index}
                  />
                </div>
                
                {/* Notes Icon - Outside, to the right (same as dashboard) */}
                {spec.notes && (
                  <div style={{
                    position: 'relative',
                    flexShrink: 0
                  }}>
                    <button
                      onClick={() => {
                        setNotesVisible(prev => ({
                          ...prev,
                          [spec.chart_index]: !prev[spec.chart_index]
                        }));
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        color: '#6b7280',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)';
                        e.currentTarget.style.color = '#374151';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                        e.currentTarget.style.color = '#6b7280';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                      }}
                      title={notesVisible[spec.chart_index] ? "Hide notes" : "Show notes"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                      {notesVisible[spec.chart_index] ? 'Hide notes' : 'Show notes'}
                    </button>
                    
                    {/* Notes Panel - Subtle area on the right (same as dashboard) */}
                    {notesVisible[spec.chart_index] && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '8px',
                        width: '350px',
                        maxHeight: '600px',
                        backgroundColor: 'white',
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        borderRadius: '12px',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                        zIndex: 100,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: 'white'
                        }}>
                          <span style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#374151'
                          }}>
                            Notes
                          </span>
                          <button
                            onClick={() => {
                              setNotesVisible(prev => ({
                                ...prev,
                                [spec.chart_index]: false
                              }));
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              color: '#9ca3af',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f3f4f6';
                              e.currentTarget.style.color = '#6b7280';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#9ca3af';
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                        <div style={{
                          flex: 1,
                          overflow: 'auto',
                          padding: '16px',
                          minHeight: '200px',
                          backgroundColor: 'white'
                        }}>
                          <MarkdownMessage content={spec.notes} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

