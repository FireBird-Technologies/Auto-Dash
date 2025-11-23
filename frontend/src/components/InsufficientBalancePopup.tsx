import React from 'react';
import { useNavigate } from 'react-router-dom';

interface InsufficientBalancePopupProps {
  isOpen: boolean;
  onClose: () => void;
  required?: number;
  balance?: number;
  plan?: string;
}

export const InsufficientBalancePopup: React.FC<InsufficientBalancePopupProps> = ({
  isOpen,
  onClose,
  required,
  balance,
  plan
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    onClose();
    navigate('/pricing');
  };

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
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <svg 
              width="28" 
              height="28" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{ color: '#dc2626' }}
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Insufficient Credits
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
              lineHeight: 1,
              transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#1f2937'}
            onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <p style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            color: '#4b5563',
            lineHeight: '1.6'
          }}>
            You don't have enough credits to complete this action.
          </p>
          
          {required !== undefined && balance !== undefined && (
            <div style={{
              backgroundColor: '#fdf2f8',
              border: '1px solid #fbcfe8',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{ color: '#831843', fontWeight: 500 }}>Required:</span>
                <span style={{ color: '#831843', fontWeight: 600 }}>{required} credits</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span style={{ color: '#831843', fontWeight: 500 }}>Available:</span>
                <span style={{ color: '#831843', fontWeight: 600 }}>{balance} credits</span>
              </div>
            </div>
          )}

          {plan && (
            <p style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              Current plan: <strong>{plan}</strong>
            </p>
          )}

          <p style={{
            margin: 0,
            fontSize: '16px',
            color: '#4b5563',
            lineHeight: '1.6'
          }}>
            Upgrade your plan to get more credits and continue using AutoDash.
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 500,
              color: '#4b5563',
              backgroundColor: '#f3f4f6',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          >
            Cancel
          </button>
          <button
            onClick={handleUpgrade}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              color: 'white',
              backgroundColor: '#dc2626',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
};

