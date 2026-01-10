import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ConnectData } from '../components/steps/ConnectData';
import { StyleContext } from '../components/steps/StyleContext';
import { Visualization } from '../components/steps/Visualization';
import { config, getAuthHeaders } from '../config';

type Row = Record<string, number | string>;

export const VisualizePage: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<Row[]>([]);
  const [datasetId, setDatasetId] = useState<string>('');
  const [vizContext, setVizContext] = useState<{
    description: string;
    colorTheme?: string;
    savedView?: boolean;
    savedDashboardData?: any;
  }>({
    description: ''
  });
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // Handle loading from Recent dashboards (Saved View)
  useEffect(() => {
    // Check if loading a saved dashboard
    const dashboardIdFromQuery = searchParams.get('dashboardId');
    const savedViewQuery = searchParams.get('savedView');
    
    if (savedViewQuery === 'true' && dashboardIdFromQuery) {
      loadSavedDashboard(parseInt(dashboardIdFromQuery));
      return;
    }
    
    // Legacy: Check for datasetId (old format)
    const datasetIdFromQuery = searchParams.get('datasetId');
    const fromRecentQuery = searchParams.get('fromRecent');
    
    if (fromRecentQuery === 'true' && datasetIdFromQuery) {
      loadRecentDashboard(datasetIdFromQuery);
      return;
    }
    
    // Fall back to location state (for same-tab navigation)
    const stateData = location.state as { datasetId?: string; fromRecent?: boolean } | null;
    
    if (stateData?.fromRecent && stateData?.datasetId) {
      loadRecentDashboard(stateData.datasetId);
    } else {
      // Reset to initial state for normal flow
      setCurrentStep(0);
      setData([]);
      setDatasetId('');
      setVizContext({ description: '' });
    }
  }, [searchParams]);

  const loadSavedDashboard = async (dashboardQueryId: number) => {
    setIsLoadingRecent(true);
    try {
      // Fetch the saved dashboard with all charts
      const dashboardResponse = await fetch(`${config.backendUrl}/api/data/dashboards/${dashboardQueryId}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!dashboardResponse.ok) {
        throw new Error('Failed to load saved dashboard');
      }

      const dashboardData = await dashboardResponse.json();
      
      // Fetch dataset preview for the data
      const previewResponse = await fetch(`${config.backendUrl}/api/data/datasets/${dashboardData.datasetId}/preview`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!previewResponse.ok) {
        throw new Error('Failed to load dataset');
      }

      const previewResult = await previewResponse.json();
      
      // Set the data and dataset ID
      setData(previewResult.preview || []);
      setDatasetId(dashboardData.datasetId);
      
      // Set context with saved view flag
      setVizContext({
        description: 'Saved Dashboard',
        savedView: true,
        savedDashboardData: dashboardData
      });
      
      // Skip directly to visualization step
      setCurrentStep(2);
    } catch (error) {
      console.error('Failed to load saved dashboard:', error);
      // Fall back to normal flow
      setCurrentStep(0);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  const loadRecentDashboard = async (datasetIdToLoad: string) => {
    setIsLoadingRecent(true);
    try {
      // Fetch dataset preview (for the data)
      const previewResponse = await fetch(`${config.backendUrl}/api/data/datasets/${datasetIdToLoad}/preview`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!previewResponse.ok) {
        throw new Error('Failed to load dataset');
      }

      const previewResult = await previewResponse.json();
      
      // Set the data and dataset ID
      setData(previewResult.preview || []);
      setDatasetId(datasetIdToLoad);
      
      // Set a default context
      setVizContext({
        description: 'Dashboard'
      });
      
      // Skip directly to visualization step
      setCurrentStep(2);
    } catch (error) {
      console.error('Failed to load recent dashboard:', error);
      // Fall back to normal flow
      setCurrentStep(0);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  // Function to reset and go back to upload
  const handleReupload = () => {
    setCurrentStep(0);
    setData([]);
    setDatasetId('');
    setVizContext({ description: '' });
  };

  const progress = ((currentStep + 1) / 3) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <ConnectData
            onDataLoaded={(newData, newDatasetId) => {
              setData(newData);
              setDatasetId(newDatasetId);
              setCurrentStep(1);
            }}
          />
        );
      case 1:
        return (
          <StyleContext
            datasetId={datasetId}
            onComplete={(context) => {
              setVizContext(context);
              setCurrentStep(2);
            }}
          />
        );
      case 2:
        return (
          <Visualization
            data={data}
            datasetId={datasetId}
            context={vizContext}
            onReupload={handleReupload}
          />
        );
      default:
        return null;
    }
  };

  if (isLoadingRecent) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="loading-spinner" style={{ width: 40, height: 40 }} />
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="progress-indicator">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {renderStep()}
      </div>
    </div>
  );
};

