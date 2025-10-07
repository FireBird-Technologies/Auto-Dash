import React, { useState } from 'react';

type Row = Record<string, number | string>;

interface VisualizationProps {
  data: Row[];
  context: {
    description: string;
  };
}

export const Visualization: React.FC<VisualizationProps> = ({ data, context }) => {
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFeedback = () => {
    if (!feedback.trim()) return;
    
    // TODO: Send to backend for chart update
    console.log('Feedback:', feedback);
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setFeedback('');
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="step-container">
      <div className="step-header">
        <p className="step-description">{context.description}</p>
      </div>

      <div className="visualization-container">
        <div className="chart-display">
          <div className="chart-placeholder">
            {/* Backend will send D3 instructions here */}
            <p>Chart visualization will be generated here based on your data and insights</p>
          </div>
        </div>

        <div className="feedback-box">
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Request changes or refinements to your visualization..."
            className="feedback-textarea"
            rows={2}
            disabled={isLoading}
          />
          {feedback.trim() && (
            <button 
              className="feedback-button"
              onClick={handleFeedback}
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update Visualization'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};