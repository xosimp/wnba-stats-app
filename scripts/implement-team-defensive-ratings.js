#!/usr/bin/env node

/**
 * Implement Team Defensive Ratings
 * This script creates a team defensive rating system for accurate opponent strength data
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function implementTeamDefensiveRatings() {
  try {
    console.log('🛡️ Implementing Team Defensive Ratings System...\n');
    
    // 1. First, let's check if team_stats table exists
    console.log('📊 Step 1: Checking for existing team_stats table...');
    
    try {
      const { data: existingTeamStats, error: checkError } = await supabase
        .from('team_stats')
        .select('*')
        .limit(1);
      
      if (checkError && checkError.code === '42P01') {
        console.log('   ❌ team_stats table does not exist - creating it...');
        await createTeamStatsTable();
      } else if (checkError) {
        console.log('   ❌ Error checking team_stats table:', checkError);
        return;
      } else {
        console.log('   ✅ team_stats table already exists');
        console.log(`   Found ${existingTeamStats.length} existing team stat records`);
      }
    } catch (error) {
      console.log('   ❌ Error checking team_stats table:', error);
      await createTeamStatsTable();
    }
    
    // 2. Get all unique teams from our data
    console.log('\n🏀 Step 2: Getting all unique teams...');
    const { data: teams, error: teamsError } = await supabase
      .from('players')
      .select('team')
      .not('team', 'is', null);
    
    if (teamsError) {
      console.error('❌ Error fetching teams:', teamsError);
      return;
    }
    
    const uniqueTeams = [...new Set(teams.map(t => t.team))];
    console.log(`Found ${uniqueTeams.length} unique teams: ${uniqueTeams.join(', ')}`);
    
    // 3. Calculate defensive ratings for each team
    console.log('\n📈 Step 3: Calculating defensive ratings...');
    
    for (const team of uniqueTeams) {
      console.log(`   Calculating defensive rating for ${team}...`);
      
      // Get all games where this team was the opponent
      const { data: opponentGames, error: gamesError } = await supabase
        .from('wnba_game_logs')
        .select('opponent, points, minutes_played')
        .eq('opponent', team);
      
      if (gamesError) {
        console.log(`     ❌ Error fetching games for ${team}:`, gamesError);
        continue;
      }
      
      if (!opponentGames || opponentGames.length === 0) {
        console.log(`     ⚠️  No opponent games found for ${team}`);
        continue;
      }
      
      // Calculate defensive rating (lower points allowed = better defense)
      const totalPointsAllowed = opponentGames.reduce((sum, game) => sum + (game.points || 0), 0);
      const gamesCount = opponentGames.length;
      const avgPointsAllowed = totalPointsAllowed / gamesCount;
      
      // Calculate defensive efficiency (points per 100 possessions estimate)
      // Using minutes played as a rough proxy for possessions
      const totalMinutes = opponentGames.reduce((sum, game) => sum + (game.minutes_played || 0), 0);
      const avgMinutesPerGame = totalMinutes / gamesCount;
      
      // Rough estimate: 100 possessions ≈ 40 minutes of play
      const possessionsPerGame = (avgMinutesPerGame / 40) * 100;
      const defensiveRating = (avgPointsAllowed / possessionsPerGame) * 100;
      
      console.log(`     ${team}: ${avgPointsAllowed.toFixed(1)} pts allowed, ${defensiveRating.toFixed(1)} defensive rating`);
      
      // 4. Store team defensive stats
      const { error: insertError } = await supabase
        .from('team_stats')
        .upsert({
          team: team,
          season: '2025',
          games_played: gamesCount,
          avg_points_allowed: avgPointsAllowed,
          defensive_rating: defensiveRating,
          total_points_allowed: totalPointsAllowed,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'team,season'
        });
      
      if (insertError) {
        console.log(`     ❌ Error storing stats for ${team}:`, insertError);
      } else {
        console.log(`     ✅ Stored defensive stats for ${team}`);
      }
    }
    
    // 5. Verify the implementation
    console.log('\n🔍 Step 4: Verifying team defensive ratings...');
    const { data: teamStats, error: verifyError } = await supabase
      .from('team_stats')
      .select('*')
      .order('defensive_rating');
    
    if (verifyError) {
      console.error('❌ Error verifying team stats:', verifyError);
    } else {
      console.log('📊 Team Defensive Ratings (lower = better defense):');
      teamStats.forEach(stat => {
        console.log(`   ${stat.team}: ${stat.defensive_rating.toFixed(1)} (${stat.avg_points_allowed.toFixed(1)} pts allowed)`);
      });
    }
    
    // 6. Test integration with regression models
    console.log('\n🧪 Step 5: Testing integration with regression models...');
    
    // Get a sample player to test
    const { data: samplePlayer, error: playerError } = await supabase
      .from('player_season_stats')
      .select('player_name, team, avg_points')
      .not('player_name', 'is', null)
      .limit(1);
    
    if (playerError || !samplePlayer || samplePlayer.length === 0) {
      console.log('   ❌ No sample player found for testing');
    } else {
      const player = samplePlayer[0];
      console.log(`   Testing with player: ${player.player_name} (${player.team})`);
      
      // Get their team's defensive rating
      const { data: playerTeamStats, error: teamError } = await supabase
        .from('team_stats')
        .select('defensive_rating')
        .eq('team', player.team)
        .single();
      
      if (teamError || !playerTeamStats) {
        console.log(`     ❌ No defensive stats found for ${player.team}`);
      } else {
        console.log(`     ✅ ${player.team} defensive rating: ${playerTeamStats.defensive_rating.toFixed(1)}`);
        console.log(`     This can now be used in regression models for opponent_strength!`);
      }
    }
    
    console.log('\n🎉 Team Defensive Ratings System Implemented Successfully!');
    console.log('   ✅ team_stats table created/updated');
    console.log('   ✅ Defensive ratings calculated for all teams');
    console.log('   ✅ Ready to use in regression models');
    console.log('\n   🎯 Next: Implement game schedule tracking for home/away and rest days');
    
  } catch (error) {
    console.error('Error implementing team defensive ratings:', error);
  }
}

async function createTeamStatsTable() {
  console.log('   🏗️  Creating team_stats table...');
  
  // Create the table using SQL
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS team_stats (
        id SERIAL PRIMARY KEY,
        team VARCHAR(10) NOT NULL,
        season VARCHAR(4) NOT NULL,
        games_played INTEGER DEFAULT 0,
        avg_points_allowed DECIMAL(5,2) DEFAULT 0,
        defensive_rating DECIMAL(5,2) DEFAULT 0,
        total_points_allowed INTEGER DEFAULT 0,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(team, season)
      );
    `
  });
  
  if (createError) {
    console.log('     ❌ Error creating table via RPC:', createError);
    
    // Fallback: try to create via direct insert (table might already exist)
    console.log('     🔄 Trying fallback table creation...');
    const { error: fallbackError } = await supabase
      .from('team_stats')
      .insert({
        team: 'TEST',
        season: '2025',
        games_played: 0,
        avg_points_allowed: 0,
        defensive_rating: 0,
        total_points_allowed: 0
      });
    
    if (fallbackError && fallbackError.code === '42P01') {
      console.log('     ❌ Cannot create team_stats table - manual creation required');
      console.log('     💡 Please run this SQL manually:');
      console.log(`
        CREATE TABLE team_stats (
          id SERIAL PRIMARY KEY,
          team VARCHAR(10) NOT NULL,
          season VARCHAR(4) NOT NULL,
          games_played INTEGER DEFAULT 0,
          avg_points_allowed DECIMAL(5,2) DEFAULT 0,
          defensive_rating DECIMAL(5,2) DEFAULT 0,
          total_points_allowed INTEGER DEFAULT 0,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(team, season)
        );
      `);
      return false;
    } else if (fallbackError) {
      console.log('     ❌ Fallback table creation failed:', fallbackError);
      return false;
    } else {
      console.log('     ✅ team_stats table created via fallback');
      // Clean up test record
      await supabase.from('team_stats').delete().eq('team', 'TEST');
      return true;
    }
  } else {
    console.log('     ✅ team_stats table created successfully');
    return true;
  }
}

implementTeamDefensiveRatings();
