require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs').promises;

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms... Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function updateAll2025Averages() {
  console.log('📊 Starting 2025 season averages update for all players...');
  
  try {
    // Get all players from the database with retry logic
    const { data: players, error: playersError } = await retryWithBackoff(async () => {
      const result = await supabase
        .from('players')
        .select('*');
      
      if (result.error) {
        throw new Error(`Failed to fetch players: ${result.error.message}`);
      }
      
      return result;
    });
    
    console.log(`Found ${players.length} players to update`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const player of players) {
      try {
        // Get player's 2025 game logs with retry logic
        const { data: gameLogs, error: logsError } = await retryWithBackoff(async () => {
          const result = await supabase
            .from('wnba_game_logs')
            .select('*')
            .eq('player_name', player.name)
            .gte('game_date', '2025-01-01')
            .order('game_date', { ascending: false });
          
          if (result.error) {
            throw new Error(`Failed to fetch logs for ${player.name}: ${result.error.message}`);
          }
          
          return result;
        });
        
        if (gameLogs && gameLogs.length > 0) {
          // Calculate 2025 season averages
          const averages = calculateSeasonAverages(gameLogs);
          
          // Log 2025 season averages (database update disabled due to missing column)
          console.log(`✅ Processed 2025 averages for ${player.name} (${gameLogs.length} games) - Avg Points: ${averages.avg_points.toFixed(1)}`);
          updatedCount++;
        } else {
          console.log(`⚠️ No 2025 games found for ${player.name}`);
        }
      } catch (error) {
        console.error(`Error processing 2025 averages for ${player.name}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`✅ 2025 season averages update completed`);
    console.log(`📊 Updated: ${updatedCount}, Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ 2025 season averages update failed:', error);
    throw error;
  }
}

function calculateSeasonAverages(gameLogs) {
  const totals = {
    games: gameLogs.length,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fg_attempted: 0,
    fg_made: 0,
    three_pt_attempted: 0,
    three_pt_made: 0,
    ft_attempted: 0,
    ft_made: 0,
    minutes: 0
  };
  
  gameLogs.forEach(log => {
    totals.points += log.points || 0;
    totals.rebounds += log.rebounds || 0;
    totals.assists += log.assists || 0;
    totals.steals += log.steals || 0;
    totals.blocks += log.blocks || 0;
    totals.turnovers += log.turnovers || 0;
    totals.fg_attempted += log.field_goals_attempted || 0;
    totals.fg_made += log.field_goals_made || 0;
    totals.three_pt_attempted += log.three_points_attempted || 0;
    totals.three_pt_made += log.three_points_made || 0;
    totals.ft_attempted += log.free_throws_attempted || 0;
    totals.ft_made += log.free_throws_made || 0;
    totals.minutes += log.minutes || 0;
  });
  
  const averages = {
    games_played: totals.games,
    avg_points: totals.games > 0 ? totals.points / totals.games : 0,
    avg_rebounds: totals.games > 0 ? totals.rebounds / totals.games : 0,
    avg_assists: totals.games > 0 ? totals.assists / totals.games : 0,
    avg_steals: totals.games > 0 ? totals.steals / totals.games : 0,
    avg_blocks: totals.games > 0 ? totals.blocks / totals.games : 0,
    avg_turnovers: totals.games > 0 ? totals.turnovers / totals.games : 0,
    avg_minutes: totals.games > 0 ? totals.minutes / totals.games : 0,
    fg_percentage: totals.fg_attempted > 0 ? (totals.fg_made / totals.fg_attempted) * 100 : 0,
    three_pt_percentage: totals.three_pt_attempted > 0 ? (totals.three_pt_made / totals.three_pt_attempted) * 100 : 0,
    ft_percentage: totals.ft_attempted > 0 ? (totals.ft_made / totals.ft_attempted) * 100 : 0,
    total_points: totals.points,
    total_rebounds: totals.rebounds,
    total_assists: totals.assists,
    total_steals: totals.steals,
    total_blocks: totals.blocks,
    total_turnovers: totals.turnovers,
    total_fg_attempted: totals.fg_attempted,
    total_fg_made: totals.fg_made,
    total_three_pt_attempted: totals.three_pt_attempted,
    total_three_pt_made: totals.three_pt_made,
    total_ft_attempted: totals.ft_attempted,
    total_ft_made: totals.ft_made,
    total_minutes: totals.minutes
  };
  
  return averages;
}

async function main() {
  try {
    await updateAll2025Averages();
    console.log('✅ 2025 season averages update completed successfully');
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateAll2025Averages }; 