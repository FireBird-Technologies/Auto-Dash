import React, { createContext, useContext, useState, useCallback } from 'react';
import { Notification, NotificationProps } from '../components/Notification';

interface NotificationOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  duration?: number;
}

interface ConfirmOptions {
  message: string;
  title?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface NotificationContextType {
  showNotification: (options: NotificationOptions) => void;
  showConfirm: (options: ConfirmOptions) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<NotificationProps | null>(null);

  const closeNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const showNotification = useCallback((options: NotificationOptions) => {
    setNotification({
      type: options.type,
      message: options.message,
      title: options.title,
      onClose: closeNotification,
      autoClose: true,
      duration: options.duration || 4000,
    });
  }, [closeNotification]);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setNotification({
      type: 'confirm',
      message: options.message,
      title: options.title,
      onClose: closeNotification,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
      autoClose: false,
    });
  }, [closeNotification]);

  const success = useCallback((message: string, title?: string) => {
    showNotification({ type: 'success', message, title });
  }, [showNotification]);

  const error = useCallback((message: string, title?: string) => {
    showNotification({ type: 'error', message, title });
  }, [showNotification]);

  const warning = useCallback((message: string, title?: string) => {
    showNotification({ type: 'warning', message, title });
  }, [showNotification]);

  const info = useCallback((message: string, title?: string) => {
    showNotification({ type: 'info', message, title });
  }, [showNotification]);

  return (
    <NotificationContext.Provider value={{ showNotification, showConfirm, success, error, warning, info }}>
      {children}
      {notification && <Notification {...notification} />}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

