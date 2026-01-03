import { useEffect, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import { config, getAuthHeaders, checkAuthResponse } from '../config';
import { useNotification } from '../contexts/NotificationContext';

interface PlotlyChartRendererProps {
  chartSpec: any;
  data: any[];
  chartIndex?: number;
  datasetId?: string;
  onChartFixed?: (chartIndex: number, fixedCode: string, figureData?: any) => void;
  onFixingStatusChange?: (isFixing: boolean) => void;
  onZoom?: (chartIndex: number) => void;
  viewMode?: 'list' | 'grid';
}

// Helper function to sanitize verbose Plotly error messages
const sanitizeErrorMessage = (error: string): string => {
  // Extract the main error message, removing verbose Plotly details
  if (error.includes('Invalid property specified')) {
    const match = error.match(/Invalid property specified[^:]+:\s*['"]([^'"]+)['"]/);
    if (match) {
      return `Invalid property "${match[1]}" used in chart configuration.`;
    }
    return 'Invalid property used in chart configuration.';
  }
  
  // Handle "Did you mean" suggestions
  if (error.includes('Did you mean')) {
    const suggestionMatch = error.match(/Did you mean\s+["']([^"']+)["']/);
    if (suggestionMatch) {
      return `Chart configuration error. Did you mean "${suggestionMatch[1]}"?`;
    }
  }
  
  // Handle "Bad property path" errors
  if (error.includes('Bad property path')) {
    const pathMatch = error.match(/Bad property path:\s*([^\n]+)/);
    if (pathMatch) {
      return `Invalid chart property: ${pathMatch[1].trim()}`;
    }
    return 'Invalid chart property configuration.';
  }
  
  // For other errors, show first line or truncate
  const firstLine = error.split('\n')[0];
  if (firstLine.length > 150) {
    return firstLine.substring(0, 150) + '...';
  }
  
  return firstLine;
};

export const PlotlyChartRenderer: React.FC<PlotlyChartRendererProps> = ({ 
  chartSpec, 
  data, 
  chartIndex = 0,
  datasetId,
  onChartFixed,
  onFixingStatusChange,
  onZoom,
  viewMode = 'list'
}) => {
  const notification = useNotification();
  const containerRef = useRef<HTMLDivElement>(null);
  const [figureData, setFigureData] = useState<any>(null);
  const [isFixing, setIsFixing] = useState<boolean>(false);
  // Track if ANY fix was attempted (not just specific error messages)
  const fixAttemptedRef = useRef<boolean>(false);
  const lastChartIndexRef = useRef<number>(chartIndex);
  const originalErrorRef = useRef<string | null>(null); // Store original error for fixing
  
  // Edit mode state variables
  const [isEditMode, setIsEditMode] = useState(false);
  const [editInput, setEditInput] = useState('');
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [editPreview, setEditPreview] = useState<{code: string, figure: any, reasoning: string} | null>(null);

  useEffect(() => {
    if (!chartSpec) return;

    // ONLY reset fix flag if we moved to a DIFFERENT chart
    if (lastChartIndexRef.current !== chartIndex) {
      fixAttemptedRef.current = false;
      lastChartIndexRef.current = chartIndex;
      console.log(`Chart ${chartIndex}: New chart detected, resetting fix flag`);
    }

    // Don't reset fix flag on every render - this was causing the loop!
    console.log(`Chart ${chartIndex} - Data length:`, data.length);
    console.log(`Chart ${chartIndex} - Fix attempted:`, fixAttemptedRef.current);

    try {
      // Check if chart has a pre-rendered figure (from backend execution)
      if (chartSpec.figure) {
        setFigureData(chartSpec.figure);
      } else if (chartSpec.execution_error) {
        // Chart execution failed on backend
        throw new Error(chartSpec.execution_error);
      } else {
        throw new Error('No figure data available');
      }
    } catch (error: any) {
      const rawErrorMessage = error instanceof Error ? error.message : 'Unknown rendering error';
      const errorMessage = sanitizeErrorMessage(rawErrorMessage);
      
      // Store original error for fixing (backend needs full details)
      originalErrorRef.current = rawErrorMessage;
      
      console.error(`Chart ${chartIndex} - Error rendering:`, error);
      
      // Show fixing message and attempt to fix (only if not already attempted)
            if (!fixAttemptedRef.current) {
              console.log(`Chart ${chartIndex}: First error, attempting fix`);
              // Pass original error to fix endpoint for better debugging
              attemptFix(originalErrorRef.current || errorMessage, chartSpec);
            } else {
              console.log(`Chart ${chartIndex}: Fix already attempted, showing error`);
            }
    }
  }, [chartSpec, data, chartIndex]);


  const attemptFix = async (errorMessage: string, chartSpec: any) => {
    if (fixAttemptedRef.current) {
      console.log(`Chart ${chartIndex}: Fix already attempted, skipping`);
      return;
    }
    
    fixAttemptedRef.current = true;
    console.log(`Chart ${chartIndex}: Attempting fix (this will only happen once)`);
    
    try {
      let plotlyCode = '';
      if (typeof chartSpec === 'string') {
        plotlyCode = chartSpec;
      } else if (chartSpec && typeof chartSpec === 'object') {
        plotlyCode = chartSpec.chart_spec || chartSpec.plotly_code || JSON.stringify(chartSpec);
      }

      // Set loading state
      setIsFixing(true);
      
      // Notify parent that we're fixing
      if (onFixingStatusChange) {
        onFixingStatusChange(true);
      }
      
      const response = await fetch(`${config.backendUrl}/api/data/fix-visualization`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          plotly_code: plotlyCode,
          error_message: errorMessage,
          dataset_id: datasetId
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Clear loading state
      setIsFixing(false);
      
      // Notify parent that fixing is done
      if (onFixingStatusChange) {
        onFixingStatusChange(false);
      }

      if (result.fix_failed) {
        console.log(`Chart ${chartIndex}: Fix failed, will not retry`);
      } else if (result.figure) {
        // Display the fixed figure immediately
        console.log(`Chart ${chartIndex}: Fix succeeded, displaying new figure`);
        setFigureData(result.figure);
        
        // Notify parent with the fixed code AND figure data to update dashboard
        if (onChartFixed && result.fixed_complete_code) {
          onChartFixed(chartIndex, result.fixed_complete_code, result.figure);
        }
      } else if (result.fixed_complete_code) {
        // Fallback if no figure returned
        console.log(`Chart ${chartIndex}: Fix succeeded but no figure data`);
        if (onChartFixed) {
          onChartFixed(chartIndex, result.fixed_complete_code);
        }
      }
    } catch (err) {
      console.error(`Chart ${chartIndex}: Failed to fix visualization:`, err);
      setIsFixing(false);
      if (onFixingStatusChange) {
        onFixingStatusChange(false);
      }
    }
  };

  const handleChartClick = () => {
    if (onZoom && figureData) {
      onZoom(chartIndex);
    }
  };

  const handleApplyEdit = () => {
    if (!editPreview || !onChartFixed) return;
    
    // Call the onChartFixed callback to update the chart
    onChartFixed(chartIndex, editPreview.code, editPreview.figure);
    
    // Clear the preview
    setEditPreview(null);
  };

  const handleDiscardEdit = () => {
    // Simply clear the preview
    setEditPreview(null);
  };

  const downloadCode = () => {
    if (!chartSpec?.chart_spec) return;
    
    const code = chartSpec.chart_spec;
    const title = chartSpec.title || 'chart';
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.py`;
    
    // Create blob with Python code
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create download link and trigger
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleEditSubmit = async () => {
    if (!editInput.trim() || !chartSpec?.chart_spec || !datasetId) return;
    
    setIsLoadingEdit(true);
    
    try {
      const response = await fetch(`${config.backendUrl}/api/data/edit-chart`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json'
        }),
        credentials: 'include',
        body: JSON.stringify({
          chart_index: chartIndex,
          edit_request: editInput,
          current_code: chartSpec.chart_spec,
          dataset_id: datasetId
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        throw new Error('Failed to edit chart');
      }

      const result = await response.json();

      if (result.success) {
        setEditPreview({
          code: result.edited_code,
          figure: result.figure,
        reasoning: result.reasoning
      });
    } else {
      notification.error(`Failed to edit chart: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error editing chart:', error);
    notification.error(`Error editing chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setIsLoadingEdit(false);
    setIsEditMode(false);
      setEditInput('');
    }
  };

  return (
    <div 
      ref={containerRef}
      className="plotly-chart-container"
      onClick={handleChartClick}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '600px',
        position: 'relative',
        padding: '12px',
        backgroundColor: '#ffffff',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
      }}
    >
      {/* Edit Button - Top Left */}
      {chartSpec?.chart_spec && datasetId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditMode(true);
          }}
          title="Edit chart"
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 100,
            background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: '500',
            color: 'white',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.2)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>Edit</span>
        </button>
      )}
      
      {/* Download Code Button */}
      {chartSpec?.chart_spec && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            downloadCode();
          }}
          title="Download Python code"
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            zIndex: 100,
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#374151',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.borderColor = '#ef4444';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
            e.currentTarget.style.color = '#374151';
            e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Code</span>
        </button>
      )}
      
      {/* Loading overlay when fixing */}
      {isFixing && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          borderRadius: '8px',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{
            marginTop: '16px',
            fontSize: '14px',
            color: '#666',
            fontWeight: '500'
          }}>
            Fixing chart...
          </p>
        </div>
      )}
      
      {/* Edit Input Popup Modal */}
      {isEditMode && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => {
            setIsEditMode(false);
            setEditInput('');
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '18px', 
              fontWeight: 600,
              color: '#1f2937'
            }}>
              Edit Chart
            </h3>
            <input
              type="text"
              value={editInput}
              onChange={(e) => setEditInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editInput.trim()) {
                  handleEditSubmit();
                }
                if (e.key === 'Escape') {
                  setIsEditMode(false);
                  setEditInput('');
                }
              }}
              placeholder="Describe your edits (e.g., 'make bars blue', 'add title')"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
                marginBottom: '16px',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#ef4444'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
            />
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setIsEditMode(false);
                  setEditInput('');
                }}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#374151',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
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
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={!editInput.trim() || isLoadingEdit}
                style={{
                  padding: '10px 20px',
                  background: editInput.trim() && !isLoadingEdit 
                    ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)' 
                    : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: editInput.trim() && !isLoadingEdit ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  minWidth: '100px',
                  boxShadow: editInput.trim() && !isLoadingEdit ? '0 2px 8px rgba(239, 68, 68, 0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (editInput.trim() && !isLoadingEdit) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (editInput.trim() && !isLoadingEdit) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
                  }
                }}
              >
                {isLoadingEdit ? 'Editing...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Render chart */}
      {figureData && (
        <div style={{
          width: '100%',
          height: '100%',
          flex: 1,
          minHeight: 0
        }}>
          <Plot
            data={figureData.data || []}
            layout={{
              ...figureData.layout,
              autosize: true,
              width: undefined,
              height: undefined,
              margin: figureData.layout?.margin || (viewMode === 'grid' 
                ? { l: 50, r: 25, t: 60, b: 50 }
                : { l: 60, r: 30, t: 80, b: 60 })
            }}
            config={{
              responsive: true,
              displayModeBar: true,
              displaylogo: false,
              modeBarButtonsToRemove: ['sendDataToCloud']
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </div>
      )}
      
      {/* Preview Comparison Modal */}
      {editPreview && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}
          onClick={handleDiscardEdit}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '1800px',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '32px',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Reasoning */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ 
                margin: '0 0 12px 0', 
                fontSize: '24px', 
                fontWeight: 600,
                color: '#1f2937'
              }}>
                Chart Preview
              </h2>
              {editPreview.reasoning && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#f0f9ff',
                  borderLeft: '4px solid #3b82f6',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#374151'
                }}>
                  <strong>Changes:</strong> {editPreview.reasoning}
                </div>
              )}
            </div>

            {/* Side-by-side comparison */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '24px'
            }}>
              {/* Current Chart */}
              <div style={{
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                padding: '16px',
                backgroundColor: '#f9fafb'
              }}>
                <h3 style={{ 
                  margin: '0 0 16px 0', 
                  fontSize: '16px', 
                  fontWeight: 600,
                  color: '#6b7280'
                }}>
                  Current Chart
                </h3>
                <div style={{ minHeight: '500px' }}>
                  {figureData && (
                    <Plot
                      data={figureData.data || []}
                      layout={{
                        ...figureData.layout,
                        autosize: true,
                        width: undefined,
                        height: undefined
                      }}
                      config={{
                        responsive: true,
                        displayModeBar: true,
                        displaylogo: false
                      }}
                      style={{ width: '100%', height: '500px' }}
                    />
                  )}
                </div>
              </div>

              {/* Preview Chart */}
              <div style={{
                border: '2px solid #ef4444',
                borderRadius: '12px',
                padding: '16px',
                backgroundColor: '#fef2f2'
              }}>
                <h3 style={{ 
                  margin: '0 0 16px 0', 
                  fontSize: '16px', 
                  fontWeight: 600,
                  color: '#ef4444'
                }}>
                  Preview (New)
                </h3>
                <div style={{ minHeight: '500px' }}>
                  {editPreview.figure && (
                    <Plot
                      data={editPreview.figure.data || []}
                      layout={{
                        ...editPreview.figure.layout,
                        autosize: true,
                        width: undefined,
                        height: undefined
                      }}
                      config={{
                        responsive: true,
                        displayModeBar: true,
                        displaylogo: false
                      }}
                      style={{ width: '100%', height: '500px' }}
                    />
                  )}
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
                onClick={handleDiscardEdit}
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
                onClick={handleApplyEdit}
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
    </div>
  );
};



