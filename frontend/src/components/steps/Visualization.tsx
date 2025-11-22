import React, { useState, useEffect, useRef } from 'react';
import { PlotlyChartRenderer } from '../PlotlyChartRenderer';
import { FixNotification } from '../FixNotification';
import { MarkdownMessage } from '../MarkdownMessage';
import { AddChartPopup } from '../AddChartPopup';
import { config, getAuthHeaders, checkAuthResponse } from '../../config';
import { useNotification } from '../../contexts/NotificationContext';

type Row = Record<string, number | string>;

interface VisualizationProps {
  data: Row[];
  datasetId: string;
  context: {
    description: string;
    colorTheme?: string;
  };
  onReupload?: () => void;
}

export const Visualization: React.FC<VisualizationProps> = ({ data, datasetId, context, onReupload }) => {
  const notification = useNotification();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chartSpecs, setChartSpecs] = useState<any[]>([]);  // Changed to array
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{
    type: 'user' | 'assistant', 
    message: string, 
    matchedChart?: {index: number, type: string, title: string},
    codeType?: 'plotly_edit' | 'analysis' | 'add_chart_query',
    executableCode?: string,
    failed?: boolean,
    retryable?: boolean,
    originalQuery?: string
  }>>([]);
  const [contextPrepared, setContextPrepared] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [localData, setLocalData] = useState<Row[]>(data); // Local copy that may be full dataset
  const [fullDataFetched, setFullDataFetched] = useState(false); // Track if we've fetched full data
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showDatasetPreview, setShowDatasetPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{ preview: Row[], total_rows: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const hasGeneratedInitialChart = useRef(false);
  const visualizationRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const [showFixNotification, setShowFixNotification] = useState(false);
  const [zoomedChartIndex, setZoomedChartIndex] = useState<number | null>(null);
  const [chartPreview, setChartPreview] = useState<{chartIndex: number, figure: any, code: string} | null>(null);
  const [isExecutingCode, setIsExecutingCode] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState<string>('Dashboard');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showAddChartPopup, setShowAddChartPopup] = useState(false);
  const [addingChart, setAddingChart] = useState(false);

  // Update local data when prop changes
  useEffect(() => {
    if (!fullDataFetched) {
      setLocalData(data);
    }
  }, [data, fullDataFetched]);

  // Clear visualization state on mount (fresh session)
  useEffect(() => {
    setChartSpecs([]);  // Changed from setChartSpec(null)
    setChatHistory([]);
    setError(null);
    setQuery('');
    setIsLoading(false);
    setContextPrepared(false);
    setFullDataFetched(false);
    hasGeneratedInitialChart.current = false;
  }, []);

  // Function to fetch full dataset when needed (called after chart generation)
  const fetchFullDataset = async () => {
    // Don't fetch if preview modal is open - wait until it's closed to avoid disrupting the UI
    if (showDatasetPreview) {
      return;
    }
    
    // Only fetch if we haven't already and we have preview data
    if (fullDataFetched || !datasetId || data.length >= 50) {
      return;
    }

    try {
      console.log(`Loading full dataset for visualization (currently have ${data.length} rows)...`);
      const response = await fetch(`${config.backendUrl}/api/data/datasets/${datasetId}/full?limit=1000`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[SUCCESS] Full dataset loaded: ${result.rows} rows (Total: ${result.total_rows_in_dataset} rows)`);
        
        // Show warning if data was limited
        if (result.limited) {
          console.warn(`[WARNING] Dataset limited to ${result.rows} rows for performance (Total dataset: ${result.total_rows_in_dataset} rows)`);
        }
        
        // Update local data with full dataset
        if (result.data && result.data.length > data.length) {
          setLocalData(result.data);
          setFullDataFetched(true);
        }
      }
    } catch (err) {
      console.error('Failed to load full dataset:', err);
      // Not critical - we can still work with preview data
    }
  };

  // Function to fetch dataset preview
  const fetchDatasetPreview = async () => {
    if (!datasetId) return;
    
    setLoadingPreview(true);
    try {
      const response = await fetch(`${config.backendUrl}/api/data/datasets/${datasetId}/preview?rows=20`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setPreviewData(result);
        setShowDatasetPreview(true);
      } else {
        console.error('Failed to fetch dataset preview');
      }
    } catch (err) {
      console.error('Error fetching dataset preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Fetch full dataset when preview modal closes (if not already fetched)
  useEffect(() => {
    if (!showDatasetPreview && !fullDataFetched && datasetId && data.length < 50) {
      // Small delay to ensure modal close animation completes
      const timer = setTimeout(() => {
        fetchFullDataset();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showDatasetPreview, fullDataFetched, datasetId, data.length]);

  // Generate initial chart on load (only once)
  useEffect(() => {
    if (context.description && datasetId && !hasGeneratedInitialChart.current) {
      hasGeneratedInitialChart.current = true;
      generateChart(context.description);
    }
  }, [context.description]); // Only depend on context.description, not datasetId

  // Prepare context when user starts typing (only before first chart)
  const prepareContext = async () => {
    // Skip if context already prepared, no dataset, or charts already generated
    if (contextPrepared || !datasetId || chartSpecs.length > 0) return;
    
    try {
      await fetch(`${config.backendUrl}/api/data/datasets/${datasetId}/prepare-context`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      setContextPrepared(true);
    } catch (err) {
      console.error('Failed to prepare context:', err);
    }
  };

  // Callback to handle when a specific chart is fixed
  const handleChartFixed = (chartIndex: number, fixedCode: string, figureData?: any) => {
    console.log(`Updating chart ${chartIndex} with fixed code`);
    // Dismiss the notification when fix is complete
    setShowFixNotification(false);
    
    setChartSpecs(prevSpecs => {
      const newSpecs = [...prevSpecs];
      if (newSpecs[chartIndex]) {
        newSpecs[chartIndex] = {
          ...newSpecs[chartIndex],
          chart_spec: fixedCode,
          figure: figureData || newSpecs[chartIndex].figure, // Update figure if provided
          execution_success: figureData ? true : newSpecs[chartIndex].execution_success,
          execution_error: figureData ? undefined : newSpecs[chartIndex].execution_error
        };
      }
      return newSpecs;
    });
  };

  // Handler for chart zoom
  const handleChartZoom = (chartIndex: number) => {
    setZoomedChartIndex(chartIndex);
  };

  // Execute analysis code
  const executeAnalysisCode = async (code: string) => {
    setIsExecutingCode(true);
    try {
      const response = await fetch(`${config.backendUrl}/api/data/execute-code`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({
          code: code,
          dataset_id: datasetId,
          code_type: 'analysis'
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        throw new Error('Failed to execute analysis code');
      }

      const result = await response.json();
      
      // Add result to chat
      if (result.success) {
        setChatHistory(prev => [...prev, {
          type: 'assistant',
          message: `**Analysis Result:**\n\n${result.result}`
        }]);
      } else {
        // Mark the last assistant message with analysis code as failed
        setChatHistory(prev => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].type === 'assistant' && updated[i].codeType === 'analysis') {
              updated[i] = {
                ...updated[i],
                failed: true,
                retryable: true
              };
              break;
            }
          }
          updated.push({
            type: 'assistant',
            message: `**Error:**\n\n${result.error}`
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error executing analysis:', error);
      // Mark the last assistant message with analysis code as failed
      setChatHistory(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].type === 'assistant' && updated[i].codeType === 'analysis') {
            updated[i] = {
              ...updated[i],
              failed: true,
              retryable: true
            };
            break;
          }
        }
        updated.push({
          type: 'assistant',
          message: `**Error:** ${error instanceof Error ? error.message : 'Failed to execute analysis'}`
        });
        return updated;
      });
    } finally {
      setIsExecutingCode(false);
    }
  };

  // Execute Plotly edit code
  const executePlotlyEdit = async (code: string, chartIndex: number) => {
    setIsExecutingCode(true);
    try {
      const response = await fetch(`${config.backendUrl}/api/data/execute-code`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({
          code: code,
          dataset_id: datasetId,
          code_type: 'plotly_edit'
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        throw new Error('Failed to execute plotly code');
      }

      const result = await response.json();
      
      if (result.success) {
        // Set preview
        setChartPreview({
          chartIndex: chartIndex,
          figure: result.figure,
          code: code
        });
      } else {
        // Mark the last assistant message with plotly_edit code as failed
        setChatHistory(prev => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].type === 'assistant' && updated[i].codeType === 'plotly_edit') {
              updated[i] = {
                ...updated[i],
                failed: true,
                retryable: true
              };
              break;
            }
          }
          updated.push({
            type: 'assistant',
            message: `**Error:** Failed to execute code`
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error executing plotly edit:', error);
      // Mark the last assistant message with plotly_edit code as failed
      setChatHistory(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].type === 'assistant' && updated[i].codeType === 'plotly_edit') {
            updated[i] = {
              ...updated[i],
              failed: true,
              retryable: true
            };
            break;
          }
        }
        updated.push({
          type: 'assistant',
          message: `**Error:** ${error instanceof Error ? error.message : 'Failed to execute code'}`
        });
        return updated;
      });
    } finally {
      setIsExecutingCode(false);
    }
  };

  // Retry failed code with improved AI
  const handleRetry = async (message: any) => {
    setIsExecutingCode(true);
    try {
      // Get data context (for now, we'll send empty string as backend will generate it)
      const dataContext = ""; // Backend will generate context from dataset_id
      
      const response = await fetch(`${config.backendUrl}/api/chat/retry`, {
        method: 'POST',
        headers: getAuthHeaders({'Content-Type': 'application/json'}),
        credentials: 'include',
        body: JSON.stringify({
          user_query: message.originalQuery || message.message,
          dataset_id: datasetId,
          code_type: message.codeType,
          plotly_code: message.codeType === 'plotly_edit' && message.matchedChart 
            ? chartSpecs[message.matchedChart.index]?.chart_spec 
            : undefined,
          data_context: dataContext
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        throw new Error('Failed to retry code generation');
      }
      
      const result = await response.json();
      
      // Add new message with improved code
      setChatHistory(prev => [...prev, {
        type: 'assistant',
        message: result.reply,
        codeType: result.code_type,
        executableCode: result.executable_code,
        matchedChart: message.matchedChart,
        originalQuery: message.originalQuery || message.message
      }]);
    } catch (error) {
      console.error('Error retrying code:', error);
      setChatHistory(prev => [...prev, {
        type: 'assistant',
        message: `**Error:** ${error instanceof Error ? error.message : 'Failed to retry'}`
      }]);
    } finally {
      setIsExecutingCode(false);
    }
  };

  // Apply chart preview
  const applyChartPreview = () => {
    if (!chartPreview) return;
    
    // Update chart specs with new figure
    setChartSpecs(prev => {
      const newSpecs = [...prev];
      if (newSpecs[chartPreview.chartIndex]) {
        newSpecs[chartPreview.chartIndex] = {
          ...newSpecs[chartPreview.chartIndex],
          figure: chartPreview.figure,
          chart_spec: chartPreview.code
        };
      }
      return newSpecs;
    });
    
    // Clear preview
    setChartPreview(null);
    
    // Add success message
    setChatHistory(prev => [...prev, {
      type: 'assistant',
      message: 'Chart updated successfully!'
    }]);
  };

  // Discard chart preview
  const discardChartPreview = () => {
    setChartPreview(null);
    setChatHistory(prev => [...prev, {
      type: 'assistant',
      message: 'Chart preview discarded.'
    }]);
  };

  const generateChart = async (userQuery: string) => {
    if (!userQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    // Add user message only - loading visualization shows in dashboard area
    setChatHistory(prev => [
      ...prev,
      { type: 'user', message: userQuery }
    ]);

    try {
      // Use /analyze for first chart, /chat for subsequent queries
      const isFirstChart = chartSpecs.length === 0;
      
      if (isFirstChart) {
        // First chart: Use analyze endpoint
        const response = await fetch(`${config.backendUrl}/api/data/analyze`, {
          method: 'POST',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify({
            query: userQuery,
            dataset_id: datasetId,
            color_theme: context.colorTheme
          })
        });

        await checkAuthResponse(response);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to generate chart');
        }

        const result = await response.json();
        
        // Fetch full dataset before rendering chart (if not already fetched)
        await fetchFullDataset();
        
        // Keep user message in chat history - don't remove it
        // The user message was already added above, so we just update chart specs
        
        // Extract dashboard title if provided
        if (result.dashboard_title) {
          setDashboardTitle(result.dashboard_title);
        }
        
        // Handle both array (new format) and single chart (old format)
        if (result.charts && Array.isArray(result.charts)) {
          // New format: array of charts
          setChartSpecs(result.charts);
        } else if (result.chart_spec) {
          // Old format: single chart - wrap in array
          setChartSpecs([{ chart_spec: result.chart_spec, chart_type: 'unknown', title: 'Visualization', chart_index: 0 }]);
        }
      } else {
        // Subsequent queries: Use chat endpoint with chart context
        const response = await fetch(`${config.backendUrl}/api/chat`, {
          method: 'POST',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify({
            message: userQuery,
            dataset_id: datasetId,
            plotly_code: chartSpecs[0]?.chart_spec || '',  // Pass current chart code
            fig_data: chartSpecs[0]?.figure || null  // Pass current figure data
          })
        });

        await checkAuthResponse(response);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to process chat request');
        }

        const result = await response.json();
        
        // Keep user message and add AI response
        setChatHistory(prev => {
          return [...prev, { 
            type: 'assistant', 
            message: result.reply,
            matchedChart: result.matched_chart,
            codeType: result.code_type,
            executableCode: result.executable_code,
            originalQuery: userQuery  // Store original query for add_chart_query button
          }];
        });
        
        // Note: Chat endpoint returns text response, not new charts
        // If the response contains code, you might want to handle that separately
      }
      
    } catch (err) {
      console.error('Error generating chart:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate chart';
      setError(errorMessage);
      
      // Keep user message and add error message
      setChatHistory(prev => {
        return [...prev, { 
          type: 'assistant', 
          message: `Error: ${errorMessage}` 
        }];
      });
    } finally {
      setIsLoading(false);
      setQuery('');
    }
  };

  const handleAddChart = async (query: string) => {
    if (!query.trim()) {
      notification.error('Please enter a chart description');
      return;
    }

    setAddingChart(true);
    try {
      const response = await fetch(`${config.backendUrl}/api/data/add-chart`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({
          query: query,
          dataset_id: datasetId,
          color_theme: context.colorTheme
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add chart');
      }

      const result = await response.json();
      
      // Add new chart to chartSpecs
      const newChartSpec = {
        chart_spec: result.chart_spec,
        chart_type: result.chart_type,
        title: result.title,
        chart_index: result.chart_index,
        figure: result.figure
      };
      
      setChartSpecs(prev => [...prev, newChartSpec]);
      notification.success('Chart added successfully!');
      
      // Fetch full dataset if needed
      await fetchFullDataset();
      
    } catch (err) {
      console.error('Error adding chart:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add chart';
      notification.error(errorMessage);
    } finally {
      setAddingChart(false);
    }
  };

  const handleAddChartFromChat = async (query: string) => {
    await handleAddChart(query);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    // Trigger context preparation when user starts typing (only before first chart)
    if (newQuery.length > 0 && !contextPrepared && chartSpecs.length === 0) {
      prepareContext();
    }
  };

  const handleSubmit = () => {
    generateChart(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReuploadClick = () => {
    notification.showConfirm({
      title: 'Upload New Dataset',
      message: 'Are you sure you want to upload a new dataset? This will clear all current visualizations and chat history.',
      onConfirm: () => {
        if (onReupload) {
          onReupload();
        }
      }
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const downloadChart = async (format: 'png-zip' | 'pdf') => {
    if (chartSpecs.length === 0) {
      notification.warning('No charts to download');
      return;
    }

    try {
      console.log('Starting chart export...');
      
      // Export all charts as base64 images using Plotly's toImage API
      const chartImages: Array<{title: string, imageData: string}> = [];
      
      // Get all Plotly chart elements
      const plotlyDivs = document.querySelectorAll('.js-plotly-plot');
      console.log(`Found ${plotlyDivs.length} Plotly charts`);
      
      for (let idx = 0; idx < chartSpecs.length; idx++) {
        const spec = chartSpecs[idx];
        const title = spec.title || `Chart ${idx + 1}`;
        const plotlyDiv = plotlyDivs[idx] as any;
        
        if (plotlyDiv && plotlyDiv.data) {
          try {
            console.log(`Exporting chart ${idx + 1}: ${title}`);
            
            // Use Plotly's toImage - this works without kaleido!
            const imageData = await (window as any).Plotly.toImage(plotlyDiv, {
              format: 'png',
              width: 1000,
              height: 800,
              scale: 2
            });
            
            chartImages.push({ title, imageData });
            console.log(`[SUCCESS] Chart ${idx + 1} exported successfully`);
          } catch (err) {
            console.error(`Failed to export chart ${idx + 1}:`, err);
          }
        } else {
          console.warn(`Chart ${idx + 1} not found in DOM`);
        }
      }

      if (chartImages.length === 0) {
        throw new Error('No charts could be exported. Please wait for charts to fully render.');
      }

      console.log(`Sending ${chartImages.length} charts to backend...`);

      // Send to backend for packaging
      const endpoint = format === 'png-zip' 
        ? '/api/export/charts-zip-from-images'
        : '/api/export/dashboard-pdf-from-images';
      
      const response = await fetch(`${config.backendUrl}${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ charts: chartImages })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${errorText}`);
      }

      // Download file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'png-zip' 
        ? `autodash_charts_${Date.now()}.zip`
        : `autodash_report_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('[SUCCESS] Download complete!');

    } catch (error) {
      console.error('Error downloading:', error);
      notification.error(`Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setShowDownloadMenu(false);
  };

  const handleShareDashboard = async () => {
    if (chartSpecs.length === 0) {
      notification.warning('No charts to share');
      return;
    }

    try {
      // Collect figures data from all charts
      const figuresData = chartSpecs.map((spec, index) => ({
        chart_index: spec.chart_index ?? index,
        figure: spec.figure || spec.fig_data,
        title: spec.title || `Chart ${index + 1}`,
        chart_type: spec.chart_type || 'plotly'
      }));

      // Get dashboard title (if available from context or first chart)
      const dashboardTitle = context?.description || chartSpecs[0]?.title || 'Dashboard';

      // Call share endpoint
      const response = await fetch(`${config.backendUrl}/api/data/datasets/${datasetId}/share`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          figures_data: figuresData,
          dashboard_title: dashboardTitle
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to create share link' }));
        throw new Error(errorData.detail || 'Failed to create share link');
      }

      const result = await response.json();
      const publicUrl = result.public_url;

      // Copy to clipboard
      await navigator.clipboard.writeText(publicUrl);
      notification.success(`Share link copied to clipboard! ${result.expires_at ? 'Link expires in 24 hours.' : ''}`);

      // Optionally show modal with link
      const showModal = window.confirm(`Share link copied!\n\n${publicUrl}\n\nOpen in new tab?`);
      if (showModal) {
        window.open(publicUrl, '_blank');
      }

    } catch (error) {
      console.error('Error sharing dashboard:', error);
      notification.error(`Failed to share dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Close download menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false);
      }
    };

    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadMenu]);

  // Close fullscreen on ESC key
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isFullscreen]);

  // Handle sidebar resizing
  const startResizing = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      if (newWidth >= 250 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <>
      <FixNotification 
        show={showFixNotification} 
        onDismiss={() => setShowFixNotification(false)} 
      />
      
      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fullscreen-modal" onClick={() => setIsFullscreen(false)}>
          <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <button className="fullscreen-close" onClick={() => setIsFullscreen(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
                    <div className="fullscreen-chart">
                      {chartSpecs.map((spec, index) => (
                        <PlotlyChartRenderer 
                          key={`chart-${index}`}
                          chartSpec={spec} 
                          data={localData}
                          chartIndex={index}
                          datasetId={datasetId}
                          onChartFixed={handleChartFixed}
                          onFixingStatusChange={(isFixing) => setShowFixNotification(isFixing)}
                        />
                      ))}
                    </div>
          </div>
        </div>
      )}

      {/* Chart Zoom Modal */}
      {zoomedChartIndex !== null && chartSpecs[zoomedChartIndex] && (
        <div 
          className="fullscreen-modal" 
          onClick={() => setZoomedChartIndex(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}
        >
          <div 
            className="fullscreen-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90%',
              height: '90%',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '20px',
              position: 'relative',
              maxWidth: '1400px',
              maxHeight: '900px'
            }}
          >
            <button 
              className="fullscreen-close" 
              onClick={() => setZoomedChartIndex(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(0, 0, 0, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10001
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div style={{ width: '100%', height: '100%' }}>
              <PlotlyChartRenderer 
                chartSpec={chartSpecs[zoomedChartIndex]} 
                data={localData}
                chartIndex={zoomedChartIndex}
                datasetId={datasetId}
                onChartFixed={handleChartFixed}
                onFixingStatusChange={(isFixing) => setShowFixNotification(isFixing)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Dataset Preview Modal */}
      {showDatasetPreview && previewData && (
        <div className="fullscreen-modal" onClick={() => setShowDatasetPreview(false)}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Dataset Preview</h2>
                <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                  Showing {previewData.preview.length} of {previewData.total_rows.toLocaleString()} total rows
                </p>
              </div>
              <button className="fullscreen-close" onClick={() => setShowDatasetPreview(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="preview-table-container">
              {previewData.preview.length > 0 && (
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th style={{ background: '#f8f9fa', fontWeight: 600 }}>#</th>
                      {Object.keys(previewData.preview[0]).map((column) => (
                        <th key={column} style={{ background: '#f8f9fa', fontWeight: 600 }}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        <td style={{ background: '#f8f9fa', fontWeight: 500 }}>{rowIndex + 1}</td>
                        {Object.entries(row).map(([column, value]) => (
                          <td key={column}>
                            {value === null || value === undefined 
                              ? <span style={{ color: '#999', fontStyle: 'italic' }}>null</span>
                              : typeof value === 'number' 
                                ? value.toLocaleString(undefined, { maximumFractionDigits: 4 })
                                : String(value)
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="visualization-page-wrapper">
        <div className="dashboard-layout" style={{ userSelect: isResizing ? 'none' : 'auto' }}>
        {/* Modern Chat Sidebar - LEFT SIDE */}
        <aside className="chat-sidebar" style={{ width: `${sidebarWidth}px` }}>
          <div className="chat-header">
            <div className="chat-header-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3>AI Assistant</h3>
              </div>
              <span className={`chat-status ${isLoading ? 'thinking' : 'online'}`}>
                {isLoading ? 'Thinking...' : 'Online'}
              </span>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="chat-messages">
            {chatHistory.length === 0 ? (
              <div className="chat-welcome">
                <div className="assistant-avatar">AI</div>
                <div className="chat-bubble assistant-bubble">
                  <MarkdownMessage content={'Hi! I\'m your AI assistant. Ask me to create visualizations from your data.\n\n**Try:** "Show me a bar chart of average prices by bedroom count"'} />
                </div>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.type}-message`}>
                  <div className={`chat-avatar ${msg.type}-avatar`}>
                    {msg.type === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className={`chat-bubble ${msg.type}-bubble`}>
                    {msg.matchedChart && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        marginBottom: '8px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444'
                      }}>
                        <span>Chart {msg.matchedChart.index}: {msg.matchedChart.title || msg.matchedChart.type}</span>
                      </div>
                    )}
                    {msg.type === 'assistant' ? (
                      <>
                        {msg.codeType && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            marginBottom: '8px',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            color: '#6366f1',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {msg.codeType === 'plotly_edit' ? 'Chart Editor' : msg.codeType === 'add_chart_query' ? 'Add Chart' : 'Data Analysis'}
                          </div>
                        )}
                        <MarkdownMessage content={msg.message} />
                        {msg.codeType && msg.executableCode && (
                          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                            {msg.codeType === 'add_chart_query' ? (
                              <button
                                onClick={() => {
                                  if (msg.originalQuery) {
                                    handleAddChartFromChat(msg.originalQuery);
                                  }
                                }}
                                disabled={addingChart}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 16px',
                                  background: addingChart ? '#6b7280' : 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: addingChart ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s',
                                  opacity: addingChart ? 0.6 : 1,
                                  boxShadow: addingChart ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.2)'
                                }}
                                onMouseEnter={(e) => {
                                  if (!addingChart) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!addingChart) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
                                  }
                                }}
                              >
                                {addingChart ? (
                                  <span>Adding Chart...</span>
                                ) : (
                                  <span>Add Chart</span>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (msg.codeType === 'plotly_edit' && msg.matchedChart) {
                                    executePlotlyEdit(msg.executableCode!, msg.matchedChart.index);
                                  } else if (msg.codeType === 'analysis') {
                                    executeAnalysisCode(msg.executableCode!);
                                  }
                                }}
                                disabled={isExecutingCode}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 16px',
                                  background: isExecutingCode ? '#6b7280' : 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: isExecutingCode ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s',
                                  opacity: isExecutingCode ? 0.6 : 1,
                                  boxShadow: isExecutingCode ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.2)'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isExecutingCode) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isExecutingCode) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
                                  }
                                }}
                              >
                                {isExecutingCode ? (
                                  <span>Running...</span>
                                ) : (
                                  <span>{msg.codeType === 'plotly_edit' ? 'Run Code' : 'Run Analysis'}</span>
                                )}
                              </button>
                            )}
                            
                            {msg.failed && msg.retryable && (
                              <button
                                onClick={() => handleRetry(msg)}
                                disabled={isExecutingCode}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 16px',
                                  background: isExecutingCode ? '#6b7280' : 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: isExecutingCode ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s',
                                  opacity: isExecutingCode ? 0.6 : 1,
                                  boxShadow: isExecutingCode ? 'none' : '0 2px 8px rgba(245, 158, 11, 0.2)'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isExecutingCode) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isExecutingCode) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.2)';
                                  }
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                                </svg>
                                <span>Retry</span>
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      msg.message
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="chat-message assistant-message">
                <div className="chat-avatar assistant-avatar">AI</div>
                <div className="chat-bubble assistant-bubble" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                    <div className="magic-sparkles" style={{ marginBottom: 0, transform: 'scale(0.8)', justifyContent: 'flex-start' }}>
                      <span className="sparkle">*</span>
                      <span className="sparkle">*</span>
                      <span className="sparkle">*</span>
                      <span className="sparkle">*</span>
                      <span className="sparkle">*</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="chat-message error-message">
                <div className="chat-avatar assistant-avatar">AI</div>
                <div className="chat-bubble error-bubble">
                  Error: {error}
                </div>
              </div>
            )}
          </div>

          {/* Chat Input - Fixed at Bottom */}
          <div className="chat-input-container">
            <textarea
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your data..."
              className="chat-input"
              rows={2}
              disabled={isLoading}
            />
            <button 
              onClick={handleSubmit}
              disabled={!query.trim() || isLoading}
              className="chat-send-button"
              title={isLoading ? 'Generating...' : 'Send message'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                minWidth: '44px'
              }}
            >
              {isLoading ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 12 12"
                      to="360 12 12"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </path>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </aside>

        {/* Resize Handle */}
        <div 
          className={`resize-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={startResizing}
        >
          <div className="resize-indicator">
            <span></span>
            <span></span>
          </div>
        </div>

        {/* Main Dashboard Area - RIGHT SIDE (Takes ALL remaining space) */}
        <main className="dashboard-main">
          <div className="step-header">
            <div>
              <h1 className="step-title">Your Dashboard</h1>
              <p className="step-description">Ask questions to generate visualizations</p>
            </div>
            <div className="dashboard-controls">
              {/* Reupload Button */}
              <button 
                onClick={handleReuploadClick} 
                className="control-button"
                title="Upload New Dataset"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Change Data
              </button>

              {/* Dataset Preview Button - Show after first query */}
              {chatHistory.length > 0 && (
                <button 
                  onClick={fetchDatasetPreview} 
                  className="control-button"
                  disabled={loadingPreview}
                  title="View Dataset Preview"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                  {loadingPreview ? 'Loading...' : 'Dataset Preview'}
                </button>
              )}
              <div className="download-dropdown" ref={downloadMenuRef}>
                <button 
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)} 
                  className="control-button"
                  disabled={chartSpecs.length === 0}
                  title="Download Chart"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ marginLeft: '4px' }}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                </button>
                {showDownloadMenu && (
                  <div className="download-menu">
                    <div className="download-menu-header" style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #e5e7eb',
                      marginBottom: '4px'
                    }}>
                      <small style={{ color: '#666', fontSize: '12px' }}>
                        Tip: Use camera icon on each chart for individual PNG
                      </small>
                    </div>
                    <button onClick={() => downloadChart('png-zip')} className="download-menu-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      All Charts (ZIP)
                      <small style={{ marginLeft: 'auto', color: '#999', fontSize: '11px' }}>
                        {chartSpecs.length} PNG{chartSpecs.length > 1 ? 's' : ''}
                      </small>
                    </button>
                    <button onClick={() => downloadChart('pdf')} className="download-menu-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      PDF Report
                      <small style={{ marginLeft: 'auto', color: '#999', fontSize: '11px' }}>
                        {chartSpecs.length} page{chartSpecs.length > 1 ? 's' : ''}
                      </small>
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={handleShareDashboard} 
                className="control-button"
                disabled={chartSpecs.length === 0}
                title="Share Dashboard"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </button>
              <button 
                onClick={toggleFullscreen} 
                className="control-button"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                )}
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </button>
            </div>
          </div>

          <div className="visualization-container-large" ref={visualizationRef}>
            {/* Star Loading Animation - Only show when loading AND no charts exist yet */}
            {isLoading && chartSpecs.length === 0 && (
            <div className="magic-loading">
              <div className="magic-sparkles">
                <span className="sparkle">*</span>
                <span className="sparkle">*</span>
                <span className="sparkle">*</span>
                <span className="sparkle">*</span>
                <span className="sparkle">*</span>
              </div>
              <p className="magic-text">Crafting beautiful insights from your data...</p>
            </div>
            )}

            {/* Chart Display - Show when charts exist (even if loading) */}
            {(chartSpecs.length > 0 || (!isLoading && chartSpecs.length === 0)) && (
              <div className="chart-display">
                {chartSpecs.length > 0 ? (
                  <>
                          {/* Dashboard Title - Editable */}
                          <div style={{ 
                            padding: '24px 20px 0 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {isEditingTitle ? (
                              <input
                                type="text"
                                value={dashboardTitle}
                                onChange={(e) => setDashboardTitle(e.target.value)}
                                onBlur={() => setIsEditingTitle(false)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') setIsEditingTitle(false);
                                  if (e.key === 'Escape') setIsEditingTitle(false);
                                }}
                                autoFocus
                                style={{
                                  fontSize: '2rem',
                                  fontWeight: 700,
                                  padding: '12px 16px',
                                  border: '2px solid #ef4444',
                                  borderRadius: '12px',
                                  outline: 'none',
                                  width: '100%',
                                  maxWidth: '800px',
                                  fontFamily: 'inherit',
                                  background: 'white',
                                  transition: 'all 0.2s',
                                  textAlign: 'center',
                                  boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.1)'
                                }}
                              />
                            ) : (
                              <h2
                                onClick={() => setIsEditingTitle(true)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f9fafb';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                                title="Click to edit dashboard title"
                                style={{
                                  fontSize: '2rem',
                                  fontWeight: 700,
                                  color: '#1f2937',
                                  margin: 0,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  padding: '12px 20px',
                                  borderRadius: '12px',
                                  transition: 'all 0.2s',
                                  border: '2px solid transparent'
                                }}
                              >
                                {dashboardTitle}
                                <svg 
                                  width="20" 
                                  height="20" 
                                  viewBox="0 0 24 24" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  strokeWidth="2"
                                  style={{ 
                                    opacity: 0.4,
                                    transition: 'opacity 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
                                >
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </h2>
                            )}
                          </div>
                          
                          {/* Charts Grid */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 1000px), 1fr))',
                            gap: '24px',
                            padding: '20px',
                            alignItems: 'start'
                          }}>
                            {chartSpecs.map((spec, index) => (
                              <PlotlyChartRenderer 
                                key={`chart-${index}`}
                                chartSpec={spec} 
                                data={localData}
                                chartIndex={index}
                                datasetId={datasetId}
                                onChartFixed={handleChartFixed}
                                onFixingStatusChange={(isFixing) => setShowFixNotification(isFixing)}
                                onZoom={handleChartZoom}
                              />
                            ))}
                            
                            {/* Add Chart Button */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              minHeight: '400px',
                              width: '100%',
                              gridColumn: '1 / -1'
                            }}>
                              <button
                                onClick={() => setShowAddChartPopup(true)}
                                className="add-chart-button"
                                style={{
                                  width: '60px',
                                  height: '60px',
                                  borderRadius: '50%',
                                  border: '2px solid #ff6b6b',
                                  backgroundColor: 'white',
                                  color: '#ff6b6b',
                                  fontSize: '32px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#ff6b6b';
                                  e.currentTarget.style.color = 'white';
                                  e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'white';
                                  e.currentTarget.style.color = '#ff6b6b';
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                                title="Add new chart to dashboard"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="empty-state">
                          <p>Ask a question about your data to generate a visualization</p>
                          <p className="empty-state-hint">
                            Examples: "Show me a histogram of prices", "Create a scatter plot of sqft_living vs price"
                          </p>
                          {localData.length > 0 && (
                            <p className="empty-state-info" style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                              Ready to visualize {localData.length.toLocaleString()} rows
                            </p>
                          )}
                        </div>
                      )}
              </div>
            )}
          </div>
        </main>
      </div>
      </div>

      {/* Add Chart Popup */}
      <AddChartPopup
        isOpen={showAddChartPopup}
        onClose={() => setShowAddChartPopup(false)}
        onAddChart={handleAddChart}
        datasetId={datasetId}
        addingChart={addingChart}
      />

      {/* Chart Preview Modal */}
      {chartPreview && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={discardChartPreview}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              maxWidth: '1600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '32px',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>
                Chart Preview
              </h2>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Preview the updated chart before applying changes
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
              gap: '24px',
              marginBottom: '24px'
            }}>
              {/* Original Chart */}
              <div style={{
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                padding: '16px',
                backgroundColor: '#f9fafb'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#6b7280' }}>
                  Original Chart
                </h3>
                <div style={{ minHeight: '400px' }}>
                  {chartSpecs[chartPreview.chartIndex] && (
                    <PlotlyChartRenderer 
                      chartSpec={chartSpecs[chartPreview.chartIndex]} 
                      data={localData}
                      chartIndex={chartPreview.chartIndex}
                      datasetId={datasetId}
                      onChartFixed={handleChartFixed}
                      onFixingStatusChange={() => {}}
                      onZoom={() => {}}
                    />
                  )}
                </div>
              </div>

              {/* Preview Chart */}
              <div style={{
                border: '2px solid #6366f1',
                borderRadius: '12px',
                padding: '16px',
                backgroundColor: '#eef2ff'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#6366f1' }}>
                  Preview (New)
                </h3>
                <div style={{ minHeight: '400px' }}>
                  <PlotlyChartRenderer 
                    chartSpec={{
                      ...chartSpecs[chartPreview.chartIndex],
                      figure: chartPreview.figure,
                      chart_spec: chartPreview.code
                    }} 
                    data={localData}
                    chartIndex={chartPreview.chartIndex}
                    datasetId={datasetId}
                    onChartFixed={handleChartFixed}
                    onFixingStatusChange={() => {}}
                    onZoom={() => {}}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              paddingTop: '16px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                onClick={discardChartPreview}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                Discard
              </button>
              <button
                onClick={applyChartPreview}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};