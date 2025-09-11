# Stripe Testing Guide

This guide helps you thoroughly test your Stripe integration before going live with your WNBA stats app.

## 🚀 Quick Start

Run the complete test suite:
```bash
npm run test:stripe
```

Or run individual tests:
```bash
npm run test:stripe:setup      # Environment setup
npm run test:stripe:integration # Core integration tests
npm run test:stripe:webhooks   # Webhook handling tests
```

## 📋 Prerequisites

1. **Stripe Account**: Sign up at [stripe.com](https://stripe.com)
2. **Test Keys**: Get your test API keys from [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
3. **Environment File**: Create `.env.local` with your credentials
4. **Test Products**: Create test products in Stripe Dashboard

## 🔧 Environment Setup

### 1. Create `.env.local`

```bash
# Stripe Configuration (Test Mode)
STRIPE_SECRET_KEY=sk_test_your_test_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key_here

# Application URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Optional: Webhook Configuration
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 2. Create Test Products

1. Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/test/products)
2. Create a **Monthly Subscription** product:
   - Name: "WNBA Stats Pro Monthly"
   - Price: $9.99/month
   - Copy the price ID (starts with `price_`)
3. Create a **Lifetime** product:
   - Name: "WNBA Stats Pro Lifetime"
   - Price: $99.99 one-time
   - Copy the price ID (starts with `price_`)

### 3. Update Price IDs

Update the price IDs in `app/api/stripe/checkout/route.ts`:

```typescript
const PRICE_IDS = {
  monthly: 'price_your_monthly_price_id_here',
  lifetime: 'price_your_lifetime_price_id_here',
};
```

## 🧪 Testing Process

### Phase 1: Automated Tests

Run the test suite to validate your setup:

```bash
npm run test:stripe
```

This will test:
- ✅ Environment variables
- ✅ User registration and login
- ✅ Database integration
- ✅ Checkout session creation
- ✅ Billing portal access
- ✅ Webhook handling

### Phase 2: Manual Testing

#### Test Cards

Use these Stripe test cards:

| Card Number | Description | Expected Result |
|-------------|-------------|-----------------|
| `4242424242424242` | Visa | Success |
| `4000000000000002` | Visa | Declined |
| `4000000000009995` | Visa | Insufficient funds |
| `4000000000000069` | Visa | Expired card |
| `4000000000000119` | Visa | Processing error |

**Test Details:**
- CVC: `123`
- Expiry: `12/2025`
- ZIP: `12345`

#### Manual Test Checklist

1. **User Registration & Login**
   - [ ] Register new user
   - [ ] Login with credentials
   - [ ] Verify user appears in database

2. **Monthly Plan Testing**
   - [ ] Select monthly plan
   - [ ] Complete checkout with success card
   - [ ] Verify subscription created in Stripe
   - [ ] Verify user plan updated in database
   - [ ] Test billing portal access

3. **Lifetime Plan Testing**
   - [ ] Select lifetime plan
   - [ ] Complete checkout with success card
   - [ ] Verify one-time payment processed
   - [ ] Verify user plan updated in database

4. **Error Handling**
   - [ ] Test declined card scenario
   - [ ] Test insufficient funds scenario
   - [ ] Test expired card scenario
   - [ ] Verify proper error messages shown

5. **Billing Portal**
   - [ ] Access billing portal
   - [ ] View subscription details
   - [ ] Test subscription cancellation
   - [ ] Test payment method updates

## 🔔 Webhook Testing

### Local Testing with Stripe CLI

1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Windows
   # Download from https://github.com/stripe/stripe-cli/releases
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. Test webhook events:
   ```bash
   stripe trigger checkout.session.completed
   stripe trigger customer.subscription.updated
   stripe trigger customer.subscription.deleted
   ```

### Production Webhook Setup

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook secret to `.env.local`

## 🚀 Going Live

### 1. Switch to Live Mode

1. Get live API keys from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Create live products and copy price IDs
3. Update `.env.local` with live keys
4. Update price IDs in checkout route
5. Configure live webhook endpoints

### 2. Final Validation

- [ ] Test with real (small) amounts
- [ ] Verify live webhook events
- [ ] Test customer support scenarios
- [ ] Monitor Stripe Dashboard for issues

## 🛠️ Troubleshooting

### Common Issues

**"Stripe secret key not configured"**
- Check `.env.local` file exists
- Verify `STRIPE_SECRET_KEY` is set
- Restart your development server

**"Invalid price ID"**
- Verify price IDs in Stripe Dashboard
- Check price IDs match test/live mode
- Ensure products are active

**"Webhook signature verification failed"**
- Check webhook secret in `.env.local`
- Verify webhook endpoint URL
- Test with Stripe CLI first

**"User not found"**
- Check Supabase connection
- Verify user exists in database
- Check authentication flow

### Debug Mode

Enable debug logging by adding to `.env.local`:
```
STRIPE_DEBUG=true
```

## 📞 Support

- **Stripe Documentation**: [stripe.com/docs](https://stripe.com/docs)
- **Stripe Support**: [support.stripe.com](https://support.stripe.com)
- **Test Cards**: [stripe.com/docs/testing](https://stripe.com/docs/testing)

## 🎯 Success Criteria

Your Stripe integration is ready for production when:

- [ ] All automated tests pass
- [ ] Manual testing with test cards successful
- [ ] Webhook events properly handled
- [ ] Error scenarios gracefully handled
- [ ] Database updates working correctly
- [ ] Billing portal fully functional

Once all criteria are met, you can confidently switch to live mode and start accepting real payments! 🎉
