import React, { createContext, useContext, ReactNode } from 'react';
import { useCredits } from '../hooks/useCredits';

interface CreditBalance {
  balance: number;
  plan_name: string | null;
  plan_id: number | null;
  credits_per_analyze: number;
  credits_per_edit: number;
  last_reset_at: string | null;
  updated_at: string;
}

interface CreditsContextType {
  credits: CreditBalance | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export const CreditsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const creditsData = useCredits();

  return (
    <CreditsContext.Provider value={creditsData}>
      {children}
    </CreditsContext.Provider>
  );
};

export const useCreditsContext = () => {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCreditsContext must be used within a CreditsProvider');
  }
  return context;
};

