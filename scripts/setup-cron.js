const cron = require('node-cron');
const { main: updateInjuries } = require('./update-injuries');

// Schedule injury updates every 4 hours
const scheduleInjuryUpdates = () => {
  console.log('Setting up injury update schedule...');
  
  // Run every 4 hours (at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
  cron.schedule('0 */4 * * *', async () => {
    console.log('Running scheduled injury update...');
    try {
      await updateInjuries();
      console.log('Scheduled injury update completed successfully');
    } catch (error) {
      console.error('Scheduled injury update failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });
  
  console.log('Injury updates scheduled to run every 4 hours');
};

// Run initial update
const runInitialUpdate = async () => {
  console.log('Running initial injury update...');
  try {
    await updateInjuries();
    console.log('Initial injury update completed');
  } catch (error) {
    console.error('Initial injury update failed:', error);
  }
};

// Start the scheduler
const startScheduler = () => {
  runInitialUpdate();
  scheduleInjuryUpdates();
  
  console.log('Injury update scheduler started');
  console.log('Updates will run every 4 hours');
  console.log('Timezone: America/New_York');
};

// Export for use in other files
module.exports = {
  startScheduler,
  scheduleInjuryUpdates,
  runInitialUpdate
};

// Start if run directly
if (require.main === module) {
  startScheduler();
} 