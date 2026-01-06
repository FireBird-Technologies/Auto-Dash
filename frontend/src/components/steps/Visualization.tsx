import React, { useState, useEffect, useRef } from 'react';
import { PlotlyChartRenderer } from '../PlotlyChartRenderer';
import { FixNotification } from '../FixNotification';
import { MarkdownMessage } from '../MarkdownMessage';
import { AddChartPopup } from '../AddChartPopup';
import { SharePopup } from '../SharePopup';
import { InsufficientBalancePopup } from '../InsufficientBalancePopup';
import { KPICardsContainer, KPICard } from '../KPICard';
import { DashboardSkeleton } from '../LoadingSkeleton';
import { config, getAuthHeaders, checkAuthResponse } from '../../config';
import { useNotification } from '../../contexts/NotificationContext';

// Chart Item Component
interface ChartItemProps {
  chartSpec: any;
  chartIndex: number;
  localData: any[];
  datasetId: string;
  onChartFixed: (chartIndex: number, fixedCode: string, figureData?: any) => void;
  onFixingStatusChange: (isFixing: boolean) => void;
  onZoom: (index: number) => void;
  onDelete: (index: number) => void;
  chartNotes: Record<number, string>;
  editingNotesIndex: number | null;
  setEditingNotesIndex: (index: number | null) => void;
  notesVisible: Record<number, boolean>;
  setNotesVisible: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  generatingInsights: Record<number, boolean>;
  savingNotes: Record<number, boolean>;
  savedNotes: Record<number, boolean>;
  handleGenerateInsights: (index: number) => void;
  handleSaveNotes: (index: number, notes: string) => void;
  setChartNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setSavedNotes: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  backgroundColor?: string;
  textColor?: string;
  filterPanelOpen: number | null;
  setFilterPanelOpen: (index: number | null) => void;
  chartFilters: Record<number, Record<string, any>>;
  setChartFilters: React.Dispatch<React.SetStateAction<Record<number, Record<string, any>>>>;
  applyingFilter: number | null;
  setApplyingFilter: React.Dispatch<React.SetStateAction<number | null>>;
  applyFilterToChart: (index: number) => void;
  getFilteredChartSpec: (spec: any, index: number) => any;
  viewMode: 'list' | 'grid';
}

const ChartItem: React.FC<ChartItemProps> = ({
  chartSpec,
  chartIndex,
  localData,
  datasetId,
  onChartFixed,
  onFixingStatusChange,
  onZoom,
  onDelete,
  chartNotes,
  editingNotesIndex,
  setEditingNotesIndex,
  notesVisible,
  setNotesVisible,
  generatingInsights,
  savingNotes,
  savedNotes,
  handleGenerateInsights,
  handleSaveNotes,
  setChartNotes,
  setSavedNotes,
  filterPanelOpen,
  setFilterPanelOpen,
  chartFilters,
  setChartFilters,
  applyingFilter,
  setApplyingFilter,
  applyFilterToChart,
  getFilteredChartSpec,
  viewMode,
  backgroundColor = '#ffffff',
  textColor = '#1a1a1a'
}) => {
  const notification = useNotification();
  
  return (
    <div
      style={{ width: '100%' }}
      key={`chart-wrapper-${chartIndex}`}
    >
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          width: '100%'
        }}
      >

        {/* Chart */}
        <div style={{
          flex: 1,
          backgroundColor: backgroundColor,
          color: textColor,
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          minHeight: '600px',
          height: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <PlotlyChartRenderer 
            chartSpec={getFilteredChartSpec(chartSpec, chartIndex)} 
            data={localData}
            chartIndex={chartIndex}
            datasetId={datasetId}
            onChartFixed={onChartFixed}
            backgroundColor={backgroundColor}
            textColor={textColor}
            onFixingStatusChange={onFixingStatusChange}
            onZoom={onZoom}
            viewMode={viewMode}
          />
        </div>
        
        {/* Action Buttons: Filter, Notes, Duplicate, Delete */}
        <div 
          data-notes-dropdown
          style={{
            position: 'relative',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {/* Delete Button */}
          <button
            onClick={() => onDelete(chartIndex)}
            style={{
              background: 'rgba(255, 107, 107, 0.1)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              padding: '0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              color: '#ff6b6b'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Delete chart"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Filter Button */}
          <button
            onClick={() => {
              setFilterPanelOpen(filterPanelOpen === chartIndex ? null : chartIndex);
            }}
            style={{
              background: filterPanelOpen === chartIndex ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255, 107, 107, 0.1)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              padding: '0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              color: '#ff6b6b'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              if (filterPanelOpen !== chartIndex) {
                e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)';
              }
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Filter data"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </button>

          {/* Filter Panel */}
          {filterPanelOpen === chartIndex && (() => {
            const columnsToFilter = (chartSpec.columns_used && chartSpec.columns_used.length > 0)
              ? chartSpec.columns_used.slice(0, 6)
              : Object.keys(localData[0] || {}).slice(0, 4);
            
            const getColumnType = (column: string): 'number' | 'date' | 'string' => {
              if (localData.length === 0) return 'string';
              const sampleValues = localData.slice(0, 10).map(row => row[column]).filter(v => v != null);
              if (sampleValues.length === 0) return 'string';
              
              if (sampleValues.every(v => typeof v === 'number' || (!isNaN(Number(v)) && v !== ''))) {
                return 'number';
              }
              
              const datePatterns = [/^\d{4}-\d{2}-\d{2}/, /^\d{2}\/\d{2}\/\d{4}/, /^\d{2}-\d{2}-\d{4}/];
              if (sampleValues.every(v => datePatterns.some(p => p.test(String(v))) || !isNaN(Date.parse(String(v))))) {
                return 'date';
              }
              
              return 'string';
            };
            
            const getNumericRange = (column: string) => {
              const values = localData.map(row => Number(row[column])).filter(v => !isNaN(v));
              return { min: Math.min(...values), max: Math.max(...values) };
            };
            
            return (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              width: '320px',
              backgroundColor: 'white',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
              zIndex: 100,
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  Filter Data
                </span>
                <button
                  onClick={() => setFilterPanelOpen(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div style={{ padding: '16px', maxHeight: '350px', overflowY: 'auto' }}>
                {columnsToFilter.length > 0 ? columnsToFilter.map((column: string) => {
                  const colType = getColumnType(column);
                  const uniqueValues = [...new Set(localData.map(row => row[column]))].filter(v => v != null);
                  
                  return (
                    <div key={column} style={{ marginBottom: '16px' }}>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px', 
                        fontWeight: 600, 
                        color: '#ef4444',
                        marginBottom: '8px',
                      }}>
                        {column}
                        <span style={{ 
                          fontSize: '9px', 
                          padding: '2px 6px', 
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          color: '#ef4444',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}>
                          {colType}
                        </span>
                      </label>
                      
                      {/* Number: Range slider */}
                      {colType === 'number' && (() => {
                        const { min, max } = getNumericRange(column);
                        const currentMin = chartFilters[chartIndex]?.[`${column}_min`] ?? min;
                        const currentMax = chartFilters[chartIndex]?.[`${column}_max`] ?? max;
                        return (
                          <div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                              <input
                                type="number"
                                placeholder="Min"
                                value={currentMin}
                                onChange={(e) => setChartFilters(prev => ({
                                  ...prev,
                                  [chartIndex]: { ...prev[chartIndex], [`${column}_min`]: e.target.value ? Number(e.target.value) : undefined }
                                }))}
                                style={{ flex: 1, padding: '6px 8px', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', width: '100%' }}
                              />
                              <span style={{ color: '#9ca3af', alignSelf: 'center' }}>—</span>
                              <input
                                type="number"
                                placeholder="Max"
                                value={currentMax}
                                onChange={(e) => setChartFilters(prev => ({
                                  ...prev,
                                  [chartIndex]: { ...prev[chartIndex], [`${column}_max`]: e.target.value ? Number(e.target.value) : undefined }
                                }))}
                                style={{ flex: 1, padding: '6px 8px', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', width: '100%' }}
                              />
                            </div>
                            <input
                              type="range"
                              min={min}
                              max={max}
                              value={currentMax}
                              onChange={(e) => setChartFilters(prev => ({
                                ...prev,
                                [chartIndex]: { ...prev[chartIndex], [`${column}_max`]: Number(e.target.value) }
                              }))}
                              style={{ width: '100%', accentColor: '#ff6b6b' }}
                            />
                          </div>
                        );
                      })()}
                      
                      {/* Date: Date range picker */}
                      {colType === 'date' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="date"
                            value={chartFilters[chartIndex]?.[`${column}_from`] || ''}
                            onChange={(e) => setChartFilters(prev => ({
                              ...prev,
                              [chartIndex]: { ...prev[chartIndex], [`${column}_from`]: e.target.value || undefined }
                            }))}
                            style={{ flex: 1, padding: '6px 8px', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                          />
                          <span style={{ color: '#9ca3af', alignSelf: 'center' }}>to</span>
                          <input
                            type="date"
                            value={chartFilters[chartIndex]?.[`${column}_to`] || ''}
                            onChange={(e) => setChartFilters(prev => ({
                              ...prev,
                              [chartIndex]: { ...prev[chartIndex], [`${column}_to`]: e.target.value || undefined }
                            }))}
                            style={{ flex: 1, padding: '6px 8px', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                          />
                        </div>
                      )}
                      
                      {/* String: Category multi-select */}
                      {colType === 'string' && (
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '6px',
                          maxHeight: '100px',
                          overflowY: 'auto',
                          padding: '4px 0'
                        }}>
                          {uniqueValues.slice(0, 15).map((val, i) => {
                            const isSelected = (chartFilters[chartIndex]?.[column] as string[] || []).includes(String(val));
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  const current = (chartFilters[chartIndex]?.[column] as string[]) || [];
                                  const newValues = isSelected 
                                    ? current.filter(v => v !== String(val))
                                    : [...current, String(val)];
                                  setChartFilters(prev => ({
                                    ...prev,
                                    [chartIndex]: { ...prev[chartIndex], [column]: newValues.length > 0 ? newValues : undefined }
                                  }));
                                }}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  border: isSelected ? '1px solid #ff6b6b' : '1px solid #e5e7eb',
                                  borderRadius: '14px',
                                  backgroundColor: isSelected ? 'rgba(255, 107, 107, 0.1)' : 'white',
                                  color: isSelected ? '#ff6b6b' : '#6b7280',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {String(val).length > 20 ? String(val).slice(0, 20) + '...' : String(val)}
                              </button>
                            );
                          })}
                          {uniqueValues.length > 15 && (
                            <span style={{ fontSize: '10px', color: '#9ca3af', alignSelf: 'center' }}>
                              +{uniqueValues.length - 15} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
                    No filterable columns detected
                  </div>
                )}
              </div>
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={async () => {
                    setChartFilters(prev => ({ ...prev, [chartIndex]: {} }));
                    const spec = chartSpec;
                    if (spec?.chart_spec) {
                      setApplyingFilter(chartIndex);
                      try {
                        const response = await fetch(`${config.backendUrl}/api/data/apply-filter`, {
                          method: 'POST',
                          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                          credentials: 'include',
                          body: JSON.stringify({
                            chart_index: chartIndex,
                            filters: {},
                            dataset_id: datasetId,
                            original_code: spec.chart_spec
                          })
                        });
                        await checkAuthResponse(response);
                        const result = await response.json();
                        if (result.success && result.figure) {
                          // Update the chart spec with the new figure
                          onChartFixed(chartIndex, spec.chart_spec, result.figure);
                          notification.success('Filters cleared');
                        }
                      } catch (error) {
                        console.error('Error clearing filters:', error);
                      } finally {
                        setApplyingFilter(null);
                        setFilterPanelOpen(null);
                      }
                    }
                  }}
                  disabled={applyingFilter === chartIndex}
                  style={{ padding: '6px 12px', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: 'white', color: '#6b7280', cursor: applyingFilter === chartIndex ? 'wait' : 'pointer' }}
                >
                  {applyingFilter === chartIndex ? 'Clearing...' : 'Clear'}
                </button>
                <button
                  onClick={() => applyFilterToChart(chartIndex)}
                  disabled={applyingFilter === chartIndex}
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '12px', 
                    border: 'none', 
                    borderRadius: '6px', 
                    backgroundColor: applyingFilter === chartIndex ? '#fca5a5' : '#ff6b6b', 
                    color: 'white', 
                    cursor: applyingFilter === chartIndex ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {applyingFilter === chartIndex && (
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  )}
                  {applyingFilter === chartIndex ? 'Applying...' : 'Apply'}
                </button>
              </div>
            </div>
            );
          })()}
          
          {/* Notes Button */}
          <button
            onClick={() => {
              // Toggle notes visibility
              if (chartNotes[chartIndex] || editingNotesIndex === chartIndex) {
                setNotesVisible(prev => ({
                  ...prev,
                  [chartIndex]: !prev[chartIndex]
                }));
                // If hiding and was editing, stop editing
                if (notesVisible[chartIndex] && editingNotesIndex === chartIndex) {
                  setEditingNotesIndex(null);
                }
              } else {
                // If no notes exist, start editing immediately
                setEditingNotesIndex(chartIndex);
                setNotesVisible(prev => ({
                  ...prev,
                  [chartIndex]: true
                }));
              }
            }}
            style={{
              background: 'rgba(255, 107, 107, 0.1)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#ff6b6b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 107, 107, 0.2)';
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
              e.currentTarget.style.color = '#ff6b6b';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            }}
            title={chartNotes[chartIndex] ? (notesVisible[chartIndex] ? "Hide notes" : "Show notes") : "Add notes"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            {chartNotes[chartIndex] ? (notesVisible[chartIndex] ? 'Hide notes' : 'Show notes') : 'Add notes'}
          </button>

          {/* Notes Panel */}
          {notesVisible[chartIndex] && (editingNotesIndex === chartIndex || chartNotes[chartIndex]) && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              width: '350px',
              maxHeight: '600px',
              backgroundColor: 'white',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'white'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#374151'
                  }}>
                    Notes
                  </span>
                  {editingNotesIndex === chartIndex && (
                    <button
                      onClick={async () => handleGenerateInsights(chartIndex)}
                      disabled={generatingInsights[chartIndex]}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(220, 38, 38, 0.1)',
                        border: '1px solid rgba(220, 38, 38, 0.2)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#dc2626',
                        cursor: generatingInsights[chartIndex] ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s',
                        opacity: generatingInsights[chartIndex] ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!generatingInsights[chartIndex]) {
                          e.currentTarget.style.background = 'rgba(220, 38, 38, 0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      {generatingInsights[chartIndex] ? 'Generating...' : 'Generate with AI'}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditingNotesIndex(null);
                    setNotesVisible(prev => ({
                      ...prev,
                      [chartIndex]: false
                    }));
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#6b7280';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#9ca3af';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '16px',
                minHeight: '200px',
                backgroundColor: 'white',
                position: 'relative'
              }}>
                {editingNotesIndex === chartIndex ? (
                  <div style={{ position: 'relative', width: '100%', flex: 1 }}>
                    <textarea
                      value={chartNotes[chartIndex] || ''}
                      onChange={(e) => {
                        setChartNotes(prev => ({ ...prev, [chartIndex]: e.target.value }));
                        setSavedNotes(prev => ({ ...prev, [chartIndex]: false }));
                      }}
                      placeholder="Add your notes here... (Markdown supported)"
                      disabled={generatingInsights[chartIndex]}
                      style={{
                        width: '100%',
                        flex: 1,
                        minHeight: '200px',
                        padding: '12px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        lineHeight: '1.6',
                        resize: 'vertical',
                        outline: 'none',
                        backgroundColor: 'white',
                        opacity: generatingInsights[chartIndex] ? 0.7 : 1,
                        transition: 'opacity 0.2s'
                      }}
                      autoFocus
                    />
                  </div>
                ) : (
                  <MarkdownMessage content={chartNotes[chartIndex] || 'No notes yet. Click "Add notes" to add some.'} />
                )}
              </div>
              {editingNotesIndex === chartIndex && (
                <div style={{
                  padding: '12px 16px',
                  borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                  backgroundColor: 'white',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={() => handleSaveNotes(chartIndex, chartNotes[chartIndex] || '')}
                    disabled={savingNotes[chartIndex] || savedNotes[chartIndex]}
                    style={{
                      padding: '6px 16px',
                      background: savedNotes[chartIndex] ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)',
                      border: savedNotes[chartIndex] ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(34, 197, 94, 0.2)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#22c55e',
                      cursor: savingNotes[chartIndex] || savedNotes[chartIndex] ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                      opacity: savingNotes[chartIndex] ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!savingNotes[chartIndex] && !savedNotes[chartIndex]) {
                        e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = savedNotes[chartIndex] ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)';
                    }}
                  >
                    {savedNotes[chartIndex] ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Saved
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                        {savingNotes[chartIndex] ? 'Saving...' : 'Save Notes'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Guide Tour Overlay Component
interface GuideTourOverlayProps {
  step: number; // 0=chat, 1=download, 2=publish
  chatButtonRef: React.RefObject<HTMLButtonElement>;
  downloadButtonRef: React.RefObject<HTMLButtonElement>;
  publishButtonRef: React.RefObject<HTMLButtonElement>;
  onNext: () => void;
}

const GuideTourOverlay: React.FC<GuideTourOverlayProps> = ({
  step,
  chatButtonRef,
  downloadButtonRef,
  publishButtonRef,
  onNext
}) => {
  const [position, setPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      let button: HTMLButtonElement | null = null;
      if (step === 0) button = chatButtonRef.current;
      else if (step === 1) button = downloadButtonRef.current;
      else if (step === 2) button = publishButtonRef.current;

      if (button) {
        const rect = button.getBoundingClientRect();
        setPosition({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [step, chatButtonRef, downloadButtonRef, publishButtonRef]);

  if (!position) return null;

  const guideContent = [
    {
      title: 'Chat',
      description: 'Ask questions or request edits to your charts',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    },
    {
      title: 'Download',
      description: 'Export charts as PNG or PDF',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )
    },
    {
      title: 'Publish',
      description: 'Share your dashboard with a public link',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      )
    }
  ];

  const content = guideContent[step];
  const tooltipRect = tooltipRef.current?.getBoundingClientRect();
  const tooltipWidth = tooltipRect?.width || 280;
  const tooltipHeight = tooltipRect?.height || 120;

  // Calculate tooltip position (prefer above, but adjust if needed)
  let tooltipTop = position.top - tooltipHeight - 16;
  let tooltipLeft = position.left + (position.width / 2) - (tooltipWidth / 2);

  // Adjust if tooltip would go off screen
  if (tooltipTop < 20) {
    tooltipTop = position.top + position.height + 16;
  }
  if (tooltipLeft < 20) {
    tooltipLeft = 20;
  }
  if (tooltipLeft + tooltipWidth > window.innerWidth - 20) {
    tooltipLeft = window.innerWidth - tooltipWidth - 20;
  }

  // Calculate arrow position
  const arrowLeft = position.left + (position.width / 2) - tooltipLeft;

  return (
    <>
      {/* Overlay backdrop */}
      <div 
        className="guide-overlay-backdrop"
      />
      
      {/* Highlighted button area */}
      <div
        className="guide-highlight-box"
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          width: position.width,
          height: position.height,
          zIndex: 10001,
          pointerEvents: 'none'
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="guide-tooltip"
        style={{
          position: 'fixed',
          top: tooltipTop,
          left: tooltipLeft,
          zIndex: 10002
        }}
      >
        <div className="guide-tooltip-content">
          <div className="guide-tooltip-header">
            <div className="guide-tooltip-icon">{content.icon}</div>
            <div>
              <h3>{content.title}</h3>
              <p>{content.description}</p>
            </div>
          </div>
          <div className="guide-tooltip-footer">
            <span className="guide-step-indicator">
              {step + 1} of {guideContent.length}
            </span>
            <div className="guide-tooltip-actions">
              {step < guideContent.length - 1 ? (
                <button onClick={onNext} className="guide-next-btn">Next</button>
              ) : (
                <button onClick={onNext} className="guide-finish-btn">Got it!</button>
              )}
            </div>
          </div>
        </div>
        {/* Arrow */}
        <div
          className="guide-tooltip-arrow"
          style={{
            [tooltipTop < position.top ? 'bottom' : 'top']: '-8px',
            left: `${arrowLeft}px`
          }}
        />
      </div>
    </>
  );
};

type Row = Record<string, number | string>;

interface VisualizationProps {
  data: Row[];
  datasetId: string;
  context: {
    description: string;
    colorTheme?: string;
  };
  onReupload?: () => void;
}

export const Visualization: React.FC<VisualizationProps> = ({ data, datasetId, context, onReupload }) => {
  const notification = useNotification();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstChartLoading, setIsFirstChartLoading] = useState(false);
  const [guideStep, setGuideStep] = useState<number | null>(null); // 0=chat, 1=download, 2=publish
  const [, setLoadingMessage] = useState('Crafting beautiful insights from your data...');
  const [chartSpecs, setChartSpecs] = useState<any[]>([]);  // Changed to array
  const [expectedKPICount, setExpectedKPICount] = useState<number | null>(null); // Track expected KPI count
  const [expectedChartCount, setExpectedChartCount] = useState<number | null>(null); // Track expected chart count
  const [streamingComplete, setStreamingComplete] = useState(false); // Track if streaming is done
  const [dashboardBgColor, setDashboardBgColor] = useState('#ffffff'); // Dashboard background color
  const [dashboardTextColor, setDashboardTextColor] = useState('#1a1a1a'); // Dashboard text color
  const [showColorPicker, setShowColorPicker] = useState(false); // Color picker dropdown visibility
  const chatButtonRef = useRef<HTMLButtonElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const publishButtonRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{
    type: 'user' | 'assistant', 
    message: string, 
    matchedChart?: {index: number, type: string, title: string},
    codeType?: 'plotly_edit' | 'analysis' | 'add_chart_query',
    executableCode?: string,
    failed?: boolean,
    retryable?: boolean,
    originalQuery?: string
  }>>([]);
  const [contextPrepared, setContextPrepared] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [localData, setLocalData] = useState<Row[]>(data); // Local copy that may be full dataset
  const [fullDataFetched, setFullDataFetched] = useState(false); // Track if we've fetched full data
  const [totalRowsInDataset, setTotalRowsInDataset] = useState<number | null>(null); // Actual total rows in dataset
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showDatasetPreview, setShowDatasetPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{ preview: Row[], total_rows: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const hasGeneratedInitialChart = useRef(false);
  const visualizationRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const [showFixNotification, setShowFixNotification] = useState(false);
  const [zoomedChartIndex, setZoomedChartIndex] = useState<number | null>(null);
  const [chartPreview, setChartPreview] = useState<{chartIndex: number, figure: any, code: string} | null>(null);
  const [isExecutingCode, setIsExecutingCode] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState<string>('Dashboard');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showAddChartPopup, setShowAddChartPopup] = useState(false);
  const [addingChart, setAddingChart] = useState(false);
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);
  const [insufficientBalanceData, setInsufficientBalanceData] = useState<{
    required?: number;
    balance?: number;
    plan?: string;
  }>({});
  const [chatVisible, setChatVisible] = useState(() => {
    const saved = localStorage.getItem('chatVisible');
    return saved !== null ? saved === 'true' : true;
  });
  const [chartNotes, setChartNotes] = useState<Record<number, string>>({});
  const [notesDropdownOpen, setNotesDropdownOpen] = useState<number | null>(null);
  const [editingNotesIndex, setEditingNotesIndex] = useState<number | null>(null);
  const [notesVisible, setNotesVisible] = useState<Record<number, boolean>>({});
  const [generatingInsights, setGeneratingInsights] = useState<Record<number, boolean>>({});
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({});
  const [savedNotes, setSavedNotes] = useState<Record<number, boolean>>({});
  const [filterPanelOpen, setFilterPanelOpen] = useState<number | null>(null);
  const [chartFilters, setChartFilters] = useState<Record<number, Record<string, any>>>({});
  const [applyingFilter, setApplyingFilter] = useState<number | null>(null);
  const [editingKPIIndex, setEditingKPIIndex] = useState<number | null>(null);
  const [isAddingKPI, setIsAddingKPI] = useState(false);
  const [showAddKPIPopup, setShowAddKPIPopup] = useState(false);
  const [addKPIInput, setAddKPIInput] = useState('');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('chart_view_mode') as 'list' | 'grid') || 'list';
  });
  
  // Undo/Redo state
  const [chartHistory, setChartHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const MAX_HISTORY = 10;

  // Update local data when prop changes
  useEffect(() => {
    if (!fullDataFetched) {
      setLocalData(data);
    }
  }, [data, fullDataFetched]);

  // Clear visualization state on mount (fresh session)
  useEffect(() => {
    setChartSpecs([]);  // Changed from setChartSpec(null)
    setChatHistory([]);
    setError(null);
    setQuery('');
    setIsLoading(false);
    setContextPrepared(false);
    setFullDataFetched(false);
    hasGeneratedInitialChart.current = false;
    setChartHistory([]);
    setHistoryIndex(-1);
  }, []);
  
  // Save chart state to history when charts change
  const saveToHistory = (newChartSpecs: any[]) => {
    setChartHistory(prev => {
      // Remove any history after current index (when making new changes after undo)
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state
      newHistory.push(JSON.parse(JSON.stringify(newChartSpecs)));
      // Keep only last MAX_HISTORY states
      return newHistory.slice(-MAX_HISTORY);
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  };
  
  // Undo function
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setChartSpecs(JSON.parse(JSON.stringify(chartHistory[newIndex])));
    }
  };
  
  // Redo function
  const handleRedo = () => {
    if (historyIndex < chartHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setChartSpecs(JSON.parse(JSON.stringify(chartHistory[newIndex])));
    }
  };

  // Save chat visibility preference
  useEffect(() => {
    localStorage.setItem('chatVisible', String(chatVisible));
  }, [chatVisible]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notesDropdownOpen !== null) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-notes-dropdown]')) {
          setNotesDropdownOpen(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notesDropdownOpen]);

  // Function to fetch full dataset when needed (called after chart generation)
  const fetchFullDataset = async () => {
    // Don't fetch if preview modal is open - wait until it's closed to avoid disrupting the UI
    if (showDatasetPreview) {
      return;
    }
    
    // Only fetch if we haven't already and we have preview data
    if (fullDataFetched || !datasetId || data.length >= 50) {
      return;
    }

    try {
      console.log(`Loading full dataset for visualization (currently have ${data.length} rows)...`);
      const response = await fetch(`${config.backendUrl}/api/data/datasets/${datasetId}/full?limit=1000`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[SUCCESS] Full dataset loaded: ${result.rows} rows (Total: ${result.total_rows_in_dataset} rows)`);
        
        // Store the actual total rows in dataset
        if (result.total_rows_in_dataset) {
          setTotalRowsInDataset(result.total_rows_in_dataset);
        }
        
        // Show warning if data was limited
        if (result.limited) {
          console.warn(`[WARNING] Dataset limited to ${result.rows} rows for performance (Total dataset: ${result.total_rows_in_dataset} rows)`);
        }
        
        // Update local data with full dataset
        if (result.data && result.data.length > data.length) {
          setLocalData(result.data);
          setFullDataFetched(true);
        }
      }
    } catch (err) {
      console.error('Failed to load full dataset:', err);
      // Not critical - we can still work with preview data
    }
  };

  // Function to fetch dataset preview
  const fetchDatasetPreview = async () => {
    if (!datasetId) return;
    
    setLoadingPreview(true);
    try {
      const response = await fetch(`${config.backendUrl}/api/data/datasets/${datasetId}/preview?rows=20`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setPreviewData(result);
        // Also capture total rows if we don't have it yet
        if (result.total_rows && !totalRowsInDataset) {
          setTotalRowsInDataset(result.total_rows);
        }
        setShowDatasetPreview(true);
      } else {
        console.error('Failed to fetch dataset preview');
      }
    } catch (err) {
      console.error('Error fetching dataset preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Fetch full dataset when preview modal closes (if not already fetched)
  useEffect(() => {
    if (!showDatasetPreview && !fullDataFetched && datasetId && data.length < 50) {
      // Small delay to ensure modal close animation completes
      const timer = setTimeout(() => {
        fetchFullDataset();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showDatasetPreview, fullDataFetched, datasetId, data.length]);

  // Generate initial chart on load (only once)
  useEffect(() => {
    if (context.description && datasetId && !hasGeneratedInitialChart.current) {
      hasGeneratedInitialChart.current = true;
      generateChart(context.description);
    }
  }, [context.description]); // Only depend on context.description, not datasetId

  // Prepare context when user starts typing (only before first chart)
  const prepareContext = async () => {
    // Skip if context already prepared, no dataset, or charts already generated
    if (contextPrepared || !datasetId || chartSpecs.length > 0) return;
    
    try {
      await fetch(`${config.backendUrl}/api/data/datasets/${datasetId}/prepare-context`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      setContextPrepared(true);
    } catch (err) {
      console.error('Failed to prepare context:', err);
    }
  };

  // Callback to handle when a specific chart is fixed
  const handleChartFixed = (chartIndex: number, fixedCode: string, figureData?: any) => {
    console.log(`Updating chart ${chartIndex} with fixed code`);
    // Dismiss the notification when fix is complete
    setShowFixNotification(false);
    
    setChartSpecs(prevSpecs => {
      const newSpecs = [...prevSpecs];
      if (newSpecs[chartIndex]) {
        newSpecs[chartIndex] = {
          ...newSpecs[chartIndex],
          chart_spec: fixedCode,
          figure: figureData || newSpecs[chartIndex].figure, // Update figure if provided
          execution_success: figureData ? true : newSpecs[chartIndex].execution_success,
          execution_error: figureData ? undefined : newSpecs[chartIndex].execution_error
        };
      }
      saveToHistory(newSpecs);
      return newSpecs;
    });
  };

  // Handler for chart zoom
  const handleDeleteChart = async (chartIndexToDelete: number) => {
    if (!datasetId) return;
    
    notification.showConfirm({
      title: 'Delete Chart',
      message: 'Are you sure you want to delete this chart? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const response = await fetch(`${config.backendUrl}/api/data/datasets/${datasetId}/charts/${chartIndexToDelete}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include',
          });

          await checkAuthResponse(response);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete chart');
          }

          // Remove the chart from local state and re-index
          setChartSpecs(prev => {
            const updatedCharts = prev
              .filter((_, idx) => idx !== chartIndexToDelete)
              .map((chart, newIdx) => ({ ...chart, chart_index: newIdx }));

            return updatedCharts;
          });
          notification.success('Chart deleted successfully!');
        } catch (error) {
          console.error('Error deleting chart:', error);
          notification.error(`Failed to delete chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
      onCancel: () => {}
    });
  };

  const handleChartZoom = (chartIndex: number) => {
    setZoomedChartIndex(chartIndex);
  };

  // Generate insights for chart notes
  const handleGenerateInsights = async (chartIndex: number) => {
    if (!datasetId) return;
    
    setGeneratingInsights(prev => ({ ...prev, [chartIndex]: true }));
    try {
      const response = await fetch(
        `${config.backendUrl}/api/data/datasets/${datasetId}/charts/${chartIndex}/insights`,
        {
          method: 'POST',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          credentials: 'include',
        }
      );
      await checkAuthResponse(response);
      if (!response.ok) throw new Error('Failed to generate insights');
      const result = await response.json();
      const newNotes = chartNotes[chartIndex] ? `${chartNotes[chartIndex]}\n\n${result.insights}` : result.insights;
      setChartNotes(prev => ({ ...prev, [chartIndex]: newNotes }));
    } catch (error) {
      console.error('Error generating insights:', error);
      notification.error('Failed to generate insights');
    } finally {
      setGeneratingInsights(prev => ({ ...prev, [chartIndex]: false }));
    }
  };

  // Save chart notes
  const handleSaveNotes = async (chartIndex: number, notes: string) => {
    if (!datasetId) return;
    
    setSavingNotes(prev => ({ ...prev, [chartIndex]: true }));
    try {
      const response = await fetch(
        `${config.backendUrl}/api/data/datasets/${datasetId}/charts/${chartIndex}/notes`,
        {
          method: 'POST',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify({ notes }),
        }
      );

      await checkAuthResponse(response);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save notes');
      }
      
      // Mark as saved on success and switch to markdown view
      setSavedNotes(prev => ({ ...prev, [chartIndex]: true }));
      setEditingNotesIndex(null); // Switch to markdown view
      notification.success('Notes saved successfully');
    } catch (error) {
      console.error('Error saving notes:', error);
      notification.error('Failed to save notes');
    } finally {
      setSavingNotes(prev => ({ ...prev, [chartIndex]: false }));
    }
  };

  // Apply filter to chart
  const applyFilterToChart = async (chartIndex: number) => {
    const filters = chartFilters[chartIndex];
    const spec = chartSpecs[chartIndex];
    
    if (!filters || Object.keys(filters).length === 0 || !spec?.chart_spec) {
      notification.info('No filters to apply');
      return;
    }
    
    setApplyingFilter(chartIndex);
    
    try {
      const response = await fetch(`${config.backendUrl}/api/data/apply-filter`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json'
        }),
        credentials: 'include',
        body: JSON.stringify({
          chart_index: chartIndex,
          filters: filters,
          dataset_id: datasetId,
          original_code: spec.chart_spec
        })
      });
      
      await checkAuthResponse(response);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.figure) {
        // Update the chart spec with the new filtered figure
        setChartSpecs(prev => prev.map((s, idx) => 
          idx === chartIndex 
            ? { ...s, figure: result.figure, filtered_code: result.filtered_code }
            : s
        ));
        notification.success('Filters applied successfully');
      } else {
        notification.error(result.error || 'Failed to apply filters');
      }
    } catch (error) {
      console.error('Error applying filter:', error);
      notification.error('Failed to apply filters');
    } finally {
      setApplyingFilter(null);
      setFilterPanelOpen(null);
    }
  };

  // Execute analysis code
  const executeAnalysisCode = async (code: string) => {
    setIsExecutingCode(true);
    try {
      const response = await fetch(`${config.backendUrl}/api/data/execute-code`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({
          code: code,
          dataset_id: datasetId,
          code_type: 'analysis'
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check for insufficient credits (402)
        if (response.status === 402 && errorData.detail) {
          const detail = typeof errorData.detail === 'string' 
            ? JSON.parse(errorData.detail) 
            : errorData.detail;
          
          if (detail.error === 'insufficient_credits') {
            setInsufficientBalanceData({
              required: detail.required,
              balance: detail.balance,
              plan: detail.plan
            });
            setShowInsufficientBalance(true);
            setIsExecutingCode(false);
            return;
          }
        }
        
        throw new Error(
          typeof errorData.detail === 'string' 
            ? errorData.detail 
            : errorData.detail?.message || 'Failed to execute analysis code'
        );
      }

      const result = await response.json();
      
      // Add result to chat
      if (result.success) {
        setChatHistory(prev => [...prev, {
          type: 'assistant',
          message: `**Analysis Result:**\n\n${result.result}`
        }]);
      } else {
        // Mark the last assistant message with analysis code as failed
        setChatHistory(prev => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].type === 'assistant' && updated[i].codeType === 'analysis') {
              updated[i] = {
                ...updated[i],
                failed: true,
                retryable: true
              };
              break;
            }
          }
          updated.push({
            type: 'assistant',
            message: `**Error:**\n\n${result.error}`
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error executing analysis:', error);
      // Mark the last assistant message with analysis code as failed
      setChatHistory(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].type === 'assistant' && updated[i].codeType === 'analysis') {
            updated[i] = {
              ...updated[i],
              failed: true,
              retryable: true
            };
            break;
          }
        }
        updated.push({
          type: 'assistant',
          message: `**Error:** ${error instanceof Error ? error.message : 'Failed to execute analysis'}`
        });
        return updated;
      });
    } finally {
      setIsExecutingCode(false);
    }
  };

  // Execute Plotly edit code
  const executePlotlyEdit = async (code: string, chartIndex: number) => {
    setIsExecutingCode(true);
    try {
      const response = await fetch(`${config.backendUrl}/api/data/execute-code`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({
          code: code,
          dataset_id: datasetId,
          code_type: 'plotly_edit'
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check for insufficient credits (402)
        if (response.status === 402 && errorData.detail) {
          const detail = typeof errorData.detail === 'string' 
            ? JSON.parse(errorData.detail) 
            : errorData.detail;
          
          if (detail.error === 'insufficient_credits') {
            setInsufficientBalanceData({
              required: detail.required,
              balance: detail.balance,
              plan: detail.plan
            });
            setShowInsufficientBalance(true);
            setIsExecutingCode(false);
            return;
          }
        }
        
        throw new Error(
          typeof errorData.detail === 'string' 
            ? errorData.detail 
            : errorData.detail?.message || 'Failed to execute plotly code'
        );
      }

      const result = await response.json();
      
      if (result.success) {
        // Set preview
        setChartPreview({
          chartIndex: chartIndex,
          figure: result.figure,
          code: code
        });
      } else {
        // Mark the last assistant message with plotly_edit code as failed
        setChatHistory(prev => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].type === 'assistant' && updated[i].codeType === 'plotly_edit') {
              updated[i] = {
                ...updated[i],
                failed: true,
                retryable: true
              };
              break;
            }
          }
          updated.push({
            type: 'assistant',
            message: `**Error:** Failed to execute code`
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error executing plotly edit:', error);
      // Mark the last assistant message with plotly_edit code as failed
      setChatHistory(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].type === 'assistant' && updated[i].codeType === 'plotly_edit') {
            updated[i] = {
              ...updated[i],
              failed: true,
              retryable: true
            };
            break;
          }
        }
        updated.push({
          type: 'assistant',
          message: `**Error:** ${error instanceof Error ? error.message : 'Failed to execute code'}`
        });
        return updated;
      });
    } finally {
      setIsExecutingCode(false);
    }
  };

  // Retry failed code with improved AI
  const handleRetry = async (message: any) => {
    setIsExecutingCode(true);
    try {
      // Get data context (for now, we'll send empty string as backend will generate it)
      const dataContext = ""; // Backend will generate context from dataset_id
      
      const response = await fetch(`${config.backendUrl}/api/chat/retry`, {
        method: 'POST',
        headers: getAuthHeaders({'Content-Type': 'application/json'}),
        credentials: 'include',
        body: JSON.stringify({
          user_query: message.originalQuery || message.message,
          dataset_id: datasetId,
          code_type: message.codeType,
          plotly_code: message.codeType === 'plotly_edit' && message.matchedChart 
            ? chartSpecs[message.matchedChart.index]?.chart_spec 
            : undefined,
          data_context: dataContext
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check for insufficient credits (402)
        if (response.status === 402 && errorData.detail) {
          const detail = typeof errorData.detail === 'string' 
            ? JSON.parse(errorData.detail) 
            : errorData.detail;
          
          if (detail.error === 'insufficient_credits') {
            setInsufficientBalanceData({
              required: detail.required,
              balance: detail.balance,
              plan: detail.plan
            });
            setShowInsufficientBalance(true);
            setIsExecutingCode(false);
            return;
          }
        }
        
        throw new Error(
          typeof errorData.detail === 'string' 
            ? errorData.detail 
            : errorData.detail?.message || 'Failed to retry code generation'
        );
      }
      
      const result = await response.json();
      
      // Add new message with improved code
      setChatHistory(prev => [...prev, {
        type: 'assistant',
        message: result.reply,
        codeType: result.code_type,
        executableCode: result.executable_code,
        matchedChart: message.matchedChart,
        originalQuery: message.originalQuery || message.message
      }]);
    } catch (error) {
      console.error('Error retrying code:', error);
      setChatHistory(prev => [...prev, {
        type: 'assistant',
        message: `**Error:** ${error instanceof Error ? error.message : 'Failed to retry'}`
      }]);
    } finally {
      setIsExecutingCode(false);
    }
  };

  // Apply chart preview
  const applyChartPreview = () => {
    if (!chartPreview) return;
    
    // Update chart specs with new figure
    setChartSpecs(prev => {
      const newSpecs = [...prev];
      if (newSpecs[chartPreview.chartIndex]) {
        newSpecs[chartPreview.chartIndex] = {
          ...newSpecs[chartPreview.chartIndex],
          figure: chartPreview.figure,
          chart_spec: chartPreview.code
        };
      }
      return newSpecs;
    });
    
    // Clear preview
    setChartPreview(null);
    
    // Add success message
    setChatHistory(prev => [...prev, {
      type: 'assistant',
      message: 'Chart updated successfully!'
    }]);
  };

  // Discard chart preview
  const discardChartPreview = () => {
    setChartPreview(null);
    setChatHistory(prev => [...prev, {
      type: 'assistant',
      message: 'Chart preview discarded.'
    }]);
  };

  // Helper function to check if a chart is blank/empty
  const isChartBlank = (chartSpec: any): boolean => {
    if (!chartSpec || !chartSpec.figure) {
      return true; // No figure data at all
    }
    
    const figure = chartSpec.figure;
    
    // Check if figure has data traces
    if (!figure.data || figure.data.length === 0) {
      return true;
    }
    
    // Check if all traces are empty or have no meaningful data
    const hasValidData = figure.data.some((trace: any) => {
      // Plotly can have data as arrays OR as objects with bdata (binary data)
      // Check for common data properties in traces
      const hasX = trace.x && (
        (Array.isArray(trace.x) && trace.x.length > 0) ||
        (typeof trace.x === 'object' && trace.x.bdata) // Plotly binary data
      );
      const hasY = trace.y && (
        (Array.isArray(trace.y) && trace.y.length > 0) ||
        (typeof trace.y === 'object' && trace.y.bdata) // Plotly binary data
      );
      const hasValues = trace.values && (
        (Array.isArray(trace.values) && trace.values.length > 0) ||
        (typeof trace.values === 'object' && trace.values.bdata)
      );
      const hasZ = trace.z && (
        (Array.isArray(trace.z) && trace.z.length > 0) ||
        (typeof trace.z === 'object' && trace.z.bdata)
      );
      const hasLat = trace.lat && (
        (Array.isArray(trace.lat) && trace.lat.length > 0) ||
        (typeof trace.lat === 'object' && trace.lat.bdata)
      );
      const hasLon = trace.lon && (
        (Array.isArray(trace.lon) && trace.lon.length > 0) ||
        (typeof trace.lon === 'object' && trace.lon.bdata)
      );
      
      // Also check for histogram-specific properties
      const hasNbinsx = trace.nbinsx !== undefined;
      
      // Check for indicator traces (KPI cards) - they have 'value' property instead of x/y
      // Indicators can have value as number, or mode property for gauge/number/delta
      const isIndicator = trace.type === 'indicator' && (
        trace.value !== undefined || 
        trace.mode !== undefined ||
        trace.gauge !== undefined
      );
      
      return hasX || hasY || hasValues || hasZ || hasLat || hasLon || hasNbinsx || isIndicator;
    });
    
    return !hasValidData;
  };

  // Get filtered chart spec for a given chart index (no longer used for filtering, kept for compatibility)
  const getFilteredChartSpec = (spec: any, _chartIndex: number) => {
    // Filters are now applied via backend, so just return the spec as-is
    return spec;
  };

  // Apply filter via backend API - re-executes chart code with filter prepended

  // KPI Edit Handler
  const handleEditKPI = async (kpiIndex: number, editRequest: string) => {
    const kpiSpecs = chartSpecs.filter(spec => spec.chart_type === 'kpi_card');
    const kpiSpec = kpiSpecs[kpiIndex];
    
    if (!kpiSpec) return;
    
    setEditingKPIIndex(kpiIndex);
    
    try {
      const response = await fetch(`${config.backendUrl}/api/data/edit-kpi`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kpi_index: kpiIndex,
          edit_request: editRequest,
          current_code: kpiSpec.chart_spec || '',
          dataset_id: datasetId,
          current_title: kpiSpec.title || 'KPI'
        })
      });
      
      await checkAuthResponse(response);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to edit KPI');
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Update the KPI in chartSpecs
        setChartSpecs(prev => {
          const newSpecs = [...prev];
          // Find the actual index in the full chartSpecs array
          let kpiCount = 0;
          for (let i = 0; i < newSpecs.length; i++) {
            if (newSpecs[i].chart_type === 'kpi_card') {
              if (kpiCount === kpiIndex) {
                newSpecs[i] = {
                  ...newSpecs[i],
                  chart_spec: result.edited_code,
                  title: result.title,
                  figure: result.figure
                };
                break;
              }
              kpiCount++;
            }
          }
          return newSpecs;
        });
        notification.success('KPI updated successfully');
      } else {
        notification.error(result.error || 'Failed to edit KPI');
      }
    } catch (error) {
      console.error('Error editing KPI:', error);
      notification.error(error instanceof Error ? error.message : 'Failed to edit KPI');
    } finally {
      setEditingKPIIndex(null);
    }
  };

  // KPI Remove Handler
  const handleRemoveKPI = (kpiIndex: number) => {
    const kpiSpecs = chartSpecs.filter(spec => spec.chart_type === 'kpi_card');
    if (kpiIndex >= kpiSpecs.length) return;
    
    // Find the actual index in chartSpecs
    let kpiCount = 0;
    const actualIndex = chartSpecs.findIndex(spec => {
      if (spec.chart_type === 'kpi_card') {
        if (kpiCount === kpiIndex) return true;
        kpiCount++;
      }
      return false;
    });
    
    if (actualIndex !== -1) {
      const newSpecs = chartSpecs.filter((_, i) => i !== actualIndex);
      saveToHistory(newSpecs);
      setChartSpecs(newSpecs);
      notification.info('KPI card removed');
    }
  };

  // KPI Add Handler
  const handleAddKPI = async (description: string) => {
    if (!description.trim()) return;
    
    setIsAddingKPI(true);
    setShowAddKPIPopup(false);
    
    try {
      const response = await fetch(`${config.backendUrl}/api/data/add-kpi`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: description.trim(),
          dataset_id: datasetId
        })
      });
      
      await checkAuthResponse(response);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add KPI');
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Add the new KPI to chartSpecs
        const newKPI = {
          chart_spec: result.chart_spec,
          title: result.title,
          chart_type: 'kpi_card',
          figure: result.figure,
          chart_index: chartSpecs.length
        };
        const newSpecs = [...chartSpecs, newKPI];
        saveToHistory(newSpecs);
        setChartSpecs(newSpecs);
        notification.success('KPI card added successfully');
        setAddKPIInput('');
      } else {
        notification.error(result.error || 'Failed to add KPI');
      }
    } catch (error) {
      console.error('Error adding KPI:', error);
      notification.error(error instanceof Error ? error.message : 'Failed to add KPI');
    } finally {
      setIsAddingKPI(false);
    }
  };

  const generateChart = async (userQuery: string) => {
    if (!userQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setStreamingComplete(false); // Reset streaming state
    setExpectedKPICount(null); // Reset to null until we get dashboard_info
    setExpectedChartCount(null); // Reset to null until we get dashboard_info
    
    // Use /analyze for first chart, /chat for subsequent queries
    const isFirstChart = chartSpecs.length === 0;
    
    // Track if this is the first chart loading for tooltip display
    if (isFirstChart) {
      setIsFirstChartLoading(true);
      // Start guided tour after a short delay
      setTimeout(() => {
        setGuideStep(0); // Start with chat button
      }, 1000);
    }
    
    // Add user message only - loading visualization shows in dashboard area
    setChatHistory(prev => [
      ...prev,
      { type: 'user', message: userQuery }
    ]);

    try {
      if (isFirstChart) {
        // First chart: Use analyze endpoint
        const response = await fetch(`${config.backendUrl}/api/data/analyze`, {
          method: 'POST',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify({
            query: userQuery,
            dataset_id: datasetId,
            color_theme: context.colorTheme
          })
        });

        await checkAuthResponse(response);

        if (!response.ok) {
          const errorData = await response.json();
          
          // Check for insufficient credits (402)
          if (response.status === 402 && errorData.detail) {
            const detail = typeof errorData.detail === 'string' 
              ? JSON.parse(errorData.detail) 
              : errorData.detail;
            
            if (detail.error === 'insufficient_credits') {
              setInsufficientBalanceData({
                required: detail.required,
                balance: detail.balance,
                plan: detail.plan
              });
              setShowInsufficientBalance(true);
              
              // Remove user message from chat history since action failed
              setChatHistory(prev => prev.slice(0, -1));
              return;
            }
          }
          
          throw new Error(
            typeof errorData.detail === 'string' 
              ? errorData.detail 
              : errorData.detail?.message || 'Failed to generate chart'
          );
        }

        // Handle streaming response (Server-Sent Events)
        const contentType = response.headers.get('content-type') || '';
        const isStreaming = contentType.includes('text/event-stream');
        
        if (isStreaming && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let totalCharts = 0;
          let streamError: Error | null = null;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              
              // Keep the last incomplete line in buffer
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const event = JSON.parse(line.slice(6));
                    
                    switch (event.type) {
                      case 'progress':
                        console.log(`Progress: ${event.progress}% - ${event.message}`);
                        break;
                      
                      case 'dashboard_info':
                        if (event.dashboard_title) {
                          setDashboardTitle(event.dashboard_title);
                        }
                        // Set expected counts for loading skeletons
                        const expectedKpis = event.kpi_count || 0;
                        setExpectedKPICount(expectedKpis);
                        
                        // Estimate chart count from plan structure
                        // Count all visualization types except kpi_cards, filters, data_source, interconnected
                        const planKeys = Object.keys(event.full_plan || {});
                        const excludedKeys = ['kpi_cards', 'data_source', 'filters', 'interconnected'];
                        const estimatedCharts = planKeys.filter(k => !excludedKeys.includes(k)).length;
                        
                        // Set estimated count (will be corrected when 'complete' event arrives)
                        setExpectedChartCount(Math.max(estimatedCharts, 1));
                        setStreamingComplete(false);
                        console.log(`Dashboard info received. Expected KPIs: ${expectedKpis}, Estimated charts: ${estimatedCharts}`);
                        break;
                      
                      case 'kpi_card':
                        // Add KPI card to state immediately as it arrives
                        console.log('Received KPI card event:', event);
                        console.log('KPI card has figure:', !!event.kpi?.figure);
                        console.log('KPI card figure data:', event.kpi?.figure?.data);
                        const kpiIsBlank = isChartBlank(event.kpi);
                        console.log('isChartBlank result:', kpiIsBlank);
                        
                        if (event.kpi && !kpiIsBlank) {
                          totalCharts++;
                          setChartSpecs(prev => [...prev, { ...event.kpi, chart_type: 'kpi_card' }]);
                          console.log('Added KPI card:', event.kpi.title || 'Unnamed KPI');
                        } else {
                          console.warn('Skipping blank KPI card:', event.kpi);
                        }
                        break;
                      
                      case 'chart':
                        // Add chart to state immediately as it arrives (only if not blank)
                        if (!isChartBlank(event.chart)) {
                          totalCharts++;
                          setChartSpecs(prev => [...prev, event.chart]);
                          console.log('Added chart:', event.chart.title || 'Unnamed');
                        } else {
                          console.warn('Skipping blank chart:', event.chart);
                        }
                        break;
                      
                      case 'complete':
                        // All charts received - stop showing skeletons
                        setStreamingComplete(true);
                        const kpiCount = event.kpi_count || 0;
                        const chartCount = (event.total_charts || totalCharts) - kpiCount;
                        // Update expected counts with actual counts
                        setExpectedKPICount(kpiCount);
                        setExpectedChartCount(chartCount);
                        const message = kpiCount > 0 
                          ? `Dashboard created successfully! Generated ${kpiCount} KPI card(s) and ${chartCount} chart(s).`
                          : `Dashboard created successfully! Generated ${event.total_charts || totalCharts} chart(s).`;
                        setChatHistory(prev => [...prev, {
                          type: 'assistant',
                          message
                        }]);
                        break;
                      
                      case 'error':
                        streamError = new Error(event.message);
                        break;
                    }
                  } catch (parseError) {
                    console.error('Error parsing SSE event:', parseError, 'Line:', line);
                    streamError = new Error(`Streaming error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
                    break;
                  }
                }
              }
              if (streamError) break;
            }
          } finally {
            reader.cancel().catch(e => console.error("Error cancelling reader:", e));
          }
          
          if (streamError) {
            throw streamError;
          }
          
          // If no charts were received and no completion message, something went wrong
          if (totalCharts === 0 && !streamError) {
            throw new Error("No charts were generated for your query. Please try a different query.");
          }
        } else {
          // Fallback: try to parse as regular JSON (backward compatibility)
          try {
            const result = await response.json();
            if (result.dashboard_title) {
              setDashboardTitle(result.dashboard_title);
            }
            if (result.charts && Array.isArray(result.charts)) {
              // Filter out blank charts
              const validCharts = result.charts.filter((chart: any) => !isChartBlank(chart));
              setChartSpecs(validCharts);
            } else if (result.chart_spec) {
              const singleChart = { chart_spec: result.chart_spec, chart_type: 'unknown', title: 'Visualization', chart_index: 0 };
              // Only add if not blank
              if (!isChartBlank(singleChart)) {
                setChartSpecs([singleChart]);
              }
            }
            setChatHistory(prev => [...prev, {
              type: 'assistant',
              message: `Dashboard created successfully! Generated ${result.charts?.length || 1} chart(s).`
            }]);
          } catch (jsonError) {
            throw new Error('Failed to parse response');
          }
        }
        
        // Fetch full dataset before rendering charts (if not already fetched)
        await fetchFullDataset();
      } else {
        // Subsequent queries: Use chat endpoint with chart context
        const response = await fetch(`${config.backendUrl}/api/chat`, {
          method: 'POST',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify({
            message: userQuery,
            dataset_id: datasetId,
            plotly_code: chartSpecs[0]?.chart_spec || '',  // Pass current chart code
            fig_data: chartSpecs[0]?.figure || null  // Pass current figure data
          })
        });

        await checkAuthResponse(response);

        if (!response.ok) {
          const errorData = await response.json();
          
          // Check for insufficient credits (402)
          if (response.status === 402 && errorData.detail) {
            const detail = typeof errorData.detail === 'string' 
              ? JSON.parse(errorData.detail) 
              : errorData.detail;
            
            if (detail.error === 'insufficient_credits') {
              setInsufficientBalanceData({
                required: detail.required,
                balance: detail.balance,
                plan: detail.plan
              });
              setShowInsufficientBalance(true);
              
              // Remove user message from chat history since action failed
              setChatHistory(prev => prev.slice(0, -1));
              return;
            }
          }
          
          throw new Error(
            typeof errorData.detail === 'string' 
              ? errorData.detail 
              : errorData.detail?.message || 'Failed to process chat request'
          );
        }

        const result = await response.json();
        
        // Keep user message and add AI response
        setChatHistory(prev => {
          return [...prev, { 
            type: 'assistant', 
            message: result.reply,
            matchedChart: result.matched_chart,
            codeType: result.code_type,
            executableCode: result.executable_code,
            originalQuery: userQuery  // Store original query for add_chart_query button
          }];
        });
        
        // Note: Chat endpoint returns text response, not new charts
        // If the response contains code, you might want to handle that separately
      }
      
    } catch (err) {
      console.error('Error generating chart:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate chart';
      setError(errorMessage);
      
      // Keep user message and add error message
      setChatHistory(prev => {
        return [...prev, { 
          type: 'assistant', 
          message: `Error: ${errorMessage}` 
        }];
      });
    } finally {
      setIsLoading(false);
      setIsFirstChartLoading(false);
      setGuideStep(null); // End tour when loading completes
      setQuery('');
    }
  };

  const handleAddChart = async (query: string, fromChat: boolean = false) => {
    if (!query.trim()) {
      notification.error('Please enter a chart description');
      return;
    }

    setAddingChart(true);
    try {
      const response = await fetch(`${config.backendUrl}/api/data/add-chart`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({
          query: query,
          dataset_id: datasetId,
          color_theme: context.colorTheme
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        const errorData = await response.json();
        
        // Check for insufficient credits (402)
        if (response.status === 402 && errorData.detail) {
          const detail = typeof errorData.detail === 'string' 
            ? JSON.parse(errorData.detail) 
            : errorData.detail;
          
          if (detail.error === 'insufficient_credits') {
            setInsufficientBalanceData({
              required: detail.required,
              balance: detail.balance,
              plan: detail.plan
            });
            setShowInsufficientBalance(true);
            setAddingChart(false);
            return;
          }
        }
        
        throw new Error(
          typeof errorData.detail === 'string' 
            ? errorData.detail 
            : errorData.detail?.message || 'Failed to add chart'
        );
      }

      const result = await response.json();
      
      // Add new chart to chartSpecs
      const newChartSpec = {
        chart_spec: result.chart_spec,
        chart_type: result.chart_type,
        title: result.title,
        chart_index: result.chart_index,
        figure: result.figure
      };
      
      setChartSpecs(prev => [...prev, newChartSpec]);
      
      if (fromChat) {
        // Add success message to chat
        setChatHistory(prev => [...prev, {
          type: 'assistant',
          message: 'Chart added successfully!'
        }]);
      } else {
        notification.success('Chart added successfully!');
      }
      
      // Fetch full dataset if needed
      await fetchFullDataset();
      
    } catch (err) {
      console.error('Error adding chart:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add chart';
      
      if (fromChat) {
        // Add error message to chat instead of notification popup
        setChatHistory(prev => [...prev, {
          type: 'assistant',
          message: 'unable to construct',
          codeType: 'add_chart_query',
          failed: true,
          retryable: true,
          originalQuery: query
        }]);
      } else {
        notification.error(errorMessage);
      }
    } finally {
      setAddingChart(false);
    }
  };

  const handleAddChartFromChat = async (query: string) => {
    await handleAddChart(query, true);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    // Trigger context preparation when user starts typing (only before first chart)
    if (newQuery.length > 0 && !contextPrepared && chartSpecs.length === 0) {
      prepareContext();
    }
  };

  const handleSubmit = () => {
    generateChart(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter or just Enter (without Shift) to send
    if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReuploadClick = () => {
    notification.showConfirm({
      title: 'Upload New Dataset',
      message: 'Are you sure you want to upload a new dataset? This will clear all current visualizations and chat history.',
      onConfirm: () => {
        if (onReupload) {
      onReupload();
    }
      }
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const downloadChart = async (format: 'png-zip' | 'pdf') => {
    if (chartSpecs.length === 0) {
      notification.warning('No charts to download');
      return;
    }

    try {
      console.log('Starting chart export...');
      
      // Export all charts as base64 images using Plotly's toImage API
      const chartImages: Array<{title: string, imageData: string}> = [];
      
      // Get all Plotly chart elements
      const plotlyDivs = document.querySelectorAll('.js-plotly-plot');
      console.log(`Found ${plotlyDivs.length} Plotly charts`);
      
      for (let idx = 0; idx < chartSpecs.length; idx++) {
        const spec = chartSpecs[idx];
        const title = spec.title || `Chart ${idx + 1}`;
        const plotlyDiv = plotlyDivs[idx] as any;
        
        if (plotlyDiv && plotlyDiv.data) {
          try {
            console.log(`Exporting chart ${idx + 1}: ${title}`);
            
            // Use Plotly's toImage - this works without kaleido!
            const imageData = await (window as any).Plotly.toImage(plotlyDiv, {
              format: 'png',
              width: 1000,
              height: 800,
              scale: 2
            });
            
            chartImages.push({ title, imageData });
            console.log(`[SUCCESS] Chart ${idx + 1} exported successfully`);
          } catch (err) {
            console.error(`Failed to export chart ${idx + 1}:`, err);
          }
        } else {
          console.warn(`Chart ${idx + 1} not found in DOM`);
        }
      }

      if (chartImages.length === 0) {
        throw new Error('No charts could be exported. Please wait for charts to fully render.');
      }

      console.log(`Sending ${chartImages.length} charts to backend...`);

      // Send to backend for packaging
      const endpoint = format === 'png-zip' 
        ? '/api/export/charts-zip-from-images'
        : '/api/export/dashboard-pdf-from-images';
      
      const response = await fetch(`${config.backendUrl}${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ charts: chartImages })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${errorText}`);
      }

      // Download file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'png-zip' 
        ? `autodash_charts_${Date.now()}.zip`
        : `autodash_report_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('[SUCCESS] Download complete!');

    } catch (error) {
      console.error('Error downloading:', error);
      notification.error(`Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setShowDownloadMenu(false);
  };

  const handleShareDashboard = async () => {
    if (chartSpecs.length === 0) {
      notification.warning('No charts to share');
      return;
    }

    try {
      // Collect figures data from all charts, including notes
      const figuresData = chartSpecs.map((spec, index) => ({
        chart_index: spec.chart_index ?? index,
        figure: spec.figure || spec.fig_data,
        title: spec.title || `Chart ${index + 1}`,
        chart_type: spec.chart_type || 'plotly',
        notes: chartNotes[index] || ''
      }));

      // Use the actual dashboard title from state (what user sees/edits)
      const titleToShare = dashboardTitle || 'Dashboard';

      // Call share endpoint
      const response = await fetch(`${config.backendUrl}/api/data/datasets/${datasetId}/share`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          figures_data: figuresData,
          dashboard_title: titleToShare,
          background_color: dashboardBgColor,
          text_color: dashboardTextColor
        })
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to create share link' }));
        throw new Error(errorData.detail || 'Failed to create share link');
      }

      const result = await response.json();
      const publicUrl = result.public_url;

      // Show share popup
      setShareUrl(publicUrl);
      setShareExpiresAt(result.expires_at);
      setShowSharePopup(true);

    } catch (error) {
      console.error('Error sharing dashboard:', error);
      notification.error(`Failed to share dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Close download menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false);
      }
    };

    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadMenu]);

  // Loading messages rotation
  useEffect(() => {
    if (!isFirstChartLoading) {
      setLoadingMessage('Crafting beautiful insights from your data...');
      return;
    }

    const loadingMessages = [
      'Crafting beautiful insights from your data...',
      'Wait as we craft stunning visuals for you...',
      'Transforming your data into meaningful charts...',
      'Creating visual narratives from your dataset...',
      'Designing elegant visualizations...',
      'Weaving data into compelling stories...',
      'Polishing your dashboard to perfection...',
      'Bringing your data to life...'
    ];

    let messageIndex = 0;
    setLoadingMessage(loadingMessages[0]);
    
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[messageIndex]);
    }, 4000); // Change message every 4 seconds

    return () => clearInterval(interval);
  }, [isFirstChartLoading]);

  // Guided tour auto-advance - 40 seconds total (13-14 seconds per step)
  useEffect(() => {
    if (guideStep === null) return;

    const timer = setTimeout(() => {
      if (guideStep < 2) {
        setGuideStep(guideStep + 1);
      } else {
        setGuideStep(null);
      }
    }, 13000); // ~13 seconds per step = ~40 seconds total

    return () => clearTimeout(timer);
  }, [guideStep]);

  // Scroll to highlighted button
  useEffect(() => {
    if (guideStep === null) return;

    let buttonRef: React.RefObject<HTMLButtonElement> | null = null;
    if (guideStep === 0) buttonRef = chatButtonRef;
    else if (guideStep === 1) buttonRef = downloadButtonRef;
    else if (guideStep === 2) buttonRef = publishButtonRef;

    if (buttonRef?.current) {
      setTimeout(() => {
        buttonRef?.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
      }, 300);
    }
  }, [guideStep]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Esc key - Close any open popups
      if (e.key === 'Escape') {
        if (isFullscreen) {
        setIsFullscreen(false);
        } else if (showSharePopup) {
          setShowSharePopup(false);
        } else if (showAddChartPopup) {
          setShowAddChartPopup(false);
        } else if (showAddKPIPopup) {
          setShowAddKPIPopup(false);
        } else if (zoomedChartIndex !== null) {
          setZoomedChartIndex(null);
        } else if (showDatasetPreview) {
          setShowDatasetPreview(false);
        } else if (showDownloadMenu) {
          setShowDownloadMenu(false);
        }
        return;
      }

      // Ctrl/Cmd + D - Download charts
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && chartSpecs.length > 0) {
        e.preventDefault();
        downloadChart('png-zip');
        return;
      }

      // Ctrl/Cmd + S - Open share popup
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && chartSpecs.length > 0) {
        e.preventDefault();
        handleShareDashboard();
        return;
      }

      // ? key - Show keyboard shortcuts help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowKeyboardHelp(true);
        return;
      }

      // Ctrl/Cmd + Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && historyIndex > 0) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || 
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        if (historyIndex < chartHistory.length - 1) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isFullscreen, showSharePopup, showAddChartPopup, showAddKPIPopup, zoomedChartIndex, showDatasetPreview, showDownloadMenu, chartSpecs.length, historyIndex, chartHistory.length]);

  // Handle sidebar resizing
  const startResizing = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      if (newWidth >= 250 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showColorPicker) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-color-picker]')) {
          setShowColorPicker(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  // Save dashboard colors to database when they change
  useEffect(() => {
    // Only save if we have charts (dashboard exists) and colors are not default
    if (chartSpecs.length === 0 || !datasetId) return;

    const saveColors = async () => {
      try {
        const response = await fetch(`${config.backendUrl}/api/data/datasets/${datasetId}/dashboard/colors`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({
            background_color: dashboardBgColor,
            text_color: dashboardTextColor
          })
        });

        if (!response.ok) {
          console.error('Failed to save dashboard colors');
        }
      } catch (error) {
        console.error('Error saving dashboard colors:', error);
      }
    };

    // Debounce the save operation
    const timeoutId = setTimeout(saveColors, 1000);
    return () => clearTimeout(timeoutId);
  }, [dashboardBgColor, dashboardTextColor, chartSpecs.length, datasetId]);

  // Calculate how many skeletons to show
  const getSkeletonCounts = () => {
    if (!isLoading || streamingComplete) {
      return { kpiSkeletons: 0, chartSkeletons: 0 };
    }

    const loadedKPIs = chartSpecs.filter(spec => spec.chart_type === 'kpi_card').length;
    const loadedCharts = chartSpecs.filter(spec => spec.chart_type !== 'kpi_card').length;

    // If we know the expected counts from dashboard_info
    if (expectedKPICount !== null && expectedChartCount !== null) {
      const kpiSkeletons = Math.max(expectedKPICount - loadedKPIs, 0);
      const chartSkeletons = Math.max(expectedChartCount - loadedCharts, 0);
      
      console.log(`Skeleton counts - KPIs: ${kpiSkeletons} (expected: ${expectedKPICount}, loaded: ${loadedKPIs}), Charts: ${chartSkeletons} (expected: ${expectedChartCount}, loaded: ${loadedCharts})`);
      
      return { kpiSkeletons, chartSkeletons };
    }

    // If we haven't received dashboard_info yet but are loading
    // Show default skeletons (but reduce as items arrive)
    const defaultKPIs = 3;
    const defaultCharts = 2;
    
    const counts = {
      kpiSkeletons: Math.max(defaultKPIs - loadedKPIs, loadedKPIs === 0 ? defaultKPIs : 1),
      chartSkeletons: Math.max(defaultCharts - loadedCharts, loadedCharts === 0 ? defaultCharts : 1)
    };
    
    console.log(`Skeleton counts (default) - KPIs: ${counts.kpiSkeletons} (loaded: ${loadedKPIs}), Charts: ${counts.chartSkeletons} (loaded: ${loadedCharts})`);
    
    return counts;
  };

  const { kpiSkeletons, chartSkeletons } = getSkeletonCounts();

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
      
      <FixNotification 
        show={showFixNotification} 
        onDismiss={() => setShowFixNotification(false)} 
      />

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div 
          className="fullscreen-modal" 
          onClick={() => setShowKeyboardHelp(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '600px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: '#1f2937'
              }}>
                ⌨️ Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '28px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <span style={{ fontWeight: 500, color: '#374151' }}>Send message</span>
                <kbd style={{ padding: '4px 8px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>Enter</kbd>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <span style={{ fontWeight: 500, color: '#374151' }}>Send message (alternative)</span>
                <kbd style={{ padding: '4px 8px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>Ctrl + Enter</kbd>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <span style={{ fontWeight: 500, color: '#374151' }}>Download charts</span>
                <kbd style={{ padding: '4px 8px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>Ctrl + D</kbd>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <span style={{ fontWeight: 500, color: '#374151' }}>Share dashboard</span>
                <kbd style={{ padding: '4px 8px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>Ctrl + S</kbd>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <span style={{ fontWeight: 500, color: '#374151' }}>Close popups</span>
                <kbd style={{ padding: '4px 8px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>Esc</kbd>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <span style={{ fontWeight: 500, color: '#374151' }}>Undo</span>
                <kbd style={{ padding: '4px 8px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>Ctrl + Z</kbd>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <span style={{ fontWeight: 500, color: '#374151' }}>Redo</span>
                <kbd style={{ padding: '4px 8px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>Ctrl + Shift + Z</kbd>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <span style={{ fontWeight: 500, color: '#374151' }}>Show this help</span>
                <kbd style={{ padding: '4px 8px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>?</kbd>
              </div>
            </div>
            
            <div style={{
              marginTop: '24px',
              padding: '12px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#92400e'
            }}>
              💡 <strong>Tip:</strong> Use Shift + Enter to add a new line in chat without sending
            </div>
          </div>
        </div>
      )}
      
      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fullscreen-modal" onClick={() => setIsFullscreen(false)}>
          <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <button className="fullscreen-close" onClick={() => setIsFullscreen(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="fullscreen-chart">
              {/* KPI Cards - Keep them small and in a grid */}
              {(chartSpecs.some(spec => spec.chart_type === 'kpi_card') || kpiSkeletons > 0) && (
                <>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    marginBottom: '32px',
                    justifyContent: 'center',
                    padding: '0 20px'
                  }}>
                    {chartSpecs
                      .map((spec, index) => ({ spec, index }))
                      .filter(({ spec }) => spec.chart_type === 'kpi_card')
                      .map(({ spec, index }) => (
                        <div 
                          key={`kpi-${index}`} 
                          className="kpi-fade-in"
                          style={{ 
                            width: '280px', 
                            height: '100px',
                            flexShrink: 0
                          }}
                        >
                          <KPICard
                            title={spec.title || `KPI ${index + 1}`}
                            chartSpec={spec}
                            chartIndex={index}
                            backgroundColor={dashboardBgColor}
                            textColor={dashboardTextColor}
                          />
                        </div>
                      ))}
                    
                    {/* Show loading skeletons for KPIs still being generated */}
                    {kpiSkeletons > 0 && (
                      <>
                        {[...Array(kpiSkeletons)].map((_, i) => (
                          <div 
                            key={`kpi-skeleton-${i}`} 
                            style={{ 
                              width: '280px', 
                              height: '100px',
                              flexShrink: 0,
                              background: 'linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)',
                              backgroundSize: '200% 100%',
                              animation: 'shimmer 1.5s infinite',
                              borderRadius: '12px',
                              border: '1px solid #e5e7eb'
                            }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                  
                  {/* Separator if there are regular charts or still loading */}
                  {(chartSpecs.some(spec => spec.chart_type !== 'kpi_card') || chartSkeletons > 0) && (
                    <div style={{
                      width: '100%',
                      height: '1px',
                      background: 'linear-gradient(to right, transparent, rgba(229, 231, 235, 0.6), transparent)',
                      marginBottom: '40px'
                    }} />
                  )}
                </>
              )}
              
              {/* Regular Charts */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '30px'
              }}>
                {chartSpecs
                  .map((spec, index) => ({ spec, index }))
                  .filter(({ spec }) => spec.chart_type !== 'kpi_card')
                  .map(({ spec, index }) => (
                    <div key={`chart-${index}`} className="chart-fade-in">
                      <PlotlyChartRenderer 
                        chartSpec={spec} 
                        data={localData}
                        chartIndex={index}
                        datasetId={datasetId}
                        onChartFixed={handleChartFixed}
                        onFixingStatusChange={(isFixing) => setShowFixNotification(isFixing)}
                        backgroundColor={dashboardBgColor}
                        textColor={dashboardTextColor}
                      />
                    </div>
                  ))}
                
                {/* Show loading skeletons for charts still being generated */}
                {chartSkeletons > 0 && (
                  <>
                    {[...Array(chartSkeletons)].map((_, i) => (
                      <div 
                        key={`chart-skeleton-${i}`} 
                        style={{ 
                          width: '100%', 
                          height: '400px',
                          background: 'linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 1.5s infinite',
                          borderRadius: '16px',
                          border: '1px solid #e5e7eb',
                          padding: '20px'
                        }}
                      >
                        <div style={{
                          height: '24px',
                          width: '200px',
                          background: 'rgba(255,255,255,0.5)',
                          borderRadius: '8px',
                          marginBottom: '16px'
                        }} />
                        <div style={{
                          height: '100%',
                          background: 'rgba(255,255,255,0.3)',
                          borderRadius: '8px'
                        }} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Zoom Modal */}
      {zoomedChartIndex !== null && chartSpecs[zoomedChartIndex] && (() => {
        const isKPICard = chartSpecs[zoomedChartIndex].chart_type === 'kpi_card';
        return (
          <div 
            className="fullscreen-modal" 
            onClick={() => setZoomedChartIndex(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px'
            }}
          >
            <button 
              className="fullscreen-close" 
              onClick={() => setZoomedChartIndex(null)}
              style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 107, 107, 0.1)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10001,
                color: '#ff6b6b',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)';
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div 
              className="fullscreen-content" 
              onClick={(e) => e.stopPropagation()}
              style={{
                width: isKPICard ? 'fit-content' : '90%',
                height: isKPICard ? 'fit-content' : '90%',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: isKPICard ? '40px 60px' : '20px',
                position: 'relative',
                maxWidth: isKPICard ? 'none' : '1400px',
                maxHeight: isKPICard ? 'none' : '900px'
              }}
            >
              <div style={{ 
                width: isKPICard ? '350px' : '100%', 
                height: isKPICard ? '120px' : '100%'
              }}>
                <PlotlyChartRenderer 
                  chartSpec={chartSpecs[zoomedChartIndex]} 
                  data={localData}
                  chartIndex={zoomedChartIndex}
                  datasetId={datasetId}
                  onChartFixed={handleChartFixed}
                  onFixingStatusChange={(isFixing) => setShowFixNotification(isFixing)}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dataset Preview Modal */}
      {showDatasetPreview && previewData && (
        <div className="fullscreen-modal" onClick={() => setShowDatasetPreview(false)}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Dataset Preview</h2>
                <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                  Showing {previewData.preview.length} of {previewData.total_rows.toLocaleString()} total rows
                </p>
              </div>
              <button className="fullscreen-close" onClick={() => setShowDatasetPreview(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="preview-table-container">
              {previewData.preview.length > 0 && (
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th style={{ background: '#f8f9fa', fontWeight: 600 }}>#</th>
                      {Object.keys(previewData.preview[0]).map((column) => (
                        <th key={column} style={{ background: '#f8f9fa', fontWeight: 600 }}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        <td style={{ background: '#f8f9fa', fontWeight: 500 }}>{rowIndex + 1}</td>
                        {Object.entries(row).map(([column, value]) => (
                          <td key={column}>
                            {value === null || value === undefined 
                              ? <span style={{ color: '#999', fontStyle: 'italic' }}>null</span>
                              : typeof value === 'number' 
                                ? value.toLocaleString(undefined, { maximumFractionDigits: 4 })
                                : String(value)
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="visualization-page-wrapper">
        <div className="dashboard-layout" style={{ userSelect: isResizing ? 'none' : 'auto' }}>
        {/* Show Chat Arrow - Appears when chat is hidden */}
        {!chatVisible && (
          <button
            onClick={() => setChatVisible(true)}
            style={{
              position: 'fixed',
              left: '0',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderLeft: 'none',
              borderTopRightRadius: '8px',
              borderBottomRightRadius: '8px',
              cursor: 'pointer',
              padding: '12px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              transition: 'all 0.2s',
              zIndex: 1000,
              boxShadow: '2px 0 4px rgba(0, 0, 0, 0.1)'
            }}
            title="Show chat"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.color = '#374151';
              e.currentTarget.style.boxShadow = '2px 0 6px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.color = '#6b7280';
              e.currentTarget.style.boxShadow = '2px 0 4px rgba(0, 0, 0, 0.1)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Modern Chat Sidebar - LEFT SIDE */}
        {chatVisible && (
        <aside className="chat-sidebar" style={{ width: `${sidebarWidth}px` }}>
          <div className="chat-header">
            <div className="chat-header-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3>AI Assistant</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className={`chat-status ${isLoading ? 'thinking' : 'online'}`}>
                {isLoading ? 'Thinking...' : 'Online'}
              </span>
                <button
                  onClick={() => setChatVisible(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6b7280',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                    width: '24px',
                    height: '24px'
                  }}
                  title="Hide chat"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#1f2937';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#6b7280';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="chat-messages">
            {chatHistory.length === 0 ? (
              <div className="chat-welcome">
                <div className="assistant-avatar">AI</div>
                <div className="chat-bubble assistant-bubble">
                  <MarkdownMessage content={'Hi! I\'m your AI assistant. Ask me to create visualizations from your data.\n\n**Try:** "Show me a bar chart of average prices by bedroom count"'} />
                </div>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.type}-message`}>
                  <div className={`chat-avatar ${msg.type}-avatar`}>
                    {msg.type === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className={`chat-bubble ${msg.type}-bubble`}>
                    {msg.matchedChart && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        marginBottom: '8px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444'
                      }}>
                        <span>Chart {msg.matchedChart.index}: {msg.matchedChart.title || msg.matchedChart.type}</span>
                      </div>
                    )}
                    {msg.type === 'assistant' ? (
                      <>
                        {msg.codeType && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            marginBottom: '8px',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            color: '#6366f1',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {msg.codeType === 'plotly_edit' ? 'Chart Editor' : msg.codeType === 'add_chart_query' ? 'Add Chart' : 'Data Analysis'}
                          </div>
                        )}
                        <MarkdownMessage content={msg.message} />
                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {msg.codeType && msg.executableCode && (
                            <>
                              {msg.codeType === 'add_chart_query' ? (
                                <button
                                  onClick={() => {
                                    if (msg.originalQuery) {
                                      handleAddChartFromChat(msg.originalQuery);
                                    }
                                  }}
                                  disabled={addingChart}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    background: addingChart ? '#6b7280' : 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: addingChart ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    opacity: addingChart ? 0.6 : 1,
                                    boxShadow: addingChart ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.2)'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!addingChart) {
                                      e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!addingChart) {
                                      e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';
                                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
                                    }
                                  }}
                                >
                                  {addingChart ? (
                                    <span>Adding Chart...</span>
                                  ) : (
                                    <span>Add Chart</span>
                                  )}
                                </button>
                              ) : (
                            <button
                              onClick={() => {
                                if (msg.codeType === 'plotly_edit' && msg.matchedChart) {
                                  executePlotlyEdit(msg.executableCode!, msg.matchedChart.index);
                                } else if (msg.codeType === 'analysis') {
                                  executeAnalysisCode(msg.executableCode!);
                                }
                              }}
                              disabled={isExecutingCode}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                background: isExecutingCode ? '#6b7280' : 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: isExecutingCode ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                opacity: isExecutingCode ? 0.6 : 1,
                                boxShadow: isExecutingCode ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.2)'
                              }}
                              onMouseEnter={(e) => {
                                if (!isExecutingCode) {
                                  e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isExecutingCode) {
                                  e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';
                                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
                                }
                              }}
                            >
                              {isExecutingCode ? (
                                <span>Running...</span>
                              ) : (
                                <span>{msg.codeType === 'plotly_edit' ? 'Run Code' : 'Run Analysis'}</span>
                              )}
                            </button>
                              )}
                            </>
                          )}
                            
                            {msg.failed && msg.retryable && (
                              <button
                                onClick={() => handleRetry(msg)}
                                disabled={isExecutingCode || addingChart}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 16px',
                                  background: (isExecutingCode || addingChart) ? '#6b7280' : 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: (isExecutingCode || addingChart) ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s',
                                  opacity: (isExecutingCode || addingChart) ? 0.6 : 1,
                                  boxShadow: (isExecutingCode || addingChart) ? 'none' : '0 2px 8px rgba(245, 158, 11, 0.2)'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isExecutingCode && !addingChart) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isExecutingCode && !addingChart) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.2)';
                                  }
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                                </svg>
                                <span>{addingChart ? 'Retrying...' : 'Retry'}</span>
                              </button>
                            )}
                          </div>
                      </>
                    ) : (
                      msg.message
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="chat-message assistant-message">
                <div className="chat-avatar assistant-avatar">AI</div>
                <div className="chat-bubble assistant-bubble" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', width: '100%' }}>
                    <div className="magic-sparkles" style={{ marginBottom: 0, transform: 'scale(0.8)', justifyContent: 'flex-start' }}>
                      <span className="sparkle">*</span>
                      <span className="sparkle">*</span>
                      <span className="sparkle">*</span>
                      <span className="sparkle">*</span>
                      <span className="sparkle">*</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="chat-message error-message">
                <div className="chat-avatar assistant-avatar">AI</div>
                <div className="chat-bubble error-bubble">
                  Error: {error}
                </div>
              </div>
            )}
          </div>

          {/* Chat Input - Fixed at Bottom */}
          <div className="chat-input-container">
            <textarea
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your data..."
              className="chat-input"
              rows={2}
              disabled={isLoading}
            />
            <button 
              ref={chatButtonRef}
              onClick={handleSubmit}
              disabled={!query.trim() || isLoading}
              className={`chat-send-button ${guideStep === 0 ? 'guide-highlight' : ''}`}
              title={isLoading ? 'Generating...' : 'Send message'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                minWidth: '44px'
              }}
            >
              {isLoading ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 12 12"
                      to="360 12 12"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </path>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </aside>
        )}

        {/* Resize Handle - Only show when chat is visible */}
        {chatVisible && (
        <div 
          className={`resize-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={startResizing}
        >
          <div className="resize-indicator">
            <span></span>
            <span></span>
          </div>
        </div>
        )}

        {/* Main Dashboard Area - RIGHT SIDE (Takes ALL remaining space) */}
        <main className="dashboard-main">
          <div className="step-header">
            <div>
              <h1 className="step-title">Your Dashboard</h1>
              <p className="step-description">Ask questions to generate visualizations</p>
            </div>
            <div className="dashboard-controls">
              {/* Undo/Redo Buttons */}
              <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
                <button 
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="control-button"
                  title={`Undo (Ctrl+Z) - ${historyIndex > 0 ? `${historyIndex} step${historyIndex > 1 ? 's' : ''} available` : 'No history'}`}
                  style={{
                    opacity: historyIndex <= 0 ? 0.5 : 1,
                    cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
                  </svg>
                </button>
                <button 
                  onClick={handleRedo}
                  disabled={historyIndex >= chartHistory.length - 1}
                  className="control-button"
                  title={`Redo (Ctrl+Shift+Z) - ${historyIndex < chartHistory.length - 1 ? `${chartHistory.length - historyIndex - 1} step${chartHistory.length - historyIndex - 1 > 1 ? 's' : ''} available` : 'No history'}`}
                  style={{
                    opacity: historyIndex >= chartHistory.length - 1 ? 0.5 : 1,
                    cursor: historyIndex >= chartHistory.length - 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 7v6h-6" />
                    <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
                  </svg>
                </button>
                {chartHistory.length > 0 && (
                  <span style={{
                    fontSize: '11px',
                    color: '#6b7280',
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    {historyIndex + 1}/{chartHistory.length}
                  </span>
                )}
              </div>
              
              {/* Reupload Button */}
              <button 
                onClick={handleReuploadClick} 
                className="control-button"
                title="Upload New Dataset"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Change Data
              </button>

              {/* Dataset Preview Button - Show after first query */}
              {chatHistory.length > 0 && (
                <button 
                  onClick={fetchDatasetPreview} 
                  className="control-button"
                  disabled={loadingPreview}
                  title="View Dataset Preview"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                  {loadingPreview ? 'Loading...' : 'Dataset Preview'}
                </button>
              )}
              <div className="download-dropdown" ref={downloadMenuRef}>
                <button 
                  ref={downloadButtonRef}
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)} 
                  className={`control-button ${guideStep === 1 ? 'guide-highlight' : ''}`}
                  disabled={chartSpecs.length === 0}
                  title="Download Chart"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" style={{ marginLeft: '2px' }}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                </button>
                {showDownloadMenu && (
                  <div className="download-menu">
                    <div className="download-menu-header" style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #e5e7eb',
                      marginBottom: '4px'
                    }}>
                      <small style={{ color: '#666', fontSize: '12px' }}>
                        Tip: Use camera icon on each chart for individual PNG
                      </small>
                    </div>
                    <button onClick={() => downloadChart('png-zip')} className="download-menu-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      All Charts (ZIP)
                      <small style={{ marginLeft: 'auto', color: '#999', fontSize: '11px' }}>
                        {chartSpecs.length} PNG{chartSpecs.length > 1 ? 's' : ''}
                      </small>
                    </button>
                    <button onClick={() => downloadChart('pdf')} className="download-menu-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      PDF Report
                      <small style={{ marginLeft: 'auto', color: '#999', fontSize: '11px' }}>
                        {chartSpecs.length} page{chartSpecs.length > 1 ? 's' : ''}
                      </small>
                    </button>
                  </div>
                )}
              </div>
              <button 
                ref={publishButtonRef}
                onClick={handleShareDashboard} 
                className={`control-button ${guideStep === 2 ? 'guide-highlight' : ''}`}
                disabled={chartSpecs.length === 0}
                title="Publish Dashboard"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Publish
              </button>
              <button 
                onClick={toggleFullscreen} 
                className="control-button"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                )}
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </button>
            </div>
          </div>

          <div className="visualization-container-large" ref={visualizationRef}>

            {/* Chart Display - Show when charts exist or loading */}
            {(chartSpecs.length > 0 || isLoading || (!isLoading && chartSpecs.length === 0)) && (
              <div 
                className={`chart-display ${isLoading && !streamingComplete ? 'loading' : ''}`}
                style={{
                  background: isLoading && !streamingComplete ? 'transparent' : dashboardBgColor,
                  color: dashboardTextColor
                }}
              >
                {(chartSpecs.length > 0 || isLoading) ? (
                  <React.Fragment>
                          {/* Dashboard Title - Editable */}
                          <div style={{ 
                            padding: '24px 20px 0 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                          }}>
                            {isEditingTitle ? (
                              <input
                                type="text"
                                value={dashboardTitle}
                                onChange={(e) => setDashboardTitle(e.target.value)}
                                onBlur={() => setIsEditingTitle(false)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') setIsEditingTitle(false);
                                  if (e.key === 'Escape') setIsEditingTitle(false);
                                }}
                                autoFocus
                                style={{
                                  fontSize: '2rem',
                                  fontWeight: 700,
                                  padding: '12px 16px',
                                  border: '2px solid #ef4444',
                                  borderRadius: '12px',
                                  outline: 'none',
                                  width: '100%',
                                  maxWidth: '800px',
                                  fontFamily: 'inherit',
                                  background: 'white',
                                  transition: 'all 0.2s',
                                  textAlign: 'center',
                                  boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.1)'
                                }}
                              />
                            ) : (
                              <h2
                                onClick={() => setIsEditingTitle(true)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f9fafb';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                                title="Click to edit dashboard title"
                                style={{
                                  fontSize: '2rem',
                                  fontWeight: 700,
                                  color: dashboardTextColor,
                                  margin: 0,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  padding: '12px 20px',
                                  borderRadius: '12px',
                                  transition: 'all 0.2s',
                                  border: '2px solid transparent'
                                }}
                              >
                                {dashboardTitle}
                                <svg 
                                  width="20" 
                                  height="20" 
                                  viewBox="0 0 24 24" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  strokeWidth="2"
                                  style={{ 
                                    opacity: 0.4,
                                    transition: 'opacity 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
                                >
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </h2>
                            )}
                            
                            {/* Color Picker - Near Title, Above KPI Cards */}
                            {!isEditingTitle && chartSpecs.length > 0 && (
                              <div style={{ 
                                position: 'absolute',
                                left: '20px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                zIndex: 10
                              }} data-color-picker>
                                {/* Three Color Dots */}
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  {/* White */}
                                  <button
                                    onClick={() => {
                                      setDashboardBgColor('#ffffff');
                                      setDashboardTextColor('#1a1a1a');
                                    }}
                                    title="White background"
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '50%',
                                      background: '#ffffff',
                                      border: dashboardBgColor === '#ffffff' ? '3px solid #ff6b6b' : '2px solid #d1d5db',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}
                                  />
                                  
                                  {/* Black */}
                                  <button
                                    onClick={() => {
                                      setDashboardBgColor('#1a1a1a');
                                      setDashboardTextColor('#ffffff');
                                    }}
                                    title="Black background"
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '50%',
                                      background: '#1a1a1a',
                                      border: dashboardBgColor === '#1a1a1a' || dashboardBgColor === '#000000' ? '3px solid #ff6b6b' : '2px solid #d1d5db',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}
                                  />
                                  
                                  {/* Blue */}
                                  <button
                                    onClick={() => {
                                      setDashboardBgColor('#1e3a5f');
                                      setDashboardTextColor('#ffffff');
                                    }}
                                    title="Blue background"
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '50%',
                                      background: '#1e3a5f',
                                      border: dashboardBgColor === '#1e3a5f' ? '3px solid #ff6b6b' : '2px solid #d1d5db',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}
                                  />
                                  
                                  {/* More Options Button */}
                                  <button
                                    onClick={() => setShowColorPicker(!showColorPicker)}
                                    title="More colors"
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '50%',
                                      background: 'linear-gradient(135deg, #ff6b6b, #ffa500, #4ade80, #60a5fa)',
                                      border: '2px solid #d1d5db',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '10px',
                                      color: 'white',
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    +
                                  </button>
                                </div>
                                
                                {/* Custom Color Picker Dropdown */}
                                {showColorPicker && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: '100%',
                                      left: '0',
                                      marginTop: '12px',
                                      background: 'white',
                                      borderRadius: '12px',
                                      padding: '16px',
                                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                                      zIndex: 1000,
                                      minWidth: '180px'
                                    }}
                                  >
                                    {/* Background Color */}
                                    <div style={{ marginBottom: '12px' }}>
                                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>
                                        Background
                                      </label>
                                      <input
                                        type="color"
                                        value={dashboardBgColor}
                                        onChange={(e) => setDashboardBgColor(e.target.value)}
                                        style={{
                                          width: '100%',
                                          height: '36px',
                                          border: '1px solid #e5e7eb',
                                          borderRadius: '8px',
                                          cursor: 'pointer'
                                        }}
                                      />
                                    </div>
                                    
                                    {/* Text Color */}
                                    <div>
                                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>
                                        Text
                                      </label>
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                          onClick={() => setDashboardTextColor('#1a1a1a')}
                                          style={{
                                            flex: 1,
                                            padding: '8px',
                                            borderRadius: '6px',
                                            border: dashboardTextColor === '#1a1a1a' ? '2px solid #ff6b6b' : '1px solid #e5e7eb',
                                            background: '#1a1a1a',
                                            cursor: 'pointer'
                                          }}
                                        />
                                        <button
                                          onClick={() => setDashboardTextColor('#ffffff')}
                                          style={{
                                            flex: 1,
                                            padding: '8px',
                                            borderRadius: '6px',
                                            border: dashboardTextColor === '#ffffff' ? '2px solid #ff6b6b' : '1px solid #e5e7eb',
                                            background: '#ffffff',
                                            cursor: 'pointer'
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* KPI Cards Row - Displayed at top, wraps after 3 cards */}
                          <KPICardsContainer 
                            kpiSpecs={chartSpecs.filter(spec => spec.chart_type === 'kpi_card')}
                            onEditKPI={handleEditKPI}
                            onRemoveKPI={handleRemoveKPI}
                            onAddKPI={() => setShowAddKPIPopup(true)}
                            editingKPIIndex={editingKPIIndex}
                            backgroundColor={dashboardBgColor}
                            textColor={dashboardTextColor}
                            hideAddButton={isLoading && !streamingComplete}
                            isAddingKPI={isAddingKPI}
                          />
                          
                          {/* Add KPI Popup with Dataset Preview */}
                          {showAddKPIPopup && (
                            <div 
                              style={{
                                position: 'fixed',
                                inset: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1000
                              }}
                              onClick={() => setShowAddKPIPopup(false)}
                            >
                              <div 
                                style={{
                                  backgroundColor: 'white',
                                  borderRadius: '12px',
                                  padding: '24px',
                                  width: '600px',
                                  maxWidth: '90vw',
                                  maxHeight: '80vh',
                                  overflow: 'hidden',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: '20px'
                                }}>
                                  <h2 style={{
                                    margin: 0,
                                    fontSize: '24px',
                                    fontWeight: 700,
                                    color: '#1f2937'
                                  }}>
                                    Add New KPI Card
                                  </h2>
                                  <button
                                    onClick={() => {
                                      setShowAddKPIPopup(false);
                                      setAddKPIInput('');
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      fontSize: '24px',
                                      cursor: 'pointer',
                                      color: '#6b7280',
                                      padding: '4px 8px',
                                      lineHeight: 1
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                                
                                {/* Dataset Preview */}
                                <div style={{ marginBottom: '16px' }}>
                                  <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#374151'
                                  }}>
                                    Data Preview
                                  </label>
                                  {localData.length > 0 ? (
                                    <div style={{
                                      border: '1px solid #e5e7eb',
                                      borderRadius: '8px',
                                      overflow: 'auto',
                                      maxHeight: '200px'
                                    }}>
                                      <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontSize: '13px'
                                      }}>
                                        <thead>
                                          <tr style={{
                                            backgroundColor: '#f9fafb',
                                            borderBottom: '2px solid #e5e7eb'
                                          }}>
                                            {Object.keys(localData[0]).map((col, idx) => (
                                              <th key={idx} style={{
                                                padding: '8px 12px',
                                                textAlign: 'left',
                                                fontWeight: 600,
                                                color: '#374151',
                                                borderRight: '1px solid #e5e7eb',
                                                whiteSpace: 'nowrap'
                                              }}>
                                                {col}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {localData.slice(0, 3).map((row, rowIdx) => (
                                            <tr key={rowIdx} style={{
                                              borderBottom: '1px solid #e5e7eb'
                                            }}>
                                              {Object.keys(localData[0]).map((col, colIdx) => (
                                                <td key={colIdx} style={{
                                                  padding: '8px 12px',
                                                  borderRight: '1px solid #e5e7eb',
                                                  color: '#6b7280'
                                                }}>
                                                  {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      <div style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#f9fafb',
                                        borderTop: '1px solid #e5e7eb',
                                        fontSize: '12px',
                                        color: '#6b7280'
                                      }}>
                                        Total rows: {totalRowsInDataset || localData.length}
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{
                                      padding: '20px',
                                      textAlign: 'center',
                                      color: '#6b7280',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: '8px'
                                    }}>
                                      No preview available
                                    </div>
                                  )}
                                </div>
                                
                                {/* Input Field */}
                                <div style={{ marginBottom: '4px' }}>
                                  <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#374151'
                                  }}>
                                    KPI Description
                                  </label>
                                  <textarea
                                    value={addKPIInput}
                                    onChange={(e) => setAddKPIInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey && addKPIInput.trim()) {
                                        e.preventDefault();
                                        handleAddKPI(addKPIInput);
                                      }
                                      if (e.key === 'Escape') {
                                        setShowAddKPIPopup(false);
                                        setAddKPIInput('');
                                      }
                                    }}
                                    placeholder="Describe the KPI you want to add (e.g., 'Average price', 'Total count of sales')"
                                    autoFocus
                                    style={{
                                      width: '100%',
                                      minHeight: '80px',
                                      padding: '12px',
                                      border: '2px solid #e5e7eb',
                                      borderRadius: '8px',
                                      fontSize: '14px',
                                      fontFamily: 'inherit',
                                      resize: 'vertical',
                                      outline: 'none',
                                      transition: 'border-color 0.2s',
                                      boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => {
                                      e.currentTarget.style.borderColor = '#ff6b6b';
                                    }}
                                    onBlur={(e) => {
                                      e.currentTarget.style.borderColor = '#e5e7eb';
                                    }}
                                  />
                                </div>
                                
                                {/* Buttons */}
                                <div style={{
                                  display: 'flex',
                                  gap: '12px',
                                  justifyContent: 'flex-end'
                                }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAddKPIPopup(false);
                                      setAddKPIInput('');
                                    }}
                                    disabled={isAddingKPI}
                                    style={{
                                      padding: '10px 20px',
                                      border: '2px solid #e5e7eb',
                                      borderRadius: '8px',
                                      backgroundColor: 'white',
                                      color: '#374151',
                                      fontSize: '14px',
                                      fontWeight: 500,
                                      cursor: isAddingKPI ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.2s',
                                      opacity: isAddingKPI ? 0.6 : 1
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleAddKPI(addKPIInput)}
                                    disabled={isAddingKPI || !addKPIInput.trim()}
                                    style={{
                                      padding: '10px 20px',
                                      border: 'none',
                                      borderRadius: '8px',
                                      backgroundColor: isAddingKPI || !addKPIInput.trim() ? '#9ca3af' : '#ff6b6b',
                                      color: 'white',
                                      fontSize: '14px',
                                      fontWeight: 500,
                                      cursor: isAddingKPI || !addKPIInput.trim() ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.2s',
                                      boxShadow: isAddingKPI || !addKPIInput.trim() ? 'none' : '0 2px 8px rgba(255, 107, 107, 0.3)'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isAddingKPI && addKPIInput.trim()) {
                                        e.currentTarget.style.backgroundColor = '#ef4444';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isAddingKPI && addKPIInput.trim()) {
                                        e.currentTarget.style.backgroundColor = '#ff6b6b';
                                      }
                                    }}
                                  >
                                    {isAddingKPI ? 'Adding KPI...' : 'Add KPI'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* View Mode Toggle */}
                          {chartSpecs.filter(spec => spec.chart_type !== 'kpi_card').length > 0 && (
                          <div style={{
                              padding: '0 20px 12px 20px',
                              display: 'flex',
                              justifyContent: 'flex-end',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span style={{ fontSize: '14px', color: '#6b7280', marginRight: '8px' }}>View:</span>
                              <button
                                onClick={() => {
                                  setViewMode('list');
                                  localStorage.setItem('chart_view_mode', 'list');
                                }}
                                style={{
                                  padding: '6px 12px',
                                  border: viewMode === 'list' ? '2px solid #ff6b6b' : '1px solid #e5e7eb',
                                  borderRadius: '6px',
                                  background: viewMode === 'list' ? '#fff5f5' : 'white',
                                  color: viewMode === 'list' ? '#ff6b6b' : '#6b7280',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: viewMode === 'list' ? 600 : 400,
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="8" y1="6" x2="21" y2="6" />
                                  <line x1="8" y1="12" x2="21" y2="12" />
                                  <line x1="8" y1="18" x2="21" y2="18" />
                                  <line x1="3" y1="6" x2="3.01" y2="6" />
                                  <line x1="3" y1="12" x2="3.01" y2="12" />
                                  <line x1="3" y1="18" x2="3.01" y2="18" />
                                </svg>
                                List
                              </button>
                              <button
                                onClick={() => {
                                  setViewMode('grid');
                                  localStorage.setItem('chart_view_mode', 'grid');
                                }}
                                style={{
                                  padding: '6px 12px',
                                  border: viewMode === 'grid' ? '2px solid #ff6b6b' : '1px solid #e5e7eb',
                                  borderRadius: '6px',
                                  background: viewMode === 'grid' ? '#fff5f5' : 'white',
                                  color: viewMode === 'grid' ? '#ff6b6b' : '#6b7280',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: viewMode === 'grid' ? 600 : 400,
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="7" height="7" />
                                  <rect x="14" y="3" width="7" height="7" />
                                  <rect x="14" y="14" width="7" height="7" />
                                  <rect x="3" y="14" width="7" height="7" />
                                </svg>
                                Grid
                              </button>
                            </div>
                          )}

                          {/* Charts Grid/List with Notes Icons */}
                          <div style={{
                            display: viewMode === 'grid' ? 'grid' : 'flex',
                            flexDirection: viewMode === 'list' ? 'column' : undefined,
                            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fit, minmax(500px, 1fr))' : undefined,
                            gap: viewMode === 'grid' ? '20px' : '24px',
                            padding: '20px',
                            alignItems: viewMode === 'list' ? 'stretch' : 'stretch',
                            position: 'relative',
                            width: '100%'
                          }}>
                            {chartSpecs.filter(spec => spec.chart_type !== 'kpi_card').map((spec) => {
                              // Find the actual index in chartSpecs array
                              const actualIndex = chartSpecs.findIndex(s => s === spec);
                              return (
                                <ChartItem
                                  key={`chart-${actualIndex}`}
                                  chartSpec={spec}
                                  chartIndex={actualIndex}
                                  localData={localData}
                                  datasetId={datasetId}
                                  onChartFixed={handleChartFixed}
                                  onFixingStatusChange={(isFixing) => setShowFixNotification(isFixing)}
                                  onZoom={handleChartZoom}
                                  onDelete={handleDeleteChart}
                                  chartNotes={chartNotes}
                                  editingNotesIndex={editingNotesIndex}
                                  setEditingNotesIndex={setEditingNotesIndex}
                                  notesVisible={notesVisible}
                                  setNotesVisible={setNotesVisible}
                                  generatingInsights={generatingInsights}
                                  savingNotes={savingNotes}
                                  savedNotes={savedNotes}
                                  handleGenerateInsights={handleGenerateInsights}
                                  handleSaveNotes={handleSaveNotes}
                                  setChartNotes={setChartNotes}
                                  setSavedNotes={setSavedNotes}
                                  filterPanelOpen={filterPanelOpen}
                                  setFilterPanelOpen={setFilterPanelOpen}
                                  chartFilters={chartFilters}
                                  setChartFilters={setChartFilters}
                                  applyingFilter={applyingFilter}
                                  setApplyingFilter={setApplyingFilter}
                                  applyFilterToChart={applyFilterToChart}
                                  getFilteredChartSpec={getFilteredChartSpec}
                                  viewMode={viewMode}
                                  backgroundColor={dashboardBgColor}
                                  textColor={dashboardTextColor}
                                />
                              );
                            })}
                            
                            {/* Skeleton Loading for Charts */}
                            {isLoading && !streamingComplete && chartSpecs.filter(spec => spec.chart_type !== 'kpi_card').length === 0 && (
                              <div style={{ width: '100%', padding: '20px' }}>
                                <DashboardSkeleton />
                              </div>
                            )}
                          </div>
                          
                          {/* Floating Add Chart Button - Hidden while loading */}
                          {!(isLoading && !streamingComplete) && (
                            <div style={{
                              display: 'flex',
                              justifyContent: 'center',
                              padding: '30px 20px',
                              width: '100%'
                            }}>
                              <button
                                onClick={() => setShowAddChartPopup(true)}
                                style={{
                                  width: '60px',
                                  height: '60px',
                                  borderRadius: '50%',
                                  border: '2px solid #ff6b6b',
                                  background: 'rgba(255, 107, 107, 0.1)',
                                  color: '#ff6b6b',
                                  fontSize: '32px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.3s ease',
                                  boxShadow: '0 4px 12px rgba(255, 107, 107, 0.2)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)';
                                  e.currentTarget.style.transform = 'scale(1.1)';
                                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 107, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)';
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 107, 0.2)';
                                }}
                                title="Add New Chart"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </React.Fragment>
                      ) : (
                        <div className="empty-state" style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          minHeight: '400px',
                          gap: '1rem'
                        }}>
                          <button
                            onClick={() => setShowAddChartPopup(true)}
                            style={{
                              width: '120px',
                              height: '120px',
                              borderRadius: '50%',
                              border: '3px solid #ff6b6b',
                              background: 'rgba(255, 107, 107, 0.1)',
                              color: '#ff6b6b',
                              fontSize: '48px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.3s ease',
                              boxShadow: '0 4px 12px rgba(255, 107, 107, 0.2)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)';
                              e.currentTarget.style.transform = 'scale(1.1)';
                              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 107, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)';
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 107, 0.2)';
                            }}
                          >
                            +
                          </button>
                          <p style={{
                            fontSize: '1.2rem',
                            color: '#6b7280',
                            fontWeight: 500,
                            margin: 0
                          }}>
                            No charts yet
                          </p>
                          <p style={{
                            fontSize: '0.9rem',
                            color: '#9ca3af',
                            margin: 0
                          }}>
                            Ask me to create visualizations from your data
                          </p>
                        </div>
                      )}
                    </div>
                  )}
          </div>
        </main>
      </div>
    </div>

    {/* Add Chart Popup */}
        <AddChartPopup
          isOpen={showAddChartPopup}
          onClose={() => setShowAddChartPopup(false)}
          onAddChart={handleAddChart}
          datasetId={datasetId}
          addingChart={addingChart}
        />

        {/* Insufficient Balance Popup */}
        <InsufficientBalancePopup
          isOpen={showInsufficientBalance}
          onClose={() => setShowInsufficientBalance(false)}
          required={insufficientBalanceData.required}
          balance={insufficientBalanceData.balance}
          plan={insufficientBalanceData.plan}
        />

        {/* Share Popup */}
        <SharePopup
          isOpen={showSharePopup}
          onClose={() => setShowSharePopup(false)}
          shareUrl={shareUrl}
          expiresAt={shareExpiresAt}
        />

        {/* Guide Tour Overlay */}
        {guideStep !== null && (
          <GuideTourOverlay
            step={guideStep}
            chatButtonRef={chatButtonRef}
            downloadButtonRef={downloadButtonRef}
            publishButtonRef={publishButtonRef}
            onNext={() => {
              if (guideStep < 2) {
                setGuideStep(guideStep + 1);
              } else {
                setGuideStep(null);
              }
            }}
          />
        )}

        {/* Chart Preview Modal */}
        {chartPreview && (
          <div
                                style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                  display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px'
            }}
            onClick={discardChartPreview}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                maxWidth: '1200px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#1f2937'
                }}>
                  Preview Chart
                </h2>
                <button
                  onClick={discardChartPreview}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '0',
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>

                                {/* Chart */}
                                <div style={{
                                  flex: 1,
                overflow: 'auto',
                padding: '20px'
              }}>
                {chartSpecs[chartPreview.chartIndex] && (
                                  <PlotlyChartRenderer 
                    chartSpec={chartSpecs[chartPreview.chartIndex]}
                    data={localData}
                    chartIndex={chartPreview.chartIndex}
                    datasetId={datasetId}
                    onChartFixed={handleChartFixed}
                    onFixingStatusChange={(isFixing) => setShowFixNotification(isFixing)}
                  />
                )}
                {!chartSpecs[chartPreview.chartIndex] && (
                  <PlotlyChartRenderer
                    chartSpec={{ figure: chartPreview.figure }}
                    data={localData}
                    chartIndex={chartPreview.chartIndex}
                    datasetId={datasetId}
                    onChartFixed={handleChartFixed}
                    onFixingStatusChange={(isFixing) => setShowFixNotification(isFixing)}
                  />
                )}
              </div>

              {/* Actions */}
              <div style={{
                padding: '20px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={discardChartPreview}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'white',
                    color: '#6b7280',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  Discard
                </button>
                <button
                  onClick={applyChartPreview}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
                  }}
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        )}

    </>
  );
};
