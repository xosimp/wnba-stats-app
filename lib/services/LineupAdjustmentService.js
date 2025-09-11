const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class LineupAdjustmentService {
  static MIN_GAMES_FOR_LINEUP_ANALYSIS = 3;
  static CONFIDENCE_THRESHOLD = 0.6;

  /**
   * Calculate adjusted teammate efficiency metrics when key players are out
   */
  static async calculateTeammateAdjustments(
    playerName,
    team,
    statType,
    injuredTeammates
  ) {
    try {
      console.log(`🔍 Calculating teammate adjustments for ${playerName} when ${injuredTeammates.join(', ')} are out`);

      if (!injuredTeammates || injuredTeammates.length === 0) {
        return null;
      }

      // Get historical lineup data
      const historicalData = await this.getHistoricalLineupData(playerName, team, statType);
      
      if (!historicalData) {
        console.log('⚠️ No historical lineup data available');
        return null;
      }

      // Calculate adjustments for each injured teammate
      let totalShootingBoost = 0;
      let totalReboundingBoost = 0;
      let totalAssistBoost = 0;
      let totalConfidence = 0;
      let validAdjustments = 0;

      for (const injuredTeammate of injuredTeammates) {
        const adjustment = historicalData.injuryAdjustments[injuredTeammate];
        
        if (adjustment && adjustment.gamesAnalyzed >= this.MIN_GAMES_FOR_LINEUP_ANALYSIS) {
          totalShootingBoost += adjustment.shootingEfficiencyBoost;
          totalReboundingBoost += adjustment.reboundingStrengthBoost;
          totalAssistBoost += adjustment.assistDependencyBoost;
          totalConfidence += Math.min(1.0, adjustment.gamesAnalyzed / 10); // More games = higher confidence
          validAdjustments++;
          
          console.log(`✅ Found adjustment for ${injuredTeammate}: +${(adjustment.shootingEfficiencyBoost * 100).toFixed(1)}% shooting, +${(adjustment.reboundingStrengthBoost * 100).toFixed(1)}% rebounding`);
        } else {
          // Use generic boost if no historical data
          const genericBoost = this.getStatSpecificMultiplier(statType);
          totalShootingBoost += genericBoost.shooting;
          totalReboundingBoost += genericBoost.rebounding;
          totalAssistBoost += genericBoost.assists;
          totalConfidence += 0.3; // Lower confidence for generic adjustments
          validAdjustments++;
          
          console.log(`⚠️ Using generic adjustment for ${injuredTeammate}: +${(genericBoost.shooting * 100).toFixed(1)}% shooting`);
        }
      }

      if (validAdjustments === 0) {
        return null;
      }

      // Calculate average boosts
      const avgShootingBoost = totalShootingBoost / validAdjustments;
      const avgReboundingBoost = totalReboundingBoost / validAdjustments;
      const avgAssistBoost = totalAssistBoost / validAdjustments;
      const avgConfidence = totalConfidence / validAdjustments;

      // Apply boosts to base metrics
      const adjustedShootingEfficiency = historicalData.baseTeammateShootingEfficiency * (1 + avgShootingBoost);
      const adjustedReboundingStrength = historicalData.baseTeammateReboundingStrength * (1 + avgReboundingBoost);
      const adjustedAssistDependency = historicalData.baseTeammateAssistDependency * (1 + avgAssistBoost);

      // Calculate overall lineup shift multiplier
      const lineupShiftMultiplier = 1 + (avgShootingBoost + avgReboundingBoost + avgAssistBoost) / 3;

      console.log(`📊 Final adjustments for ${playerName}:`);
      console.log(`   Shooting Efficiency: ${historicalData.baseTeammateShootingEfficiency.toFixed(3)} → ${adjustedShootingEfficiency.toFixed(3)} (+${(avgShootingBoost * 100).toFixed(1)}%)`);
      console.log(`   Rebounding Strength: ${historicalData.baseTeammateReboundingStrength.toFixed(3)} → ${adjustedReboundingStrength.toFixed(3)} (+${(avgReboundingBoost * 100).toFixed(1)}%)`);
      console.log(`   Assist Dependency: ${historicalData.baseTeammateAssistDependency.toFixed(3)} → ${adjustedAssistDependency.toFixed(3)} (+${(avgAssistBoost * 100).toFixed(1)}%)`);
      console.log(`   Lineup Shift: ${lineupShiftMultiplier.toFixed(3)}`);
      console.log(`   Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

      return {
        playerName,
        team,
        statType,
        injuredTeammates,
        adjustedTeammateShootingEfficiency: adjustedShootingEfficiency,
        adjustedTeammateReboundingStrength: adjustedReboundingStrength,
        adjustedTeammateAssistDependency: adjustedAssistDependency,
        lineupShiftMultiplier,
        confidence: avgConfidence
      };

    } catch (error) {
      console.error('Error calculating teammate adjustments:', error);
      return null;
    }
  }

  /**
   * Get historical lineup data for a player using real game data
   */
  static async getHistoricalLineupData(playerName, team, statType) {
    try {
      console.log(`🔍 Getting historical lineup data for ${playerName} (${team})`);

      // Get all teammates for this team from game logs
      const { data: teamGames, error: teamError } = await supabase
        .from('wnba_game_logs')
        .select('player_name, field_goals_made, field_goals_attempted, rebounds, assists, minutes')
        .eq('team', team)
        .like('game_date', '%2025%')
        .not('minutes', 'is', null)
        .gte('minutes', 15);

      if (teamError || !teamGames) {
        console.log(`❌ Error fetching team games: ${teamError?.message}`);
        return null;
      }

      // Get unique teammates (excluding the player themselves)
      const teammateNames = [...new Set(teamGames
        .map(game => game.player_name)
        .filter(name => name !== playerName)
      )];

      console.log(`📊 Found ${teammateNames.length} teammates: ${teammateNames.join(', ')}`);

      // Calculate base teammate metrics from actual game data
      const baseShootingEfficiency = this.calculateTeamShootingEfficiency(teamGames, teammateNames);
      const baseReboundingStrength = this.calculateTeamReboundingStrength(teamGames, teammateNames);
      const baseAssistDependency = this.calculateTeamAssistDependency(teamGames, teammateNames);

      console.log(`📈 Base teammate metrics:`);
      console.log(`   Shooting Efficiency: ${baseShootingEfficiency.toFixed(3)}`);
      console.log(`   Rebounding Strength: ${baseReboundingStrength.toFixed(3)}`);
      console.log(`   Assist Dependency: ${baseAssistDependency.toFixed(3)}`);

      // For each significant teammate, calculate historical adjustments when they were out
      const injuryAdjustments = {};

      for (const teammateName of teammateNames) {
        console.log(`🔍 Analyzing ${teammateName} injury impact...`);
        const adjustment = await this.calculateTeammateInjuryAdjustment(
          playerName,
          team,
          teammateName,
          statType,
          baseShootingEfficiency,
          baseReboundingStrength,
          baseAssistDependency
        );

        if (adjustment) {
          injuryAdjustments[teammateName] = adjustment;
          console.log(`✅ Found ${adjustment.gamesAnalyzed} games with ${teammateName} out`);
        } else {
          console.log(`⚠️ No reliable data for ${teammateName} injury impact`);
        }
      }

      return {
        playerName,
        team,
        statType,
        baseTeammateShootingEfficiency: baseShootingEfficiency,
        baseTeammateReboundingStrength: baseReboundingStrength,
        baseTeammateAssistDependency: baseAssistDependency,
        injuryAdjustments
      };

    } catch (error) {
      console.error('Error getting historical lineup data:', error);
      return null;
    }
  }

  /**
   * Calculate how teammate efficiency changes when a specific teammate is out
   */
  static async calculateTeammateInjuryAdjustment(
    playerName,
    team,
    injuredTeammate,
    statType,
    baseShootingEfficiency,
    baseReboundingStrength,
    baseAssistDependency
  ) {
    try {
      console.log(`🔍 Analyzing historical data for ${playerName} when ${injuredTeammate} was out`);

      // Get all games for the player in 2025
      const { data: playerGames, error: playerError } = await supabase
        .from('wnba_game_logs')
        .select('game_date, points, rebounds, assists, minutes, field_goals_made, field_goals_attempted, three_points_made, three_points_attempted, free_throws_made, free_throws_attempted, assists, turnovers')
        .eq('player_name', playerName)
        .eq('team', team)
        .like('game_date', '%2025%')
        .not('minutes', 'is', null)
        .gte('minutes', 15)
        .order('game_date', { ascending: true });

      if (playerError || !playerGames) {
        console.log(`❌ Error fetching player games: ${playerError?.message}`);
        return null;
      }

      // Get all games for the injured teammate in 2025
      const { data: teammateGames, error: teammateError } = await supabase
        .from('wnba_game_logs')
        .select('game_date, minutes')
        .eq('player_name', injuredTeammate)
        .eq('team', team)
        .like('game_date', '%2025%')
        .order('game_date', { ascending: true });

      if (teammateError || !teammateGames) {
        console.log(`❌ Error fetching teammate games: ${teammateError?.message}`);
        return null;
      }

      // Create a map of teammate game dates for quick lookup
      const teammateGameDates = new Set(teammateGames.map(game => game.game_date));

      // Find games where the player played but the teammate didn't (teammate was out)
      const teammateOutGames = playerGames.filter(playerGame => {
        return !teammateGameDates.has(playerGame.game_date);
      });

      console.log(`📊 Found ${teammateOutGames.length} games where ${playerName} played but ${injuredTeammate} was out`);

      if (teammateOutGames.length < this.MIN_GAMES_FOR_LINEUP_ANALYSIS) {
        console.log(`⚠️ Insufficient games (${teammateOutGames.length}) for reliable analysis`);
        return null;
      }

      // Calculate actual efficiency metrics in games where teammate was out
      const avgShootingEfficiency = this.calculateRealShootingEfficiency(teammateOutGames);
      const avgReboundingStrength = this.calculateRealReboundingStrength(teammateOutGames);
      const avgAssistDependency = this.calculateRealAssistDependency(teammateOutGames);

      console.log(`📈 Efficiency when ${injuredTeammate} was out:`);
      console.log(`   Shooting: ${avgShootingEfficiency.toFixed(3)} (base: ${baseShootingEfficiency.toFixed(3)})`);
      console.log(`   Rebounding: ${avgReboundingStrength.toFixed(3)} (base: ${baseReboundingStrength.toFixed(3)})`);
      console.log(`   Assists: ${avgAssistDependency.toFixed(3)} (base: ${baseAssistDependency.toFixed(3)})`);

      // Calculate boosts
      const shootingEfficiencyBoost = (avgShootingEfficiency - baseShootingEfficiency) / baseShootingEfficiency;
      const reboundingStrengthBoost = (avgReboundingStrength - baseReboundingStrength) / baseReboundingStrength;
      const assistDependencyBoost = (avgAssistDependency - baseAssistDependency) / baseAssistDependency;

      console.log(`📊 Calculated boosts:`);
      console.log(`   Shooting: ${(shootingEfficiencyBoost * 100).toFixed(1)}%`);
      console.log(`   Rebounding: ${(reboundingStrengthBoost * 100).toFixed(1)}%`);
      console.log(`   Assists: ${(assistDependencyBoost * 100).toFixed(1)}%`);

      return {
        shootingEfficiencyBoost: Math.max(0, shootingEfficiencyBoost),
        reboundingStrengthBoost: Math.max(0, reboundingStrengthBoost),
        assistDependencyBoost: Math.max(0, assistDependencyBoost),
        gamesAnalyzed: teammateOutGames.length
      };

    } catch (error) {
      console.error(`Error calculating adjustment for ${injuredTeammate}:`, error);
      return null;
    }
  }

  /**
   * Calculate team shooting efficiency from actual game data
   */
  static calculateTeamShootingEfficiency(teamGames, teammateNames) {
    let totalFGM = 0;
    let totalFGA = 0;

    for (const game of teamGames) {
      if (teammateNames.includes(game.player_name)) {
        const fgm = game.field_goals_made || 0;
        const fga = game.field_goals_attempted || 0;
        
        if (fga > 0) {
          totalFGM += fgm;
          totalFGA += fga;
        }
      }
    }

    return totalFGA > 0 ? totalFGM / totalFGA : 0.45;
  }

  /**
   * Calculate team rebounding strength from actual game data
   */
  static calculateTeamReboundingStrength(teamGames, teammateNames) {
    let totalRebounds = 0;
    let totalMinutes = 0;

    for (const game of teamGames) {
      if (teammateNames.includes(game.player_name)) {
        const rebounds = game.rebounds || 0;
        const minutes = game.minutes || 0;
        
        if (minutes > 0) {
          totalRebounds += rebounds;
          totalMinutes += minutes;
        }
      }
    }

    // Calculate rebounds per 40 minutes
    return totalMinutes > 0 ? (totalRebounds / totalMinutes) * 40 : 0.35;
  }

  /**
   * Calculate team assist dependency from actual game data
   */
  static calculateTeamAssistDependency(teamGames, teammateNames) {
    let totalAssists = 0;
    let totalMinutes = 0;

    for (const game of teamGames) {
      if (teammateNames.includes(game.player_name)) {
        const assists = game.assists || 0;
        const minutes = game.minutes || 0;
        
        if (minutes > 0) {
          totalAssists += assists;
          totalMinutes += minutes;
        }
      }
    }

    // Calculate assists per 40 minutes
    return totalMinutes > 0 ? (totalAssists / totalMinutes) * 40 : 0.25;
  }

  /**
   * Calculate real shooting efficiency from actual game data
   */
  static calculateRealShootingEfficiency(games) {
    if (games.length === 0) return 0.45;

    let totalFGM = 0;
    let totalFGA = 0;

    for (const game of games) {
      const fgm = game.field_goals_made || 0;
      const fga = game.field_goals_attempted || 0;
      
      if (fga > 0) {
        totalFGM += fgm;
        totalFGA += fga;
      }
    }

    return totalFGA > 0 ? totalFGM / totalFGA : 0.45;
  }

  /**
   * Calculate real rebounding strength from actual game data
   */
  static calculateRealReboundingStrength(games) {
    if (games.length === 0) return 0.35;

    let totalRebounds = 0;
    let totalMinutes = 0;

    for (const game of games) {
      const rebounds = game.rebounds || 0;
      const minutes = game.minutes || 0;
      
      if (minutes > 0) {
        totalRebounds += rebounds;
        totalMinutes += minutes;
      }
    }

    // Calculate rebounds per 40 minutes
    return totalMinutes > 0 ? (totalRebounds / totalMinutes) * 40 : 0.35;
  }

  /**
   * Calculate real assist dependency from actual game data
   */
  static calculateRealAssistDependency(games) {
    if (games.length === 0) return 0.25;

    let totalAssists = 0;
    let totalMinutes = 0;

    for (const game of games) {
      const assists = game.assists || 0;
      const minutes = game.minutes || 0;
      
      if (minutes > 0) {
        totalAssists += assists;
        totalMinutes += minutes;
      }
    }

    // Calculate assists per 40 minutes
    return totalMinutes > 0 ? (totalAssists / totalMinutes) * 40 : 0.25;
  }

  /**
   * Get stat-specific multiplier for teammate adjustments
   */
  static getStatSpecificMultiplier(statType) {
    switch (statType) {
      case 'points':
        return { shooting: 0.20, rebounding: 0.10, assists: 0.10 }; // +20% shooting when scorer out
      case 'rebounds':
        return { shooting: 0.10, rebounding: 0.50, assists: 0.20 }; // +50% rebounding when big out
      case 'assists':
        return { shooting: 0.30, rebounding: 0.10, assists: 0.40 }; // +40% assists when playmaker out
      default:
        return { shooting: 0.10, rebounding: 0.10, assists: 0.10 };
    }
  }
}

module.exports = { LineupAdjustmentService };
