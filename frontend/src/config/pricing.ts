/**
 * Pricing configuration
 * Adjust these values to change pricing display across the app
 */

export const pricingConfig = {
  // Annual billing discount percentage (e.g., 20 = 20% off)
  annualDiscount: 20,
  
  // Enterprise contact email
  enterpriseEmail: 'arslan@firebird-technologies.com',
  
  // Credit costs (should match backend configuration)
  creditCosts: {
    analyze: 5,
    edit: 2,
  },
} as const;

