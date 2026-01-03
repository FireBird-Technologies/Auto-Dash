import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = '4px',
  className = '',
  style
}) => {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, rgba(255, 107, 107, 0.03) 25%, rgba(255, 107, 107, 0.08) 50%, rgba(255, 107, 107, 0.03) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 4s infinite',
        ...style
      }}
    />
  );
};

export const ChartSkeleton: React.FC = () => {
  return (
    <div className="chart-skeleton" style={{
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      marginBottom: '20px'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <Skeleton width="40%" height="24px" />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <Skeleton width="60%" height="16px" />
      </div>
      <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
        <Skeleton width="20%" height="60%" />
        <Skeleton width="20%" height="80%" />
        <Skeleton width="20%" height="45%" />
        <Skeleton width="20%" height="70%" />
        <Skeleton width="20%" height="90%" />
      </div>
    </div>
  );
};

export const KPISkeleton: React.FC = () => {
  return (
    <div className="kpi-skeleton" style={{
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      marginBottom: '20px'
    }}>
      <Skeleton width="50%" height="16px" style={{ marginBottom: '12px' }} />
      <Skeleton width="70%" height="32px" style={{ marginBottom: '8px' }} />
      <Skeleton width="40%" height="14px" />
    </div>
  );
};

export const ChatMessageSkeleton: React.FC = () => {
  return (
    <div className="chat-message-skeleton" style={{
      display: 'flex',
      gap: '12px',
      marginBottom: '16px',
      padding: '12px'
    }}>
      <Skeleton width="40px" height="40px" borderRadius="50%" />
      <div style={{ flex: 1 }}>
        <Skeleton width="100%" height="16px" style={{ marginBottom: '8px' }} />
        <Skeleton width="80%" height="16px" style={{ marginBottom: '8px' }} />
        <Skeleton width="60%" height="16px" />
      </div>
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="dashboard-skeleton">
      <div style={{ marginBottom: '24px' }}>
        <Skeleton width="300px" height="32px" style={{ marginBottom: '12px' }} />
        <Skeleton width="500px" height="20px" />
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <KPISkeleton />
        <KPISkeleton />
        <KPISkeleton />
      </div>
      
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  );
};

