/**
 * Application configuration
 */

export const config = {
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',
} as const;

/**
 * Helper to get auth headers with JWT token
 */
export const getAuthHeaders = (additionalHeaders: HeadersInit = {}): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};
  
  // Copy additional headers
  if (additionalHeaders) {
    if (Array.isArray(additionalHeaders)) {
      additionalHeaders.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else if (additionalHeaders instanceof Headers) {
      additionalHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, additionalHeaders);
    }
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

/**
 * Handle authentication errors (401)
 * Clears token and redirects to login
 */
export const handleAuthError = (error: any) => {
  if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
    // Clear authentication
    localStorage.removeItem('auth_token');
    sessionStorage.clear();
    
    // Show message
    alert('Your session has expired. Please login again.');
    
    // Redirect to home page
    window.location.href = '/';
    
    return true;
  }
  return false;
};

/**
 * Check response for auth errors
 * Use after fetch calls to automatically handle 401s
 */
export const checkAuthResponse = async (response: Response) => {
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    sessionStorage.clear();
    alert('Your session has expired. Please login again.');
    window.location.href = '/';
    throw new Error('Authentication expired. Please login again.');
  }
  return response;
};

