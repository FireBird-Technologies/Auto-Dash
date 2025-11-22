# AutoDash Subscription System Documentation

## Overview

The AutoDash subscription system is a flexible, database-driven credit-based platform that integrates with Stripe for payment processing. It supports multiple subscription tiers with configurable features and credit allocations.

## Architecture

### Components

1. **Database Models** (`app/models.py`)
   - `SubscriptionPlan`: Defines subscription tiers
   - `Subscription`: User subscription records
   - `UserCredits`: Credit balance tracking
   - `CreditTransaction`: Audit trail for credit changes

2. **Services** (`app/services/`)
   - `credit_service.py`: Credit management operations
   - `plan_service.py`: Plan CRUD and initialization
   - `subscription_service.py`: Subscription lifecycle management

3. **Routes** (`app/routes/`)
   - `payment.py`: Stripe checkout and webhooks
   - `credits.py`: Credit balance and history
   - `plans.py`: Plan listing
   - `data.py`: Protected endpoints with credit checks

4. **Middleware** (`app/middleware/`)
   - `credit_check.py`: Credit requirement enforcement

## Subscription Tiers

### Free Tier
- **Price**: $0/month
- **Credits**: 25/month
- **Cost per operation**:
  - Dashboard: 5 credits
  - Edit/Analysis: 2 credits
- **Features**: Basic functionality
- **Default**: All new users automatically assigned

### Pro Tier
- **Price**: $20/month
- **Credits**: 500/month
- **Cost per operation**:
  - Dashboard: 5 credits
  - Edit/Analysis: 2 credits
- **Features**: Extended limits, priority support

### Ultra Tier
- **Price**: Configurable (default $29.99)
- **Credits**: 1000/month
- **Cost per operation**:
  - Dashboard: 5 credits
  - Edit/Analysis: 2 credits
- **Features**: Maximum limits, API access, custom branding

## Credit System

### Credit Allocation

Credits are allocated based on subscription tier and reset monthly on payment success.

### Credit Operations

#### Deduction (Post-Operation)
Credits are deducted **after** successful operation completion:

```python
# Check credits before operation
credits: CreditCheckResult = Depends(require_credits(5))

# Perform operation
result = perform_analysis(...)

# Deduct credits after success
credit_service.deduct_credits(db, user.id, 5, "Data analysis")
```

#### Transaction Types
- `RESET`: Monthly credit reset
- `DEDUCT`: Credit usage
- `REFUND`: Credit return (e.g., failed operations)
- `ADJUSTMENT`: Manual admin adjustment

### Credit History

All credit changes are logged in `CreditTransaction` for:
- Transparency
- Auditing
- Dispute resolution
- Usage analytics

## API Endpoints

### Plans

#### `GET /api/plans`
List all active subscription plans.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Free",
    "price_monthly": 0.0,
    "credits_per_month": 25,
    "credits_per_analyze": 5,
    "credits_per_edit": 2,
    "features": {...},
    "stripe_price_id": "price_...",
    "is_active": true,
    "sort_order": 0
  }
]
```

### Credits

#### `GET /api/credits/balance`
Get current credit balance and plan info.

**Response:**
```json
{
  "balance": 25,
  "plan_name": "Free",
  "plan_id": 1,
  "credits_per_analyze": 5,
  "credits_per_edit": 2,
  "last_reset_at": "2024-01-15T00:00:00",
  "updated_at": "2024-01-20T15:30:00"
}
```

#### `GET /api/credits/history`
Get credit transaction history.

**Query Parameters:**
- `limit`: Max transactions to return (default: 50)
- `offset`: Number to skip (default: 0)

**Response:**
```json
[
  {
    "id": 123,
    "amount": -5,
    "transaction_type": "deduct",
    "description": "Data analysis",
    "transaction_metadata": {"dataset_id": "abc123"},
    "created_at": "2024-01-20T15:30:00"
  }
]
```

### Payment

#### `POST /api/payment/create-checkout-session`
Create Stripe checkout session for subscription.

**Request:**
```json
{
  "plan_id": 2
}
```

**Response:**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

#### `GET /api/payment/subscription-status`
Get current subscription status.

**Response:**
```json
{
  "has_subscription": true,
  "status": "active",
  "plan": {...},
  "credits": {...},
  "stripe_subscription_id": "sub_...",
  "current_period_end": "2024-02-15T00:00:00",
  "cancel_at_period_end": false
}
```

#### `POST /api/payment/cancel-subscription`
Cancel subscription at period end.

**Response:**
```json
{
  "message": "Subscription will be canceled at the end of the billing period"
}
```

#### `POST /api/payment/webhook`
Stripe webhook handler (internal use only).

## Protected Endpoints

### Using Credit Check Middleware

Protected endpoints use the `require_credits` dependency:

```python
from app.middleware.credit_check import require_credits, CreditCheckResult

@router.post("/analyze")
async def analyze_data(
    request: AnalyzeRequest,
    credits: CreditCheckResult = Depends(require_credits(5)),
    db: Session = Depends(get_db)
):
    current_user = credits.user
    
    # Perform analysis
    result = analyze(...)
    
    # Deduct credits after success
    credit_service.deduct_credits(
        db, 
        current_user.id, 
        5, 
        "Data analysis",
        metadata={"request_id": request.id}
    )
    
    return result
```

### Current Protected Endpoints

1. **POST /api/data/analyze** - 5 credits (Dashboard creation)
   - Generate visualizations from natural language

2. **POST /api/data/edit-chart** - 2 credits
   - Edit existing charts with natural language

3. **POST /api/data/execute-code** - 2 credits
   - Execute plotly edits or analysis code

## Webhook Events

The system handles the following Stripe webhook events:

### `checkout.session.completed`
- Creates subscription record
- Assigns plan to user
- Resets credits to plan limit

### `customer.subscription.updated`
- Updates subscription status
- Changes plan if modified
- Updates billing period dates

### `customer.subscription.deleted`
- Downgrades user to Free tier
- Adjusts credit balance
- Removes Stripe subscription ID

### `invoice.payment_succeeded`
- Resets credits to plan limit (monthly renewal)
- Skips initial subscription payment
- Logs transaction

### `invoice.payment_failed`
- Marks subscription as `past_due`
- Sends notification (future enhancement)
- Does not immediately downgrade

## Database Schema

### SubscriptionPlan
```sql
CREATE TABLE subscription_plans (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    stripe_price_id VARCHAR(255),
    stripe_product_id VARCHAR(255),
    price_monthly NUMERIC(10, 2) DEFAULT 0.0,
    credits_per_month INTEGER DEFAULT 0,
    credits_per_analyze INTEGER DEFAULT 5,
    credits_per_edit INTEGER DEFAULT 2,
    features JSON,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME
);
```

### UserCredits
```sql
CREATE TABLE user_credits (
    id INTEGER PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    plan_id INTEGER REFERENCES subscription_plans(id),
    balance INTEGER DEFAULT 0,
    last_reset_at DATETIME,
    updated_at DATETIME
);
```

### CreditTransaction
```sql
CREATE TABLE credit_transactions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount INTEGER,
    transaction_type ENUM('reset', 'deduct', 'refund', 'adjustment'),
    description TEXT,
    transaction_metadata JSON,
    created_at DATETIME
);
```

### Subscription
```sql
CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    plan_id INTEGER REFERENCES subscription_plans(id),
    status VARCHAR(50) DEFAULT 'inactive',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    current_period_start DATETIME,
    current_period_end DATETIME,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at DATETIME,
    updated_at DATETIME
);
```

## Admin Operations

### Viewing Plans

```python
from app.services.plan_service import plan_service

plans = plan_service.get_all_active_plans(db)
for plan in plans:
    print(f"{plan.name}: {plan.credits_per_month} credits")
```

### Updating Plan Credits

```python
plan_service.update_plan(
    db,
    plan_id=2,
    credits_per_month=600,  # Update from 500 to 600
    credits_per_analyze=4   # Reduce cost from 5 to 4
)
```

### Manual Credit Adjustment

```python
from app.services.credit_service import credit_service
from app.models import TransactionType

credit_service.add_credits(
    db,
    user_id=123,
    amount=50,
    description="Compensation for downtime",
    transaction_type=TransactionType.ADJUSTMENT
)
```

### Viewing User Credit History

```python
transactions = credit_service.get_credit_history(db, user_id=123, limit=100)
for tx in transactions:
    print(f"{tx.created_at}: {tx.amount} credits - {tx.description}")
```

## Flexibility & Extensibility

### Adding New Plans

1. Create plan in Stripe Dashboard
2. Add to database:

```python
plan_service.create_plan(
    db,
    name="Enterprise",
    price_monthly=Decimal("99.99"),
    credits_per_month=5000,
    credits_per_analyze=5,
    credits_per_edit=2,
    stripe_price_id="price_xxx",
    features={
        "max_datasets": -1,
        "white_label": True,
        "dedicated_support": True
    }
)
```

### Modifying Credit Costs

Update the plan configuration:

```python
plan_service.update_plan(
    db,
    plan_id=1,
    credits_per_analyze=3,  # Reduce from 5 to 3
    credits_per_edit=1      # Reduce from 2 to 1
)
```

Changes apply immediately to all users on that plan.

### Adding New Features

Add features to the JSON field:

```python
plan_service.update_plan(
    db,
    plan_id=2,
    features={
        **existing_features,
        "ai_assistant": True,
        "export_formats": ["pdf", "xlsx", "png"]
    }
)
```

### Feature Checks in Code

```python
def check_feature(user_id: int, feature_name: str, db: Session) -> bool:
    subscription = subscription_service.get_user_subscription(db, user_id)
    if not subscription or not subscription.plan:
        return False
    
    features = subscription.plan.features or {}
    return features.get(feature_name, False)

# Usage
if check_feature(user.id, "white_label", db):
    # Enable white label features
    pass
```

## Testing

### Test User Flow

1. **New User Registration**
   - User signs in via Google OAuth
   - Automatically assigned Free tier
   - Receives 25 credits

2. **Using Credits**
   - User creates dashboard (5 credits deducted)
   - User edits chart (2 credits deducted)
   - Remaining: 18 credits

3. **Upgrading to Pro**
   - User clicks "Upgrade" button
   - Redirected to Stripe Checkout
   - Completes payment
   - Credits reset to 500

4. **Monthly Renewal**
   - Stripe charges user
   - Webhook receives `invoice.payment_succeeded`
   - Credits reset to 500

5. **Cancellation**
   - User cancels subscription
   - Remains Pro until period end
   - Auto-downgrades to Free tier
   - Credits reset to 25

### Stripe Test Cards

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0341 | Attaching fails |
| 4000 0000 0000 9995 | Declined |

## Monitoring

### Key Metrics to Track

1. **Credit Usage**
   - Average credits per user
   - Most common operations
   - Credit depletion rate

2. **Subscription Health**
   - Active subscriptions by tier
   - Churn rate
   - Upgrade/downgrade patterns

3. **Payment Issues**
   - Failed payment rate
   - Retry success rate
   - Past due subscriptions

### Logging

All credit operations and subscription changes are logged:

```python
logger.info(f"Deducted {amount} credits from user {user_id}")
logger.warning(f"Payment failed for user {user_id}")
```

## Future Enhancements

- [ ] Email notifications for credit warnings
- [ ] Credit purchase options (one-time top-ups)
- [ ] Annual billing discounts
- [ ] Team/organization accounts
- [ ] Usage analytics dashboard
- [ ] Referral credit system
- [ ] Trial periods for paid tiers
- [ ] Promo codes and discounts
- [ ] Partner/affiliate plans

## Support

For questions or issues:
- Check logs in application
- Review Stripe Dashboard
- Check webhook delivery logs
- Verify environment variables
- Consult API documentation

