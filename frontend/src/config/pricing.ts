// Centralized pricing configuration
export const PRICING_CONFIG = {
  // Discount percentage for annual plans (can be changed from here)
  annualDiscountPercent: 20,
  
  // Monthly prices
  monthly: {
    free: 0,
    pro: 20,
  },
  
  // Annual prices (before discount)
  annual: {
    free: 0,
    pro: 240, // 20 * 12
  },
  
  // Feature limits
  limits: {
    free: {
      dashboards: 5, // dashboards per month
    },
  },
};

// Helper function to calculate discounted annual price
export const getAnnualPrice = (plan: 'free' | 'pro') => {
  const basePrice = PRICING_CONFIG.annual[plan];
  const discount = PRICING_CONFIG.annualDiscountPercent / 100;
  return basePrice * (1 - discount);
};

// Helper function to get monthly price when billed annually
export const getMonthlyPriceAnnual = (plan: 'free' | 'pro') => {
  return getAnnualPrice(plan) / 12;
};

// Helper function to get savings
export const getAnnualSavings = (plan: 'free' | 'pro') => {
  const monthly = PRICING_CONFIG.monthly[plan] * 12;
  const annual = getAnnualPrice(plan);
  return monthly - annual;
};

