# 💳 AutoDash Subscription System

> A complete, production-ready Stripe subscription system with flexible database-driven plans and credit management.

## 🌟 Features

- ✅ **3 Subscription Tiers** - Free ($0), Pro ($20), Ultra (custom)
- ✅ **Credit-Based Usage** - Pay per operation (analyze, edit, execute)
- ✅ **Database-Driven** - Modify plans without code changes
- ✅ **Stripe Integration** - Full webhook support
- ✅ **Auto-Assignment** - Free tier for new users
- ✅ **Monthly Resets** - Credits refresh on renewal
- ✅ **Audit Trail** - Complete transaction history
- ✅ **Flexible Features** - JSON-based feature system

## 📦 What's Included

```
✅ Database Models - SubscriptionPlan, UserCredits, CreditTransaction
✅ Service Layer - Credit, Plan, and Subscription services
✅ API Routes - Credits, Plans, Payment endpoints
✅ Middleware - Credit check protection
✅ Webhooks - 5 Stripe events handled
✅ Admin Tools - Initialization scripts
✅ Documentation - Complete setup guides
```

## ⚡ Quick Start

### 1. Install

```bash
pip install stripe
# (Already in requirements.txt)
```

### 2. Configure

Add to `backend/.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_FREE_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ULTRA_PRICE_ID=price_...
```

### 3. Start

```bash
uvicorn app.main:app --reload
```

Plans initialize automatically! 🎉

## 📊 Pricing Tiers

| Tier | Price | Credits/Month | Analyze | Edit | Auto-Assigned |
|------|-------|---------------|---------|------|---------------|
| **Free** | $0 | 25 | 5 | 2 | ✅ Yes |
| **Pro** | $20 | 500 | 5 | 2 | ❌ No |
| **Ultra** | Custom | 1000 | 5 | 2 | ❌ No |

## 🔧 API Endpoints

### Plans
- `GET /api/plans` - List all plans
- `GET /api/plans/{id}` - Get plan details

### Credits
- `GET /api/credits/balance` - Current balance
- `GET /api/credits/history` - Transaction history

### Payment
- `POST /api/payment/create-checkout-session` - Start checkout
- `POST /api/payment/cancel-subscription` - Cancel at period end
- `GET /api/payment/subscription-status` - Get status
- `POST /api/payment/webhook` - Stripe webhooks

## 🛡️ Protected Endpoints

```python
from app.middleware.credit_check import require_credits

@router.post("/analyze")
async def analyze(
    credits: CreditCheckResult = Depends(require_credits(5)),
    db: Session = Depends(get_db)
):
    # Operation executes
    
    # Deduct credits after success
    credit_service.deduct_credits(db, credits.user.id, 5, "Analysis")
    
    return result
```

### Credit Costs

| Endpoint | Cost | Description |
|----------|------|-------------|
| `POST /api/data/analyze` | 5 | Generate visualizations |
| `POST /api/data/edit-chart` | 2 | Edit existing charts |
| `POST /api/data/execute-code` | 2 | Execute code |

## 🔄 How It Works

### New User Flow
1. User signs in via OAuth
2. System creates user account
3. **Automatically assigns Free tier** ✅
4. User receives 25 credits
5. Ready to use immediately

### Credit Usage Flow
1. User requests operation (e.g., analyze)
2. System **checks credits first** ✅
3. Operation executes
4. System **deducts credits after success** ✅
5. Transaction logged

### Upgrade Flow
1. User clicks "Upgrade to Pro"
2. Redirected to Stripe Checkout
3. Completes payment
4. Webhook processes event
5. Subscription updated
6. Credits reset to 500

### Monthly Renewal Flow
1. Stripe charges card
2. `invoice.payment_succeeded` webhook
3. System **resets credits to plan limit** ✅
4. Transaction logged
5. User continues with full credits

## 🎨 Flexibility

### Change Credits Anytime

```python
plan_service.update_plan(
    db, 
    plan_id=2,
    credits_per_month=600  # Changed from 500
)
```

### Change Costs Anytime

```python
plan_service.update_plan(
    db,
    plan_id=1,
    credits_per_analyze=3,  # Changed from 5
    credits_per_edit=1      # Changed from 2
)
```

### Add Features Anytime

```python
plan_service.update_plan(
    db,
    plan_id=3,
    features={
        "ai_assistant": True,
        "custom_branding": True,
        "api_access": True
    }
)
```

**No code changes or deployments needed!** ✨

## 📚 Documentation

| File | Description |
|------|-------------|
| [QUICKSTART.md](QUICKSTART.md) | 5-minute setup guide |
| [STRIPE_SETUP.md](STRIPE_SETUP.md) | Complete Stripe configuration |
| [SUBSCRIPTION_SYSTEM.md](SUBSCRIPTION_SYSTEM.md) | Full system documentation |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Implementation details |

## 🧪 Testing

### Test Cards (Stripe Test Mode)

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 9995
```

### Test Webhooks

```bash
stripe listen --forward-to localhost:3001/api/payment/webhook
stripe trigger checkout.session.completed
```

## 📈 Admin Operations

### Initialize Plans

```bash
python -m app.scripts.init_plans --create-tables
```

### View Credit History

```python
from app.services.credit_service import credit_service

transactions = credit_service.get_credit_history(db, user_id, limit=100)
```

### Manual Credit Adjustment

```python
credit_service.add_credits(
    db, user_id, 50, 
    "Compensation for downtime"
)
```

## 🔐 Security

✅ Webhook signature verification  
✅ JWT authentication on routes  
✅ Credit pre-checks before operations  
✅ Audit trail for all transactions  
✅ Environment variable protection  

## 🚀 Production Checklist

- [ ] Create Stripe products in **live mode**
- [ ] Update `.env` with **live keys**
- [ ] Set up production webhook endpoint
- [ ] Test with real payment methods
- [ ] Monitor webhook delivery
- [ ] Set up error alerting
- [ ] Review audit logs

## 🎯 Stripe Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription, assign plan |
| `customer.subscription.updated` | Update subscription details |
| `customer.subscription.deleted` | Downgrade to Free tier |
| `invoice.payment_succeeded` | Reset credits monthly |
| `invoice.payment_failed` | Mark as past_due |

## 💡 Use Cases

### End Users
- Start with free credits
- Upgrade when needed
- Track usage history
- Automatic monthly renewals
- Cancel anytime

### Admins
- Modify plans dynamically
- Adjust credit costs
- Add/remove features
- Manual adjustments
- Complete audit trail

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React/Vue)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐      ┌──────────────┐
│   FastAPI       │←────→│   Stripe     │
│   Backend       │      │   API        │
└────────┬────────┘      └──────────────┘
         │
         ↓
┌─────────────────┐
│   Database      │
│   (PostgreSQL)  │
└─────────────────┘
```

## 🌐 Environment Variables

```env
# Required
STRIPE_SECRET_KEY=sk_test_or_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_FREE_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ULTRA_PRICE_ID=price_...
FRONTEND_URL=https://your-domain.com

# Optional
STRIPE_FREE_PRODUCT_ID=prod_...
STRIPE_PRO_PRODUCT_ID=prod_...
STRIPE_ULTRA_PRODUCT_ID=prod_...
AUTO_MIGRATE=1
```

## 🐛 Troubleshooting

### Plans not showing?
```bash
python -m app.scripts.init_plans
```

### Webhooks not working?
```bash
stripe listen --forward-to localhost:3001/api/payment/webhook
```

### Credits not deducting?
Check logs for `credit_service.deduct_credits` calls.

### New users not getting Free tier?
Verify `AUTO_MIGRATE=1` and check `oauth_google.py` logs.

## 📞 Support

- **Logs**: Check application logs for errors
- **Stripe Dashboard**: View webhook deliveries
- **Documentation**: Comprehensive guides included
- **Stripe Docs**: https://stripe.com/docs

## ✅ Status

**Implementation**: ✅ Complete  
**Testing**: ✅ Ready  
**Production**: ✅ Ready  
**Documentation**: ✅ Complete  

## 🎉 You're Ready!

Everything is set up and ready to go. Follow the [QUICKSTART.md](QUICKSTART.md) guide to get running in 5 minutes!

---

**Built with ❤️ for AutoDash**  
**Version**: 1.0.0  
**License**: MIT

