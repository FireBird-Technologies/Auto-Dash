# AutoDash Subscription System - Quick Start Guide

## 🚀 Overview

The complete Stripe subscription system has been implemented with:
- ✅ 3 flexible subscription tiers (Free, Pro, Ultra)
- ✅ Credit-based usage system
- ✅ Database-driven plan management
- ✅ Full Stripe webhook integration
- ✅ Auto-assignment of Free tier to new users
- ✅ Credit checks on analyze/edit operations

## 📋 Prerequisites

- Stripe account
- Python 3.8+
- PostgreSQL or SQLite database

## ⚡ Quick Setup (5 Minutes)

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Stripe

Create `backend/.env` file:

```env
# Stripe Keys (get from https://dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Price IDs (create products in Stripe first)
STRIPE_FREE_PRICE_ID=price_YOUR_FREE_PRICE_ID
STRIPE_PRO_PRICE_ID=price_YOUR_PRO_PRICE_ID
STRIPE_ULTRA_PRICE_ID=price_YOUR_ULTRA_PRICE_ID

# Other required vars
FRONTEND_URL=http://localhost:5173
DATABASE_URL=sqlite:///./autodash.db
AUTO_MIGRATE=1
```

### 3. Create Stripe Products

Go to https://dashboard.stripe.com/products and create:

1. **AutoDash Free** - $0/month
2. **AutoDash Pro** - $20/month  
3. **AutoDash Ultra** - $29.99/month (or custom)

Copy the Price IDs to your `.env` file.

### 4. Start the Server

```bash
uvicorn app.main:app --reload --port 3001
```

On first start, the system will:
- Create all database tables
- Initialize the 3 default subscription plans
- Set up credit tracking

### 5. Set Up Webhook (Local Testing)

In a new terminal:

```bash
stripe listen --forward-to localhost:3001/api/payment/webhook
```

Copy the webhook signing secret to your `.env` file.

## 🧪 Test the System

### 1. Check Plans

```bash
curl http://localhost:3001/api/plans
```

You should see 3 plans (Free, Pro, Ultra).

### 2. Sign Up a User

1. Go to your frontend
2. Sign in with Google OAuth
3. User is automatically assigned Free tier with 25 credits

### 3. Check Credits

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/credits/balance
```

Expected response:
```json
{
  "balance": 25,
  "plan_name": "Free",
  "credits_per_analyze": 5,
  "credits_per_edit": 2
}
```

### 4. Test Dashboard Creation (Costs 5 Credits)

Use your frontend or:

```bash
curl -X POST http://localhost:3001/api/data/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me trends", "dataset_id": "YOUR_DATASET_ID"}'
```

Check credits again - should be 20 (25 - 5).

### 5. Test Upgrade to Pro

1. Go to pricing page in frontend
2. Click "Upgrade to Pro"
3. Complete checkout with test card: `4242 4242 4242 4242`
4. After successful payment, credits reset to 500

### 6. Test Webhook

Trigger a test event:

```bash
stripe trigger checkout.session.completed
```

Check logs to verify webhook was processed.

## 📂 Project Structure

```
backend/
├── app/
│   ├── models.py                    # Database models (NEW)
│   ├── main.py                      # App initialization (UPDATED)
│   ├── oauth_google.py              # OAuth with free tier assignment (UPDATED)
│   ├── stripe_routes.py             # Stripe integration (UPDATED)
│   ├── middleware/
│   │   ├── __init__.py              # NEW
│   │   └── credit_check.py          # Credit check dependency (NEW)
│   ├── routes/
│   │   ├── credits.py               # Credit endpoints (NEW)
│   │   ├── plans.py                 # Plan endpoints (NEW)
│   │   ├── payment.py               # Payment endpoints (UPDATED)
│   │   └── data.py                  # Protected endpoints (UPDATED)
│   ├── services/
│   │   ├── credit_service.py        # Credit management (NEW)
│   │   ├── plan_service.py          # Plan management (NEW)
│   │   └── subscription_service.py  # Subscription lifecycle (NEW)
│   └── scripts/
│       ├── __init__.py              # NEW
│       └── init_plans.py            # Plan initialization script (NEW)
├── STRIPE_SETUP.md                  # Detailed Stripe setup (NEW)
├── SUBSCRIPTION_SYSTEM.md           # System documentation (NEW)
└── QUICKSTART.md                    # This file (NEW)
```

## 🎯 Key Features

### For End Users

- **Free Tier**: Automatic for all new users (25 credits)
- **Upgrade Anytime**: Seamless Stripe checkout
- **Credit Tracking**: View balance and history
- **Monthly Reset**: Credits automatically reset on renewal

### For Admins

- **Flexible Plans**: Modify credits, pricing, features anytime
- **Database-Driven**: All configuration in database (no code changes)
- **Audit Trail**: Complete transaction history
- **Extensible**: Easy to add new features or tiers

## 📊 Credit Costs

| Operation | Credits |
|-----------|---------|
| Data Analysis (Generate Charts) | 5 |
| Edit Chart | 2 |
| Execute Code (Plotly/Analysis) | 2 |

## 🔧 Administration

### View All Plans

```bash
python -m app.scripts.init_plans
```

### Update Plan Credits

```python
from app.services.plan_service import plan_service
from app.db import SessionLocal

db = SessionLocal()
plan_service.update_plan(db, plan_id=2, credits_per_month=600)
db.close()
```

### Manually Adjust User Credits

```python
from app.services.credit_service import credit_service
from app.db import SessionLocal

db = SessionLocal()
credit_service.add_credits(
    db, user_id=123, amount=100, 
    description="Compensation"
)
db.close()
```

## 🐛 Troubleshooting

### Plans Not Created

```bash
python -m app.scripts.init_plans --create-tables
```

### Webhooks Not Working

1. Check Stripe CLI is running
2. Verify webhook secret in `.env`
3. Check logs for errors
4. Test with: `stripe trigger checkout.session.completed`

### Credits Not Deducting

1. Check user has credits: `GET /api/credits/balance`
2. Verify endpoint has `require_credits` dependency
3. Check logs for credit deduction messages

### New Users Not Getting Free Tier

1. Verify `AUTO_MIGRATE=1` in `.env`
2. Check plans exist in database
3. Check `oauth_google.py` logs for errors

## 📚 Documentation

- **[STRIPE_SETUP.md](STRIPE_SETUP.md)** - Complete Stripe setup guide
- **[SUBSCRIPTION_SYSTEM.md](SUBSCRIPTION_SYSTEM.md)** - Full system documentation
- **Stripe Docs** - https://stripe.com/docs

## 🚢 Going to Production

1. Switch Stripe to live mode
2. Create live products and prices
3. Update `.env` with live keys
4. Set up production webhook endpoint
5. Test thoroughly with real cards
6. Monitor webhook delivery
7. Set up error alerting

## ✅ Success Checklist

- [ ] Stripe account created
- [ ] 3 products created in Stripe
- [ ] Environment variables configured
- [ ] Server starts without errors
- [ ] Plans visible at `/api/plans`
- [ ] New user gets Free tier
- [ ] Credits deduct on operations
- [ ] Webhooks are received (test mode)
- [ ] Checkout flow works
- [ ] Monthly reset working (via webhook)

## 🎉 You're All Set!

The subscription system is ready to use. Users can:
- Sign up and get 25 free credits
- Use credits for analysis and editing
- Upgrade to Pro/Ultra for more credits
- Track their usage history
- Enjoy automatic monthly renewals

## 💡 Next Steps

1. Customize plan features in `plan_service.py`
2. Add feature checks to your frontend
3. Create pricing page UI
4. Set up email notifications
5. Add usage analytics
6. Consider annual billing options

## 🆘 Need Help?

- Check application logs
- Review Stripe Dashboard events
- Verify environment variables
- Test with Stripe CLI
- Review documentation files

---

**Built with ❤️ for AutoDash**

