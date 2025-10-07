import React, { useState, useCallback } from 'react';

interface StyleContextProps {
  onComplete: (context: {
    description: string;
  }) => void;
}

export const StyleContext: React.FC<StyleContextProps> = ({ onComplete }) => {
  const [description, setDescription] = useState('');

  const handleComplete = useCallback(() => {
    if (description.trim()) {
      onComplete({ description });
    }
  }, [description, onComplete]);

  return (
    <div className="step-container">
      <div className="step-header">
        <h1 className="step-title">What insights do you need?</h1>
        <p className="step-description">Tell us what you want to discover from your data</p>
      </div>

      <div className="insight-form">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="E.g., Show me sales trends over time, compare regional performance, identify correlations..."
          className="insight-textarea"
          rows={6}
          autoFocus
        />

        {description.trim() && (
          <button 
            className="button-primary"
            onClick={handleComplete}
          >
            Create Visualization
          </button>
        )}
      </div>
    </div>
  );
};