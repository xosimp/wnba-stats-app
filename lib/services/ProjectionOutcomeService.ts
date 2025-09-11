import { createClient } from '@supabase/supabase-js';

export interface ProjectionOutcome {
  outcome: 'OVER' | 'UNDER' | 'PUSH' | null;
  actualValue: number | null;
  gameDate: string | null;
  gameId: string | null;
  sportsbookLine?: number | null;
}

export class ProjectionOutcomeService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Check the outcome of a projection by looking up the actual game result
   */
  async checkProjectionOutcome(
    playerName: string,
    projectionDate: string,
    statType: string,
    projectedValue: number,
    gameId?: string,
    gameDate?: string,
    playerTeam?: string,
    opponent?: string,
    sportsbookLine?: number
  ): Promise<ProjectionOutcome> {
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
  private async getPlayerGameStatForDate(
    playerName: string,
    gameDate: string,
    statType: string
  ): Promise<number | null> {
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
        const formatDateForDB = (date: Date) => {
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
      let actualValue: number | null = null;
      
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
   * Calculate the outcome (OVER/UNDER/PUSH) based on actual vs projected value
   * Note: For display purposes, we compare against the sportsbook line, not the projected value
   */
  private calculateOutcome(actualValue: number, projectedValue: number, sportsbookLine?: number): 'OVER' | 'UNDER' | 'PUSH' {
    // If we have a sportsbook line, compare against that for the final outcome
    if (sportsbookLine !== undefined) {
      if (actualValue > sportsbookLine) {
        return 'OVER';
      } else if (actualValue < sportsbookLine) {
        return 'UNDER';
      } else {
        return 'PUSH';
      }
    }
    
    // Fallback to comparing against projected value (for internal calculations)
    if (actualValue > projectedValue) {
      return 'OVER';
    } else if (actualValue < projectedValue) {
      return 'UNDER';
    } else {
      return 'PUSH';
    }
  }

  /**
   * Extract date from game ID (format: YYYYMMDDTEAM)
   */
  private extractDateFromGameId(gameId: string): string | null {
    try {
      // Game ID format: YYYYMMDDTEAM (e.g., 202508160CHI)
      if (gameId.length >= 8) {
        const datePart = gameId.substring(0, 8);
        const year = datePart.substring(0, 4);
        const month = datePart.substring(4, 6);
        const day = datePart.substring(6, 8);
        return `${year}-${month}-${day}`;
      }
      return null;
    } catch (error) {
      console.error('Error extracting date from game ID:', error);
      return null;
    }
  }

  /**
   * Get default outcome when no game result is found
   */
  private getDefaultOutcome(): ProjectionOutcome {
    return {
      outcome: null,
      actualValue: null,
      gameDate: null,
      gameId: null,
      sportsbookLine: null
    };
  }

  /**
   * Check if a projection can have an outcome (game has been played)
   */
  async canHaveOutcome(gameDate?: string, gameId?: string): Promise<boolean> {
    try {
      console.log(`⏰ canHaveOutcome check - Game date: ${gameDate}, Game ID: ${gameId}`);
      
      let actualGameDate = gameDate;
      
      if (!actualGameDate && gameId) {
        actualGameDate = this.extractDateFromGameId(gameId);
        console.log(`📅 Extracted date from game ID: ${actualGameDate}`);
      }
      
      if (!actualGameDate) {
        console.log(`❌ No game date available`);
        return false;
      }
      
      const gameDateTime = new Date(actualGameDate);
      const today = new Date();
      const canHave = gameDateTime < today;
      
      console.log(`📅 Game date: ${gameDateTime}, Today: ${today}, Can have outcome: ${canHave}`);
      return canHave;
    } catch (error) {
      console.error('❌ Error checking if projection can have outcome:', error);
      return false;
    }
  }

  /**
   * Get outcome for display purposes (without updating database)
   */
  async getOutcomeForDisplay(
    playerName: string,
    projectionDate: string,
    statType: string,
    projectedValue: number,
    gameId?: string,
    gameDate?: string,
    playerTeam?: string,
    opponent?: string,
    sportsbookLine?: number
  ): Promise<ProjectionOutcome> {
    console.log(`🎯 getOutcomeForDisplay called for ${playerName} - ${statType}`);
    console.log(`📅 Projection date: ${projectionDate}, Game date: ${gameDate}, Game ID: ${gameId}`);
    console.log(`📊 Sportsbook line: ${sportsbookLine}`);
    
    // Check if this projection can have an outcome (game has been played)
    const canHaveOutcome = await this.canHaveOutcome(gameDate, gameId);
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
}
