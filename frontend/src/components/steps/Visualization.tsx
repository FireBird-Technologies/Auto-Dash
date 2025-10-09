import React, { useState, useEffect } from 'react';
import { D3ChartRenderer } from '../D3ChartRenderer';

type Row = Record<string, number | string>;

interface VisualizationProps {
  data: Row[];
  datasetId: string;
  context: {
    description: string;
  };
}

export const Visualization: React.FC<VisualizationProps> = ({ data, datasetId, context }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chartSpec, setChartSpec] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'assistant', message: string}>>([]);

  // Generate initial chart on load
  useEffect(() => {
    if (context.description) {
      generateChart(context.description);
    }
  }, [context.description, datasetId]);

  const generateChart = async (userQuery: string) => {
    if (!userQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    // Add user message to chat
    setChatHistory(prev => [...prev, { type: 'user', message: userQuery }]);

    try {
      const response = await fetch('http://localhost:8000/api/data/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: userQuery,
          dataset_id: datasetId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate chart');
      }

      const result = await response.json();
      
      // Add assistant response to chat
      setChatHistory(prev => [...prev, { 
        type: 'assistant', 
        message: result.message || 'Chart generated successfully' 
      }]);
      
      // Update chart spec (will be replaced when chart_creator is integrated)
      setChartSpec(result.chart_spec);
      
    } catch (err) {
      console.error('Error generating chart:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate chart';
      setError(errorMessage);
      setChatHistory(prev => [...prev, { 
        type: 'assistant', 
        message: `Error: ${errorMessage}` 
      }]);
    } finally {
      setIsLoading(false);
      setQuery('');
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

  return (
    <div className="step-container">
      <div className="step-header">
        <h1 className="step-title">Your Dashboard</h1>
        <p className="step-description">Ask questions to generate visualizations</p>
      </div>

      <div className="visualization-container">
        <div className="chart-display">
          {chartSpec ? (
            <D3ChartRenderer chartSpec={chartSpec} data={data} />
          ) : (
            <div className="chart-placeholder">
              <p>Ask a question about your data to generate a visualization</p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                Examples: "Show me a histogram of prices", "Create a scatter plot of sqft_living vs price"
              </p>
            </div>
          )}
        </div>

        {/* Chat History */}
        {chatHistory.length > 0 && (
          <div style={{ 
            marginBottom: '1rem', 
            maxHeight: '200px', 
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            padding: '1rem',
            backgroundColor: '#f9fafb'
          }}>
            {chatHistory.map((msg, idx) => (
              <div 
                key={idx} 
                style={{ 
                  marginBottom: '0.75rem',
                  padding: '0.5rem',
                  backgroundColor: msg.type === 'user' ? '#eff6ff' : '#f3f4f6',
                  borderRadius: '0.375rem'
                }}
              >
                <strong style={{ color: msg.type === 'user' ? '#2563eb' : '#059669' }}>
                  {msg.type === 'user' ? 'You' : 'Assistant'}:
                </strong> {msg.message}
              </div>
            ))}
          </div>
        )}

        {/* Query Input */}
        <div className="feedback-box">
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data: 'Show correlation between price and bedrooms', 'Create a bar chart of average prices by zipcode'..."
            className="feedback-textarea"
            rows={3}
            disabled={isLoading}
          />
          {error && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: '#fee2e2', 
              color: '#991b1b', 
              borderRadius: '0.375rem',
              marginTop: '0.5rem'
            }}>
              {error}
            </div>
          )}
          {query.trim() && (
            <button 
              className="feedback-button"
              onClick={handleSubmit}
              disabled={isLoading}
              style={{ marginTop: '0.5rem' }}
            >
              {isLoading ? 'Generating...' : 'Generate Visualization'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};