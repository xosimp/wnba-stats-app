import { createClient } from '@supabase/supabase-js';
import { ProjectionOutcomeService } from './ProjectionOutcomeService';

export class AutomatedOutcomeService {
  private supabase;
  private outcomeService: ProjectionOutcomeService;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.outcomeService = new ProjectionOutcomeService(supabaseUrl, supabaseKey);
  }

  /**
   * Check outcomes for all projections when a game finishes
   * This should be called after the daily automation scrapes new game results
   */
  async checkOutcomesForFinishedGames(): Promise<void> {
    try {
      console.log('🔄 Starting automated outcome checking for finished games...');
      
      // Get all projections that don't have outcomes yet
      const { data: projections, error } = await this.supabase
        .from('player_projections')
        .select('*')
        .is('outcome', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projections for outcome checking:', error);
        return;
      }

      if (!projections || projections.length === 0) {
        console.log('✅ All projections already have outcomes');
        return;
      }

      console.log(`📊 Found ${projections.length} projections without outcomes`);

      // Group projections by game date and opponent for efficient processing
      const projectionsByGame = this.groupProjectionsByGame(projections);
      
      // Process each game
      for (const [gameKey, gameProjections] of projectionsByGame) {
        await this.processGameOutcomes(gameKey, gameProjections);
      }

      console.log('✅ Automated outcome checking completed');

    } catch (error) {
      console.error('Error in automated outcome checking:', error);
    }
  }

  /**
   * Group projections by game (date + opponent combination)
   */
  private groupProjectionsByGame(projections: any[]): Map<string, any[]> {
    const gameGroups = new Map<string, any[]>();

    projections.forEach(projection => {
      if (projection.game_date && projection.opponent) {
        const gameKey = `${projection.game_date}_${projection.opponent}`;
        
        if (!gameGroups.has(gameKey)) {
          gameGroups.set(gameKey, []);
        }
        
        gameGroups.get(gameKey)!.push(projection);
      }
    });

    return gameGroups;
  }

  /**
   * Process outcomes for all projections in a specific game
   */
  private async processGameOutcomes(gameKey: string, projections: any[]): Promise<void> {
    try {
      const [gameDate, opponent] = gameKey.split('_');
      console.log(`\n🎮 Processing game: ${gameDate} vs ${opponent} (${projections.length} projections)`);

      // Check if this game has been played
      const canHaveOutcome = await this.outcomeService.canHaveOutcome(gameDate);
      
      if (!canHaveOutcome) {
        console.log(`⏰ Game on ${gameDate} hasn't been played yet`);
        return;
      }

      // Check if we have game logs for this date
      const hasGameLogs = await this.checkGameLogsExist(gameDate, projections[0].player_name);
      
      if (!hasGameLogs) {
        console.log(`📭 No game logs found for ${gameDate} - game may not be finished yet`);
        return;
      }

      console.log(`✅ Game logs found for ${gameDate}, checking outcomes...`);

      // Process each projection for this game
      for (const projection of projections) {
        await this.processProjectionOutcome(projection);
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error(`Error processing game ${gameKey}:`, error);
    }
  }

  /**
   * Check if game logs exist for a specific date
   */
  private async checkGameLogsExist(gameDate: string, playerName: string): Promise<boolean> {
    try {
      // Try different date formats that might be in the game logs
      const possibleDates = [
        gameDate,
        this.convertToGameLogFormat(gameDate)
      ];

      for (const date of possibleDates) {
        const { data: logs, error } = await this.supabase
          .from('wnba_game_logs')
          .select('id')
          .eq('player_name', playerName)
          .eq('game_date', date)
          .limit(1);

        if (!error && logs && logs.length > 0) {
          return true;
        }
      }

      return false;

    } catch (error) {
      console.error('Error checking game logs:', error);
      return false;
    }
  }

  /**
   * Convert database date format to game log format
   */
  private convertToGameLogFormat(dbDate: string): string {
    try {
      const date = new Date(dbDate);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const dayName = days[date.getDay()];
      const monthName = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      
      return `${dayName}, ${monthName} ${day}, ${year}`;
    } catch (error) {
      return dbDate;
    }
  }

  /**
   * Process outcome for a single projection
   */
  private async processProjectionOutcome(projection: any): Promise<void> {
    try {
      console.log(`   📊 Checking outcome for ${projection.player_name} - ${projection.stat_type}`);

      // Check the outcome using our existing service
      const outcome = await this.outcomeService.checkProjectionOutcome(
        projection.player_name,
        projection.created_at,
        projection.stat_type,
        projection.projected_value,
        projection.game_id,
        projection.game_date,
        projection.team,
        projection.opponent,
        projection.sportsbook_line // Add the missing sportsbook line parameter!
      );

      // Update the projection if we found an outcome
      if (outcome.outcome !== null && outcome.actualValue !== null) {
        const { error: updateError } = await this.supabase
          .from('player_projections')
          .update({
            outcome: outcome.outcome,
            actual_value: outcome.actualValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', projection.id);

        if (updateError) {
          console.error(`   ❌ Error updating projection ${projection.id}:`, updateError);
        } else {
          console.log(`   ✅ Updated: ${projection.player_name} - ${outcome.outcome} (${outcome.actualValue})`);
        }
      } else {
        console.log(`   ⏳ No outcome yet for ${projection.player_name}`);
      }

    } catch (error) {
      console.error(`   ❌ Error processing projection ${projection.id}:`, error);
    }
  }

  /**
   * Check outcomes for a specific player's projections
   * Useful for testing or manual updates
   */
  async checkOutcomesForPlayer(playerName: string): Promise<void> {
    try {
      console.log(`🎯 Checking outcomes for ${playerName}...`);
      
      const { data: projections, error } = await this.supabase
        .from('player_projections')
        .select('*')
        .eq('player_name', playerName)
        .is('outcome', null);

      if (error || !projections || projections.length === 0) {
        console.log(`No projections without outcomes found for ${playerName}`);
        return;
      }

      console.log(`Found ${projections.length} projections without outcomes for ${playerName}`);

      for (const projection of projections) {
        await this.processProjectionOutcome(projection);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ Completed outcome checking for ${playerName}`);

    } catch (error) {
      console.error(`Error checking outcomes for ${playerName}:`, error);
    }
  }

  /**
   * Check outcomes for projections from a specific date
   * Useful for checking outcomes after a specific game
   */
  async checkOutcomesForDate(gameDate: string): Promise<void> {
    try {
      console.log(`📅 Checking outcomes for games on ${gameDate}...`);
      
      const { data: projections, error } = await this.supabase
        .from('player_projections')
        .select('*')
        .eq('game_date', gameDate)
        .is('outcome', null);

      if (error || !projections || projections.length === 0) {
        console.log(`No projections found for ${gameDate}`);
        return;
      }

      console.log(`Found ${projections.length} projections for ${gameDate}`);

      // Group by opponent for efficient processing
      const projectionsByOpponent = new Map<string, any[]>();
      
      projections.forEach(projection => {
        const opponent = projection.opponent || 'Unknown';
        if (!projectionsByOpponent.has(opponent)) {
          projectionsByOpponent.set(opponent, []);
        }
        projectionsByOpponent.get(opponent)!.push(projection);
      });

      // Process each opponent's projections
      for (const [opponent, opponentProjections] of projectionsByOpponent) {
        const gameKey = `${gameDate}_${opponent}`;
        await this.processGameOutcomes(gameKey, opponentProjections);
      }

      console.log(`✅ Completed outcome checking for ${gameDate}`);

    } catch (error) {
      console.error(`Error checking outcomes for ${gameDate}:`, error);
    }
  }
}
