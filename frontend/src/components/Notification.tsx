import React, { useEffect } from 'react';
import '../styles/notification.css';

export interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  message: string;
  title?: string;
  onClose: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  autoClose?: boolean;
  duration?: number;
  showClose?: boolean;
  showOkButton?: boolean;
  showIcon?: boolean;
}

export const Notification: React.FC<NotificationProps> = ({
  type,
  message,
  title,
  onClose,
  onConfirm,
  onCancel,
  autoClose = true,
  duration = 4000,
  showClose = true,
  showOkButton = false,
  showIcon = true,
}) => {
  const isConfirm = type === 'confirm';

  useEffect(() => {
    if (autoClose && !isConfirm) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, isConfirm, onClose]);

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'error':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case 'warning':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'confirm':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      default:
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  return (
    <div className="notification-overlay" onClick={isConfirm ? undefined : onClose}>
      <div 
        className={`notification notification-${type}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-header">
          {showIcon && <div className="notification-icon">{getIcon()}</div>}
          {title && <h3 className="notification-title">{title}</h3>}
          {!isConfirm && showClose && (
            <button className="notification-close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <div className="notification-content">
          <p>{message}</p>
        </div>
        {isConfirm && (
          <div className="notification-actions">
            <button className="notification-button cancel" onClick={handleCancel}>
              Cancel
            </button>
            <button className="notification-button confirm" onClick={handleConfirm}>
              Confirm
            </button>
          </div>
        )}
        {showOkButton && !isConfirm && (
          <div className="notification-actions">
            <button className="notification-button confirm" onClick={onClose}>
              Okay
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

