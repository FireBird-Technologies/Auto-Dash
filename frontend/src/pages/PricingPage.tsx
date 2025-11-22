import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { config, getAuthHeaders, checkAuthResponse } from '../config';
import { pricingConfig } from '../config/pricing';
import { useCreditsContext } from '../contexts/CreditsContext';

interface Plan {
  id: number;
  name: string;
  price_monthly: number;
  credits_per_month: number;
  credits_per_analyze: number;
  credits_per_edit: number;
  features: Record<string, any>;
  stripe_price_id: string | null;
  is_active: boolean;
}

interface FAQ {
  question: string;
  answer: string;
}

const FAQS: FAQ[] = [
  {
    question: "What are credits and how do they work?",
    answer: "Credits are used for creating dashboards and editing charts. Each dashboard costs 5 credits, and each chart edit costs 2 credits. Your credits reset monthly with your subscription."
  },
  {
    question: "Can I upgrade or downgrade my plan?",
    answer: "Yes! You can upgrade anytime and start using more credits immediately. If you downgrade, the change takes effect at the end of your current billing period."
  },
  {
    question: "What happens if I run out of credits?",
    answer: "You can upgrade to a higher tier for more credits, or wait until your credits reset at the start of your next billing cycle."
  },
  {
    question: "Do unused credits roll over?",
    answer: "No, credits reset to your plan limit at the start of each billing period. We recommend choosing a plan that matches your monthly usage."
  },
  {
    question: "What's the difference between Free and paid plans?",
    answer: "Paid plans (Pro and Ultra) get access to the latest AI models, higher credit limits, priority support, and advanced features. Free plans use standard models with limited credits."
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes, you can cancel your subscription at any time with no penalties. You'll retain access to your paid plan features until the end of your billing period."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, debit cards, and digital wallets through our secure payment processor, Stripe."
  },
  {
    question: "Is there a free trial for paid plans?",
    answer: "New users start with a Free plan to try out AutoDash. You can upgrade to Pro or Ultra whenever you're ready for more features and credits."
  }
];

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { credits, refetch: refetchCredits } = useCreditsContext();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<number | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch(`${config.backendUrl}/api/plans`, {
        headers: getAuthHeaders(),
      });
      await checkAuthResponse(response);

      if (response.ok) {
        const data = await response.json();
        setPlans(data);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: number) => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      const shouldSignIn = window.confirm('Please sign in to upgrade your plan. Would you like to go to the sign in page?');
      if (shouldSignIn) {
        navigate('/');
      }
      return;
    }

    setUpgrading(planId);

    try {
      const response = await fetch(`${config.backendUrl}/api/payment/create-checkout-session`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_id: planId }),
      });

      await checkAuthResponse(response);

      if (response.ok) {
        const data = await response.json();
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl;
      } else {
        alert('Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to start upgrade process. Please try again.');
    } finally {
      setUpgrading(null);
    }
  };

  const isCurrentPlan = (planName: string) => {
    return credits?.plan_name?.toLowerCase() === planName.toLowerCase();
  };

  const calculatePrice = (monthlyPrice: number) => {
    if (billingPeriod === 'annual') {
      const annualPrice = monthlyPrice * 12 * (1 - pricingConfig.annualDiscount / 100);
      return Math.round(annualPrice);
    }
    return monthlyPrice;
  };

  const handleContactSales = () => {
    window.location.href = `mailto:${pricingConfig.enterpriseEmail}?subject=Enterprise Plan Inquiry`;
  };

  if (loading) {
    return (
      <div className="pricing-page">
        <div className="pricing-loading">Loading plans...</div>
      </div>
    );
  }

  return (
    <div className="pricing-page">
      <div className="pricing-container">
        <div className="pricing-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>Simple, Transparent Pricing</h1>
          <p className="subtitle">Choose the plan that fits your needs. Upgrade or downgrade anytime.</p>

          <div className="billing-toggle">
            <button 
              className={billingPeriod === 'monthly' ? 'active' : ''}
              onClick={() => setBillingPeriod('monthly')}
            >
              Monthly
            </button>
            <button 
              className={billingPeriod === 'annual' ? 'active' : ''}
              onClick={() => setBillingPeriod('annual')}
            >
              Annual
              <span className="discount-badge">Save {pricingConfig.annualDiscount}%</span>
            </button>
          </div>
        </div>

        <div className="pricing-grid">
          {plans.map((plan) => {
            const isCurrent = isCurrentPlan(plan.name);
            const isFree = plan.price_monthly === 0;
            const isPaid = !isFree;
            const displayPrice = calculatePrice(plan.price_monthly);

            return (
              <div 
                key={plan.id} 
                className={`pricing-card ${isCurrent ? 'current-plan' : ''} ${plan.name === 'Pro' ? 'popular' : ''}`}
              >
                {plan.name === 'Pro' && <div className="popular-badge">Most Popular</div>}
                
                <div className="plan-header">
                  <h3>{plan.name}</h3>
                  <div className="plan-price">
                    {isFree ? (
                      <>
                        <span className="price-amount">$0</span>
                        <span className="price-period">/month</span>
                      </>
                    ) : billingPeriod === 'annual' ? (
                      <>
                        <span className="price-amount">${displayPrice}</span>
                        <span className="price-period">/year</span>
                        <div className="price-breakdown">
                          ${Math.round(displayPrice / 12)}/month
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="price-amount">${displayPrice}</span>
                        <span className="price-period">/month</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="plan-features">
                  <div className="feature-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span><strong>{plan.credits_per_month}</strong> credits/month</span>
                  </div>
                  <div className="feature-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{plan.credits_per_analyze} credits per dashboard</span>
                  </div>
                  <div className="feature-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{plan.credits_per_edit} credits per edit</span>
                  </div>
                  <div className="feature-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{isPaid ? 'Latest AI models' : 'Standard models'}</span>
                  </div>
                  {plan.features?.priority_support && (
                    <div className="feature-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Priority support</span>
                    </div>
                  )}
                </div>

                <button
                  className={`plan-button ${isCurrent ? 'current' : ''}`}
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || isFree || upgrading !== null}
                >
                  {upgrading === plan.id ? (
                    'Processing...'
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : isFree ? (
                    'Free Forever'
                  ) : (
                    'Get Started'
                  )}
                </button>
              </div>
            );
          })}

          {/* Enterprise Card */}
          <div className="pricing-card enterprise-card">
            <div className="plan-header">
              <h3>Enterprise</h3>
              <div className="plan-price">
                <span className="price-amount">Custom</span>
              </div>
            </div>

            <div className="plan-features">
              <div className="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span><strong>Unlimited</strong> credits</span>
              </div>
              <div className="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Latest AI models</span>
              </div>
              <div className="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Dedicated support team</span>
              </div>
              <div className="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Custom integrations</span>
              </div>
              <div className="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>SLA guarantee</span>
              </div>
              <div className="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Advanced security</span>
              </div>
            </div>

            <button className="plan-button" onClick={handleContactSales}>
              Contact Sales
            </button>
          </div>
        </div>

        <div className="pricing-benefits">
          <h3>All paid plans include:</h3>
          <div className="benefits-grid">
            <div className="benefit-item">
              <h4>Latest AI Models</h4>
              <p>Access to the newest and most powerful AI models as they're released</p>
            </div>
            <div className="benefit-item">
              <h4>Advanced Analytics</h4>
              <p>Deeper insights with sophisticated analysis capabilities</p>
            </div>
            <div className="benefit-item">
              <h4>Priority Processing</h4>
              <p>Faster analysis with priority queue access</p>
            </div>
            <div className="benefit-item">
              <h4>Enhanced Security</h4>
              <p>Additional security features and data protection</p>
            </div>
          </div>
        </div>

        <div className="faq-section">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            {FAQS.map((faq, index) => (
              <div key={index} className="faq-item">
                <button
                  className={`faq-question ${openFaqIndex === index ? 'open' : ''}`}
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                >
                  <span>{faq.question}</span>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    style={{ 
                      transform: openFaqIndex === index ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {openFaqIndex === index && (
                  <div className="faq-answer">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pricing-footer">
          <div className="footer-content">
            <div className="footer-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>Cancel anytime</span>
            </div>
            <div className="footer-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Secure payments via Stripe</span>
            </div>
            <div className="footer-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>24/7 customer support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

