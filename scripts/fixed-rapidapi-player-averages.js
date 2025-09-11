#!/usr/bin/env node

/**
 * Fixed RapidAPI-based player averages fetcher
 * Uses the correct team-based player endpoint to get all player IDs
 */

const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// WNBA team mappings for the API (using slugs from the API response)
const TEAM_MAPPINGS = {
  'indiana-fever': 'IND',
  'atlanta-dream': 'ATL',
  'chicago-sky': 'CHI',
  'connecticut-sun': 'CON',
  'dallas-wings': 'DAL',
  'las-vegas-aces': 'LV',
  'los-angeles-sparks': 'LA',
  'minnesota-lynx': 'MIN',
  'new-york-liberty': 'NY',
  'phoenix-mercury': 'PHX',
  'seattle-storm': 'SEA',
  'washington-mystics': 'WSH',
  'golden-state-valkyries': 'GS'
};

async function fetchPlayerAverages() {
  console.log('🚀 Fixed RapidAPI Player Averages Fetcher (Team-Based)\n');

  let supabase;
  try {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔌 Connected to Supabase');

    // Step 1: Clean up corrupted data first
    console.log('\n🧹 Step 1: Cleaning up corrupted data...');
    
    const { data: corruptedData, error: corruptedError } = await supabase
      .from('player_season_stats')
      .select('id, player_name, team')
      .in('player_name', ['LAS', 'CHI', 'GSV', 'CON', 'WAS', 'MIN', 'ATL', 'SEA', 'IND', 'DAL', 'NY', 'PHX']);

    if (corruptedError) {
      console.log('⚠️  Error checking for corrupted data:', corruptedError.message);
    } else if (corruptedData && corruptedData.length > 0) {
      console.log(`🗑️  Found ${corruptedData.length} corrupted records to delete`);
      
      const corruptedIds = corruptedData.map(r => r.id);
      const { error: deleteError } = await supabase
        .from('player_season_stats')
        .delete()
        .in('id', corruptedIds);

      if (deleteError) {
        console.log('⚠️  Error deleting corrupted data:', deleteError.message);
      } else {
        console.log(`✅ Deleted ${corruptedData.length} corrupted records`);
      }
    }

    // Step 2: Get existing players from database
    console.log('\n📊 Step 2: Getting existing players from database...');
    
    const { data: existingPlayers, error: existingError } = await supabase
      .from('player_season_stats')
      .select('player_name, team');

    if (existingError) {
      throw new Error(`Error fetching existing players: ${existingError.message}`);
    }

    const existingPlayerNames = new Set(existingPlayers.map(p => p.player_name));
    console.log(`📊 Found ${existingPlayerNames.size} existing players in database`);

    // Step 3: Get all team IDs
    console.log('\n🏀 Step 3: Getting all team IDs...');
    
    const teamOptions = {
      method: 'GET',
      headers: {
        'x-rapidapi-key': 'b9fef5cbcbmsh3ae24f367e6e0acp12f58ejsn3c7ad2cc0f9f',
        'x-rapidapi-host': 'wnba-api.p.rapidapi.com'
      }
    };

    const teamsResponse = await fetch('https://wnba-api.p.rapidapi.com/team/id?limit=70', teamOptions);
    if (!teamsResponse.ok) {
      throw new Error(`Failed to fetch teams: ${teamsResponse.status} ${teamsResponse.statusText}`);
    }

    const teamsData = await teamsResponse.json();
    console.log(`🏀 Found ${teamsData.length || 0} teams`);

    if (!teamsData || teamsData.length === 0) {
      throw new Error('No teams returned from API');
    }

    // Step 4: Get all players from all teams using the correct endpoint
    console.log('\n👥 Step 4: Getting all players from all teams using team-based endpoint...');
    
    const allPlayerIds = new Set();
    const playerIdToName = new Map();
    const playerNameToId = new Map();
    
    for (const team of teamsData) {
      try {
        console.log(`  Getting players for team: ${team.displayName} (ID: ${team.teamId})`);
        
        // Use the correct team-based player endpoint
        const playersResponse = await fetch(`https://wnba-api.p.rapidapi.com/players/id?teamId=${team.teamId}`, teamOptions);
        if (playersResponse.ok) {
          const playersData = await playersResponse.json();
          
          if (playersData.data && playersData.data.length > 0) {
            playersData.data.forEach(player => {
              // Ensure we have a valid player name and ID
              if (player.fullName && player.fullName.trim().length > 0 && player.playerId) {
                const playerId = player.playerId.toString();
                const playerName = player.fullName.trim();
                
                allPlayerIds.add(playerId);
                playerIdToName.set(playerId, playerName);
                playerNameToId.set(playerName, playerId);
              }
            });
            console.log(`    ✅ Found ${playersData.data.length} players`);
          }
        }
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`    ⚠️  Error getting players for team ${team.displayName}: ${error.message}`);
      }
    }

    console.log(`📊 Total unique players found: ${allPlayerIds.size}`);
    console.log(`📊 Player IDs range: ${Math.min(...allPlayerIds)} to ${Math.max(...allPlayerIds)}`);

    // Step 5: Fetch stats for all players found
    console.log('\n🔍 Step 5: Fetching stats for all players...');
    
    const newPlayers = [];
    const updatedPlayers = [];
    let processedCount = 0;
    
    for (const playerId of allPlayerIds) {
      try {
        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`   Progress: ${processedCount}/${allPlayerIds.size} players processed`);
        }
        
        const searchUrl = `https://wnba-api.p.rapidapi.com/player-advanced-stats?playerId=${playerId}`;
        const searchResponse = await fetch(searchUrl, teamOptions);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          
          // Check if this player has 2025 stats
          const searchSeasonStats = searchData.player_stats?.categories?.find(cat => 
            cat.name === 'averages' && 
            cat.statistics?.some(stat => stat.season?.year === 2025)
          );

          if (searchSeasonStats) {
            const searchSeasonStat = searchSeasonStats.statistics.find(stat => stat.season?.year === 2025);
            if (searchSeasonStat) {
              // Get the actual player name from our mapping
              const playerName = playerIdToName.get(playerId);
              
              if (playerName) {
                // Check if player already exists
                const existingPlayer = existingPlayers.find(p => p.player_name === playerName);
                
                if (existingPlayer) {
                  console.log(`   ⏭️  ${playerName} already exists, checking for updates...`);
                  
                  // Check if we need to update existing record
                  const stats = searchSeasonStat.stats;
                  const labels = searchSeasonStats.labels;
                  
                  const updatedRecord = {
                    id: existingPlayer.id,
                    team: TEAM_MAPPINGS[searchSeasonStat.teamSlug] || searchSeasonStat.teamSlug?.toUpperCase() || 'UNK',
                    games_played: parseInt(stats[labels.indexOf('GP')]) || 0,
                    avg_points: parseFloat(stats[labels.indexOf('PTS')]) || 0,
                    avg_assists: parseFloat(stats[labels.indexOf('AST')]) || 0,
                    avg_rebounds: parseFloat(stats[labels.indexOf('REB')]) || 0,
                    avg_steals: parseFloat(stats[labels.indexOf('STL')]) || 0,
                    avg_blocks: parseFloat(stats[labels.indexOf('BLK')]) || 0,
                    avg_turnovers: parseFloat(stats[labels.indexOf('TO')]) || 0,
                    field_goal_percentage: parseFloat(stats[labels.indexOf('FG%')]) || 0,
                    three_point_percentage: parseFloat(stats[labels.indexOf('3P%')]) || 0,
                    free_throw_percentage: parseFloat(stats[labels.indexOf('FT%')]) || 0,
                    avg_minutes: parseFloat(stats[labels.indexOf('MIN')]) || 0,
                    avg_fgm: parseFloat(stats[labels.indexOf('FG')]?.split('-')[0]) || 0,
                    avg_fga: parseFloat(stats[labels.indexOf('FG')]?.split('-')[1]) || 0,
                    avg_3pm: parseFloat(stats[labels.indexOf('3PT')]?.split('-')[0]) || 0,
                    avg_3pa: parseFloat(stats[labels.indexOf('3PT')]?.split('-')[1]) || 0,
                    avg_ftm: parseFloat(stats[labels.indexOf('FT')]?.split('-')[0]) || 0,
                    avg_fta: parseFloat(stats[labels.indexOf('FT')]?.split('-')[1]) || 0,
                    last_updated: new Date().toISOString()
                  };

                  // Only update if we have meaningful stats and a valid ID
                  if (updatedRecord.games_played > 0 && updatedRecord.id) {
                    updatedPlayers.push(updatedRecord);
                  }
                } else {
                  console.log(`   📝 Found new player: ${playerName} (${searchSeasonStat.teamSlug})`);
                  
                  // Map the stats to our database schema
                  const stats = searchSeasonStat.stats;
                  const labels = searchSeasonStats.labels;
                  
                  const playerRecord = {
                    player_name: playerName,
                    team: TEAM_MAPPINGS[searchSeasonStat.teamSlug] || searchSeasonStat.teamSlug?.toUpperCase() || 'UNK',
                    season: '2025',
                    games_played: parseInt(stats[labels.indexOf('GP')]) || 0,
                    avg_points: parseFloat(stats[labels.indexOf('PTS')]) || 0,
                    avg_assists: parseFloat(stats[labels.indexOf('AST')]) || 0,
                    avg_rebounds: parseFloat(stats[labels.indexOf('REB')]) || 0,
                    avg_steals: parseFloat(stats[labels.indexOf('STL')]) || 0,
                    avg_blocks: parseFloat(stats[labels.indexOf('BLK')]) || 0,
                    avg_turnovers: parseFloat(stats[labels.indexOf('TO')]) || 0,
                    field_goal_percentage: parseFloat(stats[labels.indexOf('FG%')]) || 0,
                    three_point_percentage: parseFloat(stats[labels.indexOf('3P%')]) || 0,
                    free_throw_percentage: parseFloat(stats[labels.indexOf('FT%')]) || 0,
                    avg_minutes: parseFloat(stats[labels.indexOf('MIN')]) || 0,
                    avg_fgm: parseFloat(stats[labels.indexOf('FG')]?.split('-')[0]) || 0,
                    avg_fga: parseFloat(stats[labels.indexOf('FG')]?.split('-')[1]) || 0,
                    avg_3pm: parseFloat(stats[labels.indexOf('3PT')]?.split('-')[0]) || 0,
                    avg_3pa: parseFloat(stats[labels.indexOf('3PT')]?.split('-')[1]) || 0,
                    avg_ftm: parseFloat(stats[labels.indexOf('FT')]?.split('-')[0]) || 0,
                    avg_fta: parseFloat(stats[labels.indexOf('FT')]?.split('-')[1]) || 0,
                    last_updated: new Date().toISOString()
                  };

                  // Only add if player has meaningful stats
                  if (playerRecord.games_played > 0) {
                    newPlayers.push(playerRecord);
                    console.log(`   📝 Added ${playerName} (${playerRecord.team}) - ${playerRecord.avg_points} PPG, ${playerRecord.avg_rebounds} RPG`);
                  }
                }
              }
            }
          }
        }
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`   ⚠️  Error processing player ${playerId}: ${error.message}`);
        continue;
      }
    }

    console.log(`\n📊 Processing complete:`);
    console.log(`   Total players processed: ${processedCount}`);
    console.log(`   New players found: ${newPlayers.length}`);
    console.log(`   Players to update: ${updatedPlayers.length}`);

    // Step 6: Insert new players into database
    if (newPlayers.length > 0) {
      console.log('\n📝 Step 6: Inserting new players into database...');
      
      const insertBatchSize = 50;
      let insertedCount = 0;
      
      for (let i = 0; i < newPlayers.length; i += insertBatchSize) {
        const batch = newPlayers.slice(i, i + insertBatchSize);
        
        const { error: insertError } = await supabase
          .from('player_season_stats')
          .insert(batch);

        if (insertError) {
          throw new Error(`Error inserting batch ${Math.floor(i/insertBatchSize) + 1}: ${insertError.message}`);
        }

        insertedCount += batch.length;
        console.log(`✅ Inserted batch ${Math.floor(i/insertBatchSize) + 1} (${batch.length} records)`);
      }

      console.log(`✅ Total new players inserted: ${insertedCount}`);
    }

    // Step 7: Update existing players
    if (updatedPlayers.length > 0) {
      console.log('\n📝 Step 7: Updating existing players...');
      
      let updatedCount = 0;
      
      for (const updatedPlayer of updatedPlayers) {
        const { error: updateError } = await supabase
          .from('player_season_stats')
          .update(updatedPlayer)
          .eq('id', updatedPlayer.id);

        if (updateError) {
          console.log(`⚠️  Error updating player ${updatedPlayer.id}: ${updateError.message}`);
        } else {
          updatedCount++;
        }
      }

      console.log(`✅ Total players updated: ${updatedCount}`);
    }

    // Step 8: Verify results
    console.log('\n✅ Step 8: Verifying results...');
    
    const { data: finalCheck, error: finalError } = await supabase
      .from('player_season_stats')
      .select('*');

    if (finalError) {
      throw new Error(`Error in final check: ${finalError.message}`);
    }

    const finalUniqueNames = new Set(finalCheck.map(p => p.player_name));
    console.log(`📊 Final total records: ${finalCheck.length}`);
    console.log(`📊 Final unique players: ${finalUniqueNames.size}`);

    // Check for specific important players
    const importantPlayers = ['A\'ja Wilson', 'Breanna Stewart', 'Kelsey Plum', 'Napheesa Collier', 'Tina Charles'];
    console.log('\n🔍 Checking for important players:');
    
    for (const playerName of importantPlayers) {
      const { data: player, error } = await supabase
        .from('player_season_stats')
        .select('player_name, team, avg_points, avg_rebounds')
        .eq('player_name', playerName)
        .single();

      if (error) {
        console.log(`   ❌ ${playerName}: Not found in database`);
      } else {
        console.log(`   ✅ ${playerName}: ${player.team} - ${player.avg_points} pts, ${player.avg_rebounds} reb`);
      }
    }

    console.log('\n🎉 Fixed RapidAPI player averages fetch completed!');
    console.log(`📊 Added ${newPlayers.length} new players`);
    console.log(`📊 Updated ${updatedPlayers.length} existing players`);
    console.log(`📊 Database now contains ${finalCheck.length} total records`);

  } catch (error) {
    console.error('❌ Error during Fixed RapidAPI player averages fetch:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  fetchPlayerAverages()
    .then(() => {
      console.log('\n✅ Fixed RapidAPI player averages fetch completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fixed RapidAPI player averages fetch failed:', error);
      process.exit(1);
    });
}

module.exports = { fetchPlayerAverages };
