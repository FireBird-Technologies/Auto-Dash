// Pricing plan features configuration
export interface PricingFeature {
  text: string;
}

export interface PricingPlanData {
  name: string;
  description: string;
  features: PricingFeature[];
}

export const PRICING_PLANS: Record<'free' | 'pro' | 'enterprise', PricingPlanData> = {
  free: {
    name: 'Free',
    description: 'Perfect for individuals',
    features: [
      { text: 'dashboards per month' }, // Will be prefixed with the number from config
      { text: 'GPT-4 Mini powered queries' },
      { text: 'Basic chart types' },
      { text: 'Standard insights' },
      { text: 'Community support' },
    ],
  },
  pro: {
    name: 'Pro',
    description: 'For professionals and teams',
    features: [
      { text: 'Unlimited dashboards' },
      { text: 'GPT-4 & Claude 3.5 Sonnet' },
      { text: 'All advanced chart types' },
      { text: 'Deep data analysis' },
      { text: 'Smart trend predictions' },
      { text: 'Custom themes' },
      { text: 'Priority AI processing' },
    ],
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For large organizations',
    features: [
      { text: 'Everything in Pro' },
      { text: 'Dedicated AI model instances' },
      { text: 'Custom model fine-tuning' },
      { text: 'Advanced predictive analytics' },
      { text: 'API access & integrations' },
      { text: 'White-label options' },
      { text: '99.9% SLA guarantee' },
    ],
  },
};

