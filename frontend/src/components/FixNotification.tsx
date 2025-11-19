import React from 'react';

interface FixNotificationProps {
  show: boolean;
  onDismiss: () => void;
}

export const FixNotification: React.FC<FixNotificationProps> = ({ show, onDismiss }) => {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '100px',
      right: '24px',
      background: 'linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%)',
      color: 'white',
      padding: '18px 22px',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(255, 107, 107, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)',
      maxWidth: '360px',
      zIndex: 9999,
      animation: 'slideInRight 0.3s ease-out',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '10px',
      backdropFilter: 'blur(10px)'
    }}>
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(255, 255, 255, 0.25)',
          border: 'none',
          borderRadius: '50%',
          width: '26px',
          height: '26px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          color: 'white',
          transition: 'all 0.2s',
          fontWeight: '500',
          lineHeight: '1'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Dismiss"
      >
        ×
      </button>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px' }}>
        <div style={{ 
          width: '22px', 
          height: '22px', 
          border: '3px solid rgba(255, 255, 255, 0.4)', 
          borderTop: '3px solid white', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite',
          flexShrink: 0
        }}></div>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '15px', 
            fontWeight: '600',
            marginBottom: '5px',
            letterSpacing: '-0.01em'
          }}>
            🔧 Fixing visualization...
          </div>
          <div style={{ 
            fontSize: '13px', 
            opacity: 0.95,
            lineHeight: '1.5',
            fontWeight: '400'
          }}>
            Our AI is analyzing the error and generating a fix.
          </div>
        </div>
      </div>
    </div>
  );
};

