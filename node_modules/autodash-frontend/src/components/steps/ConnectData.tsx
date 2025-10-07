import React, { useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type Row = Record<string, number | string>;

interface ConnectDataProps {
  onDataLoaded: (data: Row[]) => void;
}

const SAMPLE_DATA = [
  { date: '2024-01', sales: 120000, units: 450, region: 'North' },
  { date: '2024-02', sales: 135000, units: 480, region: 'North' },
  { date: '2024-03', sales: 142000, units: 510, region: 'North' },
  { date: '2024-01', sales: 95000, units: 320, region: 'South' },
  { date: '2024-02', sales: 105000, units: 360, region: 'South' },
  { date: '2024-03', sales: 115000, units: 400, region: 'South' },
];

export const ConnectData: React.FC<ConnectDataProps> = ({ onDataLoaded }) => {
  const parseCSV = useCallback((file: File) => {
    return new Promise<Row[]>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        complete: result => resolve(result.data as Row[]),
        error: reject
      });
    });
  }, []);

  const parseExcel = useCallback(async (file: File) => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Row>(sheet);
  }, []);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.toLowerCase().split('.').pop();
      let parsed: Row[] = [];
      
      if (ext === 'csv') {
        parsed = await parseCSV(file);
      } else if (['xls', 'xlsx'].includes(ext || '')) {
        parsed = await parseExcel(file);
      } else {
        throw new Error('Unsupported file type');
      }

      if (parsed.length > 0) {
        onDataLoaded(parsed);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
    }
  }, [parseCSV, parseExcel, onDataLoaded]);

  return (
    <div className="step-container">
      <div className="step-header">
        <h1 className="step-title">Connect Your Data</h1>
        <p className="step-description">Upload your dataset to start visualizing</p>
      </div>

      <div className="upload-container">
        <div className="upload-zone">
          <input 
            type="file" 
            accept=".csv, .xls, .xlsx" 
            onChange={handleUpload}
            className="file-input"
          />
          <div className="upload-info">
            <div className="upload-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p>Drop your file here or click to browse</p>
            <span className="upload-formats">Supports .csv, .xls, .xlsx</span>
          </div>
        </div>
      </div>

      <div className="sample-option">
        <button 
          className="sample-button"
          onClick={() => onDataLoaded(SAMPLE_DATA)}
        >
          Try with sample data
        </button>
      </div>
    </div>
  );
};