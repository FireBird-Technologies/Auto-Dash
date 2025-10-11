/**
 * Application configuration
 */

export const config = {
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',
} as const;

/**
 * Helper to get auth headers with JWT token
 */
export const getAuthHeaders = (additionalHeaders: HeadersInit = {}): HeadersInit => {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = { ...additionalHeaders };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

