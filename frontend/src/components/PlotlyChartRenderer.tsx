import { useEffect, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import { config, getAuthHeaders } from '../config';

interface PlotlyChartRendererProps {
  chartSpec: any;
  data: any[];
  chartIndex?: number;
  datasetId?: string;
  onChartFixed?: (chartIndex: number, fixedCode: string) => void;
  onFixingStatusChange?: (isFixing: boolean) => void;
}

export const PlotlyChartRenderer: React.FC<PlotlyChartRendererProps> = ({ 
  chartSpec, 
  data, 
  chartIndex = 0,
  datasetId,
  onChartFixed,
  onFixingStatusChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [figureData, setFigureData] = useState<any>(null);
  // Track if ANY fix was attempted (not just specific error messages)
  const fixAttemptedRef = useRef<boolean>(false);
  const lastChartIndexRef = useRef<number>(chartIndex);

  useEffect(() => {
    if (!chartSpec) return;

    // ONLY reset fix flag if we moved to a DIFFERENT chart
    if (lastChartIndexRef.current !== chartIndex) {
      fixAttemptedRef.current = false;
      lastChartIndexRef.current = chartIndex;
      console.log(`Chart ${chartIndex}: New chart detected, resetting fix flag`);
    }

    // Don't reset fix flag on every render - this was causing the loop!
    setRenderError(null);
    setIsFixing(false);

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown rendering error';
      console.error(`Chart ${chartIndex} - Error rendering:`, error);
      setRenderError(errorMessage);
      
      // Show fixing message and attempt to fix (only if not already attempted)
            if (!fixAttemptedRef.current) {
              console.log(`Chart ${chartIndex}: First error, attempting fix`);
              attemptFix(errorMessage, chartSpec);
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
        setRenderError(errorMessage);
      } else if (result.figure) {
        // Display the fixed figure immediately
        console.log(`Chart ${chartIndex}: Fix succeeded, displaying new figure`);
        setFigureData(result.figure);
        setRenderError(null);
        
        // Optionally notify parent with the fixed code
        if (onChartFixed && result.fixed_complete_code) {
          onChartFixed(chartIndex, result.fixed_complete_code);
        }
      } else if (result.fixed_complete_code) {
        // Fallback if no figure returned
        console.log(`Chart ${chartIndex}: Fix succeeded but no figure data`);
        if (onChartFixed) {
          onChartFixed(chartIndex, result.fixed_complete_code);
        }
        setRenderError('Chart fixed - please refresh to see the updated visualization');
      }
    } catch (err) {
      console.error(`Chart ${chartIndex}: Failed to fix visualization:`, err);
      if (onFixingStatusChange) {
        onFixingStatusChange(false);
      }
      setRenderError(errorMessage);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="plotly-chart-container"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '600px',
        position: 'relative'
      }}
    >
      {/* Render error or chart */}
      {renderError ? (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          color: '#d32f2f', 
          background: 'linear-gradient(135deg, #fff5f7, #ffe4e6)', 
          borderRadius: '16px', 
          margin: '20px',
          border: '1px solid rgba(255, 107, 107, 0.15)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '600' }}>⚠️ Visualization Error</h3>
          <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>{renderError}</p>
          <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#999' }}>Try rephrasing your query or asking for a different type of visualization.</p>
        </div>
      ) : !figureData ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          <p>Loading chart...</p>
        </div>
      ) : (
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



