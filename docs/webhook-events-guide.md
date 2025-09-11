# Stripe Webhook Events Configuration Guide

## Required Events for Your WNBA Stats App

### **Currently Handled Events:**
1. **`checkout.session.completed`** - ✅ Already implemented
2. **`invoice.paid`** - ✅ Already implemented

### **Recommended Additional Events:**

#### **Subscription Management:**
3. **`customer.subscription.created`** - New subscription created
4. **`customer.subscription.updated`** - Subscription modified
5. **`customer.subscription.deleted`** - Subscription cancelled
6. **`customer.subscription.trial_will_end`** - Trial ending soon

#### **Payment Issues:**
7. **`invoice.payment_failed`** - Payment failed
8. **`invoice.payment_action_required`** - Action required

#### **Customer Management:**
9. **`customer.created`** - New customer
10. **`customer.updated`** - Customer updated

## How to Configure in Stripe Dashboard:

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set URL: `https://yourdomain.com/api/stripe/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `customer.created`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

## Enhanced Webhook Handler (Optional)

You could enhance your webhook handler to handle more events:

```typescript
// Enhanced webhook handler example
switch (event.type) {
  case 'checkout.session.completed':
  case 'invoice.paid':
    // Your existing logic
    break;
    
  case 'customer.subscription.created':
    // Handle new subscription
    break;
    
  case 'customer.subscription.updated':
    // Handle subscription changes
    break;
    
  case 'customer.subscription.deleted':
    // Handle subscription cancellation
    break;
    
  case 'invoice.payment_failed':
    // Handle failed payments
    break;
    
  default:
    console.log(`Unhandled event type: ${event.type}`);
}
```

## Environment Variables Needed:

Add to your `.env.local`:
```
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
``` 