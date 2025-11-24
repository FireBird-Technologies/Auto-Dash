import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Landing } from './components/Landing';
import { Account } from './components/Account';
import { VisualizePage } from './pages/VisualizePage';
import { PricingPage } from './pages/PricingPage';
import { SubscriptionResult } from './pages/SubscriptionResult';
import { PublicDashboard } from './pages/PublicDashboard';
import { CreditsProvider } from './contexts/CreditsContext';
import { NotificationProvider } from './contexts/NotificationContext';

function AuthHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    
    if (token && sessionStorage.getItem('auth_callback')) {
      localStorage.setItem('auth_token', token);
      sessionStorage.removeItem('auth_callback');
      
      // Check if there's a redirect URL stored
      const redirectTo = sessionStorage.getItem('auth_redirect_to');
      if (redirectTo) {
        sessionStorage.removeItem('auth_redirect_to');
        navigate(redirectTo, { replace: true });
      } else {
        navigate('/visualize', { replace: true });
      }
    }
  }, [navigate, location]);

  return null;
}

function AppRoutes() {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('auth_token');

  return (
    <>
      <AuthHandler />
      <Navbar onAccountClick={() => navigate('/account')} />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<Landing onStart={() => navigate('/visualize')} />} />
          <Route 
            path="/visualize" 
            element={
              isAuthenticated ? (
                <VisualizePage />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/account" 
            element={
              isAuthenticated ? (
                <Account onClose={() => navigate(-1)} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/pricing" 
            element={<PricingPage />}
          />
          <Route 
            path="/subscription" 
            element={<SubscriptionResult />}
          />
          <Route 
            path="/shared/:token" 
            element={<PublicDashboard />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <NotificationProvider>
        <CreditsProvider>
      <div className="app-container">
        <AppRoutes />
      </div>
        </CreditsProvider>
      </NotificationProvider>
    </Router>
  );
}