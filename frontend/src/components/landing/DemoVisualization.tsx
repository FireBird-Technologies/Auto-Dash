import { useState } from 'react';
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

export const DemoVisualization: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ChartType>('bar');

  const renderBarChart = () => {
    return (
      <Plot
        data={[
          {
            type: 'bar',
            x: barChartData.map(d => d.name),
            y: barChartData.map(d => d.value),
            marker: {
              color: '#ff6b6b',
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
              color: '#1a1a1a',
              family: 'inherit'
            }
          } as any
        ]}
        layout={{
          title: {
            text: 'Tech Startup Valuations 2024',
            font: {
              size: 20,
              color: '#ff6b6b',
              family: 'inherit'
            }
          },
          xaxis: {
            title: '',
            tickangle: -45,
            tickfont: { size: 11, color: '#1a1a1a' },
            showgrid: false
          },
          yaxis: {
            title: 'Valuation ($ Millions)',
            titlefont: { size: 13, color: '#1a1a1a' },
            tickfont: { size: 11, color: '#1a1a1a' },
            gridcolor: '#f0f0f0',
            tickformat: '$,.0f'
          },
          plot_bgcolor: 'white',
          paper_bgcolor: 'white',
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
    );
  };

  const renderScatterPlot = () => {
    return (
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
              color: '#1a1a1a',
              family: 'inherit'
            },
            marker: {
              size: scatterData.map(d => Math.sqrt(d.population) * 3),
              color: '#ff6b6b',
              opacity: 0.7,
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
              color: '#ff6b6b',
              family: 'inherit'
            }
          },
          xaxis: {
            title: 'Energy Use per Capita (kg oil equivalent)',
            titlefont: { size: 13, color: '#1a1a1a' },
            tickfont: { size: 11, color: '#1a1a1a' },
            gridcolor: '#f0f0f0',
            zeroline: false
          },
          yaxis: {
            title: 'GDP per Capita ($)',
            titlefont: { size: 13, color: '#1a1a1a' },
            tickfont: { size: 11, color: '#1a1a1a' },
            gridcolor: '#f0f0f0',
            zeroline: false,
            tickformat: '$,.0f'
          },
          plot_bgcolor: 'white',
          paper_bgcolor: 'white',
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
    );
  };

  const renderAnalysisNotebook = () => {
    return (
      <div style={{
        width: '100%',
        background: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        fontFamily: 'inherit'
      }}>
        {/* Notebook Header */}
        <div style={{
          background: '#f8f9fa',
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
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
            color: '#1a1a1a'
          }}>
            Sales Analysis Notebook
          </div>
          <div style={{
            marginLeft: 'auto',
            fontSize: '12px',
            color: '#6b7280',
            fontFamily: 'monospace'
          }}>
            Last run: Just now
          </div>
        </div>

        {/* Notebook Cells */}
        <div style={{ padding: '0' }}>
          {/* Cell 1: Import and Load Data */}
          <div style={{
            borderBottom: '1px solid #e5e7eb',
            padding: '20px 24px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#6b7280',
              marginBottom: '8px',
              fontFamily: 'monospace'
            }}>
              [1]:
            </div>
            <div style={{
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              marginBottom: '12px'
            }}>
              <pre style={{
                margin: 0,
                fontSize: '13px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                color: '#1a1a1a',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
{`# Load and preview the sales dataset
df = load_data('sales_2024.csv')
df.head()`}
              </pre>
            </div>
            <div style={{
              background: '#fafbfc',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '13px',
              fontFamily: 'monospace'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#6b7280' }}></th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>Date</th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>Product</th>
                      <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }}>Revenue</th>
                      <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }}>Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px', color: '#6b7280' }}>0</td>
                      <td style={{ padding: '8px' }}>2024-01-15</td>
                      <td style={{ padding: '8px' }}>Pro Plan</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>$2,850</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>45</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px', color: '#6b7280' }}>1</td>
                      <td style={{ padding: '8px' }}>2024-01-16</td>
                      <td style={{ padding: '8px' }}>Enterprise</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>$5,200</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>12</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px', color: '#6b7280' }}>2</td>
                      <td style={{ padding: '8px' }}>2024-01-17</td>
                      <td style={{ padding: '8px' }}>Starter</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>$890</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>78</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '12px', color: '#6b7280', fontSize: '11px' }}>
                Shape: (1,247 rows × 5 columns)
              </div>
            </div>
          </div>

          {/* Cell 2: Calculate Summary Statistics */}
          <div style={{
            borderBottom: '1px solid #e5e7eb',
            padding: '20px 24px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#6b7280',
              marginBottom: '8px',
              fontFamily: 'monospace'
            }}>
              [2]:
            </div>
            <div style={{
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              marginBottom: '12px'
            }}>
              <pre style={{
                margin: 0,
                fontSize: '13px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                color: '#1a1a1a',
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
              background: '#fafbfc',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontFamily: 'monospace',
              fontSize: '13px'
            }}>
              <div style={{ color: '#1a1a1a', lineHeight: '1.8' }}>
                <div><span style={{ color: '#6b7280' }}>{'{'}</span></div>
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
                <div><span style={{ color: '#6b7280' }}>{'}'}</span></div>
              </div>
            </div>
          </div>

          {/* Cell 3: Perform Analysis */}
          <div style={{
            borderBottom: '1px solid #e5e7eb',
            padding: '20px 24px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#6b7280',
              marginBottom: '8px',
              fontFamily: 'monospace'
            }}>
              [3]:
            </div>
            <div style={{
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              marginBottom: '12px'
            }}>
              <pre style={{
                margin: 0,
                fontSize: '13px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                color: '#1a1a1a',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
{`# Analyze growth trends
monthly_growth = df.groupby(df['Date'].dt.to_period('M'))['Revenue'].sum()
growth_rate = ((monthly_growth.iloc[-1] - monthly_growth.iloc[0]) / monthly_growth.iloc[0]) * 100

print(f"Overall Revenue Growth: {growth_rate:.1f}%")
print(f"Best Month: {monthly_growth.idxmax()} (${'$'}{monthly_growth.max():,.0f})")`}
              </pre>
            </div>
            <div style={{
              background: '#fafbfc',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontFamily: 'monospace',
              fontSize: '13px',
              color: '#1a1a1a',
              lineHeight: '1.8'
            }}>
              <div>Overall Revenue Growth: <span style={{ color: '#10b981', fontWeight: '600' }}>37.2%</span></div>
              <div>Best Month: <span style={{ fontWeight: '600' }}>Dec 2024</span> (<span style={{ color: '#10b981' }}>$312,450</span>)</div>
            </div>
          </div>

          {/* Cell 4: AI Insight */}
          <div style={{
            padding: '20px 24px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#6b7280',
              marginBottom: '8px',
              fontFamily: 'monospace'
            }}>
              [4]:
            </div>
            <div style={{
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              marginBottom: '12px'
            }}>
              <pre style={{
                margin: 0,
                fontSize: '13px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                color: '#1a1a1a',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
{`# Generate AI insights
get_insights("What are the key trends in this sales data?")`}
              </pre>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #fff7f8 0%, #ffffff 100%)',
              padding: '20px',
              borderRadius: '8px',
              border: '2px solid #ff6b6b20',
              fontSize: '14px',
              lineHeight: '1.7',
              color: '#1a1a1a'
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

  const renderTimeSeries = () => {
    return (
      <Plot
        data={[
          {
            type: 'scatter',
            mode: 'lines+markers',
            x: timeSeriesData.map(d => d.month),
            y: timeSeriesData.map(d => d.price),
            line: {
              color: '#ff6b6b',
              width: 3
            },
            marker: {
              size: 8,
              color: '#ff6b6b',
              line: {
                width: 0
              }
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(255, 107, 107, 0.2)',
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
              color: '#ff6b6b',
              family: 'inherit'
            }
          },
          xaxis: {
            title: 'Month (2024)',
            titlefont: { size: 13, color: '#1a1a1a' },
            tickfont: { size: 12, color: '#1a1a1a' },
            showgrid: false
          },
          yaxis: {
            title: 'Stock Price ($)',
            titlefont: { size: 13, color: '#1a1a1a' },
            tickfont: { size: 11, color: '#1a1a1a' },
            gridcolor: '#f0f0f0',
            tickformat: '$,.2f'
          },
          plot_bgcolor: 'white',
          paper_bgcolor: 'white',
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
    );
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '4px',
        marginBottom: '24px',
        background: '#f8f8f8',
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
            color: activeTab === 'bar' ? '#ff6b6b' : '#666',
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
            color: activeTab === 'scatter' ? '#ff6b6b' : '#666',
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
            color: activeTab === 'timeseries' ? '#ff6b6b' : '#666',
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
            color: activeTab === 'analysis' ? '#ff6b6b' : '#666',
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
      <div 
        style={{
          width: '100%',
          background: 'white',
          borderRadius: '12px',
          overflow: 'hidden'
        }}
      >
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
        color: '#666',
        fontSize: '14px'
      }}>
        {activeTab === 'analysis' 
          ? 'Interactive notebook showing data analysis with AI-powered insights'
          : `Hover over ${activeTab === 'bar' ? 'bars' : activeTab === 'scatter' ? 'bubbles' : 'data points'} for detailed insights • Powered by Plotly`}
      </div>
    </div>
  );
};
