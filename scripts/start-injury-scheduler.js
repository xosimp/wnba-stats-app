const { main: updateInjuries } = require('./update-injuries');

// Schedule injury updates every 4 hours
const scheduleInjuryUpdates = () => {
  console.log('Setting up injury update schedule...');
  
  // Run every 4 hours (4 * 60 * 60 * 1000 milliseconds)
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  
  const runUpdate = async () => {
    console.log('🕐 Running scheduled injury update...');
    const startTime = new Date();
    console.log(`⏰ Update started at: ${startTime.toLocaleString()}`);
    
    try {
      await updateInjuries();
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      console.log(`✅ Scheduled injury update completed successfully in ${duration.toFixed(2)} seconds`);
      console.log(`⏰ Update completed at: ${endTime.toLocaleString()}`);
    } catch (error) {
      console.error('❌ Scheduled injury update failed:', error);
      console.error('🔄 Will retry in 4 hours...');
    }
  };
  
  // Run initial update immediately
  runUpdate();
  
  // Schedule recurring updates every 4 hours
  setInterval(runUpdate, FOUR_HOURS);
  
  console.log('📅 Injury updates scheduled to run every 4 hours');
  console.log(`⏰ Next update: ${new Date(Date.now() + FOUR_HOURS).toLocaleString()}`);
  console.log('🌍 Timezone: America/New_York');
};

// Start the scheduler
const startScheduler = () => {
  console.log('🏀 Starting WNBA Injury Update Scheduler...');
  console.log('=' .repeat(50));
  
  scheduleInjuryUpdates();
  
  console.log('=' .repeat(50));
  console.log('✅ Injury update scheduler started successfully!');
  console.log('📊 Monitoring WNBA injuries every 4 hours');
  console.log('🔄 Auto-refresh enabled');
  console.log('💾 Database updates active');
  console.log('');
  console.log('Press Ctrl+C to stop the scheduler');
  console.log('=' .repeat(50));
  
  // Keep the process alive
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping injury scheduler...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping injury scheduler...');
    process.exit(0);
  });
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception in injury scheduler:', error);
    console.log('🔄 Restarting scheduler in 30 seconds...');
    setTimeout(() => {
      console.log('🔄 Restarting injury scheduler...');
      startScheduler();
    }, 30000);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection in injury scheduler:', reason);
    console.log('🔄 Continuing operation...');
  });
};

// Export for use in other files
module.exports = {
  startScheduler,
  scheduleInjuryUpdates
};

// Start if run directly
if (require.main === module) {
  startScheduler();
} 