import { createClient } from '@supabase/supabase-js';

/**
 * Service for handling back-to-back game detection and fatigue adjustments
 * Higher PACE = more possessions = more scoring opportunities
 */
export class BackToBackService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Check if a team is playing back-to-back games (consecutive days)
   * This affects player performance due to fatigue
   */
  async checkBackToBackGames(team: string, gameDate: string): Promise<number> {
    try {
      // Parse the current game date
      const currentGameDate = new Date(gameDate);
      if (isNaN(currentGameDate.getTime())) {
        console.log(`  ⚠️  Invalid game date format: ${gameDate}, skipping back-to-back check`);
        return 1.0;
      }

      // Get the previous day's date
      const previousDay = new Date(currentGameDate);
      previousDay.setDate(previousDay.getDate() - 1);

      // Format dates for database query (YYYY-MM-DD)
      const currentDateString = currentGameDate.toISOString().split('T')[0];
      const previousDateString = previousDay.toISOString().split('T')[0];

      console.log(`  🔍 Checking for back-to-back games:`);
      console.log(`    - Current game: ${currentDateString}`);
      console.log(`    - Previous day: ${previousDateString}`);

      // Check if the team played a game on the previous day
      const { data: previousGame, error } = await this.supabase
        .from('wnba_game_logs')
        .select('game_date, opponent, team')
        .eq('team', team)
        .ilike('game_date', `%${previousDateString}%`)
        .limit(1);

      if (error) {
        console.log(`  ⚠️  Error checking previous day game: ${error.message}`);
        return 1.0;
      }

      if (previousGame && previousGame.length > 0) {
        const prevGame = previousGame[0];
        // Determine if previous game was home/away based on team name pattern
        const wasHomeGame = prevGame.team.includes('Table');
        console.log(`  ⚠️  BACK-TO-BACK DETECTED!`);
        console.log(`    - Previous game: ${prevGame.game_date} vs ${prevGame.opponent} (${wasHomeGame ? 'Home' : 'Away'})`);
        console.log(`    - Current game: ${currentDateString} vs ${team}`);

        // Apply back-to-back penalty based on research
        // WNBA players typically see 3-8% reduction in performance on back-to-backs
        // Factors: travel, fatigue, less recovery time
        const backToBackPenalty = 0.94; // -6% reduction
        console.log(`  📉 Applying back-to-back penalty: ×${backToBackPenalty} (-6% due to fatigue)`);

        return backToBackPenalty;
      } else {
        console.log(`  ✅ No back-to-back detected (team had rest day)`);
        return 1.0; // No adjustment needed
      }

    } catch (error) {
      console.error(`  ❌ Error in checkBackToBackGames:`, error);
      return 1.0; // Default to no adjustment on error
    }
  }

  /**
   * Get back-to-back statistics for a team in a given date range
   * Useful for analysis and reporting
   */
  async getBackToBackStats(team: string, startDate: string, endDate: string): Promise<{
    totalGames: number;
    backToBackGames: number;
    backToBackPercentage: number;
    averageFatigueImpact: number;
  }> {
    try {
      const { data: games, error } = await this.supabase
        .from('wnba_game_logs')
        .select('game_date, team')
        .eq('team', team)
        .gte('game_date', startDate)
        .lte('game_date', endDate)
        .order('game_date', { ascending: true });

      if (error || !games) {
        throw new Error(`Failed to fetch games: ${error?.message}`);
      }

      let backToBackCount = 0;
      let totalFatigueImpact = 0;

      for (let i = 1; i < games.length; i++) {
        const currentGame = new Date(games[i].game_date);
        const previousGame = new Date(games[i - 1].game_date);
        
        const daysDiff = (currentGame.getTime() - previousGame.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff === 1) {
          backToBackCount++;
          totalFatigueImpact += 0.06; // 6% fatigue impact
        }
      }

      const totalGames = games.length;
      const backToBackPercentage = totalGames > 0 ? (backToBackCount / totalGames) * 100 : 0;
      const averageFatigueImpact = backToBackCount > 0 ? totalFatigueImpact / backToBackCount : 0;

      return {
        totalGames,
        backToBackGames: backToBackCount,
        backToBackPercentage,
        averageFatigueImpact
      };

    } catch (error) {
      console.error('Error getting back-to-back stats:', error);
      return {
        totalGames: 0,
        backToBackGames: 0,
        backToBackPercentage: 0,
        averageFatigueImpact: 0
      };
    }
  }
}
