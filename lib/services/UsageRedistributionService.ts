import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export interface UsageDelta {
  playerName: string;
  teammateName: string;
  statType: 'points' | 'rebounds' | 'assists';
  position: string;
  baseUsage: number;
  adjustedUsage: number;
  usageDelta: number;
  deltaPercentage: number;
  gamesWithTeammateOut: number;
  gamesWithTeammateIn: number;
}

export interface HistoricalUsageData {
  playerName: string;
  statType: 'points' | 'rebounds' | 'assists';
  position: string;
  baseUsage: number;
  usageDeltas: UsageDelta[];
  averageDelta: number;
  confidence: number; // 0-1 based on sample size
}

export class UsageRedistributionService {
  private static readonly MIN_GAMES_FOR_DELTA = 3; // Minimum games needed to calculate reliable delta
  private static readonly CONFIDENCE_THRESHOLD = 0.7; // Minimum confidence for applying delta

  /**
   * Calculate historical usage deltas for a player when key teammates were out
   */
  static async calculateHistoricalUsageDeltas(
    playerName: string,
    team: string,
    statType: 'points' | 'rebounds' | 'assists'
  ): Promise<HistoricalUsageData | null> {
    try {
      console.log(`📊 USAGE REDISTRIBUTION: Calculating historical deltas for ${playerName} (${statType})`);

      // Get player's base usage rate
      const { data: playerStats, error: playerError } = await supabase
        .from('player_advanced_stats')
        .select('usage_percentage, position')
        .eq('player_name', playerName)
        .eq('team', team)
        .eq('season', 2025)
        .single();

      if (playerError || !playerStats) {
        console.log(`⚠️ Could not get base usage for ${playerName}`);
        return null;
      }

      const baseUsage = playerStats.usage_percentage || 0;
      const position = playerStats.position || 'Unknown';

      // Get all teammates for this team
      const { data: teammates, error: teammatesError } = await supabase
        .from('player_advanced_stats')
        .select('player_name, usage_percentage, position')
        .eq('team', team)
        .eq('season', 2025)
        .neq('player_name', playerName);

      if (teammatesError || !teammates) {
        console.log(`⚠️ Could not get teammates for ${team}`);
        return null;
      }

      // Filter for significant teammates (high usage or key positions)
      const significantTeammates = teammates.filter(teammate => {
        const usage = teammate.usage_percentage || 0;
        const pos = teammate.position || '';
        
        // High usage players (>18%) or key positions
        return usage > 18 || ['PG', 'SG', 'C'].includes(pos);
      });

      console.log(`📊 Found ${significantTeammates.length} significant teammates for analysis`);

      const usageDeltas: UsageDelta[] = [];

      // For each significant teammate, calculate usage delta when they were out
      for (const teammate of significantTeammates) {
        const delta = await this.calculateTeammateUsageDelta(
          playerName,
          team,
          teammate.player_name,
          statType,
          baseUsage,
          position
        );

        if (delta) {
          usageDeltas.push(delta);
        }
      }

      if (usageDeltas.length === 0) {
        console.log(`📊 No reliable usage deltas found for ${playerName}`);
        return null;
      }

      // Calculate average delta and confidence
      const averageDelta = usageDeltas.reduce((sum, delta) => sum + delta.deltaPercentage, 0) / usageDeltas.length;
      const totalGames = usageDeltas.reduce((sum, delta) => sum + delta.gamesWithTeammateOut, 0);
      const confidence = Math.min(1.0, totalGames / 10); // More games = higher confidence

      console.log(`📊 USAGE DELTAS for ${playerName}:`);
      console.log(`   Average Delta: ${averageDelta.toFixed(1)}%`);
      console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);
      console.log(`   Sample Size: ${totalGames} games`);

      return {
        playerName,
        statType,
        position,
        baseUsage,
        usageDeltas,
        averageDelta,
        confidence
      };

    } catch (error) {
      console.error('Error calculating historical usage deltas:', error);
      return null;
    }
  }

  /**
   * Calculate usage delta for a specific teammate
   */
  private static async calculateTeammateUsageDelta(
    playerName: string,
    team: string,
    teammateName: string,
    statType: 'points' | 'rebounds' | 'assists',
    baseUsage: number,
    position: string
  ): Promise<UsageDelta | null> {
    try {
      // Get games where teammate was out (injured or didn't play)
      const { data: gamesWithTeammateOut, error: outError } = await supabase
        .from('wnba_game_logs')
        .select('game_date, points, rebounds, assists, minutes')
        .eq('player_name', playerName)
        .eq('team', team)
        .like('game_date', '%2025%')
        .not('minutes', 'is', null)
        .gte('minutes', 15); // Only games with significant minutes

      if (outError || !gamesWithTeammateOut) {
        return null;
      }

      // Get games where teammate was in (played)
      const { data: gamesWithTeammateIn, error: inError } = await supabase
        .from('wnba_game_logs')
        .select('game_date, points, rebounds, assists, minutes')
        .eq('player_name', playerName)
        .eq('team', team)
        .like('game_date', '%2025%')
        .not('minutes', 'is', null)
        .gte('minutes', 15);

      if (inError || !gamesWithTeammateIn) {
        return null;
      }

      // Get actual games where the teammate played to find when they were out
      const { data: teammateGames, error: teammateError } = await supabase
        .from('wnba_game_logs')
        .select('game_date, minutes')
        .eq('player_name', teammateName)
        .eq('team', team)
        .like('game_date', '%2025%')
        .order('game_date', { ascending: true });

      if (teammateError || !teammateGames) {
        return null;
      }

      // Create a set of dates when the teammate played
      const teammateGameDates = new Set(teammateGames.map(game => game.game_date));

      // Find games where the player played but the teammate didn't (teammate was out)
      const teammateOutGames = gamesWithTeammateOut.filter(playerGame => {
        return !teammateGameDates.has(playerGame.game_date);
      });

      // Find games where both played (baseline)
      const teammateInGames = gamesWithTeammateIn.filter(playerGame => {
        return teammateGameDates.has(playerGame.game_date);
      });

      if (teammateOutGames.length < this.MIN_GAMES_FOR_DELTA || teammateInGames.length < this.MIN_GAMES_FOR_DELTA) {
        return null;
      }

      // Calculate average usage in each scenario
      const avgUsageWithTeammateOut = teammateOutGames.reduce((sum, game) => {
        return sum + this.calculateGameUsage(game, statType);
      }, 0) / teammateOutGames.length;

      const avgUsageWithTeammateIn = teammateInGames.reduce((sum, game) => {
        return sum + this.calculateGameUsage(game, statType);
      }, 0) / teammateInGames.length;

      const usageDelta = avgUsageWithTeammateOut - avgUsageWithTeammateIn;
      const deltaPercentage = (usageDelta / avgUsageWithTeammateIn) * 100;

      return {
        playerName,
        teammateName,
        statType,
        position,
        baseUsage: avgUsageWithTeammateIn,
        adjustedUsage: avgUsageWithTeammateOut,
        usageDelta,
        deltaPercentage,
        gamesWithTeammateOut: teammateOutGames.length,
        gamesWithTeammateIn: teammateInGames.length
      };

    } catch (error) {
      console.error(`Error calculating delta for ${teammateName}:`, error);
      return null;
    }
  }

  /**
   * Calculate game-level usage for a specific stat
   */
  private static calculateGameUsage(game: any, statType: 'points' | 'rebounds' | 'assists'): number {
    const statValue = game[statType] || 0;
    const minutes = game.minutes || 1;
    
    // Simple usage calculation: stat per minute * 40 (assuming 40-minute game)
    return (statValue / minutes) * 40;
  }

  /**
   * Get adjusted usage rate for a player when specific teammates are out
   */
  static async getAdjustedUsageRate(
    playerName: string,
    team: string,
    statType: 'points' | 'rebounds' | 'assists',
    injuredTeammates: string[]
  ): Promise<number> {
    try {
      // Get historical usage data
      const historicalData = await this.calculateHistoricalUsageDeltas(playerName, team, statType);
      
      if (!historicalData || historicalData.confidence < this.CONFIDENCE_THRESHOLD) {
        console.log(`📊 Insufficient data for usage redistribution for ${playerName}`);
        return historicalData?.baseUsage || 0;
      }

      // Calculate stat-specific boost based on historical data
      let totalBoost = 0;
      let appliedBoosts = 0;

      for (const injuredTeammate of injuredTeammates) {
        // Find historical delta for this teammate
        const delta = historicalData.usageDeltas.find(d => d.teammateName === injuredTeammate);
        
        if (delta) {
          // Apply stat-specific multiplier
          const statMultiplier = this.getStatSpecificMultiplier(statType, delta.position);
          const adjustedDelta = delta.deltaPercentage * statMultiplier;
          
          totalBoost += adjustedDelta;
          appliedBoosts++;
          
          console.log(`📊 ${playerName} gets ${adjustedDelta.toFixed(1)}% boost due to ${injuredTeammate} being out`);
        }
      }

      if (appliedBoosts === 0) {
        return historicalData.baseUsage;
      }

      // Calculate final adjusted usage
      const averageBoost = totalBoost / appliedBoosts;
      const adjustedUsage = historicalData.baseUsage * (1 + averageBoost / 100);

      console.log(`📊 USAGE REDISTRIBUTION: ${playerName} base usage ${historicalData.baseUsage.toFixed(1)}% → adjusted ${adjustedUsage.toFixed(1)}% (+${averageBoost.toFixed(1)}%)`);

      return adjustedUsage;

    } catch (error) {
      console.error('Error getting adjusted usage rate:', error);
      return 0;
    }
  }

  /**
   * Get stat-specific multiplier based on position and stat type
   */
  private static getStatSpecificMultiplier(
    statType: 'points' | 'rebounds' | 'assists',
    position: string
  ): number {
    const multipliers: Record<string, Record<string, number>> = {
      'points': {
        'PG': 1.0,   // Guards get normal boost for points
        'SG': 1.0,
        'SF': 1.2,   // Forwards get higher boost for points
        'PF': 1.2,
        'C': 1.1    // Centers get moderate boost for points
      },
      'rebounds': {
        'PG': 0.8,   // Guards get lower boost for rebounds
        'SG': 0.8,
        'SF': 1.0,   // Forwards get normal boost for rebounds
        'PF': 1.3,   // Power forwards get highest boost for rebounds
        'C': 1.5     // Centers get highest boost for rebounds
      },
      'assists': {
        'PG': 1.4,   // Point guards get highest boost for assists
        'SG': 1.2,   // Shooting guards get high boost for assists
        'SF': 0.9,   // Forwards get lower boost for assists
        'PF': 0.8,
        'C': 0.7     // Centers get lowest boost for assists
      }
    };

    return multipliers[statType]?.[position] || 1.0;
  }

  /**
   * Calculate projection boost based on usage redistribution
   */
  static async calculateUsageRedistributionBoost(
    playerName: string,
    team: string,
    statType: 'points' | 'rebounds' | 'assists',
    injuredTeammates: string[]
  ): Promise<number> {
    try {
      const adjustedUsage = await this.getAdjustedUsageRate(playerName, team, statType, injuredTeammates);
      
      if (adjustedUsage === 0) {
        return 1.0; // No boost if no data
      }

      // Get base usage for comparison
      const { data: playerStats } = await supabase
        .from('player_advanced_stats')
        .select('usage_percentage')
        .eq('player_name', playerName)
        .eq('team', team)
        .eq('season', 2025)
        .single();

      const baseUsage = playerStats?.usage_percentage || 0;
      
      if (baseUsage === 0) {
        return 1.0;
      }

      // Calculate boost factor based on usage increase
      const usageIncrease = (adjustedUsage - baseUsage) / baseUsage;
      
      // Convert usage increase to projection boost
      // Higher usage increase = higher projection boost
      const boostFactor = 1.0 + (usageIncrease * 0.5); // 50% of usage increase becomes projection boost
      
      // Cap the boost to reasonable levels
      const cappedBoost = Math.min(1.4, Math.max(0.9, boostFactor));
      
      console.log(`📊 USAGE REDISTRIBUTION BOOST: ${playerName} gets ${((cappedBoost - 1) * 100).toFixed(1)}% projection boost`);
      
      return cappedBoost;

    } catch (error) {
      console.error('Error calculating usage redistribution boost:', error);
      return 1.0;
    }
  }
}
