import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleAuthButton } from '../components/GoogleAuthButton';
import { ContactForm } from '../components/ContactForm';
import { 
  PRICING_CONFIG, 
  getMonthlyPriceAnnual, 
  getAnnualSavings,
  getAnnualPrice 
} from '../config/pricing';
import { PRICING_PLANS, PricingFeature } from '../config/pricingPlans';

// Helper component for feature list item
const FeatureItem: React.FC<{ feature: PricingFeature; prefix?: string }> = ({ feature, prefix }) => (
  <li>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
    <span>{prefix ? `${prefix} ${feature.text}` : feature.text}</span>
  </li>
);

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('auth_token');
  const [showContactForm, setShowContactForm] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const handlePlanSelection = (plan: 'free' | 'pro') => {
    if (isAuthenticated) {
      // User is already logged in
      // TODO: Implement Stripe checkout for Pro plan
      navigate('/visualize');
    } else {
      // Store selected plan before auth redirect
      sessionStorage.setItem('selected_plan', plan);
    }
  };

  const renderPricingButton = (plan: 'free' | 'pro') => {
    const isProPlan = plan === 'pro';
    
    // Determine button text based on auth state
    let buttonText = 'Get Started';
    if (isAuthenticated) {
      buttonText = isProPlan ? 'Upgrade' : 'Current Plan';
    }
    
    // Style for enterprise-like buttons (consistent with Contact Sales)
    const buttonStyle: React.CSSProperties = {
      width: '100%',
      padding: '16px 32px',
      borderRadius: '12px',
      fontSize: '16px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    };

    if (isProPlan) {
      // Red gradient for Pro (like Contact Sales but red)
      buttonStyle.background = 'linear-gradient(135deg, #ff6b6b, #ff8787)';
      buttonStyle.color = 'white';
      buttonStyle.boxShadow = '0 8px 24px rgba(255, 107, 107, 0.25)';
    } else {
      // Secondary style for Free
      buttonStyle.background = 'white';
      buttonStyle.color = 'var(--aa-text)';
      buttonStyle.border = '2px solid var(--aa-border)';
    }

    const handleButtonClick = () => {
      handlePlanSelection(plan);
    };

    if (isAuthenticated) {
      return (
        <button style={buttonStyle} onClick={handleButtonClick}>
          {buttonText}
        </button>
      );
    }

    // For non-authenticated users, we need to store plan before auth redirect
    return (
      <GoogleAuthButton
        style={buttonStyle}
        onBeforeAuth={handleButtonClick}
      >
        {buttonText}
      </GoogleAuthButton>
    );
  };

  if (showContactForm) {
    return <ContactForm onBack={() => setShowContactForm(false)} />;
  }

  return (
    <div className="pricing-page">
      <div className="pricing-container">
        {/* Back to Home button for logged-in users */}
        {isAuthenticated && (
          <button className="back-button" onClick={() => navigate('/visualize')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Home
          </button>
        )}

        {/* Header Section */}
        <div className="pricing-header">
          <h1 className="pricing-title">Choose Your Plan</h1>
          <p className="pricing-subtitle">
            Start free and upgrade as you grow. All plans include our core visualization features.
          </p>
          
          {/* Billing Toggle */}
          <div className="billing-toggle-container">
            <button
              className={`billing-toggle-button ${billingPeriod === 'monthly' ? 'active' : ''}`}
              onClick={() => setBillingPeriod('monthly')}
            >
              Monthly
            </button>
            <button
              className={`billing-toggle-button ${billingPeriod === 'annual' ? 'active' : ''}`}
              onClick={() => setBillingPeriod('annual')}
            >
              Annual
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="pricing-grid">
          {/* Free Plan */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <h3 className="pricing-plan-name">{PRICING_PLANS.free.name}</h3>
              <div className="pricing-amount">
                <span className="pricing-currency">$</span>
                <span className="pricing-price">0</span>
                <span className="pricing-period">/month</span>
              </div>
              <p className="pricing-description">{PRICING_PLANS.free.description}</p>
            </div>

            <div className="pricing-features">
              <ul>
                <FeatureItem 
                  feature={PRICING_PLANS.free.features[0]} 
                  prefix={PRICING_CONFIG.limits.free.dashboards.toString()} 
                />
                {PRICING_PLANS.free.features.slice(1).map((feature, index) => (
                  <FeatureItem key={index} feature={feature} />
                ))}
              </ul>
            </div>

            <div className="pricing-card-footer">
              {renderPricingButton('free')}
            </div>
          </div>

          {/* Pro Plan */}
          <div className="pricing-card pricing-card-featured">
            <div className="pricing-badge">Most Popular</div>
            <div className="pricing-card-header">
              <h3 className="pricing-plan-name">{PRICING_PLANS.pro.name}</h3>
              <div className="pricing-amount">
                <span className="pricing-currency">$</span>
                <span className="pricing-price">
                  {billingPeriod === 'monthly' 
                    ? PRICING_CONFIG.monthly.pro 
                    : getMonthlyPriceAnnual('pro').toFixed(0)}
                </span>
                <span className="pricing-period">/month</span>
              </div>
              {billingPeriod === 'annual' && (
                <p className="pricing-save-badge">
                  Save ${getAnnualSavings('pro').toFixed(0)}/year • Billed ${getAnnualPrice('pro').toFixed(0)}/year
                </p>
              )}
              <p className="pricing-description">{PRICING_PLANS.pro.description}</p>
            </div>

            <div className="pricing-features">
              <ul>
                {PRICING_PLANS.pro.features.map((feature, index) => (
                  <FeatureItem key={index} feature={feature} />
                ))}
              </ul>
            </div>

            <div className="pricing-card-footer">
              {renderPricingButton('pro')}
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <h3 className="pricing-plan-name">{PRICING_PLANS.enterprise.name}</h3>
              <div className="pricing-amount">
                <span className="pricing-price-custom">Custom</span>
              </div>
              <p className="pricing-description">{PRICING_PLANS.enterprise.description}</p>
            </div>

            <div className="pricing-features">
              <ul>
                {PRICING_PLANS.enterprise.features.map((feature, index) => (
                  <FeatureItem key={index} feature={feature} />
                ))}
              </ul>
            </div>

            <div className="pricing-card-footer">
              <button 
                className="cta-button-secondary"
                style={{ 
                  width: '100%',
                  background: 'linear-gradient(135deg, #1f2937, #374151)',
                  color: 'white'
                }}
                onClick={() => setShowContactForm(true)}
              >
                Contact Sales
              </button>
            </div>
          </div>
        </div>

        {/* FAQ or Additional Info */}
        <div className="pricing-faq">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h4>Can I switch plans later?</h4>
              <p>Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            <div className="faq-item">
              <h4>What payment methods do you accept?</h4>
              <p>We accept all major credit cards, PayPal, and bank transfers for Enterprise customers.</p>
            </div>
            <div className="faq-item">
              <h4>Is there a free trial for Pro?</h4>
              <p>Yes! New Pro subscribers get a 14-day free trial with full access to all features.</p>
            </div>
            <div className="faq-item">
              <h4>Do you offer discounts for nonprofits?</h4>
              <p>Yes, we offer special pricing for educational institutions and nonprofits. Contact us for details.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

