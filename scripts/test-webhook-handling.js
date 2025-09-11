#!/usr/bin/env node

/**
 * Stripe Webhook Testing Script
 * Tests webhook handling for subscription events
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const fetch = require('node-fetch');
const crypto = require('crypto');

class WebhookTester {
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';
  }

  generateWebhookSignature(payload, secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    
    return `t=${timestamp},v1=${signature}`;
  }

  async testWebhookEvent(eventType, payload) {
    console.log(`\n🔔 Testing ${eventType} webhook...`);
    
    try {
      const signature = this.generateWebhookSignature(payload, this.webhookSecret);
      
      const response = await fetch(`${this.baseUrl}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature
        },
        body: payload
      });

      const responseText = await response.text();
      
      if (response.ok) {
        console.log(`✅ ${eventType} webhook handled successfully`);
        console.log(`   Response: ${responseText}`);
        return true;
      } else {
        console.log(`❌ ${eventType} webhook failed`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${responseText}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ ${eventType} webhook error: ${error.message}`);
      return false;
    }
  }

  generateCheckoutSessionCompletedPayload() {
    return JSON.stringify({
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2020-08-27',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'cs_test_checkout_session',
          object: 'checkout.session',
          amount_total: 999,
          currency: 'usd',
          customer: 'cus_test_customer',
          customer_email: 'test@example.com',
          mode: 'subscription',
          payment_status: 'paid',
          status: 'complete',
          subscription: 'sub_test_subscription',
          metadata: {
            userEmail: 'test@example.com',
            plan: 'monthly'
          }
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_request',
        idempotency_key: null
      },
      type: 'checkout.session.completed'
    });
  }

  generateSubscriptionUpdatedPayload() {
    return JSON.stringify({
      id: 'evt_test_webhook_2',
      object: 'event',
      api_version: '2020-08-27',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'sub_test_subscription',
          object: 'subscription',
          customer: 'cus_test_customer',
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
          items: {
            data: [{
              id: 'si_test_subscription_item',
              object: 'subscription_item',
              price: {
                id: 'price_test_monthly',
                object: 'price',
                amount: 999,
                currency: 'usd',
                recurring: {
                  interval: 'month'
                }
              }
            }]
          }
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_request_2',
        idempotency_key: null
      },
      type: 'customer.subscription.updated'
    });
  }

  generateSubscriptionDeletedPayload() {
    return JSON.stringify({
      id: 'evt_test_webhook_3',
      object: 'event',
      api_version: '2020-08-27',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'sub_test_subscription',
          object: 'subscription',
          customer: 'cus_test_customer',
          status: 'canceled',
          canceled_at: Math.floor(Date.now() / 1000)
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_request_3',
        idempotency_key: null
      },
      type: 'customer.subscription.deleted'
    });
  }

  async testAllWebhooks() {
    console.log('🔔 Testing Stripe Webhook Handling\n');
    console.log('=' .repeat(50));

    const results = [];

    // Test checkout.session.completed
    const checkoutPayload = this.generateCheckoutSessionCompletedPayload();
    const checkoutResult = await this.testWebhookEvent('checkout.session.completed', checkoutPayload);
    results.push({ event: 'checkout.session.completed', success: checkoutResult });

    // Test customer.subscription.updated
    const subscriptionUpdatedPayload = this.generateSubscriptionUpdatedPayload();
    const subscriptionUpdatedResult = await this.testWebhookEvent('customer.subscription.updated', subscriptionUpdatedPayload);
    results.push({ event: 'customer.subscription.updated', success: subscriptionUpdatedResult });

    // Test customer.subscription.deleted
    const subscriptionDeletedPayload = this.generateSubscriptionDeletedPayload();
    const subscriptionDeletedResult = await this.testWebhookEvent('customer.subscription.deleted', subscriptionDeletedPayload);
    results.push({ event: 'customer.subscription.deleted', success: subscriptionDeletedResult });

    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 WEBHOOK TEST SUMMARY');
    console.log('=' .repeat(50));

    const passed = results.filter(r => r.success).length;
    const total = results.length;
    const successRate = ((passed / total) * 100).toFixed(1);

    console.log(`\n✅ Passed: ${passed}/${total} (${successRate}%)`);
    
    results.forEach(result => {
      const emoji = result.success ? '✅' : '❌';
      console.log(`   ${emoji} ${result.event}`);
    });

    if (successRate === '100.0') {
      console.log('\n🎉 All webhook tests passed!');
      console.log('   Your webhook handling is ready for production.');
    } else {
      console.log('\n🔧 Some webhook tests failed.');
      console.log('   Please check your webhook endpoint implementation.');
    }

    console.log('\n💡 Webhook Setup Tips:');
    console.log('   • Make sure your webhook endpoint is accessible from the internet');
    console.log('   • Use ngrok or similar for local testing: ngrok http 3000');
    console.log('   • Configure webhooks in Stripe Dashboard > Webhooks');
    console.log('   • Test with real events using Stripe CLI: stripe listen --forward-to localhost:3000/api/stripe/webhook');
  }
}

// Run the webhook tests
if (require.main === module) {
  const tester = new WebhookTester();
  tester.testAllWebhooks().catch(console.error);
}

module.exports = WebhookTester;
