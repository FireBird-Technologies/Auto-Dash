import React, { useCallback, useState } from 'react';
import { config, getAuthHeaders } from '../config';

type Row = Record<string, number | string>;

interface FileUploadProps {
  onDataLoaded: (data: Row[], columns: string[], datasetId: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to load sample data');
      }

      const result = await response.json();
      setSuccess(`Sample data loaded: ${result.dataset_info.filename}`);
      
      // Pass minimal data to proceed to visualization
      onDataLoaded([], [], result.dataset_id);
    } catch (err) {
      console.error('Error loading sample data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sample data');
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
      
      // Pass minimal data to proceed to visualization
      onDataLoaded([], [], result.dataset_id);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [onDataLoaded]);

  return (
    <div className="upload-section">
      <h3 className="section-title">Upload CSV / Excel</h3>
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
            <span className="upload-formats">Supports .csv, .xls, .xlsx</span>
          </div>
        </div>
        
        <div style={{ marginTop: '1rem' }}>
          <button
            onClick={loadSampleData}
            disabled={uploading}
            className="feedback-button"
          >
            {uploading ? 'Loading...' : 'Load Sample Data'}
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
