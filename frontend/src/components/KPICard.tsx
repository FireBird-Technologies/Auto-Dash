import React, { useRef, useEffect, useState } from 'react';
import Plot from 'react-plotly.js';

interface KPICardProps {
  title: string;
  chartSpec: any;
  chartIndex: number;
}

export const KPICard: React.FC<KPICardProps> = ({ title, chartSpec, chartIndex }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 280, height: 100 });
  const figureData = chartSpec?.figure;
  
  console.log(`KPICard ${chartIndex}: title="${title}", has figure=${!!figureData}, chartSpec=`, chartSpec);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: width || 280, height: height || 100 });
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Placeholder when loading
  if (!figureData) {
    return (
      <div 
        ref={containerRef}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          flex: '1 1 0',
          minWidth: '0',
          height: '100px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        }}>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Loading...</div>
      </div>
    );
  }

  // Extract the indicator data for clean display
  const indicatorData = figureData.data?.[0];
  const value = indicatorData?.value;
  const indicatorTitle = indicatorData?.title?.text || title;

  // If we have valid indicator data, render a clean custom KPI card
  if (indicatorData?.type === 'indicator' && value !== undefined) {
    // Format the value nicely
    const formatValue = (val: number | string) => {
      if (typeof val === 'number') {
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
        if (Number.isInteger(val)) return val.toLocaleString();
        return val.toFixed(2);
      }
      return String(val);
    };

    return (
      <div 
        ref={containerRef}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          flex: '1 1 0',
          minWidth: '0',
          height: '100px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '12px 16px',
        }}
      >
        <div style={{ 
          fontSize: '11px', 
          fontWeight: 500, 
          color: '#6b7280', 
          marginBottom: '6px',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {indicatorTitle}
        </div>
        <div style={{ 
          fontSize: '28px', 
          fontWeight: 700, 
          color: '#111827',
          lineHeight: 1.1
        }}>
          {formatValue(value)}
        </div>
      </div>
    );
  }

  // Fallback: render with Plotly for other indicator types
  return (
    <div 
      ref={containerRef}
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        flex: '1 1 0',
        minWidth: '0',
        height: '100px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <Plot
        data={figureData.data || []}
        layout={{
          autosize: false,
          width: dimensions.width,
          height: dimensions.height,
          margin: { l: 8, r: 8, t: 30, b: 8 },
          paper_bgcolor: 'white',
          plot_bgcolor: 'white',
          showlegend: false,
        }}
        config={{
          displayModeBar: false,
          responsive: true,
          staticPlot: true,
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

// KPI Cards Container - Limit to 3 cards
interface KPICardsContainerProps {
  kpiSpecs: any[];
}

export const KPICardsContainer: React.FC<KPICardsContainerProps> = ({ kpiSpecs }) => {
  console.log('KPICardsContainer received specs:', kpiSpecs?.length, kpiSpecs);
  
  if (!kpiSpecs || kpiSpecs.length === 0) {
    console.log('KPICardsContainer: No KPI specs to display');
    return null;
  }

  const limitedKpis = kpiSpecs.slice(0, 3);
  console.log('KPICardsContainer: Displaying', limitedKpis.length, 'KPI cards');

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      padding: '12px 20px',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      {limitedKpis.map((spec, index) => (
        <KPICard
          key={`kpi-${index}`}
          title={spec.title || `KPI ${index + 1}`}
          chartSpec={spec}
          chartIndex={index}
        />
      ))}
    </div>
  );
};

export default KPICard;
