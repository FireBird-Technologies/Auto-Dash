import React, { useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type Row = Record<string, number | string>;

interface FileUploadProps {
  onDataLoaded: (data: Row[], columns: string[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
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

      const keys = Object.keys(parsed[0] || {});
      onDataLoaded(parsed, keys);
    } catch (error) {
      console.error('Error parsing file:', error);
      // TODO: Add proper error handling UI
    }
  }, [parseCSV, parseExcel, onDataLoaded]);

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
          />
          <div className="upload-info">
            <p>Drop your file here or click to browse</p>
            <span className="upload-formats">Supports .csv, .xls, .xlsx</span>
          </div>
        </div>
      </div>
    </div>
  );
};
