import React, { useCallback, useState } from 'react';
import { config, getAuthHeaders, checkAuthResponse } from '../config';
import { useNotification } from '../contexts/NotificationContext';

type Row = Record<string, number | string>;

interface FileUploadProps {
  onDataLoaded: (data: Row[], columns: string[], datasetId: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const notification = useNotification();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const uploadToBackend = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${config.backendUrl}/api/data/upload`, {
      method: 'POST',
      body: formData,
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    await checkAuthResponse(response);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Upload failed');
    }

    return response.json();
  };

  const loadSampleData = async () => {
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${config.backendUrl}/api/data/sample/load`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      await checkAuthResponse(response);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to load sample data');
      }

      const result = await response.json();
      setSuccess(`Sample data loaded: ${result.dataset_info.filename}`);
      
      // Pass minimal data to proceed to visualization immediately
      // Note: Suggestions will be fetched by StyleContext component
      onDataLoaded([], [], result.dataset_id);
    } catch (err) {
      console.error('Error loading sample data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sample data';
      setError(errorMessage);
      
      // Show popup notification for sample data errors
      notification.showNotification({
        type: 'error',
        title: 'Failed to Load Sample Data',
        message: 'We\'re sorry, something went wrong. Currently only supports datasets that are in tabular form. Please try again later.',
        duration: 6000
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadToBackend(file);
      setSuccess(`File uploaded: ${result.file_info.filename}`);
      
      // Pass minimal data to proceed to visualization immediately
      // Note: Suggestions will be fetched by StyleContext component
      onDataLoaded([], [], result.dataset_id);
    } catch (err) {
      console.error('Error uploading file:', err);
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      
      // Show popup notification for upload errors
      notification.showNotification({
        type: 'error',
        title: 'Upload Failed',
        message: 'We\'re sorry, something went wrong. Currently only supports datasets that are in tabular form. Please try again later.',
        duration: 6000
      });
    } finally {
      setUploading(false);
    }
  }, [onDataLoaded]);

  return (
    <div className="upload-section">
      <h3 className="section-title">Upload Your Dataset</h3>
      <div className="upload">
        <div className="upload-zone">
          <input 
            type="file" 
            accept=".csv, .xls, .xlsx" 
            onChange={handleUpload}
            className="file-input"
            disabled={uploading}
          />
          <div className="upload-info">
            <p>{uploading ? 'Uploading...' : 'Drop your file here or click to browse'}</p>
            <span className="upload-formats">Supports CSV and Excel files (.csv, .xls, .xlsx)</span>
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
              Tabular data with headers • Works best with numeric, date, and categorical data
            </p>
          </div>
        </div>
        
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'row', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={loadSampleData}
            disabled={uploading}
            className="feedback-button"
          >
            {uploading ? 'Loading...' : 'Use Sample Data'}
          </button>
          
          <button
            onClick={() => {
              const subject = encodeURIComponent('Connect to Database Request');
              const body = encodeURIComponent('Hello,\n\nI would like to connect my database to AutoDash.\n\nPlease let me know the next steps.\n\nThank you!');
              window.location.href = `mailto:arslan@firebird-technologies.com?subject=${subject}&body=${body}`;
            }}
            disabled={uploading}
            className="feedback-button"
          >
            Connect to your db
          </button>
          
          <button
            onClick={() => {
              const subject = encodeURIComponent('Demo Request');
              const body = encodeURIComponent('Hello,\n\nI would like to request a demo of AutoDash.\n\nPlease let me know when would be a good time.\n\nThank you!');
              window.location.href = `mailto:arslan@firebird-technologies.com?subject=${subject}&body=${body}`;
            }}
            disabled={uploading}
            className="feedback-button"
          >
            Ask for demo
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fce7f3', color: '#9f1239', borderRadius: '0.375rem', border: '1px solid #f9a8d4' }}>
            {error}
          </div>
        )}
        
        {success && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fdf2f8', color: '#831843', borderRadius: '0.375rem', border: '1px solid #fbcfe8' }}>
            {success}
          </div>
        )}
      </div>
    </div>
  );
};
