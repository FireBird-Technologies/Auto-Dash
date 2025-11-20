import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Landing } from './components/Landing';
import { Account } from './components/Account';
import { VisualizePage } from './pages/VisualizePage';
import { PricingPage } from './pages/PricingPage';

function AuthHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    
    if (token && sessionStorage.getItem('auth_callback')) {
      localStorage.setItem('auth_token', token);
      sessionStorage.removeItem('auth_callback');
      
      // After auth, always go to visualize page
      sessionStorage.removeItem('selected_plan');
      navigate('/visualize', { replace: true });
    }
  }, [navigate, location]);

  return null;
}

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = !!localStorage.getItem('auth_token');
  
  // Hide navbar on pricing page
  const hideNavbar = location.pathname === '/pricing';

  return (
    <>
      <AuthHandler />
      {!hideNavbar && <Navbar onAccountClick={() => navigate('/account')} />}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route 
            path="/" 
            element={
              isAuthenticated ? (
                <Navigate to="/visualize" replace />
              ) : (
                <Landing onStart={() => navigate('/visualize')} />
              )
            } 
          />
          <Route path="/pricing" element={<PricingPage />} />
          <Route 
            path="/visualize" 
            element={
              isAuthenticated ? (
                <VisualizePage />
              ) : (
                <Navigate to="/pricing" replace />
              )
            } 
          />
          <Route 
            path="/account" 
            element={
              isAuthenticated ? (
                <Account onClose={() => navigate(-1)} />
              ) : (
                <Navigate to="/pricing" replace />
              )
            } 
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
      <div className="app-container">
        <AppRoutes />
      </div>
    </Router>
  );
}