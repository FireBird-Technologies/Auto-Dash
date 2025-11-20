import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRICING_CONFIG, getMonthlyPriceAnnual, getAnnualPrice } from '../config/pricing';

export const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [processing, setProcessing] = useState(false);
  
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
  });

  const price = billingPeriod === 'monthly' 
    ? PRICING_CONFIG.monthly.pro 
    : getMonthlyPriceAnnual('pro');

  const totalPrice = billingPeriod === 'monthly'
    ? PRICING_CONFIG.monthly.pro
    : getAnnualPrice('pro');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCardDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Store pro plan status
    localStorage.setItem('subscription_plan', 'pro');
    localStorage.setItem('billing_period', billingPeriod);
    
    setProcessing(false);
    navigate('/visualize');
  };

  return (
    <div className="payment-page">
      <div className="payment-container">
        <button className="back-button" onClick={() => navigate('/pricing')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Pricing
        </button>

        <div className="payment-content">
          <div className="payment-header">
            <h1 className="page-title page-title-center">Complete Your Subscription</h1>
            <p className="page-subtitle page-subtitle-center">
              Subscribe to AutoDash Pro and unlock unlimited AI-powered visualizations
            </p>
          </div>

          <div className="payment-layout">
            {/* Order Summary */}
            <div className="order-summary">
              <h3>Order Summary</h3>
              
              <div className="billing-period-selector">
                <button
                  className={`period-option ${billingPeriod === 'monthly' ? 'active' : ''}`}
                  onClick={() => setBillingPeriod('monthly')}
                >
                  <div className="period-option-header">
                    <span className="period-name">Monthly</span>
                    <span className="period-price">${PRICING_CONFIG.monthly.pro}/mo</span>
                  </div>
                  <span className="period-detail">Billed monthly</span>
                </button>
                
                <button
                  className={`period-option ${billingPeriod === 'annual' ? 'active' : ''}`}
                  onClick={() => setBillingPeriod('annual')}
                >
                  <div className="period-option-header">
                    <span className="period-name">Annual</span>
                    <span className="period-price">${getMonthlyPriceAnnual('pro').toFixed(0)}/mo</span>
                  </div>
                  <span className="period-detail">
                    Billed ${getAnnualPrice('pro').toFixed(0)}/year
                    <span className="save-badge">Save {PRICING_CONFIG.annualDiscountPercent}%</span>
                  </span>
                </button>
              </div>

              <div className="summary-details">
                <div className="summary-row">
                  <span>AutoDash Pro</span>
                  <span>${price}/month</span>
                </div>
                {billingPeriod === 'annual' && (
                  <div className="summary-row discount">
                    <span>Annual discount ({PRICING_CONFIG.annualDiscountPercent}%)</span>
                    <span>-${(PRICING_CONFIG.annual.pro - getAnnualPrice('pro')).toFixed(0)}</span>
                  </div>
                )}
                <div className="summary-divider" />
                <div className="summary-row total">
                  <span>Total {billingPeriod === 'annual' ? 'per year' : 'per month'}</span>
                  <span>${totalPrice.toFixed(0)}</span>
                </div>
              </div>

              <div className="features-included">
                <h4>What's included:</h4>
                <ul>
                  <li>✓ Unlimited dashboards</li>
                  <li>✓ GPT-4 & Claude 3.5 Sonnet</li>
                  <li>✓ All advanced chart types</li>
                  <li>✓ Priority AI processing</li>
                </ul>
              </div>
            </div>

            {/* Payment Form */}
            <div className="payment-form-wrapper">
              <form className="payment-form" onSubmit={handleSubmit}>
                <h3>Payment Details</h3>

                <div className="form-group">
                  <label htmlFor="cardNumber">Card Number</label>
                  <input
                    type="text"
                    id="cardNumber"
                    name="cardNumber"
                    value={cardDetails.cardNumber}
                    onChange={handleInputChange}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cardName">Cardholder Name</label>
                  <input
                    type="text"
                    id="cardName"
                    name="cardName"
                    value={cardDetails.cardName}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="expiryDate">Expiry Date</label>
                    <input
                      type="text"
                      id="expiryDate"
                      name="expiryDate"
                      value={cardDetails.expiryDate}
                      onChange={handleInputChange}
                      placeholder="MM/YY"
                      maxLength={5}
                      required
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="cvv">CVV</label>
                    <input
                      type="text"
                      id="cvv"
                      name="cvv"
                      value={cardDetails.cvv}
                      onChange={handleInputChange}
                      placeholder="123"
                      maxLength={4}
                      required
                      className="form-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="button-primary"
                  style={{ 
                    width: '100%', 
                    marginTop: '24px',
                    opacity: 1,
                    transform: 'none'
                  }}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <svg style={{ animation: 'spin 1s linear infinite' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" opacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    `Subscribe for $${totalPrice.toFixed(0)}${billingPeriod === 'annual' ? '/year' : '/month'}`
                  )}
                </button>

                <p className="payment-disclaimer">
                  By subscribing, you agree to our Terms of Service and Privacy Policy. 
                  You can cancel anytime.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

