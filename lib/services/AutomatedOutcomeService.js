const { createClient } = require('@supabase/supabase-js');
const { ProjectionOutcomeService } = require('./ProjectionOutcomeService');

class AutomatedOutcomeService {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.outcomeService = new ProjectionOutcomeService(supabaseUrl, supabaseKey);
  }

  /**
   * Check outcomes for all projections when a game finishes
   * This should be called after the daily automation scrapes new game results
   */
  async checkOutcomesForFinishedGames() {
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
  groupProjectionsByGame(projections) {
    const gameGroups = new Map();

    projections.forEach(projection => {
      if (projection.game_date && projection.opponent) {
        const gameKey = `${projection.game_date}_${projection.opponent}`;
        
        if (!gameGroups.has(gameKey)) {
          gameGroups.set(gameKey, []);
        }
        
        gameGroups.get(gameKey).push(projection);
      }
    });

    return gameGroups;
  }

  /**
   * Process outcomes for all projections in a specific game
   */
  async processGameOutcomes(gameKey, projections) {
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
        await this.processProjectionOutcome(projection, gameDate);
      }

    } catch (error) {
      console.error(`Error processing game outcomes for ${gameKey}:`, error);
    }
  }

  /**
   * Check if game logs exist for a specific date and player
   */
  async checkGameLogsExist(gameDate, playerName) {
    try {
      const { data: gameLogs, error } = await this.supabase
        .from('wnba_game_logs')
        .select('id')
        .eq('game_date', gameDate)
        .eq('player_name', playerName)
        .limit(1);

      if (error) {
        console.error('Error checking game logs:', error);
        return false;
      }

      return gameLogs && gameLogs.length > 0;
    } catch (error) {
      console.error('Error in checkGameLogsExist:', error);
      return false;
    }
  }

  /**
   * Process outcome for a single projection
   */
  async processProjectionOutcome(projection, gameDate) {
    try {
      console.log(`  📊 Processing projection for ${projection.player_name} (${projection.stat_type})`);

      // Get the actual game result for this player
      const { data: gameLogs, error } = await this.supabase
        .from('wnba_game_logs')
        .select('*')
        .eq('game_date', gameDate)
        .eq('player_name', projection.player_name)
        .limit(1);

      if (error || !gameLogs || gameLogs.length === 0) {
        console.log(`    ⚠️  No game log found for ${projection.player_name} on ${gameDate}`);
        return;
      }

      const gameLog = gameLogs[0];
      const actualValue = gameLog[projection.stat_type];

      if (actualValue === null || actualValue === undefined) {
        console.log(`    ⚠️  No ${projection.stat_type} data in game log for ${projection.player_name}`);
        return;
      }

      // Determine outcome based on projection type and actual value
      const outcome = this.determineOutcome(projection, actualValue);
      
      // Update the projection with the outcome
      const { error: updateError } = await this.supabase
        .from('player_projections')
        .update({
          outcome: outcome,
          actual_value: actualValue
        })
        .eq('id', projection.id);

      if (updateError) {
        console.error(`    ❌ Error updating projection outcome:`, updateError);
      } else {
        console.log(`    ✅ Outcome updated: ${outcome} (Projected: ${projection.projected_value}, Actual: ${actualValue})`);
      }

    } catch (error) {
      console.error(`Error processing projection outcome for ${projection.player_name}:`, error);
    }
  }

  /**
   * Determine the outcome of a projection based on the actual value
   */
  determineOutcome(projection, actualValue) {
    const projected = parseFloat(projection.projected_value);
    const actual = parseFloat(actualValue);
    
    if (isNaN(projected) || isNaN(actual)) {
      return 'OVER'; // Default to OVER for unknown cases
    }

    // For over/under projections
    if (projection.projection_type === 'over') {
      return actual > projected ? 'OVER' : 'UNDER';
    } else if (projection.projection_type === 'under') {
      return actual < projected ? 'UNDER' : 'OVER';
    }

    // For exact value projections (within a tolerance)
    const tolerance = 0.5; // Allow 0.5 point tolerance
    const difference = Math.abs(actual - projected);
    
    if (difference <= tolerance) {
      return 'OVER'; // Hit = OVER
    } else {
      return 'UNDER'; // Miss = UNDER
    }
  }

  /**
   * Get summary of outcome checking results
   */
  async getOutcomeSummary() {
    try {
      const { data: projections, error } = await this.supabase
        .from('player_projections')
        .select('outcome, projection_type')
        .not('outcome', 'is', null);

      if (error) {
        console.error('Error fetching outcome summary:', error);
        return null;
      }

      const summary = {
        total: projections.length,
        overs: projections.filter(p => p.outcome === 'OVER').length,
        unders: projections.filter(p => p.outcome === 'UNDER').length
      };

      summary.accuracy = summary.total > 0 ? (summary.overs / summary.total * 100).toFixed(2) : 0;

      return summary;
    } catch (error) {
      console.error('Error getting outcome summary:', error);
      return null;
    }
  }
}

module.exports = { AutomatedOutcomeService };
