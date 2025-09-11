import { createClient } from '@supabase/supabase-js';

/**
 * Service for handling game outcomes and results
 * Retrieves actual game results to compare against projections
 */
export class GameOutcomeService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get the outcome of a specific game for a player
   * Returns outcome (OVER/UNDER/PUSH), actual value, and stat type
   */
  async getGameOutcome(
    playerName: string,
    team: string,
    opponent: string,
    gameDate: string,
    statType: string
  ): Promise<{ outcome: string; actualValue: number; statType: string }> {
    try {
      console.log(`  🎯 Getting game outcome for ${playerName} vs ${opponent} on ${gameDate}`);

      // Extract the date part from the game date (e.g., "Fri, May 16, 2025" -> "2025-05-16")
      const date = new Date(gameDate);
      if (isNaN(date.getTime())) {
        console.log(`  ⚠️  Invalid game date format: ${gameDate}`);
        return { outcome: '', actualValue: 0, statType: '' };
      }

      const dateString = date.toISOString().split('T')[0];

      // Find the game log for this player on this date
      const { data: gameLog, error } = await this.supabase
        .from('wnba_game_logs')
        .select('*')
        .eq('player_name', playerName)
        .eq('team', team)
        .ilike('game_date', `%${dateString}%`)
        .limit(1);

      if (error) {
        console.log(`  ⚠️  Error finding game log: ${error.message}`);
        return { outcome: '', actualValue: 0, statType: '' };
      }

      if (!gameLog || gameLog.length === 0) {
        console.log(`  ⚠️  No game log found for ${playerName} on ${dateString}`);
        return { outcome: '', actualValue: 0, statType: '' };
      }

      const game = gameLog[0];
      console.log(`  📊 Found game: ${game.game_date} vs ${game.opponent}`);

      // Get the actual value for the requested stat type
      let actualValue = 0;
      switch (statType) {
        case 'points':
          actualValue = game.points || 0;
          break;
        case 'rebounds':
          actualValue = game.rebounds || 0;
          break;
        case 'assists':
          actualValue = game.assists || 0;
          break;
        case 'steals':
          actualValue = game.steals || 0;
          break;
        case 'blocks':
          actualValue = game.blocks || 0;
          break;
        case 'turnovers':
          actualValue = game.turnovers || 0;
          break;
        default:
          console.log(`  ⚠️  Unknown stat type: ${statType}`);
          return { outcome: '', actualValue: 0, statType: '' };
      }

      console.log(`  📊 Actual ${statType}: ${actualValue}`);

      // Find the projection for this player and game
      const { data: projection, error: projError } = await this.supabase
        .from('player_projections')
        .select('projected_value, sportsbook_line')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .eq('game_date', gameDate)
        .limit(1);

      if (projError || !projection || projection.length === 0) {
        console.log(`  ⚠️  No projection found for ${playerName} ${statType} on ${gameDate}`);
        return { outcome: '', actualValue, statType };
      }

      const proj = projection[0];
      const projectedValue = proj.projected_value;
      const sportsbookLine = proj.sportsbook_line;

      console.log(`  📊 Projected ${statType}: ${projectedValue}`);
      if (sportsbookLine) {
        console.log(`  📊 Sportsbook line: ${sportsbookLine}`);
      }

      // Determine the outcome
      let outcome = '';
      if (sportsbookLine) {
        // Use sportsbook line if available
        if (actualValue > sportsbookLine) {
          outcome = 'OVER';
        } else if (actualValue < sportsbookLine) {
          outcome = 'UNDER';
        } else {
          outcome = 'PUSH';
        }
      } else {
        // Use projected value as fallback
        if (actualValue > projectedValue) {
          outcome = 'OVER';
        } else if (actualValue < projectedValue) {
          outcome = 'UNDER';
        } else {
          outcome = 'PUSH';
        }
      }

      console.log(`  🎯 Outcome: ${outcome} (${actualValue} ${statType})`);
      return { outcome, actualValue, statType };

    } catch (error) {
      console.error(`  ❌ Error in getGameOutcome:`, error);
      return { outcome: '', actualValue: 0, statType: '' };
    }
  }

  /**
   * Get recent game outcomes for a player
   * Useful for tracking projection accuracy
   */
  async getRecentGameOutcomes(
    playerName: string,
    statType: string,
    limit: number = 10
  ): Promise<Array<{
    gameDate: string;
    opponent: string;
    projectedValue: number;
    actualValue: number;
    outcome: string;
    accuracy: number;
  }>> {
    try {
      const { data: projections, error } = await this.supabase
        .from('player_projections')
        .select('game_date, opponent, projected_value, sportsbook_line, team')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .order('game_date', { ascending: false })
        .limit(limit);

      if (error || !projections) {
        throw new Error(`Failed to fetch projections: ${error?.message}`);
      }

      const outcomes = [];

      for (const proj of projections) {
        const outcome = await this.getGameOutcome(
          playerName,
          proj.team || '',
          proj.opponent,
          proj.game_date,
          statType
        );

        if (outcome.outcome && outcome.actualValue > 0) {
          const accuracy = Math.abs(proj.projected_value - outcome.actualValue) / outcome.actualValue;
          outcomes.push({
            gameDate: proj.game_date,
            opponent: proj.opponent,
            projectedValue: proj.projected_value,
            actualValue: outcome.actualValue,
            outcome: outcome.outcome,
            accuracy: accuracy
          });
        }
      }

      return outcomes;

    } catch (error) {
      console.error('Error getting recent game outcomes:', error);
      return [];
    }
  }

  /**
   * Calculate projection accuracy statistics for a player
   */
  async getProjectionAccuracyStats(
    playerName: string,
    statType: string
  ): Promise<{
    totalProjections: number;
    overCount: number;
    underCount: number;
    pushCount: number;
    averageAccuracy: number;
    overPercentage: number;
    underPercentage: number;
  }> {
    try {
      const outcomes = await this.getRecentGameOutcomes(playerName, statType, 100);

      if (outcomes.length === 0) {
        return {
          totalProjections: 0,
          overCount: 0,
          underCount: 0,
          pushCount: 0,
          averageAccuracy: 0,
          overPercentage: 0,
          underPercentage: 0
        };
      }

      const overCount = outcomes.filter(o => o.outcome === 'OVER').length;
      const underCount = outcomes.filter(o => o.outcome === 'UNDER').length;
      const pushCount = outcomes.filter(o => o.outcome === 'PUSH').length;
      const totalProjections = outcomes.length;

      const averageAccuracy = outcomes.reduce((sum, o) => sum + o.accuracy, 0) / totalProjections;

      return {
        totalProjections,
        overCount,
        underCount,
        pushCount,
        averageAccuracy,
        overPercentage: (overCount / totalProjections) * 100,
        underPercentage: (underCount / totalProjections) * 100
      };

    } catch (error) {
      console.error('Error getting projection accuracy stats:', error);
      return {
        totalProjections: 0,
        overCount: 0,
        underCount: 0,
        pushCount: 0,
        averageAccuracy: 0,
        overPercentage: 0,
        underPercentage: 0
      };
    }
  }

  /**
   * Helper method to clean team names for matching
   */
  private cleanTeamName(teamName: string): string {
    return teamName
      .replace(/\s*\([^)]*\)\s*Table?/g, '') // Remove "(X-X) Table" suffix
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}
