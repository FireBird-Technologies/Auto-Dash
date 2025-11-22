# Stripe Subscription System Setup Guide

This guide will help you set up Stripe for the AutoDash subscription system.

## Overview

The AutoDash subscription system includes three tiers:
- **Free Tier**: $0/month, 25 credits
- **Pro Tier**: $20/month, 500 credits
- **Ultra Tier**: Custom pricing, 1000 credits

## Prerequisites

- A Stripe account (create one at https://stripe.com)
- Stripe CLI for webhook testing (optional but recommended)

## Step 1: Create Products and Prices in Stripe

### 1.1 Log in to Stripe Dashboard

Go to https://dashboard.stripe.com and log in to your account.

### 1.2 Create Products

Navigate to **Products** → **Add Product** and create three products:

#### Free Tier
- **Name**: AutoDash Free
- **Description**: Free tier with 25 credits per month
- **Pricing**:
  - Price: $0.00
  - Billing period: Monthly
  - Note: This is for tracking only, users won't be charged

#### Pro Tier
- **Name**: AutoDash Pro
- **Description**: Professional tier with 500 credits per month
- **Pricing**:
  - Price: $20.00
  - Billing period: Monthly (recurring)

#### Ultra Tier
- **Name**: AutoDash Ultra
- **Description**: Ultra tier with 1000 credits per month
- **Pricing**:
  - Price: $29.99 (or your preferred amount)
  - Billing period: Monthly (recurring)

### 1.3 Get Price IDs

After creating each product, Stripe will assign a **Price ID** to each. They look like:
- `price_1234567890abcdef` (this is an example)

Copy these Price IDs - you'll need them for the environment variables.

### 1.4 Get Product IDs (Optional)

You can also copy the **Product IDs** if you want to store them. They look like:
- `prod_1234567890abcdef`

## Step 2: Get API Keys

### 2.1 Get Secret Key

1. Navigate to **Developers** → **API Keys**
2. Copy your **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for live mode)
3. Keep this key secure - never commit it to version control!

### 2.2 Get Webhook Secret

1. Navigate to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://your-domain.com/api/payment/webhook`
   - For local testing, you can use the Stripe CLI (see Step 3)
4. Select the following events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. After creating the endpoint, click to view it and copy the **Signing secret** (starts with `whsec_`)

## Step 3: Configure Environment Variables

Create or update your `backend/.env` file with the following variables:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price IDs
STRIPE_FREE_PRICE_ID=price_free_tier_id
STRIPE_PRO_PRICE_ID=price_pro_tier_id
STRIPE_ULTRA_PRICE_ID=price_ultra_tier_id

# Stripe Product IDs (optional)
STRIPE_FREE_PRODUCT_ID=prod_free_tier_id
STRIPE_PRO_PRODUCT_ID=prod_pro_tier_id
STRIPE_ULTRA_PRODUCT_ID=prod_ultra_tier_id

# Frontend URL for redirects
FRONTEND_URL=http://localhost:5173
```

### Example format (replace with your actual values from Stripe Dashboard):

```env
STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_SECRET_KEY_FROM_STRIPE_DASHBOARD
STRIPE_WEBHOOK_SECRET=whsec_YOUR_ACTUAL_WEBHOOK_SECRET_FROM_STRIPE_DASHBOARD

STRIPE_FREE_PRICE_ID=price_YOUR_FREE_PRICE_ID
STRIPE_PRO_PRICE_ID=price_YOUR_PRO_PRICE_ID
STRIPE_ULTRA_PRICE_ID=price_YOUR_ULTRA_PRICE_ID

FRONTEND_URL=http://localhost:5173
```

## Step 4: Initialize Database and Plans

### 4.1 Automatic Initialization (Recommended)

The application will automatically create database tables and initialize plans on startup if `AUTO_MIGRATE=1` in your `.env` file.

Just start your backend server:

```bash
cd backend
uvicorn app.main:app --reload
```

### 4.2 Manual Initialization

You can also manually initialize plans using the provided script:

```bash
cd backend
python -m app.scripts.init_plans --create-tables
```

Options:
- `--create-tables`: Create database tables if they don't exist
- `--force`: Force update of existing plans with new values

## Step 5: Test with Stripe CLI (Local Development)

For local testing, use the Stripe CLI to forward webhook events:

### 5.1 Install Stripe CLI

Follow instructions at: https://stripe.com/docs/stripe-cli

### 5.2 Login to Stripe CLI

```bash
stripe login
```

### 5.3 Forward Webhooks to Local Server

```bash
stripe listen --forward-to localhost:3001/api/payment/webhook
```

This will give you a webhook signing secret (starts with `whsec_`). Use this in your `.env` file for local testing.

### 5.4 Test a Payment

```bash
stripe trigger checkout.session.completed
```

## Step 6: Verify Setup

### 6.1 Check Plans Endpoint

Visit: `http://localhost:3001/api/plans`

You should see all three plans with their configurations.

### 6.2 Check Credit Balance (Authenticated)

Create a test user by logging in via Google OAuth, then check:

`GET http://localhost:3001/api/credits/balance`

Headers:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### 6.3 Test Checkout Flow

1. Log in to your application
2. Navigate to the subscription/pricing page
3. Click on a plan (Pro or Ultra)
4. Complete the checkout using Stripe's test card: `4242 4242 4242 4242`
   - Use any future expiration date
   - Use any 3-digit CVC
   - Use any ZIP code

## Step 7: Go Live

When ready to go live:

1. Switch to **Live mode** in Stripe Dashboard
2. Create new products and prices in live mode
3. Get new live API keys (`sk_live_...`)
4. Create a new webhook endpoint for your production URL
5. Update your production `.env` with live keys
6. Test thoroughly before announcing!

## Troubleshooting

### Webhook Events Not Received

1. Check that your webhook endpoint is accessible from the internet
2. Verify the webhook signing secret in your `.env` file
3. Check Stripe Dashboard → Webhooks → Your endpoint for delivery logs
4. For local testing, ensure Stripe CLI is running

### Credits Not Resetting

- Check webhook logs for `invoice.payment_succeeded` events
- Verify the event is being handled correctly in logs
- Check credit transaction history via `/api/credits/history`

### Plans Not Showing

- Run the initialization script: `python -m app.scripts.init_plans`
- Check database for subscription_plans table
- Verify AUTO_MIGRATE is enabled

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signing secret | `whsec_...` |
| `STRIPE_FREE_PRICE_ID` | Yes | Price ID for Free tier | `price_...` |
| `STRIPE_PRO_PRICE_ID` | Yes | Price ID for Pro tier | `price_...` |
| `STRIPE_ULTRA_PRICE_ID` | Yes | Price ID for Ultra tier | `price_...` |
| `STRIPE_FREE_PRODUCT_ID` | No | Product ID for Free tier | `prod_...` |
| `STRIPE_PRO_PRODUCT_ID` | No | Product ID for Pro tier | `prod_...` |
| `STRIPE_ULTRA_PRODUCT_ID` | No | Product ID for Ultra tier | `prod_...` |
| `FRONTEND_URL` | Yes | Frontend URL for redirects | `http://localhost:5173` |
| `AUTO_MIGRATE` | No | Auto-create DB tables on startup | `1` (default) |

## Support

For issues or questions:
1. Check Stripe Dashboard logs
2. Check application logs
3. Review webhook event details in Stripe Dashboard
4. Consult Stripe documentation: https://stripe.com/docs

## Security Notes

⚠️ **Important Security Reminders:**

- Never commit API keys to version control
- Use environment variables for all sensitive data
- Always verify webhook signatures
- Use HTTPS in production
- Rotate keys if compromised
- Use different keys for test/live environments
- Implement rate limiting on payment endpoints
- Monitor webhook delivery for anomalies

