#!/usr/bin/env node

/**
 * Master Stripe Testing Script
 * Runs all Stripe integration tests in sequence
 */

const { execSync } = require('child_process');
const path = require('path');

class StripeTestRunner {
  constructor() {
    this.scriptsDir = path.join(__dirname);
    this.results = [];
  }

  async runScript(scriptName, description) {
    console.log(`\n🚀 Running ${description}...`);
    console.log('=' .repeat(60));
    
    try {
      const startTime = Date.now();
      const output = execSync(`node ${path.join(this.scriptsDir, scriptName)}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(output);
      console.log(`\n✅ ${description} completed in ${duration}s`);
      
      this.results.push({
        script: scriptName,
        description,
        success: true,
        duration: parseFloat(duration)
      });
      
      return true;
    } catch (error) {
      console.log(`\n❌ ${description} failed:`);
      console.log(error.stdout || error.message);
      
      this.results.push({
        script: scriptName,
        description,
        success: false,
        error: error.message
      });
      
      return false;
    }
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...\n');
    
    const checks = [
      {
        name: 'Node.js',
        check: () => {
          const version = process.version;
          console.log(`   ✅ Node.js ${version}`);
          return true;
        }
      },
      {
        name: 'Environment File',
        check: () => {
          const fs = require('fs');
          const envPath = path.join(process.cwd(), '.env.local');
          if (fs.existsSync(envPath)) {
            console.log('   ✅ .env.local file found');
            return true;
          } else {
            console.log('   ❌ .env.local file not found');
            return false;
          }
        }
      },
      {
        name: 'Required Dependencies',
        check: () => {
          try {
            require('node-fetch');
            require('@supabase/supabase-js');
            console.log('   ✅ Required dependencies available');
            return true;
          } catch (error) {
            console.log('   ❌ Missing dependencies:', error.message);
            return false;
          }
        }
      }
    ];

    let allPassed = true;
    for (const check of checks) {
      if (!check.check()) {
        allPassed = false;
      }
    }

    return allPassed;
  }

  async runAllTests() {
    console.log('🧪 STRIPE INTEGRATION TEST SUITE');
    console.log('=' .repeat(60));
    console.log('Testing your WNBA stats app payment integration...\n');

    // Check prerequisites
    const prerequisitesOk = await this.checkPrerequisites();
    if (!prerequisitesOk) {
      console.log('\n❌ Prerequisites not met. Please fix the issues above and try again.');
      return;
    }

    // Run test scripts
    const tests = [
      {
        script: 'setup-stripe-test-env.js',
        description: 'Environment Setup & Validation'
      },
      {
        script: 'test-stripe-integration.js',
        description: 'Core Integration Tests'
      },
      {
        script: 'test-webhook-handling.js',
        description: 'Webhook Handling Tests'
      }
    ];

    console.log(`\n📋 Running ${tests.length} test suites...\n`);

    for (const test of tests) {
      await this.runScript(test.script, test.description);
    }

    // Generate summary
    this.generateSummary();
  }

  generateSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 FINAL TEST SUMMARY');
    console.log('=' .repeat(60));

    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const successRate = ((passed / total) * 100).toFixed(1);
    const totalDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0).toFixed(2);

    console.log(`\n🎯 Overall Results: ${passed}/${total} passed (${successRate}%)`);
    console.log(`⏱️  Total Duration: ${totalDuration}s\n`);

    console.log('📋 Test Results:');
    this.results.forEach((result, index) => {
      const emoji = result.success ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}s)` : '';
      console.log(`   ${index + 1}. ${emoji} ${result.description}${duration}`);
      
      if (!result.success && result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });

    console.log('\n🎯 Next Steps:');
    if (successRate === '100.0') {
      console.log('   🎉 All tests passed! Your Stripe integration is production-ready.');
      console.log('   🔄 You can now switch to live mode when ready to accept real payments.');
      console.log('   📝 Remember to update your price IDs and webhook endpoints for live mode.');
    } else {
      console.log('   🔧 Some tests failed. Please review the errors above.');
      console.log('   📚 Check the individual test outputs for specific issues.');
      console.log('   🛠️  Fix the issues and run the tests again.');
    }

    console.log('\n💡 Manual Testing Checklist:');
    console.log('   □ Test user registration and login');
    console.log('   □ Test monthly plan checkout with test card');
    console.log('   □ Test lifetime plan checkout with test card');
    console.log('   □ Test billing portal access');
    console.log('   □ Test failed payment scenarios');
    console.log('   □ Test subscription cancellation');
    console.log('   □ Test webhook events in Stripe Dashboard');

    console.log('\n🔗 Useful Links:');
    console.log('   • Stripe Dashboard: https://dashboard.stripe.com/test');
    console.log('   • Test Cards: https://stripe.com/docs/testing#cards');
    console.log('   • Webhook Testing: https://stripe.com/docs/webhooks/test');
  }
}

// Run the test suite
if (require.main === module) {
  const runner = new StripeTestRunner();
  runner.runAllTests().catch(console.error);
}

module.exports = StripeTestRunner;
