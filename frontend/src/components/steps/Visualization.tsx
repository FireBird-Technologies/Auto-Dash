import React, { useState, useEffect, useRef } from 'react';
import { D3ChartRenderer } from '../D3ChartRenderer';
import { config, getAuthHeaders } from '../../config';

type Row = Record<string, number | string>;

interface VisualizationProps {
  data: Row[];
  datasetId: string;
  context: {
    description: string;
    colorTheme?: string;
  };
}

export const Visualization: React.FC<VisualizationProps> = ({ data, datasetId, context }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chartSpecs, setChartSpecs] = useState<any[]>([]);  // Changed to array
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'assistant', message: string}>>([]);
  const [contextPrepared, setContextPrepared] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [localData, setLocalData] = useState<Row[]>(data); // Local copy that may be full dataset
  const [fullDataFetched, setFullDataFetched] = useState(false); // Track if we've fetched full data
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const hasGeneratedInitialChart = useRef(false);
  const visualizationRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

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
        console.log(`✅ Full dataset loaded: ${result.rows} rows (Total: ${result.total_rows_in_dataset} rows)`);
        
        // Show warning if data was limited
        if (result.limited) {
          console.warn(`⚠️ Dataset limited to ${result.rows} rows for performance (Total dataset: ${result.total_rows_in_dataset} rows)`);
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
  const handleChartFixed = (chartIndex: number, fixedCode: string) => {
    console.log(`Updating chart ${chartIndex} with fixed code`);
    setChartSpecs(prevSpecs => {
      const newSpecs = [...prevSpecs];
      if (newSpecs[chartIndex]) {
        newSpecs[chartIndex] = {
          ...newSpecs[chartIndex],
          chart_spec: fixedCode
        };
      }
      return newSpecs;
    });
  };

  const generateChart = async (userQuery: string) => {
    if (!userQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    // Add user message and thinking message in one update to avoid duplication
    setChatHistory(prev => [
      ...prev,
      { type: 'user', message: userQuery },
      { type: 'assistant', message: ' Analyzing your data and generating visualization...' }
    ]);

    try {
      // Use /analyze for first chart, /chat for subsequent queries
      const endpoint = chartSpecs.length > 0 ? 'chat' : 'analyze';
      
      const response = await fetch(`${config.backendUrl}/api/data/${endpoint}`, {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate chart');
      }

      const result = await response.json();
      
      // Fetch full dataset before rendering chart (if not already fetched)
      await fetchFullDataset();
      
      // Remove the thinking message and update chart specs
      setChatHistory(prev => prev.slice(0, -1));
      
      // Handle both array (new format) and single chart (old format)
      if (result.charts && Array.isArray(result.charts)) {
        // New format: array of charts
        setChartSpecs(result.charts);
      } else if (result.chart_spec) {
        // Old format: single chart - wrap in array
        setChartSpecs([{ chart_spec: result.chart_spec, chart_type: 'unknown', title: 'Visualization', chart_index: 0 }]);
      }
      
    } catch (err) {
      console.error('Error generating chart:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate chart';
      setError(errorMessage);
      
      // Replace thinking message with error
      setChatHistory(prev => {
        const newHistory = prev.slice(0, -1);
        return [...newHistory, { 
          type: 'assistant', 
          message: `❌ ${errorMessage}` 
        }];
      });
    } finally {
      setIsLoading(false);
      setQuery('');
    }
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

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const downloadChart = (format: 'png' | 'pdf' | 'svg') => {
    if (!visualizationRef.current) return;

    // Check if there's any content to download
    if (visualizationRef.current.children.length === 0) {
      alert('No chart to download');
      return;
    }

    const timestamp = new Date().getTime();

    if (format === 'svg') {
      // For SVG, we'll use html2canvas to convert the entire container to SVG
      // This ensures we capture all content including multiple charts
      import('html2canvas').then((html2canvas) => {
        html2canvas.default(visualizationRef.current!, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          allowTaint: true
        }).then(canvas => {
          // Convert canvas to SVG
          const svgData = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">
            <image href="${canvas.toDataURL()}" width="${canvas.width}" height="${canvas.height}"/>
          </svg>`;
          
          const blob = new Blob([svgData], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `dashboard-${timestamp}.svg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        });
      });
    } else if (format === 'png') {
      // Download as PNG - capture entire visualization area
      // Use html2canvas to capture the entire container
      import('html2canvas').then((html2canvas) => {
        html2canvas.default(visualizationRef.current!, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          allowTaint: true
        }).then(canvas => {
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `dashboard-${timestamp}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }
          });
        });
      });
    } else if (format === 'pdf') {
      // Download as PDF - capture entire visualization area
      const containerRect = visualizationRef.current.getBoundingClientRect();
      
      import('html2canvas').then((html2canvas) => {
        import('jspdf').then(({ jsPDF }) => {
          html2canvas.default(visualizationRef.current!, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: true
          }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
              orientation: containerRect.width > containerRect.height ? 'landscape' : 'portrait',
              unit: 'px',
              format: [containerRect.width, containerRect.height]
            });
            
            pdf.addImage(imgData, 'PNG', 0, 0, containerRect.width, containerRect.height);
            pdf.save(`dashboard-${timestamp}.pdf`);
          });
        });
      });
    }

    setShowDownloadMenu(false);
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
                        <D3ChartRenderer 
                          key={`chart-${index}`}
                          chartSpec={spec.chart_spec} 
                          data={localData}
                          chartIndex={index}
                          onChartFixed={handleChartFixed}
                        />
                      ))}
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
                {isLoading ? '● Thinking...' : '● Online'}
              </span>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="chat-messages">
            {chatHistory.length === 0 ? (
              <div className="chat-welcome">
                <div className="assistant-avatar">AI</div>
                <div className="chat-bubble assistant-bubble">
                  <p>Hi! I'm your AI assistant. Ask me to create visualizations from your data.</p>
                  <p className="chat-hint">Try: "Show me a bar chart of average prices by bedroom count"</p>
                </div>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.type}-message`}>
                  <div className={`chat-avatar ${msg.type}-avatar`}>
                    {msg.type === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className={`chat-bubble ${msg.type}-bubble`}>
                    {msg.message}
                  </div>
                </div>
              ))
            )}
            {error && (
              <div className="chat-message error-message">
                <div className="chat-avatar assistant-avatar">AI</div>
                <div className="chat-bubble error-bubble">
                  ❌ {error}
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
            >
              {isLoading ? '⏳' : '➤'}
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
                    <button onClick={() => downloadChart('png')} className="download-menu-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      PNG Image
                    </button>
                    <button onClick={() => downloadChart('svg')} className="download-menu-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                      SVG Vector
                    </button>
                    <button onClick={() => downloadChart('pdf')} className="download-menu-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      PDF Document
                    </button>
                  </div>
                )}
              </div>
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
            {/* Magic Loading Animation - Show when loading and no charts yet */}
            {isLoading && chartSpecs.length === 0 && (
            <div className="magic-loading">
              <div className="magic-sparkles">
                <span className="sparkle">•</span>
                <span className="sparkle">•</span>
                <span className="sparkle">•</span>
                <span className="sparkle">•</span>
                <span className="sparkle">•</span>
              </div>
              <p className="magic-text">Transforming your data into art..</p>
            </div>
            )}

            {/* Chart Display - Show when not loading OR when charts exist */}
            {(!isLoading || chartSpecs.length > 0) && (
                    <div className="chart-display">
                      {chartSpecs.length > 0 ? (
                        chartSpecs.map((spec, index) => (
                          <D3ChartRenderer 
                            key={`chart-${index}`}
                            chartSpec={spec.chart_spec} 
                            data={localData}
                            chartIndex={index}
                            onChartFixed={handleChartFixed}
                          />
                        ))
                      ) : (
                        <div className="empty-state">
                          <p>Ask a question about your data to generate a visualization</p>
                          <p className="empty-state-hint">
                            Examples: "Show me a histogram of prices", "Create a scatter plot of sqft_living vs price"
                          </p>
                          {localData.length > 0 && (
                            <p className="empty-state-info" style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                              📊 Ready to visualize {localData.length.toLocaleString()} rows
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
    </>
  );
};