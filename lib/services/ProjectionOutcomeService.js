const { createClient } = require('@supabase/supabase-js');

class ProjectionOutcomeService {
  constructor(supabaseUrl, supabaseKey) {
    console.log('🔧 ProjectionOutcomeService constructor called with:', {
      supabaseUrl: supabaseUrl ? 'present' : 'missing',
      supabaseKey: supabaseKey ? 'present' : 'missing'
    });
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials:', { supabaseUrl, supabaseKey });
      throw new Error('Supabase URL and key are required');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client created successfully');
  }

  /**
   * Check if a game can have an outcome (game date is in the past)
   */
  async canHaveOutcome(gameDate) {
    try {
      const gameDateTime = new Date(gameDate);
      const today = new Date();
      return gameDateTime < today;
    } catch (error) {
      console.error('Error checking if game can have outcome:', error);
      return false;
    }
  }

  /**
   * Check the outcome of a projection by looking up the actual game result
   */
  async checkProjectionOutcome(
    playerName,
    projectionDate,
    statType,
    projectedValue,
    gameId,
    gameDate,
    playerTeam,
    opponent,
    sportsbookLine
  ) {
    try {
      console.log(`🔍 Checking outcome for ${playerName} - ${statType} projection from ${projectionDate}`);
      console.log(`📅 Game ID: ${gameId}, Game Date: ${gameDate}, Team: ${playerTeam}, Opponent: ${opponent}`);
      console.log(`📊 Projected Value: ${projectedValue}, Sportsbook Line: ${sportsbookLine}`);
      
      // Determine the actual game date
      let actualGameDate = gameDate;
      
      if (!actualGameDate && gameId) {
        // Extract date from game ID (format: YYYYMMDDTEAM)
        actualGameDate = this.extractDateFromGameId(gameId);
        console.log(`📅 Extracted date from game ID: ${actualGameDate}`);
      }
      
      if (!actualGameDate) {
        console.log('❌ Could not determine game date');
        return this.getDefaultOutcome();
      }
      
      console.log(`🎯 Looking for game on ${actualGameDate}`);
      
      // Check if this game has been played (game date is in the past)
      const gameDateTime = new Date(actualGameDate);
      const today = new Date();
      console.log(`📅 Game date: ${gameDateTime}, Today: ${today}, Game played: ${gameDateTime < today}`);
      
      if (gameDateTime >= today) {
        console.log(`⏳ Game on ${actualGameDate} hasn't been played yet`);
        return this.getDefaultOutcome();
      }
      
      // Find the player's game log for this specific game date
      console.log(`🔍 Looking for game log for ${playerName} on ${actualGameDate}...`);
      const actualValue = await this.getPlayerGameStatForDate(playerName, actualGameDate, statType);
      
      if (actualValue === null) {
        console.log(`❌ No game log found for ${playerName} on ${actualGameDate}`);
        return this.getDefaultOutcome();
      }

      console.log(`✅ Found actual value: ${actualValue} for ${statType}`);
      const outcome = this.calculateOutcome(actualValue, projectedValue, sportsbookLine);
      console.log(`🎯 Calculated outcome: ${outcome} (${actualValue} vs ${sportsbookLine || projectedValue})`);
      
      return {
        outcome,
        actualValue,
        gameDate: actualGameDate,
        gameId,
        sportsbookLine
      };
      
    } catch (error) {
      console.error('❌ Error checking projection outcome:', error);
      return this.getDefaultOutcome();
    }
  }

  /**
   * Get the actual stat value for a player on a specific game date
   */
  async getPlayerGameStatForDate(playerName, gameDate, statType) {
    try {
      console.log(`🔍 Querying database for ${playerName} on ${gameDate} for ${statType}`);
      
      // First try exact date match with pagination
      let { data, error } = await this.supabase
        .from('wnba_game_logs')
        .select('*')
        .eq('player_name', playerName)
        .eq('game_date', gameDate)
        .limit(1000); // Use pagination

      if (error) {
        console.log(`❌ Database error:`, error);
        return null;
      }
      
      if (!data || data.length === 0) {
        console.log(`❌ No exact match for ${playerName} on ${gameDate}, trying date range...`);
        
        // Convert ISO date to the format used in database (e.g., "2025-09-07" -> "Sep 7, 2025")
        // Parse the date as local time to avoid timezone issues
        const [year, month, day] = gameDate.split('-').map(Number);
        const targetDate = new Date(year, month - 1, day); // month is 0-indexed
        const dayBefore = new Date(targetDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const dayAfter = new Date(targetDate);
        dayAfter.setDate(dayAfter.getDate() + 1);
        
        // Convert to database format: "Mon, Sep 6, 2025"
        const formatDateForDB = (date) => {
          return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });
        };
        
        const dayBeforeStr = formatDateForDB(dayBefore);
        const dayAfterStr = formatDateForDB(dayAfter);
        const targetDateStr = formatDateForDB(targetDate);
        
        console.log(`🔍 Searching date range: ${dayBeforeStr} to ${dayAfterStr} (target: ${targetDateStr})`);
        
        // Try exact match with formatted date first
        const { data: exactFormattedData, error: exactFormattedError } = await this.supabase
          .from('wnba_game_logs')
          .select('*')
          .eq('player_name', playerName)
          .eq('game_date', targetDateStr)
          .limit(1000);
          
        if (exactFormattedData && exactFormattedData.length > 0) {
          console.log(`✅ Found exact match with formatted date: ${targetDateStr}`);
          data = exactFormattedData;
        } else {
          console.log(`❌ No exact match with formatted date: ${targetDateStr}`);
          
          // Try range search with formatted dates
          const { data: rangeData, error: rangeError } = await this.supabase
            .from('wnba_game_logs')
            .select('*')
            .eq('player_name', playerName)
            .or(`game_date.eq."${dayBeforeStr}",game_date.eq."${targetDateStr}",game_date.eq."${dayAfterStr}"`)
            .limit(1000); // Use pagination
            
          if (rangeError) {
            console.log(`❌ Range query error:`, rangeError);
            return null;
          }
          
          console.log(`📊 Range search found: ${rangeData?.length || 0} records`);
          data = rangeData;
        }
      }
      
      if (!data || data.length === 0) {
        console.log(`❌ No data found for ${playerName} around ${gameDate}`);
        return null;
      }

      console.log(`✅ Found ${data.length} game log record(s):`, data);

      // Use the first (most recent) record if multiple found
      const gameLog = data[0];
      console.log(`🎯 Using game log:`, gameLog);

      // Extract the appropriate stat based on statType
      let actualValue = null;
      
      switch (statType.toLowerCase()) {
        case 'points':
          actualValue = gameLog.points || null;
          break;
        case 'rebounds':
          actualValue = gameLog.rebounds || null;
          break;
        case 'assists':
          actualValue = gameLog.assists || null;
          break;
        case 'pa': // Points + Assists
          actualValue = (gameLog.points || 0) + (gameLog.assists || 0);
          break;
        case 'pr': // Points + Rebounds
          actualValue = (gameLog.points || 0) + (gameLog.rebounds || 0);
          break;
        case 'ra': // Rebounds + Assists
          actualValue = (gameLog.rebounds || 0) + (gameLog.assists || 0);
          break;
        case 'pra': // Points + Rebounds + Assists
          actualValue = (gameLog.points || 0) + (gameLog.rebounds || 0) + (gameLog.assists || 0);
          break;
        default:
          actualValue = gameLog[statType] || null;
      }

      console.log(`📊 Extracted ${statType} value: ${actualValue} from data`);
      return actualValue;
      
    } catch (error) {
      console.error('❌ Error getting player game stat:', error);
      return null;
    }
  }

  /**
   * Extract date from game ID (format: YYYYMMDDTEAM)
   */
  extractDateFromGameId(gameId) {
    try {
      if (!gameId || gameId.length < 8) {
        return null;
      }
      
      const dateString = gameId.substring(0, 8);
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      
      return `${year}-${month}-${day}`;
      
    } catch (error) {
      console.error('Error extracting date from game ID:', error);
      return null;
    }
  }

  /**
   * Calculate the outcome based on actual vs projected values
   */
  calculateOutcome(actualValue, projectedValue, sportsbookLine) {
    try {
      const actual = parseFloat(actualValue);
      const projected = parseFloat(projectedValue);
      const line = sportsbookLine ? parseFloat(sportsbookLine) : projected;
      
      if (isNaN(actual) || isNaN(line)) {
        return null;
      }
      
      // For over/under projections
      if (actual > line) {
        return 'OVER';
      } else if (actual < line) {
        return 'UNDER';
      } else {
        return 'PUSH';
      }
      
    } catch (error) {
      console.error('Error calculating outcome:', error);
      return null;
    }
  }

  /**
   * Get default outcome when no data is available
   */
  getDefaultOutcome() {
    return {
      outcome: null,
      actualValue: null,
      gameDate: null,
      gameId: null,
      sportsbookLine: null
    };
  }

  /**
   * Update a projection with its outcome
   */
  async updateProjectionOutcome(projectionId, outcome, actualValue, gameDate) {
    try {
      const { error } = await this.supabase
        .from('player_projections')
        .update({
          outcome: outcome,
          actual_value: actualValue,
          game_date: gameDate,
          outcome_checked_at: new Date().toISOString()
        })
        .eq('id', projectionId);

      if (error) {
        console.error('❌ Error updating projection outcome:', error);
        return false;
      }

      console.log(`✅ Projection ${projectionId} outcome updated: ${outcome}`);
      return true;
      
    } catch (error) {
      console.error('❌ Error updating projection outcome:', error);
      return false;
    }
  }

  /**
   * Get all projections that need outcome checking
   */
  async getProjectionsNeedingOutcomes() {
    try {
      const { data: projections, error } = await this.supabase
        .from('player_projections')
        .select('*')
        .is('outcome', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching projections needing outcomes:', error);
        return [];
      }

      return projections || [];
      
    } catch (error) {
      console.error('❌ Error getting projections needing outcomes:', error);
      return [];
    }
  }

  /**
   * Get outcome for display purposes (without updating database)
   */
  async getOutcomeForDisplay(
    playerName,
    projectionDate,
    statType,
    projectedValue,
    gameId,
    gameDate,
    playerTeam,
    opponent,
    sportsbookLine
  ) {
    console.log(`🎯 getOutcomeForDisplay called for ${playerName} - ${statType}`);
    console.log(`📅 Projection date: ${projectionDate}, Game date: ${gameDate}, Game ID: ${gameId}`);
    console.log(`📊 Sportsbook line: ${sportsbookLine}`);
    
    // Check if this projection can have an outcome (game has been played)
    const canHaveOutcome = await this.canHaveOutcome(gameDate);
    console.log(`⏰ Can have outcome: ${canHaveOutcome}`);
    
    if (!canHaveOutcome) {
      console.log(`⏳ Projection cannot have outcome yet`);
      return this.getDefaultOutcome();
    }

    console.log(`✅ Projection can have outcome, checking...`);
    // Check the outcome
    return await this.checkProjectionOutcome(
      playerName, 
      projectionDate, 
      statType, 
      projectedValue, 
      gameId, 
      gameDate, 
      playerTeam, 
      opponent,
      sportsbookLine
    );
  }

  /**
   * Get outcome statistics for projections
   */
  async getOutcomeStats() {
    try {
      const { data: projections, error } = await this.supabase
        .from('player_projections')
        .select('outcome, stat_type, projection_type');

      if (error) {
        console.error('❌ Error fetching outcome stats:', error);
        return null;
      }

      const stats = {
        total: projections.length,
        withOutcomes: projections.filter(p => p.outcome !== null).length,
        withoutOutcomes: projections.filter(p => p.outcome === null).length,
        byStatType: {},
        byProjectionType: {}
      };

      // Group by stat type
      projections.forEach(p => {
        if (!stats.byStatType[p.stat_type]) {
          stats.byStatType[p.stat_type] = { total: 0, hits: 0, misses: 0 };
        }
        stats.byStatType[p.stat_type].total++;
        if (p.outcome === 'hit') stats.byStatType[p.stat_type].hits++;
        if (p.outcome === 'miss') stats.byStatType[p.stat_type].misses++;
      });

      // Group by projection type
      projections.forEach(p => {
        if (!stats.byProjectionType[p.projection_type]) {
          stats.byProjectionType[p.projection_type] = { total: 0, hits: 0, misses: 0 };
        }
        stats.byProjectionType[p.projection_type].total++;
        if (p.outcome === 'hit') stats.byProjectionType[p.projection_type].hits++;
        if (p.outcome === 'miss') stats.byProjectionType[p.projection_type].misses++;
      });

      return stats;
      
    } catch (error) {
      console.error('❌ Error getting outcome stats:', error);
      return null;
    }
  }
}

module.exports = { ProjectionOutcomeService };
