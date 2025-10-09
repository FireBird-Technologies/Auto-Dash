import React from 'react';
import { FileUpload } from '../FileUpload';

type Row = Record<string, number | string>;

interface ConnectDataProps {
  onDataLoaded: (data: Row[], datasetId: string) => void;
}

export const ConnectData: React.FC<ConnectDataProps> = ({ onDataLoaded }) => {
  const handleDataLoaded = (data: Row[], columns: string[], datasetId: string) => {
    onDataLoaded(data, datasetId);
  };

  return (
    <div className="step-container">
      <div className="step-header">
        <h1 className="step-title">Connect Your Data</h1>
        <p className="step-description">Upload your dataset or load sample housing data</p>
      </div>

      <div className="upload-container">
        <FileUpload onDataLoaded={handleDataLoaded} />
      </div>
    </div>
  );
};