const { PlayerLeagueAveragesService } = require('../lib/services/PlayerLeagueAveragesService');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

/**
 * Script to update player-level league averages from the database
 * This should be run daily as part of the automation process
 */
async function updatePlayerLeagueAverages() {
  try {
    console.log('🚀 Starting player league averages update...');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }
    
    // Initialize the service
    const service = PlayerLeagueAveragesService.getInstance(supabaseUrl, supabaseKey);
    
    // Update league averages from current database data
    await service.updateLeagueAverages('2025');
    
    // Get the updated values to verify
    const thresholds = service.getAllThresholds();
    console.log('✅ Player league averages updated successfully:');
    console.log('📊 League Averages:', thresholds.leagueAvg);
    console.log('📈 Top 1% Thresholds:', thresholds.top1);
    console.log('📉 Bottom 1% Thresholds:', thresholds.bottom1);
    
    console.log('🎉 Player league averages update completed!');
    
  } catch (error) {
    console.error('❌ Error updating player league averages:', error);
    process.exit(1);
  }
}

// Run the update
updatePlayerLeagueAverages();
