import React, { useState, useCallback, useEffect } from 'react';
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
  const [selectedTheme, setSelectedTheme] = useState(0);
  const [customColors, setCustomColors] = useState(['#FF516B', '#99C3FA', '#99FABE']);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isThemePickerExpanded, setIsThemePickerExpanded] = useState(false);

  // Auto-fill first suggestion instead of placeholder
  useEffect(() => {
    const loadSuggestion = async () => {
      if (!datasetId || description) return; // Don't override if user already typed

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
          if (data.suggestions?.[0]) {
            setDescription(data.suggestions[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load suggestion:', error);
      }
    };

    loadSuggestion();
  }, [datasetId, description]);

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
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder=""
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