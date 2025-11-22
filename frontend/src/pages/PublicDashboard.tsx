import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlotlyChartRenderer } from '../components/PlotlyChartRenderer';
import { config } from '../config';

export const PublicDashboard: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<{
    dataset_id: string;
    filename: string;
    dashboard_title: string | null;
    figures_data: Array<{
      chart_index: number;
      figure: any;
      title: string;
      chart_type: string;
    }>;
    owner_name: string;
    created_at: string;
  } | null>(null);

  useEffect(() => {
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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '24px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '8px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{
            margin: '0 0 8px 0',
            fontSize: '28px',
            color: '#111827'
          }}>
            {dashboardData.dashboard_title || 'Public Dashboard'}
          </h1>
          <p style={{
            margin: '0',
            color: '#6b7280',
            fontSize: '14px'
          }}>
            Dataset: {dashboardData.filename} • Shared by {dashboardData.owner_name || 'Anonymous'}
          </p>
        </div>

        {/* Charts Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))',
          gap: '24px'
        }}>
          {sortedFigures.map((chart, index) => (
            <div
              key={chart.chart_index}
              style={{
                backgroundColor: 'white',
                padding: '24px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '18px',
                color: '#111827'
              }}>
                {chart.title || `Chart ${index + 1}`}
              </h3>
              <div style={{ width: '100%', height: '500px' }}>
                <PlotlyChartRenderer
                  chartSpec={{ figure: chart.figure }}
                  data={[]}
                  chartIndex={chart.chart_index}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '48px',
          padding: '24px',
          color: '#6b7280',
          fontSize: '14px'
        }}>
          <p>Powered by AutoDash</p>
        </div>
      </div>
    </div>
  );
};

