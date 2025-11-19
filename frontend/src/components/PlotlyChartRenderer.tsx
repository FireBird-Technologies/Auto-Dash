import { useEffect, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import { config, getAuthHeaders } from '../config';

interface PlotlyChartRendererProps {
  chartSpec: any;
  data: any[];
  chartIndex?: number;
  datasetId?: string;
  onChartFixed?: (chartIndex: number, fixedCode: string, figureData?: any) => void;
  onFixingStatusChange?: (isFixing: boolean) => void;
  onZoom?: (chartIndex: number) => void;
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
  onZoom
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [figureData, setFigureData] = useState<any>(null);
  // Track if ANY fix was attempted (not just specific error messages)
  const fixAttemptedRef = useRef<boolean>(false);
  const lastChartIndexRef = useRef<number>(chartIndex);
  const originalErrorRef = useRef<string | null>(null); // Store original error for fixing

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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
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

  return (
    <div 
      ref={containerRef}
      className="plotly-chart-container"
      onClick={handleChartClick}
      style={{
        width: '100%',
        maxWidth: '1000px',
        height: '800px',
        minHeight: '800px',
        position: 'relative',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '8px',
        padding: '12px',
        backgroundColor: '#ffffff',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
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
      {/* Render chart */}
      {figureData && (
        <Plot
          data={figureData.data || []}
          layout={{
            ...figureData.layout,
            autosize: true,
            margin: figureData.layout?.margin || { l: 60, r: 30, t: 80, b: 60 }
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
      )}
    </div>
  );
};



