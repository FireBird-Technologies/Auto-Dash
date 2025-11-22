import { useState, useEffect, useCallback } from 'react';
import { config, getAuthHeaders, checkAuthResponse } from '../config';

interface CreditBalance {
  balance: number;
  plan_name: string | null;
  plan_id: number | null;
  credits_per_analyze: number;
  credits_per_edit: number;
  last_reset_at: string | null;
  updated_at: string;
}

export const useCredits = () => {
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${config.backendUrl}/api/credits/balance`, {
        headers: getAuthHeaders(),
      });

      await checkAuthResponse(response);

      if (response.ok) {
        const data = await response.json();
        setCredits(data);
        setError(null);
      } else {
        setError('Failed to fetch credits');
      }
    } catch (err) {
      console.error('Error fetching credits:', err);
      setError('Failed to fetch credits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    
    // Refresh credits every 2 minutes (reduced from 30 seconds to reduce API calls)
    const interval = setInterval(fetchCredits, 120000);
    
    return () => clearInterval(interval);
  }, [fetchCredits]);

  return {
    credits,
    loading,
    error,
    refetch: fetchCredits,
  };
};

