import React, { useState, useCallback, useEffect, useRef } from 'react';
import { config, getAuthHeaders } from '../../config';

interface StyleContextProps {
  datasetId: string;
  onComplete: (context: {
    description: string;
    colorTheme?: string;
  }) => void;
}

const predefinedThemes = [
  { name: 'Default', colors: ['#FF516B', '#99C3FA', '#99FABE'] },
  { name: 'Ocean', colors: ['#003f5c', '#2f4b7c', '#665191'] },
  { name: 'Forest', colors: ['#1a472a', '#2d6a4f', '#52b788'] },
  { name: 'Sunset', colors: ['#d62828', '#f77f00', '#fcbf49'] },
  { name: 'Purple', colors: ['#5a189a', '#9d4edd', '#e0aaff'] },
  { name: 'Monochrome', colors: ['#212529', '#495057', '#adb5bd'] },
];

export const StyleContext: React.FC<StyleContextProps> = ({ datasetId, onComplete }) => {
  const [description, setDescription] = useState('');
  const [suggestion, setSuggestion] = useState<string>(''); // Store suggestion separately
  const [selectedTheme, setSelectedTheme] = useState(0);
  const [customColors, setCustomColors] = useState(['#FF516B', '#99C3FA', '#99FABE']);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isThemePickerExpanded, setIsThemePickerExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load suggestion (don't auto-fill - show as overlay)
  useEffect(() => {
    const loadSuggestion = async () => {
      if (!datasetId) return;

      // First check sessionStorage (might already be fetched by FileUpload)
      const storedSuggestion = sessionStorage.getItem(`suggestion_${datasetId}`);
      if (storedSuggestion) {
        setSuggestion(storedSuggestion);
        return;
      }

      // If not in sessionStorage, fetch it
      try {
        const response = await fetch(
          `${config.backendUrl}/api/data/datasets/${datasetId}/suggest-queries`,
          {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
          }
        );

        if (response.ok) {
          const data = await response.json();
          // Backend now returns {suggestion: "..."} instead of {suggestions: [...]}
          if (data.suggestion) {
            setSuggestion(data.suggestion);
            // Also store it in sessionStorage for consistency
            sessionStorage.setItem(`suggestion_${datasetId}`, data.suggestion);
          }
        }
      } catch (error) {
        console.error('Failed to load suggestion:', error);
      }
    };

    loadSuggestion();
  }, [datasetId]); // Only run when datasetId changes

  // Handle Tab key to accept suggestion
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !description && suggestion) {
      e.preventDefault();
      setDescription(suggestion);
      // Clear suggestion after accepting
      setSuggestion('');
    }
  };

  const handleComplete = useCallback(() => {
    if (description.trim()) {
      const colors = selectedTheme === predefinedThemes.length ? customColors : predefinedThemes[selectedTheme].colors;
      onComplete({ 
        description,
        colorTheme: colors.join(',')  // Send as comma-separated string
      });
    }
  }, [description, selectedTheme, customColors, onComplete]);

  return (
    <div className="step-container">
      <div className="step-header">
        <h1 className="step-title">What insights do you need?</h1>
        <p className="step-description">Tell us what you want to discover from your data</p>
      </div>

      <div className="insight-form">
        <div style={{ position: 'relative', width: '100%' }}>
          {/* Suggestion overlay - only show when textarea is empty and suggestion exists */}
          {!description && suggestion && (
            <div 
              className="suggestion-overlay"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                padding: '20px',
                pointerEvents: 'none',
                color: 'rgba(156, 163, 175, 0.6)',
                fontSize: '16px',
                lineHeight: '1.6',
                fontFamily: 'inherit',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'flex-start',
                zIndex: 1,
                borderColor: 'transparent'
              }}
            >
              <span>{suggestion}</span>
              <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.6, color: 'rgba(156, 163, 175, 0.8)' }}>
                (Press Tab to accept)
              </span>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder=""
            className="insight-textarea"
            rows={6}
            autoFocus
            style={{ 
              position: 'relative', 
              zIndex: 2,
              backgroundColor: description ? 'var(--aa-surface)' : 'transparent',
              caretColor: 'var(--aa-text)'
            }}
          />
        </div>

        {description.trim() && (
          <button 
            className="button-primary"
            onClick={handleComplete}
          >
            Create Visualization
          </button>
        )}

        {/* Color Theme Picker */}
        {description.trim() && (
          <div className="theme-picker-container">
            <label className="theme-picker-label">Color Theme (Optional)</label>
            <div className="theme-options">
              {/* Show only Default theme when collapsed */}
              {!isThemePickerExpanded ? (
                <button
                  className={`theme-button ${selectedTheme === 0 ? 'selected' : ''}`}
                  onClick={() => setIsThemePickerExpanded(true)}
                  title="Default - Click to see more themes"
                >
                  <div className="theme-preview">
                    {predefinedThemes[0].colors.map((color, i) => (
                      <div
                        key={i}
                        className="theme-color"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="theme-name">{predefinedThemes[0].name}</span>
                </button>
              ) : (
                /* Show all themes when expanded */
                <>
                  {predefinedThemes.map((theme, index) => (
                    <button
                      key={index}
                      className={`theme-button ${selectedTheme === index ? 'selected' : ''}`}
                      onClick={() => setSelectedTheme(index)}
                      title={theme.name}
                    >
                      <div className="theme-preview">
                        {theme.colors.map((color, i) => (
                          <div
                            key={i}
                            className="theme-color"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <span className="theme-name">{theme.name}</span>
                    </button>
                  ))}
                  <button
                    className={`theme-button ${selectedTheme === predefinedThemes.length ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedTheme(predefinedThemes.length);
                      setShowColorPicker(!showColorPicker);
                    }}
                    title="Custom"
                  >
                    <div className="theme-preview">
                      {customColors.map((color, i) => (
                        <div
                          key={i}
                          className="theme-color"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="theme-name">Custom</span>
                  </button>
                </>
              )}
            </div>

            {/* Custom Color Picker */}
            {showColorPicker && selectedTheme === predefinedThemes.length && (
              <div className="custom-color-picker">
                {customColors.map((color, index) => (
                  <div key={index} className="color-input-group">
                    <label>Color {index + 1}</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const newColors = [...customColors];
                          newColors[index] = e.target.value;
                          setCustomColors(newColors);
                        }}
                        className="color-input"
                      />
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => {
                          const newColors = [...customColors];
                          newColors[index] = e.target.value;
                          setCustomColors(newColors);
                        }}
                        className="color-hex-input"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};