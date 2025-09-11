#!/usr/bin/env node

/**
 * Stripe Test Environment Setup Script
 * Helps configure test environment variables and validates Stripe setup
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');

class StripeTestEnvSetup {
  constructor() {
    this.envPath = path.join(process.cwd(), '.env.local');
    this.requiredVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_BASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL'
    ];
  }

  async checkExistingEnv() {
    console.log('🔍 Checking existing environment configuration...\n');
    
    if (fs.existsSync(this.envPath)) {
      console.log('✅ .env.local file found');
      const envContent = fs.readFileSync(this.envPath, 'utf8');
      
      const missingVars = [];
      const presentVars = [];
      
      for (const varName of this.requiredVars) {
        if (envContent.includes(`${varName}=`)) {
          presentVars.push(varName);
        } else {
          missingVars.push(varName);
        }
      }
      
      console.log(`\n📊 Environment Variables Status:`);
      console.log(`   ✅ Present: ${presentVars.length}/${this.requiredVars.length}`);
      console.log(`   ❌ Missing: ${missingVars.length}/${this.requiredVars.length}`);
      
      if (presentVars.length > 0) {
        console.log('\n✅ Present variables:');
        presentVars.forEach(varName => console.log(`   • ${varName}`));
      }
      
      if (missingVars.length > 0) {
        console.log('\n❌ Missing variables:');
        missingVars.forEach(varName => console.log(`   • ${varName}`));
      }
      
      return { presentVars, missingVars, envContent };
    } else {
      console.log('❌ .env.local file not found');
      return { presentVars: [], missingVars: this.requiredVars, envContent: '' };
    }
  }

  generateEnvTemplate() {
    return `# Stripe Configuration (Test Mode)
# Get these from your Stripe Dashboard > Developers > API Keys
STRIPE_SECRET_KEY=sk_test_your_test_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key_here

# Application URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Database Configuration
DATABASE_URL=your_database_url_here

# Optional: Webhook Configuration
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
`;
  }

  async createEnvFile() {
    console.log('\n📝 Creating .env.local template...');
    
    const template = this.generateEnvTemplate();
    fs.writeFileSync(this.envPath, template);
    
    console.log('✅ .env.local template created');
    console.log('📋 Please update the values with your actual credentials');
  }

  async validateStripeKeys(envContent) {
    console.log('\n🔑 Validating Stripe key format...');
    
    const stripeSecretMatch = envContent.match(/STRIPE_SECRET_KEY=(sk_test_[a-zA-Z0-9]+)/);
    const stripePublishableMatch = envContent.match(/STRIPE_PUBLISHABLE_KEY=(pk_test_[a-zA-Z0-9]+)/);
    
    if (stripeSecretMatch) {
      console.log('✅ Stripe Secret Key format looks correct (test mode)');
    } else {
      console.log('❌ Stripe Secret Key format incorrect or missing');
      console.log('   Expected format: sk_test_...');
    }
    
    if (stripePublishableMatch) {
      console.log('✅ Stripe Publishable Key format looks correct (test mode)');
    } else {
      console.log('❌ Stripe Publishable Key format incorrect or missing');
      console.log('   Expected format: pk_test_...');
    }
    
    return {
      secretKeyValid: !!stripeSecretMatch,
      publishableKeyValid: !!stripePublishableMatch
    };
  }

  async checkStripeProducts() {
    console.log('\n🛍️ Checking Stripe Products Configuration...');
    
    // Read the checkout route to get price IDs
    const checkoutPath = path.join(process.cwd(), 'app/api/stripe/checkout/route.ts');
    
    if (fs.existsSync(checkoutPath)) {
      const checkoutContent = fs.readFileSync(checkoutPath, 'utf8');
      const priceIdsMatch = checkoutContent.match(/PRICE_IDS = \{[\s\S]*?monthly: '([^']+)',[\s\S]*?lifetime: '([^']+)'/);
      
      if (priceIdsMatch) {
        const [, monthlyPriceId, lifetimePriceId] = priceIdsMatch;
        console.log('✅ Price IDs found in checkout route:');
        console.log(`   • Monthly: ${monthlyPriceId}`);
        console.log(`   • Lifetime: ${lifetimePriceId}`);
        
        // Check if they're test price IDs
        if (monthlyPriceId.startsWith('price_') && lifetimePriceId.startsWith('price_')) {
          console.log('✅ Price IDs appear to be in correct format');
        } else {
          console.log('❌ Price IDs format may be incorrect');
        }
        
        return { monthlyPriceId, lifetimePriceId };
      } else {
        console.log('❌ Could not find price IDs in checkout route');
        return null;
      }
    } else {
      console.log('❌ Checkout route file not found');
      return null;
    }
  }

  async generateTestInstructions() {
    console.log('\n📚 Test Mode Setup Instructions:');
    console.log('=' .repeat(50));
    
    console.log('\n1. 🔑 Get Stripe Test Keys:');
    console.log('   • Go to https://dashboard.stripe.com/test/apikeys');
    console.log('   • Copy your "Publishable key" (starts with pk_test_)');
    console.log('   • Copy your "Secret key" (starts with sk_test_)');
    console.log('   • Add them to your .env.local file');
    
    console.log('\n2. 🛍️ Create Test Products:');
    console.log('   • Go to https://dashboard.stripe.com/test/products');
    console.log('   • Create a monthly subscription product');
    console.log('   • Create a one-time payment product for lifetime');
    console.log('   • Copy the price IDs and update checkout/route.ts');
    
    console.log('\n3. 🌐 Set Up Webhooks (Optional):');
    console.log('   • Go to https://dashboard.stripe.com/test/webhooks');
    console.log('   • Add endpoint: https://yourdomain.com/api/stripe/webhook');
    console.log('   • Select events: checkout.session.completed, customer.subscription.updated, etc.');
    console.log('   • Copy webhook secret to .env.local');
    
    console.log('\n4. 🧪 Test Cards:');
    console.log('   • Success: 4242424242424242');
    console.log('   • Decline: 4000000000000002');
    console.log('   • Insufficient Funds: 4000000000009995');
    console.log('   • Expired: 4000000000000069');
    console.log('   • CVC: 123, Exp: 12/2025');
    
    console.log('\n5. 🚀 Run Tests:');
    console.log('   • npm run test:stripe');
    console.log('   • Or: node scripts/test-stripe-integration.js');
  }

  async runSetup() {
    console.log('🚀 Stripe Test Environment Setup\n');
    console.log('=' .repeat(50));
    
    // Check existing environment
    const { presentVars, missingVars, envContent } = await this.checkExistingEnv();
    
    // Validate Stripe keys if present
    if (envContent) {
      await this.validateStripeKeys(envContent);
    }
    
    // Check Stripe products configuration
    await this.checkStripeProducts();
    
    // Create .env.local if missing or incomplete
    if (missingVars.length > 0) {
      if (!fs.existsSync(this.envPath)) {
        await this.createEnvFile();
      } else {
        console.log('\n⚠️  Some environment variables are missing.');
        console.log('   Please add them to your existing .env.local file.');
      }
    } else {
      console.log('\n✅ All required environment variables are present!');
    }
    
    // Generate test instructions
    await this.generateTestInstructions();
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Update your .env.local with actual values');
    console.log('   2. Create test products in Stripe Dashboard');
    console.log('   3. Run the test script: node scripts/test-stripe-integration.js');
    console.log('   4. Test manually with test cards');
    console.log('   5. Switch to live mode when ready!');
  }
}

// Run the setup
if (require.main === module) {
  const setup = new StripeTestEnvSetup();
  setup.runSetup().catch(console.error);
}

module.exports = StripeTestEnvSetup;
