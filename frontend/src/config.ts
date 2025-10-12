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

