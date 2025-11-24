import React, { useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';

interface SharePopupProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  expiresAt: string | null;
}

export const SharePopup: React.FC<SharePopupProps> = ({
  isOpen,
  onClose,
  shareUrl,
  expiresAt
}) => {
  const notification = useNotification();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      notification.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      notification.error('Failed to copy link');
    }
  };

  const handleOpenLink = () => {
    window.open(shareUrl, '_blank');
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
          padding: '24px',
          maxWidth: '600px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            color: '#1f2937'
          }}>
            Publish Dashboard
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
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        <p style={{
          margin: '0 0 16px 0',
          color: '#6b7280',
          fontSize: '14px'
        }}>
          Share this link to allow others to view your dashboard
        </p>

        {expiresAt && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#92400e'
            }}>
              This link will expire in 24 hours
            </p>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px'
        }}>
          <input
            type="text"
            value={shareUrl}
            readOnly
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'monospace',
              backgroundColor: '#f9fafb',
              color: '#1f2937'
            }}
          />
          <button
            onClick={handleCopy}
            style={{
              padding: '12px 24px',
              background: copied ? '#10b981' : 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
            }}
            onMouseEnter={(e) => {
              if (!copied) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!copied) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
              }
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'white',
              color: '#374151',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            Close
          </button>
          <button
            onClick={handleOpenLink}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
            }}
          >
            Open Link
          </button>
        </div>
      </div>
    </div>
  );
};

