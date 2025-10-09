import React, { useCallback, useState } from 'react';

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

    const response = await fetch('http://localhost:8000/api/data/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include', // For auth cookies
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
      const response = await fetch('http://localhost:8000/api/data/sample/load', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to load sample data');
      }

      const result = await response.json();
      setSuccess(`Sample data loaded: ${result.dataset_info.filename}`);
      
      // Load preview data for display
      const previewResponse = await fetch(
        `http://localhost:8000/api/data/datasets/${result.dataset_id}/preview?rows=100`,
        { credentials: 'include' }
      );
      
      if (previewResponse.ok) {
        const previewData = await previewResponse.json();
        const columns = Object.keys(previewData.preview[0] || {});
        onDataLoaded(previewData.preview, columns, result.dataset_id);
      }
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
      
      // Pass data to parent component
      const columns = result.file_info.column_names;
      const preview = result.file_info.preview;
      onDataLoaded(preview, columns, result.dataset_id);
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
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.5 : 1
            }}
          >
            {uploading ? 'Loading...' : 'Load Sample Housing Data'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '0.375rem' }}>
            {error}
          </div>
        )}
        
        {success && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '0.375rem' }}>
            {success}
          </div>
        )}
      </div>
    </div>
  );
};
