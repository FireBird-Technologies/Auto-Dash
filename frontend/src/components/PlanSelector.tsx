import React, { useState } from 'react';
import { pricingConfig } from '../config/pricing';

interface Plan {
  id: number;
  name: string;
  price_monthly: number;
  price_yearly: number | null;
  credits_per_month: number;
  credits_per_analyze: number;
  credits_per_edit: number;
  features: Record<string, any>;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
}

interface PlanSelectorProps {
  plans: Plan[];
  currentPlanId: number | null;
  onSelectPlan: (planId: number, billingPeriod: 'monthly' | 'yearly', promoCode?: string) => void;
  loading?: boolean;
}

export const PlanSelector: React.FC<PlanSelectorProps> = ({
  plans,
  currentPlanId,
  onSelectPlan,
  loading = false
}) => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoCodeValid, setPromoCodeValid] = useState<boolean | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  const calculatePrice = (plan: Plan) => {
    if (billingPeriod === 'yearly') {
      if (plan.price_yearly !== null) {
        return plan.price_yearly;
      }
      return plan.price_monthly * 12 * (1 - pricingConfig.annualDiscount / 100);
    }
    return plan.price_monthly;
  };

  const getMonthlyEquivalent = (plan: Plan) => {
    if (plan.name === "Free" || billingPeriod === 'monthly') {
      return null;
    }
    if (plan.price_yearly !== null) {
      const monthly = plan.price_yearly / 12;
      return `($${monthly.toFixed(2)}/month)`;
    }
    return null;
  };

  const handleValidatePromoCode = async (planId: number) => {
    if (!promoCode.trim()) {
      setPromoCodeValid(null);
      return;
    }

    setValidatingPromo(true);
    try {
      const { config, getAuthHeaders } = await import('../config');
      const response = await fetch(`${config.backendUrl}/api/payment/validate-promo-code`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promo_code: promoCode.trim().toUpperCase(),
          plan_id: planId,
          billing_period: billingPeriod
        }),
      });

      const data = await response.json();
      setPromoCodeValid(data.valid);
    } catch (error) {
      console.error('Error validating promo code:', error);
      setPromoCodeValid(false);
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleSelectPlan = (planId: number) => {
    setSelectedPlanId(planId);
    if (promoCode.trim()) {
      handleValidatePromoCode(planId).then(() => {
        if (promoCodeValid) {
          onSelectPlan(planId, billingPeriod, promoCode.trim().toUpperCase());
        }
      });
    } else {
      onSelectPlan(planId, billingPeriod);
    }
  };

  const isCurrentPlan = (planId: number) => {
    return currentPlanId === planId;
  };

  const isUpgrade = (plan: Plan) => {
    if (!currentPlanId) return true;
    const currentPlan = plans.find(p => p.id === currentPlanId);
    if (!currentPlan) return true;
    return plan.credits_per_month > currentPlan.credits_per_month;
  };

  return (
    <div className="plan-selector">
      <div className="billing-toggle">
        <button
          className={`billing-toggle-button ${billingPeriod === 'monthly' ? 'active' : ''}`}
          onClick={() => setBillingPeriod('monthly')}
        >
          Monthly
        </button>
        <button
          className={`billing-toggle-button ${billingPeriod === 'yearly' ? 'active' : ''}`}
          onClick={() => setBillingPeriod('yearly')}
        >
          Annual <span className="discount-badge">Save {pricingConfig.annualDiscount}%</span>
        </button>
      </div>

      <div className="plans-grid">
        {plans.map((plan) => {
          const isCurrent = isCurrentPlan(plan.id);
          const isUpgradePlan = isUpgrade(plan);
          const displayPrice = calculatePrice(plan);
          const monthlyEquivalent = getMonthlyEquivalent(plan);

          return (
            <div
              key={plan.id}
              className={`plan-card ${isCurrent ? 'current-plan' : ''} ${isUpgradePlan && !isCurrent ? 'upgrade-plan' : ''}`}
            >
              {isCurrent && <div className="current-badge">Current Plan</div>}
              {isUpgradePlan && !isCurrent && <div className="upgrade-badge">Upgrade</div>}
              {!isUpgradePlan && !isCurrent && <div className="downgrade-badge">Downgrade</div>}

              <h3 className="plan-name">{plan.name}</h3>
              <div className="plan-price">
                <span className="price-amount">
                  {plan.name === "Free" ? "$0" : `$${displayPrice}`}
                </span>
                {plan.name !== "Free" && (
                  <span className="price-cycle">/{billingPeriod === 'monthly' ? 'month' : 'year'}</span>
                )}
              </div>
              {monthlyEquivalent && <p className="monthly-equivalent">{monthlyEquivalent}</p>}

              <div className="plan-credits">{plan.credits_per_month} Credits/month</div>

              <ul className="plan-features">
                <li className="feature-included">
                  <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  {plan.credits_per_analyze} credits per dashboard
                </li>
                <li className="feature-included">
                  <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  {plan.credits_per_edit} credits per edit
                </li>
                {plan.features.latest_models && (
                  <li className="feature-included">
                    <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Latest AI models
                  </li>
                )}
                {plan.features.priority_support && (
                  <li className="feature-included">
                    <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Priority Support
                  </li>
                )}
              </ul>

              {!isCurrent && (
                <div className="plan-actions">
                  <div className="promo-code-input">
                    <input
                      type="text"
                      placeholder="Promo code (optional)"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value);
                        setPromoCodeValid(null);
                      }}
                      onBlur={() => {
                        if (promoCode.trim()) {
                          handleValidatePromoCode(plan.id);
                        }
                      }}
                      className={`promo-input ${promoCodeValid === true ? 'valid' : promoCodeValid === false ? 'invalid' : ''}`}
                    />
                    {validatingPromo && <span className="validating-indicator">...</span>}
                    {promoCodeValid === true && <span className="valid-indicator">Valid</span>}
                    {promoCodeValid === false && <span className="invalid-indicator">Invalid</span>}
                  </div>
                  <button
                    className="plan-button"
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={loading || (promoCode.trim() !== '' && promoCodeValid === false)}
                  >
                    {loading && selectedPlanId === plan.id ? 'Switching...' : 'Switch to this plan'}
                  </button>
                </div>
              )}

              {isCurrent && (
                <button className="plan-button current-plan-button" disabled>
                  Current Plan
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

