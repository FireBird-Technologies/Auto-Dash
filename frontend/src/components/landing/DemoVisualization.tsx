import { useState, useRef, useEffect } from 'react';
import Plot from 'react-plotly.js';

// Bar chart data - Tech Startup Valuations
const barChartData = [
  { name: 'NeuralTech AI', value: 2850, category: 'AI/ML', growth: 245, employees: 450 },
  { name: 'QuantumScale', value: 1920, category: 'Cloud', growth: 189, employees: 380 },
  { name: 'CyberShield Pro', value: 1650, category: 'Security', growth: 167, employees: 290 },
  { name: 'DataFlow Systems', value: 1480, category: 'Analytics', growth: 145, employees: 320 },
  { name: 'BlockChain Labs', value: 1320, category: 'Crypto', growth: 198, employees: 210 },
  { name: 'EdgeCompute Inc', value: 1180, category: 'Cloud', growth: 134, employees: 260 },
  { name: 'SmartVision AI', value: 1050, category: 'AI/ML', growth: 156, employees: 195 },
  { name: 'SecureNet', value: 920, category: 'Security', growth: 112, employees: 180 },
  { name: 'DataMesh', value: 850, category: 'Analytics', growth: 98, employees: 150 },
  { name: 'CloudNative', value: 780, category: 'Cloud', growth: 87, employees: 140 },
];

// Scatter plot data - GDP per Country
const scatterData = [
  { country: 'USA', gdp: 68309, energy: 6895, population: 331 },
  { country: 'China', gdp: 12720, energy: 2237, population: 1425 },
  { country: 'Japan', gdp: 33950, energy: 3310, population: 125 },
  { country: 'Germany', gdp: 48756, energy: 3752, population: 83 },
  { country: 'UK', gdp: 46371, energy: 2705, population: 67 },
  { country: 'India', gdp: 2389, energy: 637, population: 1417 },
  { country: 'France', gdp: 42330, energy: 3525, population: 67 },
  { country: 'Italy', gdp: 35551, energy: 2598, population: 59 },
  { country: 'Canada', gdp: 52051, energy: 7333, population: 38 },
  { country: 'South Korea', gdp: 34758, energy: 5851, population: 52 },
  { country: 'Spain', gdp: 30116, energy: 2686, population: 47 },
  { country: 'Australia', gdp: 64491, energy: 5450, population: 26 },
  { country: 'Netherlands', gdp: 57534, energy: 4375, population: 17 },
  { country: 'Switzerland', gdp: 91992, energy: 2923, population: 9 },
  { country: 'Sweden', gdp: 60239, energy: 5129, population: 10 },
];

// Time series data - Stock Market Performance
const timeSeriesData = [
  { month: 'Jan', price: 412.5, volume: 85.2, volatility: 18.5 },
  { month: 'Feb', price: 398.2, volume: 92.1, volatility: 22.3 },
  { month: 'Mar', price: 385.7, volume: 98.5, volatility: 25.8 },
  { month: 'Apr', price: 408.3, volume: 88.7, volatility: 20.1 },
  { month: 'May', price: 432.8, volume: 82.3, volatility: 16.4 },
  { month: 'Jun', price: 456.1, volume: 79.6, volatility: 14.2 },
  { month: 'Jul', price: 478.9, volume: 86.4, volatility: 15.7 },
  { month: 'Aug', price: 462.3, volume: 94.8, volatility: 19.3 },
  { month: 'Sep', price: 485.6, volume: 81.5, volatility: 13.8 },
  { month: 'Oct', price: 512.4, volume: 77.2, volatility: 12.4 },
  { month: 'Nov', price: 538.7, volume: 83.9, volatility: 14.6 },
  { month: 'Dec', price: 565.2, volume: 89.3, volatility: 16.2 },
];

type ChartType = 'bar' | 'scatter' | 'timeseries' | 'analysis';

// Helper function to convert hex to rgba
const hexToRgba = (hex: string, opacity: number): string => {
  const normalizedHex = hex.replace('#', '');
  const r = parseInt(normalizedHex.substring(0, 2), 16);
  const g = parseInt(normalizedHex.substring(2, 4), 16);
  const b = parseInt(normalizedHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const DemoVisualization: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ChartType>('bar');
  
  // Dashboard customization state
  const [dashboardBgColor, setDashboardBgColor] = useState('#ffffff');
  const [dashboardTextColor, setDashboardTextColor] = useState('#1a1a1a');
  const [dashboardBgOpacity, setDashboardBgOpacity] = useState(1);
  const [useGradient, setUseGradient] = useState(false);
  const [gradientColor2, setGradientColor2] = useState('#e5e7eb');
  
  // Container colors per chart
  const [containerColors, setContainerColors] = useState<Record<number, {bg: string, text: string, opacity: number}>>({
    0: { bg: '#ffffff', text: '#1a1a1a', opacity: 1 }
  });
  
  // Chart trace colors and opacities
  const [chartColors, setChartColors] = useState<Record<number, string[]>>({
    0: ['#ff6b6b']
  });
  const [chartOpacities, setChartOpacities] = useState<Record<number, number[]>>({
    0: [1]
  });
  
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  const customizationButtonRef = useRef<HTMLButtonElement>(null);
  const customizationPanelRef = useRef<HTMLDivElement>(null);

  // Close customization panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showCustomizationPanel &&
        customizationPanelRef.current &&
        !customizationPanelRef.current.contains(event.target as Node) &&
        customizationButtonRef.current &&
        !customizationButtonRef.current.contains(event.target as Node)
      ) {
        setShowCustomizationPanel(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomizationPanel]);

  const getBackgroundStyle = () => {
    if (useGradient) {
      return {
        background: `linear-gradient(135deg, ${hexToRgba(dashboardBgColor, dashboardBgOpacity)}, ${hexToRgba(gradientColor2, dashboardBgOpacity)})`
      };
    }
    return {
      background: hexToRgba(dashboardBgColor, dashboardBgOpacity)
    };
  };

  const getContainerStyle = (chartIndex: number) => {
    const containerColor = containerColors[chartIndex] || { bg: dashboardBgColor, text: dashboardTextColor, opacity: 1 };
    return {
      backgroundColor: hexToRgba(containerColor.bg, containerColor.opacity),
      color: containerColor.text,
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      border: '1px solid rgba(0, 0, 0, 0.1)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    };
  };

  const renderBarChart = () => {
    const traceColor = chartColors[0]?.[0] || '#ff6b6b';
    const traceOpacity = chartOpacities[0]?.[0] ?? 1;
    const rgbaColor = hexToRgba(traceColor, traceOpacity);
    const containerStyle = getContainerStyle(0);
    
    return (
      <div style={containerStyle}>
        <Plot
          data={[
            {
              type: 'bar',
              x: barChartData.map(d => d.name),
              y: barChartData.map(d => d.value),
              marker: {
                color: rgbaColor,
                line: {
                  width: 0
                }
              },
              hovertemplate: '<b>%{x}</b><br>' +
                'Valuation: $%{y}M<br>' +
                '<extra></extra>',
              text: barChartData.map(d => `$${d.value}M`),
              textposition: 'outside',
              textfont: {
                size: 11,
                color: containerStyle.color,
                family: 'inherit'
              }
            } as any
          ]}
          layout={{
            title: {
              text: 'Tech Startup Valuations 2024',
              font: {
                size: 20,
                color: containerStyle.color,
                family: 'inherit'
              }
            },
            xaxis: {
              title: '',
              tickangle: -45,
              tickfont: { size: 11, color: containerStyle.color },
              showgrid: false
            },
            yaxis: {
              title: 'Valuation ($ Millions)',
              titlefont: { size: 13, color: containerStyle.color },
              tickfont: { size: 11, color: containerStyle.color },
              gridcolor: 'rgba(0, 0, 0, 0.1)',
              tickformat: '$,.0f'
            },
            plot_bgcolor: 'transparent',
            paper_bgcolor: 'transparent',
            margin: { l: 80, r: 40, t: 80, b: 100 },
            hovermode: 'closest',
            showlegend: false,
            height: 500
          } as any}
          config={{
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d'],
            responsive: true
          }}
          style={{ width: '100%', height: '500px' }}
        />
      </div>
    );
  };

  const renderScatterPlot = () => {
    const traceColor = chartColors[0]?.[0] || '#ff6b6b';
    const traceOpacity = chartOpacities[0]?.[0] ?? 0.7;
    const rgbaColor = hexToRgba(traceColor, traceOpacity);
    const containerStyle = getContainerStyle(0);
    
    return (
      <div style={containerStyle}>
        <Plot
          data={[
            {
              type: 'scatter',
              mode: 'markers+text' as any,
              x: scatterData.map(d => d.energy),
              y: scatterData.map(d => d.gdp),
              text: scatterData.map(d => d.country),
              textposition: 'top center',
              textfont: {
                size: 10,
                color: containerStyle.color,
                family: 'inherit'
              },
              marker: {
                size: scatterData.map(d => Math.sqrt(d.population) * 3),
                color: rgbaColor,
                line: {
                  width: 0
                }
              },
              hovertemplate: '<b>%{text}</b><br>' +
                'GDP per Capita: $%{y:,.0f}<br>' +
                'Energy Use: %{x:,.0f} kg<br>' +
                '<extra></extra>'
            } as any
          ]}
          layout={{
            title: {
              text: 'Global Economics: GDP per Capita vs Energy Use',
              font: {
                size: 20,
                color: containerStyle.color,
                family: 'inherit'
              }
            },
            xaxis: {
              title: 'Energy Use per Capita (kg oil equivalent)',
              titlefont: { size: 13, color: containerStyle.color },
              tickfont: { size: 11, color: containerStyle.color },
              gridcolor: 'rgba(0, 0, 0, 0.1)',
              zeroline: false
            },
            yaxis: {
              title: 'GDP per Capita ($)',
              titlefont: { size: 13, color: containerStyle.color },
              tickfont: { size: 11, color: containerStyle.color },
              gridcolor: 'rgba(0, 0, 0, 0.1)',
              zeroline: false,
              tickformat: '$,.0f'
            },
            plot_bgcolor: 'transparent',
            paper_bgcolor: 'transparent',
            margin: { l: 80, r: 40, t: 80, b: 80 },
            hovermode: 'closest',
            showlegend: false,
            height: 500
          } as any}
          config={{
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d'],
            responsive: true
          }}
          style={{ width: '100%', height: '500px' }}
        />
      </div>
    );
  };

  const renderTimeSeries = () => {
    const traceColor = chartColors[0]?.[0] || '#ff6b6b';
    const traceOpacity = chartOpacities[0]?.[0] ?? 1;
    const rgbaColor = hexToRgba(traceColor, traceOpacity);
    const containerStyle = getContainerStyle(0);
    
    return (
      <div style={containerStyle}>
        <Plot
          data={[
            {
              type: 'scatter',
              mode: 'lines+markers',
              x: timeSeriesData.map(d => d.month),
              y: timeSeriesData.map(d => d.price),
              line: {
                color: rgbaColor,
                width: 3
              },
              marker: {
                size: 8,
                color: rgbaColor,
                line: {
                  width: 0
                }
              },
              fill: 'tozeroy',
              fillcolor: hexToRgba(traceColor, traceOpacity * 0.2),
              hovertemplate: '<b>%{x} 2024</b><br>' +
                'Price: $%{y:.2f}<br>' +
                '<extra></extra>'
            } as any
          ]}
          layout={{
            title: {
              text: 'Stock Market Performance: 2024 Trading Year',
              font: {
                size: 20,
                color: containerStyle.color,
                family: 'inherit'
              }
            },
            xaxis: {
              title: 'Month (2024)',
              titlefont: { size: 13, color: containerStyle.color },
              tickfont: { size: 12, color: containerStyle.color },
              showgrid: false
            },
            yaxis: {
              title: 'Stock Price ($)',
              titlefont: { size: 13, color: containerStyle.color },
              tickfont: { size: 11, color: containerStyle.color },
              gridcolor: 'rgba(0, 0, 0, 0.1)',
              tickformat: '$,.2f'
            },
            plot_bgcolor: 'transparent',
            paper_bgcolor: 'transparent',
            margin: { l: 70, r: 40, t: 80, b: 80 },
            hovermode: 'closest',
            showlegend: false,
            height: 500
          } as any}
          config={{
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d'],
            responsive: true
          }}
          style={{ width: '100%', height: '500px' }}
        />
      </div>
    );
  };

  const renderAnalysisNotebook = () => {
    const containerStyle = getContainerStyle(0);
    
    return (
      <div style={{
        ...containerStyle,
        fontFamily: 'inherit'
      }}>
        {/* Notebook Header */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.05)',
          padding: '16px 24px',
          borderBottom: `1px solid ${hexToRgba(containerStyle.color, 0.2)}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#ff6b6b'
          }} />
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: containerStyle.color
          }}>
            Sales Analysis Notebook
          </div>
          <div style={{
            marginLeft: 'auto',
            fontSize: '12px',
            color: hexToRgba(containerStyle.color, 0.7),
            fontFamily: 'monospace'
          }}>
            Last run: Just now
          </div>
        </div>

        {/* Notebook Cells */}
        <div style={{ padding: '0' }}>
          {/* Cell 1: Import and Load Data */}
          <div style={{
            borderBottom: `1px solid ${hexToRgba(containerStyle.color, 0.1)}`,
            padding: '20px 24px'
          }}>
            <div style={{
              fontSize: '11px',
              color: hexToRgba(containerStyle.color, 0.6),
              marginBottom: '8px',
              fontFamily: 'monospace'
            }}>
              [1]:
            </div>
            <div style={{
              background: 'rgba(0, 0, 0, 0.03)',
              padding: '16px',
              borderRadius: '8px',
              border: `1px solid ${hexToRgba(containerStyle.color, 0.1)}`,
              marginBottom: '12px'
            }}>
              <pre style={{
                margin: 0,
                fontSize: '13px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                color: containerStyle.color,
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
{`# Load and preview the sales dataset
df = load_data('sales_2024.csv')
df.head()`}
              </pre>
            </div>
            <div style={{
              background: 'rgba(0, 0, 0, 0.02)',
              padding: '16px',
              borderRadius: '8px',
              border: `1px solid ${hexToRgba(containerStyle.color, 0.1)}`,
              fontSize: '13px',
              fontFamily: 'monospace',
              color: containerStyle.color
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px'
                }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${hexToRgba(containerStyle.color, 0.2)}` }}>
                      <th style={{ padding: '8px', textAlign: 'left', color: hexToRgba(containerStyle.color, 0.6) }}></th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', color: containerStyle.color }}>Date</th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', color: containerStyle.color }}>Product</th>
                      <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: containerStyle.color }}>Revenue</th>
                      <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: containerStyle.color }}>Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: `1px solid ${hexToRgba(containerStyle.color, 0.1)}` }}>
                      <td style={{ padding: '8px', color: hexToRgba(containerStyle.color, 0.6) }}>0</td>
                      <td style={{ padding: '8px', color: containerStyle.color }}>2024-01-15</td>
                      <td style={{ padding: '8px', color: containerStyle.color }}>Pro Plan</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: containerStyle.color }}>$2,850</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: containerStyle.color }}>45</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${hexToRgba(containerStyle.color, 0.1)}` }}>
                      <td style={{ padding: '8px', color: hexToRgba(containerStyle.color, 0.6) }}>1</td>
                      <td style={{ padding: '8px', color: containerStyle.color }}>2024-01-16</td>
                      <td style={{ padding: '8px', color: containerStyle.color }}>Enterprise</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: containerStyle.color }}>$5,200</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: containerStyle.color }}>12</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${hexToRgba(containerStyle.color, 0.1)}` }}>
                      <td style={{ padding: '8px', color: hexToRgba(containerStyle.color, 0.6) }}>2</td>
                      <td style={{ padding: '8px', color: containerStyle.color }}>2024-01-17</td>
                      <td style={{ padding: '8px', color: containerStyle.color }}>Starter</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: containerStyle.color }}>$890</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: containerStyle.color }}>78</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '12px', color: hexToRgba(containerStyle.color, 0.6), fontSize: '11px' }}>
                Shape: (1,247 rows × 5 columns)
              </div>
            </div>
          </div>

          {/* Cell 2: Calculate Summary Statistics */}
          <div style={{
            borderBottom: `1px solid ${hexToRgba(containerStyle.color, 0.1)}`,
            padding: '20px 24px'
          }}>
            <div style={{
              fontSize: '11px',
              color: hexToRgba(containerStyle.color, 0.6),
              marginBottom: '8px',
              fontFamily: 'monospace'
            }}>
              [2]:
            </div>
            <div style={{
              background: 'rgba(0, 0, 0, 0.03)',
              padding: '16px',
              borderRadius: '8px',
              border: `1px solid ${hexToRgba(containerStyle.color, 0.1)}`,
              marginBottom: '12px'
            }}>
              <pre style={{
                margin: 0,
                fontSize: '13px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                color: containerStyle.color,
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
{`# Calculate key metrics
summary = {
    'Total Revenue': df['Revenue'].sum(),
    'Avg Revenue per Sale': df['Revenue'].mean(),
    'Total Units Sold': df['Units'].sum(),
    'Top Product': df.groupby('Product')['Revenue'].sum().idxmax()
}
summary`}
              </pre>
            </div>
            <div style={{
              background: 'rgba(0, 0, 0, 0.02)',
              padding: '16px',
              borderRadius: '8px',
              border: `1px solid ${hexToRgba(containerStyle.color, 0.1)}`,
              fontFamily: 'monospace',
              fontSize: '13px',
              color: containerStyle.color,
              lineHeight: '1.8'
            }}>
              <div>
                <div><span style={{ color: hexToRgba(containerStyle.color, 0.6) }}>{'{'}</span></div>
                <div style={{ paddingLeft: '20px' }}>
                  <span style={{ color: '#ff6b6b' }}>'Total Revenue'</span>: <span style={{ color: '#10b981' }}>$3,247,850</span>,
                </div>
                <div style={{ paddingLeft: '20px' }}>
                  <span style={{ color: '#ff6b6b' }}>'Avg Revenue per Sale'</span>: <span style={{ color: '#10b981' }}>$2,604.33</span>,
                </div>
                <div style={{ paddingLeft: '20px' }}>
                  <span style={{ color: '#ff6b6b' }}>'Total Units Sold'</span>: <span style={{ color: '#10b981' }}>8,452</span>,
                </div>
                <div style={{ paddingLeft: '20px' }}>
                  <span style={{ color: '#ff6b6b' }}>'Top Product'</span>: <span style={{ color: '#3b82f6' }}>'Enterprise'</span>
                </div>
                <div><span style={{ color: hexToRgba(containerStyle.color, 0.6) }}>{'}'}</span></div>
              </div>
            </div>
          </div>

          {/* Cell 3: AI Insight */}
          <div style={{
            padding: '20px 24px'
          }}>
            <div style={{
              fontSize: '11px',
              color: hexToRgba(containerStyle.color, 0.6),
              marginBottom: '8px',
              fontFamily: 'monospace'
            }}>
              [3]:
            </div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.1) 0%, rgba(255, 255, 255, 0.1) 100%)',
              padding: '20px',
              borderRadius: '8px',
              border: '2px solid rgba(255, 107, 107, 0.2)',
              fontSize: '14px',
              lineHeight: '1.7',
              color: containerStyle.color
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                color: '#ff6b6b',
                fontWeight: '600',
                fontSize: '13px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                AI INSIGHTS
              </div>
              <div>
                <strong>🎯 Key Findings:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Revenue shows strong <strong>upward trend</strong> with 37.2% growth YoY</li>
                  <li><strong>Enterprise plan</strong> drives highest revenue despite lower volume</li>
                  <li>Q4 performance exceptional, suggesting <strong>seasonal demand</strong></li>
                  <li>Average deal size increased from $2,204 to $3,156 (+43%)</li>
                </ul>
                <strong>💡 Recommendations:</strong> Focus sales efforts on Enterprise tier and prepare inventory for Q4 surge.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Customization Button */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000
      }}>
        <button
          ref={customizationButtonRef}
          onClick={() => setShowCustomizationPanel(!showCustomizationPanel)}
          style={{
            background: 'rgba(255, 107, 107, 0.1)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 107, 107, 0.3)',
            borderRadius: '12px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#ff6b6b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.71 4.63a1 1 0 0 0-1.42 0l-1.83 1.83 3.75 3.75L23 8.29a1 1 0 0 0 0-1.41z"/>
            <path d="M16 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            <path d="M20 21v-8"/>
            <path d="M16 17H8"/>
          </svg>
          Customize
        </button>
      </div>

      {/* Customization Panel */}
      {showCustomizationPanel && (
        <div
          ref={customizationPanelRef}
          style={{
            position: 'absolute',
            top: '50px',
            right: '10px',
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            zIndex: 1001,
            width: '320px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}
        >
          <div style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 700, color: '#1a1a1a' }}>
            🎨 Customize Dashboard
          </div>

          {/* Dashboard Background */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              Dashboard Background
            </label>
            <input
              type="color"
              value={dashboardBgColor}
              onChange={(e) => setDashboardBgColor(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                marginBottom: '8px'
              }}
            />
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#9ca3af' }}>
                Opacity: {Math.round(dashboardBgOpacity * 100)}%
              </label>
              <style>{`
                input[type="range"]#demo-dashboard-opacity {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 100%;
                  height: 8px;
                  background: linear-gradient(to right, #ff6b6b 0%, #ff6b6b ${dashboardBgOpacity * 100}%, #e5e7eb ${dashboardBgOpacity * 100}%, #e5e7eb 100%);
                  border-radius: 4px;
                  outline: none;
                }
                input[type="range"]#demo-dashboard-opacity::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: #ff6b6b;
                  cursor: pointer;
                  box-shadow: 0 2px 6px rgba(255, 107, 107, 0.4);
                  border: 2px solid white;
                }
                input[type="range"]#demo-dashboard-opacity::-moz-range-thumb {
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: #ff6b6b;
                  cursor: pointer;
                  border: 2px solid white;
                  box-shadow: 0 2px 6px rgba(255, 107, 107, 0.4);
                }
                input[type="range"]#demo-dashboard-opacity::-webkit-slider-runnable-track {
                  width: 100%;
                  height: 8px;
                  border-radius: 4px;
                }
                input[type="range"]#demo-dashboard-opacity::-moz-range-track {
                  width: 100%;
                  height: 8px;
                  border-radius: 4px;
                }
              `}</style>
              <input
                id="demo-dashboard-opacity"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={dashboardBgOpacity}
                onChange={(e) => setDashboardBgOpacity(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer'
                }}
              />
            </div>
            <label 
              onClick={(e) => {
                e.stopPropagation();
                setUseGradient(!useGradient);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid',
                  borderColor: useGradient ? '#ff6b6b' : '#d1d5db',
                  borderRadius: '3px',
                  backgroundColor: useGradient ? '#ff6b6b' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
              >
                {useGradient && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                  >
                    <polyline
                      points="2,6 5,9 10,3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              Use Gradient
            </label>
            {useGradient && (
              <input
                type="color"
                value={gradientColor2}
                onChange={(e) => setGradientColor2(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginTop: '8px'
                }}
              />
            )}
          </div>

          {/* Dashboard Text Color */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              Dashboard Text Color
            </label>
            <input
              type="color"
              value={dashboardTextColor}
              onChange={(e) => setDashboardTextColor(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Container Colors */}
          <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              Chart Container
            </label>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#9ca3af' }}>
                Background
              </label>
              <input
                type="color"
                value={containerColors[0]?.bg || '#ffffff'}
                onChange={(e) => {
                  setContainerColors({
                    ...containerColors,
                    0: { ...containerColors[0], bg: e.target.value, text: containerColors[0]?.text || '#1a1a1a', opacity: containerColors[0]?.opacity ?? 1 }
                  });
                }}
                style={{
                  width: '100%',
                  height: '36px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#9ca3af' }}>
                Opacity: {Math.round((containerColors[0]?.opacity ?? 1) * 100)}%
              </label>
              <style>{`
                input[type="range"]#demo-container-opacity {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 100%;
                  height: 8px;
                  background: linear-gradient(to right, #ff6b6b 0%, #ff6b6b ${(containerColors[0]?.opacity ?? 1) * 100}%, #e5e7eb ${(containerColors[0]?.opacity ?? 1) * 100}%, #e5e7eb 100%);
                  border-radius: 4px;
                  outline: none;
                }
                input[type="range"]#demo-container-opacity::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: #ff6b6b;
                  cursor: pointer;
                  box-shadow: 0 2px 6px rgba(255, 107, 107, 0.4);
                  border: 2px solid white;
                }
                input[type="range"]#demo-container-opacity::-moz-range-thumb {
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: #ff6b6b;
                  cursor: pointer;
                  border: 2px solid white;
                  box-shadow: 0 2px 6px rgba(255, 107, 107, 0.4);
                }
                input[type="range"]#demo-container-opacity::-webkit-slider-runnable-track {
                  width: 100%;
                  height: 8px;
                  border-radius: 4px;
                }
                input[type="range"]#demo-container-opacity::-moz-range-track {
                  width: 100%;
                  height: 8px;
                  border-radius: 4px;
                }
              `}</style>
              <input
                id="demo-container-opacity"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={containerColors[0]?.opacity ?? 1}
                onChange={(e) => {
                  setContainerColors({
                    ...containerColors,
                    0: { ...containerColors[0], bg: containerColors[0]?.bg || '#ffffff', text: containerColors[0]?.text || '#1a1a1a', opacity: parseFloat(e.target.value) }
                  });
                }}
                style={{
                  width: '100%',
                  cursor: 'pointer'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#9ca3af' }}>
                Text Color
              </label>
              <input
                type="color"
                value={containerColors[0]?.text || '#1a1a1a'}
                onChange={(e) => {
                  setContainerColors({
                    ...containerColors,
                    0: { ...containerColors[0], bg: containerColors[0]?.bg || '#ffffff', text: e.target.value, opacity: containerColors[0]?.opacity ?? 1 }
                  });
                }}
                style={{
                  width: '100%',
                  height: '36px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>

          {/* Chart Colors */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              Chart Colors
            </label>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#9ca3af' }}>
                Trace Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: chartColors[0]?.[0] || '#ff6b6b',
                    border: '1px solid #e5e7eb',
                    flexShrink: 0
                  }}
                />
                <input
                  type="color"
                  value={chartColors[0]?.[0] || '#ff6b6b'}
                  onChange={(e) => {
                    setChartColors({
                      ...chartColors,
                      0: [e.target.value]
                    });
                  }}
                  style={{
                    flex: 1,
                    height: '36px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#9ca3af' }}>
                Opacity: {Math.round((chartOpacities[0]?.[0] ?? 1) * 100)}%
              </label>
              <style>{`
                input[type="range"]#demo-chart-opacity {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 100%;
                  height: 8px;
                  background: linear-gradient(to right, #ff6b6b 0%, #ff6b6b ${(chartOpacities[0]?.[0] ?? 1) * 100}%, #e5e7eb ${(chartOpacities[0]?.[0] ?? 1) * 100}%, #e5e7eb 100%);
                  border-radius: 4px;
                  outline: none;
                }
                input[type="range"]#demo-chart-opacity::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: #ff6b6b;
                  cursor: pointer;
                  box-shadow: 0 2px 6px rgba(255, 107, 107, 0.4);
                  border: 2px solid white;
                }
                input[type="range"]#demo-chart-opacity::-moz-range-thumb {
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: #ff6b6b;
                  cursor: pointer;
                  border: 2px solid white;
                  box-shadow: 0 2px 6px rgba(255, 107, 107, 0.4);
                }
                input[type="range"]#demo-chart-opacity::-webkit-slider-runnable-track {
                  width: 100%;
                  height: 8px;
                  border-radius: 4px;
                }
                input[type="range"]#demo-chart-opacity::-moz-range-track {
                  width: 100%;
                  height: 8px;
                  border-radius: 4px;
                }
              `}</style>
              <input
                id="demo-chart-opacity"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={chartOpacities[0]?.[0] ?? 1}
                onChange={(e) => {
                  setChartOpacities({
                    ...chartOpacities,
                    0: [parseFloat(e.target.value)]
                  });
                }}
                style={{
                  width: '100%',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Container with Custom Background */}
      <div style={{
        ...getBackgroundStyle(),
        borderRadius: '16px',
        padding: '24px',
        transition: 'all 0.3s ease'
      }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '4px',
          marginBottom: '24px',
          background: 'rgba(0, 0, 0, 0.05)',
          padding: '4px',
          borderRadius: '8px',
          width: 'fit-content',
          margin: '0 auto 24px',
        }}>
          <button
            onClick={() => setActiveTab('bar')}
            style={{
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: '500',
              border: 'none',
              background: activeTab === 'bar' ? 'white' : 'transparent',
              color: activeTab === 'bar' ? '#ff6b6b' : dashboardTextColor,
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'bar' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
            }}
          >
            Bar Chart
          </button>
          <button
            onClick={() => setActiveTab('scatter')}
            style={{
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: '500',
              border: 'none',
              background: activeTab === 'scatter' ? 'white' : 'transparent',
              color: activeTab === 'scatter' ? '#ff6b6b' : dashboardTextColor,
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'scatter' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
            }}
          >
            Scatter Plot
          </button>
          <button
            onClick={() => setActiveTab('timeseries')}
            style={{
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: '500',
              border: 'none',
              background: activeTab === 'timeseries' ? 'white' : 'transparent',
              color: activeTab === 'timeseries' ? '#ff6b6b' : dashboardTextColor,
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'timeseries' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
            }}
          >
            Time Series
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            style={{
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: '500',
              border: 'none',
              background: activeTab === 'analysis' ? 'white' : 'transparent',
              color: activeTab === 'analysis' ? '#ff6b6b' : dashboardTextColor,
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'analysis' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
            }}
          >
            Analysis
          </button>
        </div>

        {/* Chart Container */}
        <div style={{ width: '100%' }}>
          {activeTab === 'bar' && renderBarChart()}
          {activeTab === 'scatter' && renderScatterPlot()}
          {activeTab === 'timeseries' && renderTimeSeries()}
          {activeTab === 'analysis' && renderAnalysisNotebook()}
        </div>

        {/* Info Text */}
        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          fontStyle: 'italic',
          color: hexToRgba(dashboardTextColor, 0.7),
          fontSize: '14px'
        }}>
          {activeTab === 'analysis' 
            ? 'Interactive notebook showing data analysis with AI-powered insights'
            : `Hover over ${activeTab === 'bar' ? 'bars' : activeTab === 'scatter' ? 'bubbles' : 'data points'} for detailed insights • Powered by Plotly`}
        </div>
      </div>
    </div>
  );
};
