import React, { useState, useEffect, useRef } from 'react';

interface DashboardMetadata {
  id: string;
  title: string;
  datasetId: string;
  chartCount: number;
  timestamp: number;
  datasetName?: string;
}

interface RecentDashboardsProps {
  onLoadDashboard?: (metadata: DashboardMetadata) => void;
}

export const RecentDashboards: React.FC<RecentDashboardsProps> = ({ onLoadDashboard }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentDashboards, setRecentDashboards] = useState<DashboardMetadata[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRecentDashboards();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const loadRecentDashboards = () => {
    try {
      const stored = localStorage.getItem('recent_dashboards');
      if (stored) {
        const dashboards = JSON.parse(stored) as DashboardMetadata[];
        // Sort by timestamp descending (most recent first)
        dashboards.sort((a, b) => b.timestamp - a.timestamp);
        setRecentDashboards(dashboards.slice(0, 10)); // Keep only last 10
      }
    } catch (error) {
      console.error('Failed to load recent dashboards:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const handleDashboardClick = (dashboard: DashboardMetadata) => {
    setIsOpen(false);
    if (onLoadDashboard) {
      onLoadDashboard(dashboard);
    }
  };

  const clearRecentDashboards = () => {
    localStorage.removeItem('recent_dashboards');
    setRecentDashboards([]);
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          color: '#dc2626',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 500,
          padding: '8px 16px',
          borderRadius: '6px',
          transition: 'background-color 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: isOpen ? '#fee2e2' : 'transparent'
        }}
        onMouseOver={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = '#fee2e2';
          }
        }}
        onMouseOut={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        Recent
        {recentDashboards.length > 0 && (
          <span style={{
            backgroundColor: '#ff6b6b',
            color: 'white',
            borderRadius: '10px',
            padding: '2px 6px',
            fontSize: '11px',
            fontWeight: 600,
            minWidth: '18px',
            textAlign: 'center'
          }}>
            {recentDashboards.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '8px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          border: '1px solid #e5e7eb',
          minWidth: '320px',
          maxWidth: '400px',
          maxHeight: '500px',
          overflow: 'hidden',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f9fafb'
          }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#1f2937' }}>
              Recent Dashboards
            </span>
            {recentDashboards.length > 0 && (
              <button
                onClick={clearRecentDashboards}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#fee2e2';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Clear All
              </button>
            )}
          </div>

          <div style={{
            overflowY: 'auto',
            maxHeight: '400px'
          }}>
            {recentDashboards.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#9ca3af'
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="9" x2="15" y2="9" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <p style={{ margin: 0, fontSize: '14px' }}>No recent dashboards</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>Create a dashboard to see it here</p>
              </div>
            ) : (
              recentDashboards.map((dashboard) => (
                <button
                  key={dashboard.id}
                  onClick={() => handleDashboardClick(dashboard)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontWeight: 600,
                      fontSize: '14px',
                      color: '#1f2937',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1
                    }}>
                      {dashboard.title}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      marginLeft: '8px',
                      flexShrink: 0
                    }}>
                      {formatTimestamp(dashboard.timestamp)}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    {dashboard.datasetName && (
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        📊 {dashboard.datasetName}
                      </span>
                    )}
                    <span style={{ flexShrink: 0 }}>
                      {dashboard.chartCount} chart{dashboard.chartCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to save dashboard to recent list
export const saveDashboardToRecent = (metadata: Omit<DashboardMetadata, 'timestamp'>) => {
  try {
    const stored = localStorage.getItem('recent_dashboards');
    let dashboards: DashboardMetadata[] = stored ? JSON.parse(stored) : [];
    
    // Remove existing entry with same ID if exists
    dashboards = dashboards.filter(d => d.id !== metadata.id);
    
    // Add new entry with timestamp
    dashboards.unshift({
      ...metadata,
      timestamp: Date.now()
    });
    
    // Keep only last 10
    dashboards = dashboards.slice(0, 10);
    
    localStorage.setItem('recent_dashboards', JSON.stringify(dashboards));
  } catch (error) {
    console.error('Failed to save dashboard to recent:', error);
  }
};

