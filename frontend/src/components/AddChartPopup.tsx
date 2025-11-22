import React, { useState, useEffect } from 'react';
import { config, getAuthHeaders, checkAuthResponse } from '../config';
import { useNotification } from '../contexts/NotificationContext';

interface AddChartPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onAddChart: (query: string) => Promise<void>;
  datasetId: string;
  addingChart: boolean;
}

export const AddChartPopup: React.FC<AddChartPopupProps> = ({
  isOpen,
  onClose,
  onAddChart,
  datasetId,
  addingChart
}) => {
  const notification = useNotification();
  const [query, setQuery] = useState('');
  const [previewData, setPreviewData] = useState<{ preview: any[], total_rows: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (isOpen && datasetId) {
      fetchPreview();
      setQuery('');
    }
  }, [isOpen, datasetId]);

  const fetchPreview = async () => {
    if (!datasetId) return;
    
    setLoadingPreview(true);
    try {
      const response = await fetch(`${config.backendUrl}/api/data/datasets/${datasetId}/preview?rows=3`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      await checkAuthResponse(response);

      if (response.ok) {
        const result = await response.json();
        setPreviewData(result);
      } else {
        console.error('Failed to fetch dataset preview');
      }
    } catch (err) {
      console.error('Error fetching dataset preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      notification.error('Please enter a chart description');
      return;
    }
    await onAddChart(query);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
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
            Add New Chart to Dashboard
          </h2>
          <button
            onClick={onClose}
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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151'
            }}>
              Chart Description
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe the chart you want to add (e.g., 'Show a bar chart of sales by region')"
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#ff6b6b';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
              disabled={addingChart}
            />
          </div>

          {/* Data Preview */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151'
            }}>
              Data Preview
            </label>
            {loadingPreview ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                Loading preview...
              </div>
            ) : previewData && previewData.preview && previewData.preview.length > 0 ? (
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
                      {Object.keys(previewData.preview[0]).map((key) => (
                        <th key={key} style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: '#374151',
                          borderRight: '1px solid #e5e7eb'
                        }}>
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.map((row, idx) => (
                      <tr key={idx} style={{
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        {Object.values(row).map((value, cellIdx) => (
                          <td key={cellIdx} style={{
                            padding: '8px 12px',
                            borderRight: '1px solid #e5e7eb',
                            color: '#6b7280'
                          }}>
                            {value !== null && value !== undefined ? String(value) : '-'}
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
                  Total rows: {previewData.total_rows}
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

          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={addingChart}
              style={{
                padding: '10px 20px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: '#374151',
                fontSize: '14px',
                fontWeight: 500,
                cursor: addingChart ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: addingChart ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingChart || !query.trim()}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: addingChart || !query.trim() ? '#9ca3af' : '#ff6b6b',
                color: 'white',
                fontSize: '14px',
                fontWeight: 500,
                cursor: addingChart || !query.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: addingChart || !query.trim() ? 'none' : '0 2px 8px rgba(255, 107, 107, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!addingChart && query.trim()) {
                  e.currentTarget.style.backgroundColor = '#ef4444';
                }
              }}
              onMouseLeave={(e) => {
                if (!addingChart && query.trim()) {
                  e.currentTarget.style.backgroundColor = '#ff6b6b';
                }
              }}
            >
              {addingChart ? 'Adding Chart...' : 'Add Chart'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

