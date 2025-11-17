import { useEffect, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import { config, getAuthHeaders } from '../config';

interface PlotlyChartRendererProps {
  chartSpec: any;
  data: any[];
  chartIndex?: number;
  onChartFixed?: (chartIndex: number, fixedCode: string) => void;
}

export const PlotlyChartRenderer: React.FC<PlotlyChartRendererProps> = ({ 
  chartSpec, 
  data, 
  chartIndex = 0,
  onChartFixed
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [figureData, setFigureData] = useState<any>(null);
  const [chartHeight, setChartHeight] = useState(600);

  useEffect(() => {
    if (!chartSpec) return;

    setRenderError(null);
    setIsFixing(false);

    console.log(`Chart ${chartIndex} - Data length:`, data.length);

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
      
      // Show fixing message and attempt to fix
      showFixingMessage();
      attemptFix(errorMessage, chartSpec);
    }
  }, [chartSpec, data, chartIndex]);

  const showFixingMessage = () => {
    setIsFixing(true);
  };

  useEffect(() => {
    const updateHeight = () => {
      if (typeof window === 'undefined') return;
      const viewportHeight = window.innerHeight || 800;
      const calculatedHeight = Math.max(380, Math.min(720, viewportHeight * 0.65));
      setChartHeight(calculatedHeight);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const attemptFix = async (errorMessage: string, chartSpec: any) => {
    try {
      // Extract Plotly code from chartSpec
      let plotlyCode = '';
      if (typeof chartSpec === 'string') {
        plotlyCode = chartSpec;
      } else if (chartSpec && typeof chartSpec === 'object') {
        plotlyCode = chartSpec.chart_spec || chartSpec.plotly_code || JSON.stringify(chartSpec);
      }

      showFixingMessage();
      
      // Call fix-visualization endpoint
      const response = await fetch(`${config.backendUrl}/api/data/fix-visualization`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({
          d3_code: plotlyCode,  // Backend still uses this field name
          error_message: errorMessage
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setIsFixing(false);

      if (result.fix_failed) {
        setRenderError(errorMessage);
      } else if (result.fixed_complete_code) {
        // Notify parent that chart was fixed
        if (onChartFixed) {
          onChartFixed(chartIndex, result.fixed_complete_code);
        }
        
        // Note: The fixed code needs to be re-executed on the backend
        // For now, just show a message
        setRenderError('Chart fixed - please refresh to see the updated visualization');
      }
    } catch (err) {
      console.error('Failed to fix visualization:', err);
      setIsFixing(false);
      setRenderError(errorMessage);
    }
  };

  if (isFixing) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#1976d2', background: '#e3f2fd', borderRadius: '8px', margin: '20px' }}>
        <div style={{ display: 'inline-block', marginBottom: '15px' }}>
          <div style={{ width: '24px', height: '24px', border: '3px solid #1976d2', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#1976d2' }}>🔧 Fixing visualization...</h3>
        <p style={{ margin: '0', fontSize: '14px', color: '#666', fontWeight: '500' }}>Sorry for the wait, taking longer than expected</p>
        <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#999' }}>Our AI is analyzing the error and generating a fix.</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (renderError) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#d32f2f', background: '#ffebee', borderRadius: '8px', margin: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>⚠️ Visualization Error</h3>
        <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>{renderError}</p>
        <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#999' }}>Try rephrasing your query or asking for a different type of visualization.</p>
      </div>
    );
  }

  if (!figureData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading chart...</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="plotly-chart-container"
      style={{
        width: '100%',
        height: `${chartHeight}px`,
        maxHeight: '80vh',
        position: 'relative'
      }}
    >
      <Plot
        data={figureData.data || []}
        layout={{
          ...figureData.layout,
          autosize: true,
          height: chartHeight,
          margin: figureData.layout?.margin || { l: 60, r: 30, t: 80, b: 60 }
        }}
        config={{
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['sendDataToCloud']
        }}
        style={{ width: '100%', height: `${chartHeight}px` }}
        useResizeHandler={true}
      />
    </div>
  );
};



