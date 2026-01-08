import React, { useRef, useEffect, useState } from 'react';
import Plot from 'react-plotly.js';

// Helper function to determine if a color is dark
const isDarkColor = (color: string): boolean => {
  // Remove # if present
  const hex = color.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return true if dark (luminance < 0.5)
  return luminance < 0.5;
};

// Helper function to get shadow based on background color
const getShadow = (backgroundColor: string): string => {
  // Normalize color (remove # and convert to lowercase)
  const normalizedColor = backgroundColor.replace('#', '').toLowerCase();
  
  // Check if color is white or very light (ffffff, fff, or close to white)
  const isWhite = normalizedColor === 'ffffff' || normalizedColor === 'fff' || 
                  (normalizedColor.length === 6 && 
                   parseInt(normalizedColor.substring(0, 2), 16) > 250 &&
                   parseInt(normalizedColor.substring(2, 4), 16) > 250 &&
                   parseInt(normalizedColor.substring(4, 6), 16) > 250);
  
  if (isDarkColor(backgroundColor)) {
    // Light glow for dark backgrounds
    return '0 4px 20px rgba(255, 255, 255, 0.15), 0 2px 8px rgba(255, 255, 255, 0.1)';
  } else if (isWhite) {
    // Lower opacity shadow for white backgrounds
    return '0 4px 20px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04)';
  } else {
    // Dark shadow for light backgrounds
    return '0 4px 20px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)';
  }
};

interface KPICardProps {
  title: string;
  chartSpec: any;
  chartIndex: number;
  onEdit?: (index: number, editRequest: string) => Promise<void>;
  onRemove?: (index: number) => void;
  isEditing?: boolean;
  backgroundColor?: string;
  textColor?: string;
  activeContainerColorPicker?: number | null;
  setActiveContainerColorPicker?: (index: number | null) => void;
  containerColors?: Record<number, {bg: string, text: string, opacity: number}>;
  setContainerColors?: React.Dispatch<React.SetStateAction<Record<number, {bg: string, text: string, opacity: number}>>>;
  applyToContainers?: boolean;
  setApplyToContainers?: (value: boolean) => void;
}

// Helper function to convert hex to rgba
const hexToRgba = (hex: string, opacity: number): string => {
  const normalizedHex = hex.replace('#', '');
  const r = parseInt(normalizedHex.substring(0, 2), 16);
  const g = parseInt(normalizedHex.substring(2, 4), 16);
  const b = parseInt(normalizedHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const KPICard: React.FC<KPICardProps> = ({ 
  title, 
  chartSpec, 
  chartIndex,
  onEdit,
  backgroundColor = '#ffffff',
  textColor = '#1a1a1a',
  onRemove,
  isEditing = false,
  activeContainerColorPicker,
  setActiveContainerColorPicker,
  containerColors,
  setContainerColors,
  applyToContainers,
  setApplyToContainers
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const colorPickerButtonRef = useRef<HTMLButtonElement>(null);
  const colorPickerDropdownRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 280, height: 100 });
  const [showActions, setShowActions] = useState(false);
  const [showEditInput, setShowEditInput] = useState(false);
  const [editInput, setEditInput] = useState('');
  const figureData = chartSpec?.figure;

  // Get container-specific colors or use defaults
  const containerColor = containerColors?.[chartIndex];
  const actualBg = applyToContainers ? backgroundColor : (containerColor?.bg || '#ffffff');
  const actualText = applyToContainers ? textColor : (containerColor?.text || '#1a1a1a');
  const actualOpacity = applyToContainers ? 1 : (containerColor?.opacity || 1);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeContainerColorPicker === chartIndex && colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setActiveContainerColorPicker?.(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeContainerColorPicker, chartIndex, setActiveContainerColorPicker]);

  // Position color picker dropdown relative to button
  useEffect(() => {
    if (activeContainerColorPicker === chartIndex && colorPickerButtonRef.current && colorPickerDropdownRef.current) {
      const buttonRect = colorPickerButtonRef.current.getBoundingClientRect();
      const dropdown = colorPickerDropdownRef.current;
      
      // Position below the button, aligned to the right
      dropdown.style.top = `${buttonRect.bottom + 4}px`;
      dropdown.style.right = `${window.innerWidth - buttonRect.right}px`;
      
      // Adjust if dropdown would go off screen
      const dropdownRect = dropdown.getBoundingClientRect();
      if (dropdownRect.bottom > window.innerHeight) {
        dropdown.style.top = `${buttonRect.top - dropdownRect.height - 4}px`;
      }
      if (dropdownRect.left < 0) {
        dropdown.style.right = 'auto';
        dropdown.style.left = `${buttonRect.left}px`;
      }
    }
  }, [activeContainerColorPicker, chartIndex]);

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

  const handleEditSubmit = async () => {
    if (editInput.trim() && onEdit) {
      await onEdit(chartIndex, editInput.trim());
      setEditInput('');
      setShowEditInput(false);
    }
  };

  // Placeholder when loading
  if (!figureData) {
    return (
      <div 
        ref={containerRef}
        style={{
          backgroundColor: hexToRgba(actualBg, actualOpacity),
          color: actualText,
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          width: '100%',
          height: '100px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: getShadow(actualBg),
          boxSizing: 'border-box'
        }}>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Loading...</div>
      </div>
    );
  }

  // Extract the indicator data for clean display
  const indicatorData = figureData.data?.[0];
  const value = indicatorData?.value;
  const indicatorTitle = indicatorData?.title?.text || title;

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

  const ActionButtons = () => (
    <div 
      ref={colorPickerRef}
      style={{
        position: 'absolute',
        top: '4px',
        right: '4px',
        display: 'flex',
        gap: '4px',
        opacity: showActions ? 1 : 0,
        transition: 'opacity 0.2s',
        zIndex: 10
      }}>
      {/* Color Picker Button */}
      {setActiveContainerColorPicker && (
        <div style={{ position: 'relative' }}>
          <button
            ref={colorPickerButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              if (setActiveContainerColorPicker) {
                const isOpening = activeContainerColorPicker !== chartIndex;
                setActiveContainerColorPicker(isOpening ? chartIndex : null);
                // Untick "apply to all" when opening color picker for a specific container
                if (isOpening && setApplyToContainers) {
                  setApplyToContainers(false);
                }
              }
            }}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: 'rgba(255, 107, 107, 0.1)',
              color: '#ff6b6b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Container colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
          </button>

          {/* Color Picker Dropdown */}
          {activeContainerColorPicker === chartIndex && setContainerColors && (
            <div
              ref={colorPickerDropdownRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                background: 'white',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                zIndex: 10000,
                minWidth: '180px',
                border: '1px solid #e5e7eb'
              }}
            >
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 500, color: '#6b7280' }}>
                  Background
                </label>
                <input
                  type="color"
                  value={containerColor?.bg || '#ffffff'}
                  onChange={(e) => {
                    setContainerColors(prev => ({
                      ...prev,
                      [chartIndex]: { ...prev[chartIndex], bg: e.target.value, text: prev[chartIndex]?.text || '#1a1a1a', opacity: prev[chartIndex]?.opacity || 1 }
                    }));
                    if (setApplyToContainers) {
                      setApplyToContainers(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '32px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 500, color: '#6b7280' }}>
                  Opacity
                </label>
                <style>{`
                  input[type="range"]#kpi-opacity-${chartIndex}::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: #ff6b6b;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(255, 107, 107, 0.3);
                  }
                  input[type="range"]#kpi-opacity-${chartIndex}::-moz-range-thumb {
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: #ff6b6b;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 4px rgba(255, 107, 107, 0.3);
                  }
                  input[type="range"]#kpi-opacity-${chartIndex}::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 4px;
                    background: #e5e7eb;
                    border-radius: 2px;
                  }
                  input[type="range"]#kpi-opacity-${chartIndex}::-moz-range-track {
                    width: 100%;
                    height: 4px;
                    background: #e5e7eb;
                    border-radius: 2px;
                  }
                `}</style>
                <input
                  id={`kpi-opacity-${chartIndex}`}
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={containerColor?.opacity ?? 1}
                  onChange={(e) => {
                    const newOpacity = parseFloat(e.target.value);
                    setContainerColors(prev => ({
                      ...prev,
                      [chartIndex]: { 
                        bg: prev[chartIndex]?.bg || '#ffffff', 
                        text: prev[chartIndex]?.text || '#1a1a1a', 
                        opacity: newOpacity 
                      }
                    }));
                    if (setApplyToContainers) {
                      setApplyToContainers(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    cursor: 'pointer',
                    accentColor: '#ff6b6b'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>
                  <span>0%</span>
                  <span>{Math.round((containerColor?.opacity ?? 1) * 100)}%</span>
                  <span>100%</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 500, color: '#6b7280' }}>
                  Text
                </label>
                <input
                  type="color"
                  value={containerColor?.text || '#1a1a1a'}
                  onChange={(e) => {
                    setContainerColors(prev => ({
                      ...prev,
                      [chartIndex]: { ...prev[chartIndex], bg: prev[chartIndex]?.bg || '#ffffff', text: e.target.value, opacity: prev[chartIndex]?.opacity || 1 }
                    }));
                    if (setApplyToContainers) {
                      setApplyToContainers(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '32px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Button */}
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowEditInput(true);
          }}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            color: '#ff6b6b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title="Edit KPI"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}
      
      {/* Remove Button */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(chartIndex);
          }}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title="Remove KPI"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );

  const EditInputOverlay = () => (
    <div style={{
      position: 'absolute',
      inset: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      padding: '8px',
      gap: '6px',
      zIndex: 20
    }}>
      <input
        type="text"
        value={editInput}
        onChange={(e) => setEditInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleEditSubmit();
          if (e.key === 'Escape') {
            setShowEditInput(false);
            setEditInput('');
          }
        }}
        placeholder="e.g., Show average instead of sum..."
        autoFocus
        style={{
          flex: 1,
          padding: '6px 8px',
          fontSize: '11px',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          outline: 'none'
        }}
      />
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => {
            setShowEditInput(false);
            setEditInput('');
          }}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleEditSubmit}
          disabled={!editInput.trim() || isEditing}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: '#ff6b6b',
            color: 'white',
            cursor: editInput.trim() && !isEditing ? 'pointer' : 'not-allowed',
            opacity: editInput.trim() && !isEditing ? 1 : 0.5
          }}
        >
          {isEditing ? '...' : 'Edit'}
        </button>
      </div>
    </div>
  );

  // If we have valid indicator data, render a clean custom KPI card
  if (indicatorData?.type === 'indicator' && value !== undefined) {
    return (
      <div 
        ref={containerRef}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        style={{
          backgroundColor: hexToRgba(actualBg, actualOpacity),
          color: actualText,
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          width: '100%',
          height: '100px',
          boxShadow: getShadow(backgroundColor),
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '12px 16px',
          position: 'relative',
          opacity: isEditing ? 0.7 : 1,
          transition: 'opacity 0.2s',
          boxSizing: 'border-box'
        }}
      >
        {isEditing && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 15
          }}>
            <div className="loading-spinner" style={{ width: 20, height: 20 }} />
          </div>
        )}
        
        <ActionButtons />
        {showEditInput && <EditInputOverlay />}
        
        <div style={{ 
          fontSize: '11px', 
          fontWeight: 500, 
          color: actualText, 
          opacity: 0.7,
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
          color: actualText,
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
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      style={{
        backgroundColor: backgroundColor,
        color: textColor,
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        width: '100%',
        height: '100px',
        boxShadow: getShadow(backgroundColor),
        position: 'relative',
        boxSizing: 'border-box'
      }}
    >
      {isEditing && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 15
        }}>
          <div className="loading-spinner" style={{ width: 20, height: 20 }} />
        </div>
      )}
      
      <ActionButtons />
      {showEditInput && <EditInputOverlay />}
      
      <Plot
        data={figureData.data || []}
        layout={{
          autosize: false,
          width: dimensions.width,
          height: dimensions.height,
          margin: { l: 8, r: 8, t: 30, b: 8 },
          paper_bgcolor: actualBg,
          plot_bgcolor: actualBg,
          font: { color: actualText },
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

// KPI Cards Container - Wraps to new row after 3 cards, with floating add button
interface KPICardsContainerProps {
  kpiSpecs: any[];
  onEditKPI?: (index: number, editRequest: string) => Promise<void>;
  onRemoveKPI?: (index: number) => void;
  onAddKPI?: () => void;
  editingKPIIndex?: number | null;
  isAddingKPI?: boolean;
  backgroundColor?: string;
  textColor?: string;
  hideAddButton?: boolean;
  activeContainerColorPicker?: number | null;
  setActiveContainerColorPicker?: (index: number | null) => void;
  containerColors?: Record<number, {bg: string, text: string, opacity: number}>;
  setContainerColors?: React.Dispatch<React.SetStateAction<Record<number, {bg: string, text: string, opacity: number}>>>;
  applyToContainers?: boolean;
  setApplyToContainers?: (value: boolean) => void;
}

export const KPICardsContainer: React.FC<KPICardsContainerProps> = ({ 
  kpiSpecs, 
  onEditKPI,
  onRemoveKPI,
  onAddKPI,
  editingKPIIndex,
  isAddingKPI = false,
  backgroundColor = '#ffffff',
  textColor = '#1a1a1a',
  hideAddButton = false,
  activeContainerColorPicker,
  setActiveContainerColorPicker,
  containerColors,
  setContainerColors,
  applyToContainers,
  setApplyToContainers
}) => {
  const kpis = kpiSpecs || [];
  const [addButtonHovered, setAddButtonHovered] = useState(false);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 20px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }}>
      {/* KPI Cards Grid */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        flex: 1
      }}>
        {kpis.map((spec, index) => (
          <div 
            key={`kpi-${index}`} 
            style={{ 
              flex: '1 1 calc(33.333% - 8px)',
              minWidth: '200px',
              maxWidth: 'calc(33.333% - 8px)'
            }}
          >
            <KPICard
              title={spec.title || `KPI ${index + 1}`}
              chartSpec={spec}
              chartIndex={index}
              onEdit={onEditKPI}
              onRemove={onRemoveKPI}
              isEditing={editingKPIIndex === index}
              backgroundColor={backgroundColor}
              textColor={textColor}
              activeContainerColorPicker={activeContainerColorPicker}
              setActiveContainerColorPicker={setActiveContainerColorPicker}
              containerColors={containerColors}
              setContainerColors={setContainerColors}
              applyToContainers={applyToContainers}
              setApplyToContainers={setApplyToContainers}
            />
          </div>
        ))}
      </div>
      
      {/* Floating Add KPI Button - Similar to filter button style */}
      {onAddKPI && !hideAddButton && (
        <button
          onClick={onAddKPI}
          disabled={isAddingKPI}
          onMouseEnter={() => setAddButtonHovered(true)}
          onMouseLeave={() => setAddButtonHovered(false)}
          style={{
            background: addButtonHovered ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255, 107, 107, 0.1)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 107, 107, 0.3)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isAddingKPI ? 'not-allowed' : 'pointer',
            boxShadow: addButtonHovered ? '0 4px 12px rgba(255, 107, 107, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease',
            transform: addButtonHovered ? 'scale(1.1)' : 'scale(1)',
            opacity: isAddingKPI ? 0.6 : 1,
            flexShrink: 0
          }}
          title="Add KPI Card"
        >
          {isAddingKPI ? (
            <div className="loading-spinner" style={{ width: 16, height: 16 }} />
          ) : (
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#ff6b6b" 
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
};

export default KPICard;
