import { createClient } from '@supabase/supabase-js';

/**
 * Service for calculating assist-specific analytics and metrics
 */
export class AssistAnalyticsService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Calculate assist consistency score based on variance
   */
  async calculateAssistConsistency(playerName: string, season: string = '2025'): Promise<number> {
    try {
      const { data: playerStats, error } = await this.supabase
        .from('wnba_game_logs')
        .select('assists, game_date')
        .eq('player_name', playerName)
        .eq('season', season)
        .not('assists', 'is', null)
        .order('game_date', { ascending: false });

      if (error || !playerStats || playerStats.length < 5) {
        return 0.5; // Default consistency for insufficient data
      }

      const assistValues = playerStats.map(game => game.assists).filter(val => val !== undefined && !isNaN(val));
      
      if (assistValues.length < 5) {
        return 0.5;
      }

      // Calculate mean and standard deviation
      const mean = assistValues.reduce((sum, val) => sum + val, 0) / assistValues.length;
      const variance = assistValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / assistValues.length;
      const stdDev = Math.sqrt(variance);

      // Calculate coefficient of variation (CV = stdDev / mean)
      const cv = mean > 0 ? stdDev / mean : 1;

      // Convert CV to consistency score (lower CV = higher consistency)
      // WNBA assist CV typically ranges from 0.3 (very consistent) to 1.2 (very inconsistent)
      let consistencyScore = 1.0;
      
      if (cv <= 0.4) {
        consistencyScore = 0.95; // Very consistent
      } else if (cv <= 0.6) {
        consistencyScore = 0.85; // Consistent
      } else if (cv <= 0.8) {
        consistencyScore = 0.75; // Moderately consistent
      } else if (cv <= 1.0) {
        consistencyScore = 0.65; // Inconsistent
      } else {
        consistencyScore = 0.55; // Very inconsistent
      }

      return consistencyScore;

    } catch (error) {
      console.error('Error calculating assist consistency:', error);
      return 0.5;
    }
  }

  /**
   * Calculate assist efficiency trends (recent vs season average)
   */
  async calculateAssistEfficiencyTrend(playerName: string, season: string = '2025'): Promise<{
    recentEfficiency: number;
    seasonEfficiency: number;
    trend: 'improving' | 'declining' | 'stable';
    trendStrength: number;
  }> {
    try {
      const { data: playerStats, error } = await this.supabase
        .from('wnba_game_logs')
        .select('assists, fga, fta, turnovers, game_date')
        .eq('player_name', playerName)
        .eq('season', season)
        .not('assists', 'is', null)
        .order('game_date', { ascending: false });

      if (error || !playerStats || playerStats.length < 10) {
        return {
          recentEfficiency: 0.15,
          seasonEfficiency: 0.15,
          trend: 'stable',
          trendStrength: 0
        };
      }

      // Calculate Hollinger assist ratio for recent games (last 10) vs season
      const recentGames = playerStats.slice(0, 10);
      const seasonGames = playerStats;

      const recentEfficiency = this.calculateHollingerAssistRatio(recentGames);
      const seasonEfficiency = this.calculateHollingerAssistRatio(seasonGames);

      // Determine trend
      const efficiencyChange = recentEfficiency - seasonEfficiency;
      const changePercentage = seasonEfficiency > 0 ? (efficiencyChange / seasonEfficiency) * 100 : 0;

      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      let trendStrength = 0;

      if (changePercentage > 10) {
        trend = 'improving';
        trendStrength = Math.min(Math.abs(changePercentage) / 20, 1); // Cap at 1.0
      } else if (changePercentage < -10) {
        trend = 'declining';
        trendStrength = Math.min(Math.abs(changePercentage) / 20, 1);
      }

      return {
        recentEfficiency,
        seasonEfficiency,
        trend,
        trendStrength
      };

    } catch (error) {
      console.error('Error calculating assist efficiency trend:', error);
      return {
        recentEfficiency: 0.15,
        seasonEfficiency: 0.15,
        trend: 'stable',
        trendStrength: 0
      };
    }
  }

  /**
   * Calculate Hollinger assist ratio: AST / (FGA + 0.475 * FTA + AST + TOV)
   */
  private calculateHollingerAssistRatio(games: any[]): number {
    let totalAssists = 0;
    let totalFGA = 0;
    let totalFTA = 0;
    let totalTOV = 0;

    games.forEach(game => {
      totalAssists += game.assists || 0;
      totalFGA += game.fga || 0;
      totalFTA += game.fta || 0;
      totalTOV += game.turnovers || 0;
    });

    const denominator = totalFGA + 0.475 * totalFTA + totalAssists + totalTOV;
    
    if (denominator === 0) return 0;
    
    return totalAssists / denominator;
  }

  /**
   * Calculate assist distribution by game situation
   */
  async calculateAssistDistribution(playerName: string, season: string = '2025'): Promise<{
    homeAssists: number;
    awayAssists: number;
    closeGameAssists: number; // Games within 10 points
    blowoutAssists: number; // Games with 20+ point margin
    clutchAssists: number; // 4th quarter assists
  }> {
    try {
      const { data: playerStats, error } = await this.supabase
        .from('wnba_game_logs')
        .select('assists, is_home, game_date, team_score, opponent_score')
        .eq('player_name', playerName)
        .eq('season', season)
        .not('assists', 'is', null);

      if (error || !playerStats) {
        return {
          homeAssists: 0,
          awayAssists: 0,
          closeGameAssists: 0,
          blowoutAssists: 0,
          clutchAssists: 0
        };
      }

      let homeAssists = 0;
      let awayAssists = 0;
      let closeGameAssists = 0;
      let blowoutAssists = 0;
      let clutchAssists = 0;

      playerStats.forEach(game => {
        const assists = game.assists || 0;
        const margin = Math.abs((game.team_score || 0) - (game.opponent_score || 0));

        if (game.is_home) {
          homeAssists += assists;
        } else {
          awayAssists += assists;
        }

        if (margin <= 10) {
          closeGameAssists += assists;
        } else if (margin >= 20) {
          blowoutAssists += assists;
        }
      });

      return {
        homeAssists,
        awayAssists,
        closeGameAssists,
        blowoutAssists,
        clutchAssists: 0 // Would need 4th quarter data to calculate
      };

    } catch (error) {
      console.error('Error calculating assist distribution:', error);
      return {
        homeAssists: 0,
        awayAssists: 0,
        closeGameAssists: 0,
        blowoutAssists: 0,
        clutchAssists: 0
      };
    }
  }

  /**
   * Calculate assist quality metrics
   */
  async calculateAssistQualityMetrics(playerName: string, season: string = '2025'): Promise<{
    assistToTurnoverRatio: number;
    assistToFieldGoalRatio: number;
    potentialAssistRate: number; // Estimated based on team shooting
    assistEfficiency: number;
  }> {
    try {
      const { data: playerStats, error } = await this.supabase
        .from('wnba_game_logs')
        .select('assists, turnovers, fga, fta, team, game_date')
        .eq('player_name', playerName)
        .eq('season', season)
        .not('assists', 'is', null);

      if (error || !playerStats || playerStats.length === 0) {
        return {
          assistToTurnoverRatio: 0,
          assistToFieldGoalRatio: 0,
          potentialAssistRate: 0,
          assistEfficiency: 0
        };
      }

      let totalAssists = 0;
      let totalTurnovers = 0;
      let totalFGA = 0;
      let totalFTA = 0;

      playerStats.forEach(game => {
        totalAssists += game.assists || 0;
        totalTurnovers += game.turnovers || 0;
        totalFGA += game.fga || 0;
        totalFTA += game.fta || 0;
      });

      // Calculate ratios
      const assistToTurnoverRatio = totalTurnovers > 0 ? totalAssists / totalTurnovers : totalAssists;
      const assistToFieldGoalRatio = (totalFGA + totalFTA * 0.44) > 0 ? totalAssists / (totalFGA + totalFTA * 0.44) : 0;

      // Estimate potential assist rate based on team shooting (simplified)
      const potentialAssistRate = totalAssists > 0 ? Math.min(totalAssists * 1.2, 15) : 0; // Assume 20% more potential

      // Overall assist efficiency (combination of ratios)
      const assistEfficiency = (
        (assistToTurnoverRatio * 0.4) +
        (assistToFieldGoalRatio * 0.4) +
        (potentialAssistRate / 10 * 0.2)
      ) / 1.0;

      return {
        assistToTurnoverRatio,
        assistToFieldGoalRatio,
        potentialAssistRate,
        assistEfficiency
      };

    } catch (error) {
      console.error('Error calculating assist quality metrics:', error);
      return {
        assistToTurnoverRatio: 0,
        assistToFieldGoalRatio: 0,
        potentialAssistRate: 0,
        assistEfficiency: 0
      };
    }
  }

  /**
   * Calculate matchup-specific assist performance
   */
  async calculateMatchupAssistPerformance(
    playerName: string, 
    opponent: string, 
    season: string = '2025'
  ): Promise<{
    h2hAssists: number;
    h2hGames: number;
    h2hEfficiency: number;
    opponentAssistDefense: number;
    matchupAdvantage: 'favorable' | 'neutral' | 'unfavorable';
  }> {
    try {
      // Get head-to-head data
      const { data: h2hStats, error: h2hError } = await this.supabase
        .from('wnba_game_logs')
        .select('assists, fga, fta, turnovers')
        .eq('player_name', playerName)
        .eq('opponent', opponent)
        .eq('season', season)
        .not('assists', 'is', null);

      if (h2hError || !h2hStats || h2hStats.length === 0) {
        return {
          h2hAssists: 0,
          h2hGames: 0,
          h2hEfficiency: 0,
          opponentAssistDefense: 0,
          matchupAdvantage: 'neutral'
        };
      }

      const h2hGames = h2hStats.length;
      const h2hAssists = h2hStats.reduce((sum, game) => sum + (game.assists || 0), 0);
      const h2hEfficiency = this.calculateHollingerAssistRatio(h2hStats);

      // Get opponent's assist defense
      const { data: opponentDefense, error: defenseError } = await this.supabase
        .from('team_defensive_stats')
        .select('opp_ast')
        .eq('team', opponent)
        .eq('stat_type', 'assists')
        .eq('season', season)
        .single();

      const opponentAssistDefense = opponentDefense?.opp_ast || 18.5;
      const leagueAverage = 18.5;
      const defensiveRatio = opponentAssistDefense / leagueAverage;

      // Determine matchup advantage
      let matchupAdvantage: 'favorable' | 'neutral' | 'unfavorable' = 'neutral';
      
      if (defensiveRatio > 1.1) {
        matchupAdvantage = 'favorable'; // Opponent allows more assists
      } else if (defensiveRatio < 0.9) {
        matchupAdvantage = 'unfavorable'; // Opponent suppresses assists
      }

      return {
        h2hAssists,
        h2hGames,
        h2hEfficiency,
        opponentAssistDefense,
        matchupAdvantage
      };

    } catch (error) {
      console.error('Error calculating matchup assist performance:', error);
      return {
        h2hAssists: 0,
        h2hGames: 0,
        h2hEfficiency: 0,
        opponentAssistDefense: 0,
        matchupAdvantage: 'neutral'
      };
    }
  }

  /**
   * Calculate assist streak analysis
   */
  async calculateAssistStreakAnalysis(playerName: string, season: string = '2025'): Promise<{
    currentStreak: number;
    longestStreak: number;
    averageStreak: number;
    streakConsistency: number;
  }> {
    try {
      const { data: playerStats, error } = await this.supabase
        .from('wnba_game_logs')
        .select('assists, game_date')
        .eq('player_name', playerName)
        .eq('season', season)
        .not('assists', 'is', null)
        .order('game_date', { ascending: false });

      if (error || !playerStats || playerStats.length === 0) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          averageStreak: 0,
          streakConsistency: 0
        };
      }

      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      let totalStreaks = 0;
      let streakSum = 0;

      // Calculate streaks (consecutive games with assists)
      for (let i = 0; i < playerStats.length; i++) {
        const hasAssists = (playerStats[i].assists || 0) > 0;
        
        if (hasAssists) {
          tempStreak++;
          if (i === 0) currentStreak = tempStreak; // Current streak
        } else {
          if (tempStreak > 0) {
            longestStreak = Math.max(longestStreak, tempStreak);
            streakSum += tempStreak;
            totalStreaks++;
          }
          tempStreak = 0;
        }
      }

      // Handle case where streak continues to end of season
      if (tempStreak > 0) {
        longestStreak = Math.max(longestStreak, tempStreak);
        streakSum += tempStreak;
        totalStreaks++;
      }

      const averageStreak = totalStreaks > 0 ? streakSum / totalStreaks : 0;
      const streakConsistency = totalStreaks > 0 ? (totalStreaks / playerStats.length) : 0;

      return {
        currentStreak,
        longestStreak,
        averageStreak,
        streakConsistency
      };

    } catch (error) {
      console.error('Error calculating assist streak analysis:', error);
      return {
        currentStreak: 0,
        longestStreak: 0,
        averageStreak: 0,
        streakConsistency: 0
      };
    }
  }
}
