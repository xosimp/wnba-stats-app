import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export interface TeammateAdjustment {
  playerName: string;
  team: string;
  statType: 'points' | 'rebounds' | 'assists';
  injuredTeammates: string[];
  adjustedTeammateShootingEfficiency: number;
  adjustedTeammateReboundingStrength: number;
  adjustedTeammateAssistDependency: number;
  lineupShiftMultiplier: number;
  confidence: number;
}

export interface HistoricalLineupData {
  playerName: string;
  team: string;
  statType: 'points' | 'rebounds' | 'assists';
  baseTeammateShootingEfficiency: number;
  baseTeammateReboundingStrength: number;
  baseTeammateAssistDependency: number;
  injuryAdjustments: {
    [teammateName: string]: {
      shootingEfficiencyBoost: number;
      reboundingStrengthBoost: number;
      assistDependencyBoost: number;
      gamesAnalyzed: number;
    };
  };
}

export class LineupAdjustmentService {
  private static readonly MIN_GAMES_FOR_LINEUP_ANALYSIS = 3;
  private static readonly CONFIDENCE_THRESHOLD = 0.6;

  /**
   * Calculate adjusted teammate efficiency metrics when key players are out
   */
  static async calculateTeammateAdjustments(
    playerName: string,
    team: string,
    statType: 'points' | 'rebounds' | 'assists',
    injuredTeammates: string[]
  ): Promise<TeammateAdjustment | null> {
    try {
      console.log(`🏀 LINEUP ADJUSTMENT: Calculating teammate effects for ${playerName} (${statType})`);

      // Get historical lineup data
      const historicalData = await this.getHistoricalLineupData(playerName, team, statType);
      
      if (!historicalData) {
        console.log(`⚠️ No historical lineup data for ${playerName}`);
        return null;
      }

      // Calculate base teammate metrics
      const baseShootingEfficiency = historicalData.baseTeammateShootingEfficiency;
      const baseReboundingStrength = historicalData.baseTeammateReboundingStrength;
      const baseAssistDependency = historicalData.baseTeammateAssistDependency;

      console.log(`📊 Base teammate metrics for ${playerName}:`);
      console.log(`   Shooting Efficiency: ${baseShootingEfficiency.toFixed(3)}`);
      console.log(`   Rebounding Strength: ${baseReboundingStrength.toFixed(3)}`);
      console.log(`   Assist Dependency: ${baseAssistDependency.toFixed(3)}`);

      // Calculate adjustments for each injured teammate
      let totalShootingBoost = 0;
      let totalReboundingBoost = 0;
      let totalAssistBoost = 0;
      let appliedAdjustments = 0;

      for (const injuredTeammate of injuredTeammates) {
        const adjustment = historicalData.injuryAdjustments[injuredTeammate];
        
        if (adjustment && adjustment.gamesAnalyzed >= this.MIN_GAMES_FOR_LINEUP_ANALYSIS) {
          // Apply stat-specific multipliers
          const shootingMultiplier = this.getStatSpecificMultiplier(statType, 'shooting');
          const reboundingMultiplier = this.getStatSpecificMultiplier(statType, 'rebounding');
          const assistMultiplier = this.getStatSpecificMultiplier(statType, 'assists');

          totalShootingBoost += adjustment.shootingEfficiencyBoost * shootingMultiplier;
          totalReboundingBoost += adjustment.reboundingStrengthBoost * reboundingMultiplier;
          totalAssistBoost += adjustment.assistDependencyBoost * assistMultiplier;
          appliedAdjustments++;

          console.log(`📊 ${injuredTeammate} injury effects:`);
          console.log(`   Shooting: +${(adjustment.shootingEfficiencyBoost * shootingMultiplier * 100).toFixed(1)}%`);
          console.log(`   Rebounding: +${(adjustment.reboundingStrengthBoost * reboundingMultiplier * 100).toFixed(1)}%`);
          console.log(`   Assists: +${(adjustment.assistDependencyBoost * assistMultiplier * 100).toFixed(1)}%`);
        }
      }

      if (appliedAdjustments === 0) {
        console.log(`⚠️ No reliable injury adjustments found for ${playerName}`);
        return null;
      }

      // Calculate final adjusted metrics
      const averageShootingBoost = totalShootingBoost / appliedAdjustments;
      const averageReboundingBoost = totalReboundingBoost / appliedAdjustments;
      const averageAssistBoost = totalAssistBoost / appliedAdjustments;

      const adjustedShootingEfficiency = baseShootingEfficiency * (1 + averageShootingBoost);
      const adjustedReboundingStrength = baseReboundingStrength * (1 + averageReboundingBoost);
      const adjustedAssistDependency = baseAssistDependency * (1 + averageAssistBoost);

      // Calculate lineup shift multiplier (overall team efficiency change)
      const lineupShiftMultiplier = this.calculateLineupShiftMultiplier(
        statType,
        averageShootingBoost,
        averageReboundingBoost,
        averageAssistBoost
      );

      // Calculate confidence based on sample size
      const confidence = Math.min(1.0, appliedAdjustments / 3);

      console.log(`🎯 FINAL ADJUSTMENTS for ${playerName}:`);
      console.log(`   Adjusted Shooting Efficiency: ${adjustedShootingEfficiency.toFixed(3)} (+${(averageShootingBoost * 100).toFixed(1)}%)`);
      console.log(`   Adjusted Rebounding Strength: ${adjustedReboundingStrength.toFixed(3)} (+${(averageReboundingBoost * 100).toFixed(1)}%)`);
      console.log(`   Adjusted Assist Dependency: ${adjustedAssistDependency.toFixed(3)} (+${(averageAssistBoost * 100).toFixed(1)}%)`);
      console.log(`   Lineup Shift Multiplier: ${lineupShiftMultiplier.toFixed(3)}`);
      console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);

      return {
        playerName,
        team,
        statType,
        injuredTeammates,
        adjustedTeammateShootingEfficiency: adjustedShootingEfficiency,
        adjustedTeammateReboundingStrength: adjustedReboundingStrength,
        adjustedTeammateAssistDependency: adjustedAssistDependency,
        lineupShiftMultiplier,
        confidence
      };

    } catch (error) {
      console.error('Error calculating teammate adjustments:', error);
      return null;
    }
  }

  /**
   * Get historical lineup data for a player using real game data
   */
  private static async getHistoricalLineupData(
    playerName: string,
    team: string,
    statType: 'points' | 'rebounds' | 'assists'
  ): Promise<HistoricalLineupData | null> {
    try {
      console.log(`🔍 Getting historical lineup data for ${playerName} (${team})`);

      // Get all teammates for this team from game logs (more accurate than advanced stats)
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
      const injuryAdjustments: { [teammateName: string]: any } = {};

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
   * Uses real historical data to find games where the teammate was actually injured/out
   */
  private static async calculateTeammateInjuryAdjustment(
    playerName: string,
    team: string,
    injuredTeammate: string,
    statType: 'points' | 'rebounds' | 'assists',
    baseShootingEfficiency: number,
    baseReboundingStrength: number,
    baseAssistDependency: number
  ): Promise<any> {
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
   * Calculate game-level usage
   */
  private static calculateGameUsage(game: any, statType: 'points' | 'rebounds' | 'assists'): number {
    const statValue = game[statType] || 0;
    const minutes = game.minutes || 1;
    return (statValue / minutes) * 40; // Normalize to 40-minute game
  }

  /**
   * Calculate team shooting efficiency from actual game data
   */
  private static calculateTeamShootingEfficiency(teamGames: any[], teammateNames: string[]): number {
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
  private static calculateTeamReboundingStrength(teamGames: any[], teammateNames: string[]): number {
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
  private static calculateTeamAssistDependency(teamGames: any[], teammateNames: string[]): number {
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
  private static calculateRealShootingEfficiency(games: any[]): number {
    if (games.length === 0) return 0.45; // Default if no games

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
  private static calculateRealReboundingStrength(games: any[]): number {
    if (games.length === 0) return 0.35; // Default if no games

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
  private static calculateRealAssistDependency(games: any[]): number {
    if (games.length === 0) return 0.25; // Default if no games

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
  private static getStatSpecificMultiplier(
    statType: 'points' | 'rebounds' | 'assists',
    metricType: 'shooting' | 'rebounding' | 'assists'
  ): number {
    const multipliers: Record<string, Record<string, number>> = {
      'points': {
        'shooting': 1.2,    // Points model benefits from shooting efficiency
        'rebounding': 0.8,  // Points model less affected by rebounding
        'assists': 0.9      // Points model slightly affected by assists
      },
      'rebounds': {
        'shooting': 0.7,    // Rebounds model less affected by shooting
        'rebounding': 1.5,  // Rebounds model highly affected by rebounding
        'assists': 0.8      // Rebounds model slightly affected by assists
      },
      'assists': {
        'shooting': 1.3,    // Assists model benefits from shooting efficiency
        'rebounding': 0.6,  // Assists model less affected by rebounding
        'assists': 1.4      // Assists model highly affected by assists
      }
    };

    return multipliers[statType]?.[metricType] || 1.0;
  }

  /**
   * Calculate overall lineup shift multiplier
   */
  private static calculateLineupShiftMultiplier(
    statType: 'points' | 'rebounds' | 'assists',
    shootingBoost: number,
    reboundingBoost: number,
    assistBoost: number
  ): number {
    // Weight the boosts based on stat type importance
    const weights = {
      'points': { shooting: 0.6, rebounding: 0.2, assists: 0.2 },
      'rebounds': { shooting: 0.1, rebounding: 0.7, assists: 0.2 },
      'assists': { shooting: 0.4, rebounding: 0.1, assists: 0.5 }
    };

    const statWeights = weights[statType];
    const weightedBoost = (
      shootingBoost * statWeights.shooting +
      reboundingBoost * statWeights.rebounding +
      assistBoost * statWeights.assists
    );

    // Convert to multiplier (1.0 = no change, 1.1 = 10% boost)
    return 1.0 + (weightedBoost * 0.5); // 50% of weighted boost becomes multiplier
  }

  /**
   * Apply lineup adjustments to model features
   */
  static async applyLineupAdjustments(
    playerName: string,
    team: string,
    statType: 'points' | 'rebounds' | 'assists',
    injuredTeammates: string[],
    baseFeatures: any
  ): Promise<any> {
    try {
      if (injuredTeammates.length === 0) {
        return baseFeatures; // No adjustments needed
      }

      // Get lineup adjustments
      const adjustments = await this.calculateTeammateAdjustments(
        playerName,
        team,
        statType,
        injuredTeammates
      );

      if (!adjustments || adjustments.confidence < this.CONFIDENCE_THRESHOLD) {
        console.log(`⚠️ Insufficient data for lineup adjustments for ${playerName}`);
        return baseFeatures;
      }

      // Apply adjustments to relevant features
      const adjustedFeatures = { ...baseFeatures };

      // Adjust teammate efficiency features
      if (baseFeatures.teammate_shooting_efficiency !== undefined) {
        adjustedFeatures.teammate_shooting_efficiency = adjustments.adjustedTeammateShootingEfficiency;
        console.log(`🏀 Adjusted teammate shooting efficiency: ${baseFeatures.teammate_shooting_efficiency.toFixed(3)} → ${adjustments.adjustedTeammateShootingEfficiency.toFixed(3)}`);
      }

      if (baseFeatures.teammate_rebounding_strength !== undefined) {
        adjustedFeatures.teammate_rebounding_strength = adjustments.adjustedTeammateReboundingStrength;
        console.log(`🏀 Adjusted teammate rebounding strength: ${baseFeatures.teammate_rebounding_strength.toFixed(3)} → ${adjustments.adjustedTeammateReboundingStrength.toFixed(3)}`);
      }

      if (baseFeatures.teammate_assist_dependency !== undefined) {
        adjustedFeatures.teammate_assist_dependency = adjustments.adjustedTeammateAssistDependency;
        console.log(`🏀 Adjusted teammate assist dependency: ${baseFeatures.teammate_assist_dependency.toFixed(3)} → ${adjustments.adjustedTeammateAssistDependency.toFixed(3)}`);
      }

      // Apply lineup shift multiplier to overall projection
      adjustedFeatures.lineup_shift_multiplier = adjustments.lineupShiftMultiplier;

      console.log(`🏀 LINEUP ADJUSTMENTS APPLIED: ${playerName} gets ${((adjustments.lineupShiftMultiplier - 1) * 100).toFixed(1)}% overall boost`);

      return adjustedFeatures;

    } catch (error) {
      console.error('Error applying lineup adjustments:', error);
      return baseFeatures;
    }
  }
}
