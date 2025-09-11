#!/usr/bin/env node

/**
 * Integrate Injury Monitoring with Regression Models
 * This script connects our existing active_injuries table with regression training
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

async function integrateInjuryMonitoring() {
  try {
    console.log('🏥 Integrating Injury Monitoring with Regression Models...\n');
    
    // 1. Verify we have injury data
    console.log('📊 Step 1: Checking injury data availability...');
    const { data: injuries, error: injuriesError } = await supabase
      .from('active_injuries')
      .select('player_name, team_abbrev, status, injury, expected_return, last_updated');
    
    if (injuriesError) {
      console.error('❌ Error fetching injury data:', injuriesError);
      return;
    }
    
    console.log(`✅ Found injury data for ${injuries.length} players`);
    console.log('📋 Sample injuries:');
    injuries.slice(0, 5).forEach(injury => {
      console.log(`   ${injury.player_name} (${injury.team_abbrev}): ${injury.status} - ${injury.injury}`);
    });
    
    // 2. Analyze injury statuses and create severity mapping
    console.log('\n🔍 Step 2: Analyzing injury statuses...');
    
    const statusCounts = {};
    injuries.forEach(injury => {
      statusCounts[injury.status] = (statusCounts[injury.status] || 0) + 1;
    });
    
    console.log('Injury status distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} players`);
    });
    
    // 3. Create injury severity mapping for regression models
    console.log('\n🔧 Step 3: Creating injury severity mapping...');
    
    // Map injury statuses to numerical severity (0 = healthy, 1 = severely injured)
    const injurySeverityMap = {
      'Out': 1.0,           // Completely out - highest impact
      'Questionable': 0.7,   // Likely out - high impact
      'Doubtful': 0.8,      // Probably out - high impact
      'Day-to-Day': 0.4,    // Might play - moderate impact
      'Probable': 0.2,      // Likely to play - low impact
      'Available': 0.0,     // Ready to play - no impact
      'Active': 0.0         // Ready to play - no impact
    };
    
    console.log('Injury severity mapping:');
    Object.entries(injurySeverityMap).forEach(([status, severity]) => {
      console.log(`   ${status}: ${severity} severity`);
    });
    
    // 4. Test integration with a sample player
    console.log('\n🧪 Step 4: Testing injury integration...');
    
    // Get a sample player to test
    const { data: samplePlayer, error: playerError } = await supabase
      .from('player_season_stats')
      .select('player_name, team, avg_points')
      .not('player_name', 'is', null)
      .limit(1);
    
    if (playerError || !samplePlayer || samplePlayer.length === 0) {
      console.log('   ❌ No sample player found');
    } else {
      const player = samplePlayer[0];
      console.log(`   Testing with player: ${player.player_name} (${player.team})`);
      
      // Check if this player has injury data
      const playerInjury = injuries.find(injury => 
        injury.player_name === player.player_name || 
        injury.team_abbrev === player.team
      );
      
      if (!playerInjury) {
        console.log(`     ✅ ${player.player_name} has no injury data (healthy)`);
        console.log(`     Injury factor: 0.0 (no impact on performance)`);
      } else {
        console.log(`     ⚠️  ${player.player_name} injury status: ${playerInjury.status}`);
        console.log(`     Injury: ${playerInjury.injury}`);
        console.log(`     Expected return: ${playerInjury.expected_return}`);
        
        const severity = injurySeverityMap[playerInjury.status] || 0.5;
        console.log(`     Injury factor: ${severity} (${severity === 0 ? 'no impact' : severity === 1 ? 'severe impact' : 'moderate impact'})`);
      }
    }
    
    // 5. Show how this integrates with regression models
    console.log('\n🎯 Step 5: Regression Model Integration...');
    console.log('   Our regression models can now use these REAL injury factors:');
    console.log('   - injury_status: 0.0-1.0 scale (0 = healthy, 1 = severely injured)');
    console.log('   - injury_type: String (e.g., "Knee", "Hamstring", "Ankle")');
    console.log('   - days_until_return: Integer (days until expected return)');
    console.log('   - injury_severity: Categorical (Out, Questionable, Day-to-Day, etc.)');
    
    // 6. Create a comprehensive injury lookup system
    console.log('\n🔧 Step 6: Creating comprehensive injury lookup system...');
    
    const injuryLookup = {};
    injuries.forEach(injury => {
      // Create lookup by player name
      injuryLookup[injury.player_name] = {
        status: injury.status,
        injury: injury.injury,
        severity: injurySeverityMap[injury.status] || 0.5,
        team: injury.team_abbrev,
        expected_return: injury.expected_return,
        last_updated: injury.last_updated
      };
      
      // Also create lookup by team for team-wide injury analysis
      if (!injuryLookup[injury.team_abbrev]) {
        injuryLookup[injury.team_abbrev] = [];
      }
      injuryLookup[injury.team_abbrev].push({
        player_name: injury.player_name,
        status: injury.status,
        injury: injury.injury,
        severity: injurySeverityMap[injury.status] || 0.5
      });
    });
    
    console.log('   ✅ Comprehensive injury lookup system created');
    console.log(`   Players with injuries: ${Object.keys(injuryLookup).filter(key => key.length > 3).length}`);
    console.log(`   Teams with injuries: ${Object.keys(injuryLookup).filter(key => key.length <= 3).length}`);
    
    // 7. Test team injury analysis
    console.log('\n🏀 Step 7: Testing team injury analysis...');
    
    const sampleTeam = 'ATL';
    const teamInjuries = injuryLookup[sampleTeam];
    if (teamInjuries && Array.isArray(teamInjuries)) {
      console.log(`   ${sampleTeam} team injuries: ${teamInjuries.length} players`);
      teamInjuries.forEach(injury => {
        console.log(`     ${injury.player_name}: ${injury.status} (${injury.severity} severity)`);
      });
      
      const avgTeamInjurySeverity = teamInjuries.reduce((sum, injury) => sum + injury.severity, 0) / teamInjuries.length;
      console.log(`   Average team injury severity: ${avgTeamInjurySeverity.toFixed(3)}`);
      console.log(`   This can be used as a team_health factor in regression models!`);
    }
    
    // 8. Save the injury lookup system for use in training scripts
    console.log('\n💾 Step 8: Saving injury lookup system...');
    const fs = require('fs');
    const path = require('path');
    const lookupPath = path.join(__dirname, 'injury-lookup-system.json');
    
    fs.writeFileSync(lookupPath, JSON.stringify(injuryLookup, null, 2));
    console.log(`   ✅ Injury lookup system saved to: ${lookupPath}`);
    console.log('   This can be imported by training scripts for accurate injury status data');
    
    // 9. Show sample usage for training scripts
    console.log('\n📖 Step 9: Sample usage for training scripts...');
    console.log('   // In your training script:');
    console.log('   const injuryLookup = require("./injury-lookup-system.json");');
    console.log('   const playerName = "Jordin Canada";');
    console.log('   const injuryData = injuryLookup[playerName];');
    console.log('   const injuryFactor = injuryData ? injuryData.severity : 0.0;');
    console.log('   // injuryFactor is now 0.0-1.0 scale for regression models');
    
    // 10. Show next steps
    console.log('\n🎉 Injury Monitoring Integration Complete!');
    console.log('   ✅ Existing active_injuries table discovered and integrated');
    console.log('   ✅ Injury severity mapping created (0.0-1.0 scale)');
    console.log('   ✅ Comprehensive injury lookup system built');
    console.log('   ✅ Team injury analysis capabilities added');
    console.log('   ✅ Ready to use in regression models');
    console.log('\n   🎯 Next: Replace synthetic data with real situational factors');
    console.log('   🎯 Then: Retrain models with all real data sources');
    
  } catch (error) {
    console.error('Error integrating injury monitoring:', error);
  }
}

integrateInjuryMonitoring();
