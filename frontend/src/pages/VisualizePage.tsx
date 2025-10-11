import React, { useState, useEffect } from 'react';
import { ConnectData } from '../components/steps/ConnectData';
import { StyleContext } from '../components/steps/StyleContext';
import { Visualization } from '../components/steps/Visualization';

type Row = Record<string, number | string>;

export const VisualizePage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<Row[]>([]);
  const [datasetId, setDatasetId] = useState<string>('');
  const [vizContext, setVizContext] = useState({
    description: ''
  });

  // Clear session data on page load/refresh
  useEffect(() => {
    // Reset to initial state
    setCurrentStep(0);
    setData([]);
    setDatasetId('');
    setVizContext({ description: '' });
  }, []);

  const progress = ((currentStep + 1) / 3) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <ConnectData
            onDataLoaded={(newData, newDatasetId) => {
              setData(newData);
              setDatasetId(newDatasetId);
              setCurrentStep(1);
            }}
          />
        );
      case 1:
        return (
          <StyleContext
            onComplete={(context) => {
              setVizContext(context);
              setCurrentStep(2);
            }}
          />
        );
      case 2:
        return (
          <Visualization
            data={data}
            datasetId={datasetId}
            context={vizContext}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="progress-indicator">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {renderStep()}
      </div>
    </div>
  );
};

