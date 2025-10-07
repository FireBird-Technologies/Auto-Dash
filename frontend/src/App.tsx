import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Landing } from './components/Landing';
import { ConnectData } from './components/steps/ConnectData';
import { StyleContext } from './components/steps/StyleContext';
import { Visualization } from './components/steps/Visualization';

type Row = Record<string, number | string>;

export default function App() {
  const [currentStep, setCurrentStep] = useState(-1); // landing first
  const [data, setData] = useState<Row[]>([]);
  const [vizContext, setVizContext] = useState({
    description: ''
  });

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token && sessionStorage.getItem('auth_callback')) {
      localStorage.setItem('auth_token', token);
      sessionStorage.removeItem('auth_callback');
      setCurrentStep(0);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const progress = currentStep < 0 ? 0 : ((currentStep + 1) / 3) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case -1:
        return <Landing onStart={() => setCurrentStep(0)} />;
      case 0:
        return (
          <ConnectData
            onDataLoaded={(newData) => {
              setData(newData);
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
            context={vizContext}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <div className="progress-indicator">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      
      <Navbar />
      
      {renderStep()}
    </div>
  );
}