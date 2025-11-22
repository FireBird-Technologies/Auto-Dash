# Monthly & Yearly Plan Support

## Overview
The system now supports separate monthly and yearly Stripe price IDs for each subscription plan. This allows users to choose between monthly and annual billing cycles with proper Stripe integration.

## Changes Made

### 1. Database Schema Updates (`backend/app/models.py`)
Added new fields to `SubscriptionPlan` model:
- `stripe_price_id_monthly`: Stripe price ID for monthly billing
- `stripe_price_id_yearly`: Stripe price ID for yearly billing
- `price_yearly`: Yearly price (for display purposes)
- `stripe_price_id`: Kept for backward compatibility (legacy field)

### 2. Plan Service Updates (`backend/app/services/plan_service.py`)
- Updated `get_plan_by_stripe_price_id()` to check both monthly and yearly price IDs
- Updated `create_plan()` to accept monthly and yearly price IDs
- Updated `initialize_default_plans()` to use new environment variables
- Updated `get_plan_info()` to return new fields

### 3. API Routes Updates (`backend/app/routes/plans.py`)
- Updated `PlanResponse` model to include new fields
- Updated route handlers to return monthly and yearly price IDs

### 4. Stripe Integration Updates (`backend/app/stripe_routes.py`)
- Updated `CreateCheckoutRequest` to accept `billing_period` parameter
- Updated checkout session creation to use correct price ID based on billing period:
  - `billing_period="monthly"` → uses `stripe_price_id_monthly`
  - `billing_period="yearly"` → uses `stripe_price_id_yearly`

### 5. Frontend Updates (`frontend/src/pages/PricingPage.tsx`)
- Updated `Plan` interface to include new fields
- Updated `calculatePrice()` to use `price_yearly` when available
- Updated `handleUpgrade()` to send `billing_period` to backend

## Environment Variables

Update your `.env` file with the following variables:

```env
# Monthly Price IDs
STRIPE_FREE_PRICE_MONTHLY_ID=price_xxxxx_free_monthly
STRIPE_PRO_PRICE_MONTHLY_ID=price_xxxxx_pro_monthly
STRIPE_ULTRA_PRICE_MONTHLY_ID=price_xxxxx_ultra_monthly

# Yearly Price IDs
STRIPE_FREE_PRICE_YEARLY_ID=price_xxxxx_free_yearly
STRIPE_PRO_PRICE_YEARLY_ID=price_xxxxx_pro_yearly
STRIPE_ULTRA_PRICE_YEARLY_ID=price_xxxxx_ultra_yearly

# Product IDs (optional, can remain the same)
STRIPE_FREE_PRODUCT_ID=prod_xxxxx_free
STRIPE_PRO_PRODUCT_ID=prod_xxxxx_pro
STRIPE_ULTRA_PRODUCT_ID=prod_xxxxx_ultra
```

## Stripe Setup

### Creating Monthly and Yearly Prices in Stripe

1. **For each plan (Free, Pro, Ultra):**
   - Create a monthly recurring price (e.g., `price_pro_monthly`)
   - Create a yearly recurring price (e.g., `price_pro_yearly`)
   - Copy the price IDs to your `.env` file

2. **Yearly prices should be:**
   - Set to "Recurring" billing period: "Year"
   - Can include a discount (e.g., 20% off = $20/month * 12 * 0.8 = $192/year)

## Database Migration

The schema changes require a database migration. If you're using `AUTO_MIGRATE=1`, the tables will be recreated automatically on next startup.

**⚠️ Warning:** If you have existing plans in the database, you'll need to:

1. **Option A: Reinitialize plans** (recommended for development)
   ```bash
   python -m app.scripts.init_plans --force
   ```
   This will update existing plans with the new price IDs from environment variables.

2. **Option B: Manual update** (for production)
   - Update existing plans via admin API or database directly
   - Set `stripe_price_id_monthly` and `stripe_price_id_yearly` for each plan

## Usage

### Frontend
Users can now toggle between "Monthly" and "Annual" billing on the pricing page. When they click "Upgrade", the system will:
1. Send the selected `billing_period` to the backend
2. Backend selects the appropriate Stripe price ID
3. Creates checkout session with correct price
4. User completes payment in Stripe

### Backend
The checkout endpoint now accepts:
```json
{
  "plan_id": 2,
  "billing_period": "yearly"  // or "monthly"
}
```

## Testing

1. **Set environment variables** with your Stripe price IDs
2. **Restart backend** to apply schema changes
3. **Reinitialize plans** if needed:
   ```bash
   python -m app.scripts.init_plans --force
   ```
4. **Test checkout flow:**
   - Select "Monthly" → should use monthly price ID
   - Select "Annual" → should use yearly price ID
   - Verify correct price in Stripe checkout

## Backward Compatibility

- Legacy `stripe_price_id` field is still supported
- If `stripe_price_id_monthly` is not set, system falls back to `stripe_price_id`
- Existing plans will continue to work until migrated

## Notes

- Yearly prices are stored in `price_yearly` field for display purposes
- The frontend calculates annual discount if `price_yearly` is not set
- Webhook handlers work with both monthly and yearly subscriptions
- Credit reset logic works the same for both billing cycles (monthly reset)

