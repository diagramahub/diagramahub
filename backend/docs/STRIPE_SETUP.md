# Stripe Configuration Guide

This guide explains how to configure Stripe for the DiagramaHub subscription system.

## Prerequisites

- A Stripe account (sign up at https://stripe.com)
- Access to the Stripe Dashboard

## Step 1: Get API Keys

1. Log in to your Stripe Dashboard: https://dashboard.stripe.com
2. Navigate to **Developers** → **API keys**
3. You'll see two types of keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

### Test Mode vs Live Mode

- **Test mode** keys (prefix `_test_`): Use for development and testing
  - No real charges are made
  - Use test card numbers (see below)
- **Live mode** keys (prefix `_live_`): Use for production
  - Real charges are made
  - Requires account verification

### Add Keys to Environment

Add the keys to your `.env` file:

```bash
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

## Step 2: Configure Webhooks

Webhooks allow Stripe to notify your application about payment events.

### Create Webhook Endpoint

1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Enter your endpoint URL:
   - Development: `http://localhost:8000/api/v1/webhooks/stripe`
   - Production: `https://your-domain.com/api/v1/webhooks/stripe`

### Select Events

Select the following events to listen for:

- ✅ `checkout.session.completed` - Payment successful
- ✅ `customer.subscription.updated` - Subscription status changed
- ✅ `customer.subscription.deleted` - Subscription cancelled
- ✅ `invoice.payment_failed` - Payment failed

### Get Webhook Secret

1. After creating the endpoint, click on it
2. Click **Reveal** next to "Signing secret"
3. Copy the secret (starts with `whsec_`)
4. Add to your `.env` file:

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Step 3: Test Configuration

### Using Test Cards

Stripe provides test card numbers for testing:

| Card Number         | Description                    |
|---------------------|--------------------------------|
| 4242 4242 4242 4242 | Successful payment             |
| 4000 0000 0000 0002 | Card declined                  |
| 4000 0000 0000 9995 | Insufficient funds             |
| 4000 0025 0000 3155 | Requires authentication (3D Secure) |

- Use any future expiration date (e.g., 12/34)
- Use any 3-digit CVC (e.g., 123)
- Use any ZIP code (e.g., 12345)

### Test Webhook Locally

For local development, use Stripe CLI to forward webhooks:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks:
   ```bash
   stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe
   ```
4. The CLI will display a webhook signing secret - use this in your `.env`

### Verify Setup

1. Start your backend server
2. Create a test plan in the admin panel
3. Try to subscribe to the plan
4. Complete checkout with a test card
5. Check that:
   - Subscription is activated
   - Webhook events are logged
   - User has access to plan features

## Step 4: Production Deployment

### Switch to Live Mode

1. Get your **live** API keys from Stripe Dashboard
2. Update `.env` with live keys:
   ```bash
   STRIPE_SECRET_KEY=sk_live_your_live_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
   ```

### Configure Production Webhook

1. Create a new webhook endpoint with your production URL
2. Select the same events as before
3. Update `.env` with the new webhook secret

### Important Security Notes

- ⚠️ **Never commit** API keys to version control
- ⚠️ Keep secret keys **secure** and **private**
- ⚠️ Use environment variables for all sensitive data
- ⚠️ Rotate keys if they are ever exposed

## Troubleshooting

### Webhook Not Receiving Events

1. Check that webhook URL is publicly accessible
2. Verify webhook secret is correct
3. Check Stripe Dashboard → Webhooks → Recent events for errors
4. Ensure your server is running and endpoint is active

### Payment Not Completing

1. Check Stripe Dashboard → Payments for payment status
2. Verify test card number is correct
3. Check backend logs for errors
4. Ensure webhook events are being processed

### Subscription Not Activating

1. Check that `checkout.session.completed` webhook is configured
2. Verify webhook handler is processing events correctly
3. Check database for subscription records
4. Review backend logs for errors

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

## Support

For issues with Stripe integration:
1. Check Stripe Dashboard for error details
2. Review backend logs
3. Consult Stripe documentation
4. Contact Stripe support if needed
