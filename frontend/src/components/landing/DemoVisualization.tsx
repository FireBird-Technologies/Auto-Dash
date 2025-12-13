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

type ChartType = 'bar' | 'scatter' | 'timeseries';

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
          }
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
        }}
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
            mode: 'markers+text',
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
          }
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
        }}
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
          }
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
        }}
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
      </div>

      {/* Info Text */}
      <div style={{
        marginTop: '20px',
        textAlign: 'center',
        fontStyle: 'italic',
        color: '#666',
        fontSize: '14px'
      }}>
        Hover over {activeTab === 'bar' ? 'bars' : activeTab === 'scatter' ? 'bubbles' : 'data points'} for detailed insights • Powered by Plotly
      </div>
    </div>
  );
};
