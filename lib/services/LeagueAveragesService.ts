import { createClient } from '@supabase/supabase-js';

/**
 * Service for handling WNBA league averages and statistics
 * Manages league-wide data and updates
 */
export class LeagueAveragesService {
  private supabase;

  // WNBA 2025 Season League Averages (updated daily)
  private static WNBA_LEAGUE_AVERAGES = {
    points: 82.5,      // Average points per game across all teams
    rebounds: 35.2,    // Average rebounds per game across all teams  
    assists: 18.7,     // Average assists per game across all teams
    turnovers: 14.3,   // Average turnovers per game across all teams
    steals: 7.8        // Average steals per game across all teams
  };

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // Load league averages from database on service initialization
    this.loadLeagueAveragesFromDatabase().catch(error => {
      console.error('Failed to load league averages from database:', error);
    });
  }

  /**
   * Get the current WNBA league average for a specific stat type
   */
  getLeagueAverage(statType: string): number {
    return LeagueAveragesService.WNBA_LEAGUE_AVERAGES[statType as keyof typeof LeagueAveragesService.WNBA_LEAGUE_AVERAGES] || 0;
  }

  /**
   * Update WNBA league averages (should be called daily after new games)
   * This method calculates league averages from all game logs and updates the constants
   */
  async updateLeagueAverages(season: string = '2025'): Promise<void> {
    try {
      console.log('Updating WNBA league averages...');
      
      // Get all game logs for the season
      const { data: gameLogs, error } = await this.supabase
        .from('wnba_game_logs')
        .select('*')
        .eq('season', season);

      if (error) {
        console.error('Error fetching game logs for league averages:', error);
        return;
      }

      if (!gameLogs || gameLogs.length === 0) {
        console.log('No game logs found for league average calculation');
        return;
      }

      // Calculate league averages for each stat type
      const statTypes = ['points', 'rebounds', 'assists', 'turnovers', 'steals'];
      const leagueAverages: Record<string, number> = {};

      for (const statType of statTypes) {
        const validValues = gameLogs
          .map((game: any) => game[statType])
          .filter((value: any) => typeof value === 'number' && !isNaN(value));
        
        if (validValues.length > 0) {
          const average = validValues.reduce((sum: number, value: number) => sum + value, 0) / validValues.length;
          leagueAverages[statType] = Math.round(average * 10) / 10; // Round to 1 decimal
          console.log(`League average for ${statType}: ${leagueAverages[statType]}`);
        }
      }

      // Update the static constants
      Object.assign(LeagueAveragesService.WNBA_LEAGUE_AVERAGES, leagueAverages);
      
      console.log('WNBA league averages updated successfully:', LeagueAveragesService.WNBA_LEAGUE_AVERAGES);
      
      // Optionally save to database for persistence across server restarts
      await this.saveLeagueAveragesToDatabase(leagueAverages, season);
      
    } catch (error) {
      console.error('Error updating league averages:', error);
    }
  }

  /**
   * Save league averages to database for persistence
   */
  private async saveLeagueAveragesToDatabase(averages: Record<string, number>, season: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('league_averages')
        .upsert({
          season,
          updated_at: new Date().toISOString(),
          points: averages.points,
          rebounds: averages.rebounds,
          assists: averages.assists,
          turnovers: averages.turnovers,
          steals: averages.steals
        });

      if (error) {
        console.error('Error saving league averages to database:', error);
      } else {
        console.log('League averages saved to database successfully');
      }
    } catch (error) {
      console.error('Error in saveLeagueAveragesToDatabase:', error);
    }
  }

  /**
   * Load league averages from database on service initialization
   */
  private async loadLeagueAveragesFromDatabase(season: string = '2025'): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('league_averages')
        .select('*')
        .eq('season', season)
        .single();

      if (error) {
        console.log('No league averages found in database, using defaults');
        return;
      }

      if (data) {
        // Update static constants with database values
        LeagueAveragesService.WNBA_LEAGUE_AVERAGES = {
          points: data.points || 82.5,
          rebounds: data.rebounds || 35.2,
          assists: data.assists || 18.7,
          turnovers: data.turnovers || 14.3,
          steals: data.steals || 7.8
        };
        
        console.log('League averages loaded from database:', LeagueAveragesService.WNBA_LEAGUE_AVERAGES);
      }
    } catch (error) {
      console.error('Error loading league averages from database:', error);
    }
  }

  /**
   * Get available seasons from the database
   */
  async getAvailableSeasons(): Promise<string[]> {
    try {
      console.log('Checking available seasons in database...');
      
      const { data, error } = await this.supabase
        .from('wnba_game_logs')
        .select('game_date')
        .not('game_date', 'is', null);

      if (error) {
        console.error('Error fetching available seasons:', error);
        return [];
      }

      // Extract years from game dates
      const years = [...new Set((data || []).map((log: any) => {
        const date = new Date(log.game_date);
        return date.getFullYear().toString();
      }))];

      return years.sort() as string[];
    } catch (error) {
      console.error('Error in getAvailableSeasons:', error);
      return [];
    }
  }

  /**
   * Get projection accuracy statistics
   */
  async getProjectionAccuracy(playerName?: string): Promise<any> {
    try {
      // First check if the projection_accuracy table exists and has data
      let query = this.supabase
        .from('projection_accuracy')
        .select('*');

      if (playerName) {
        query = query.eq('player_name', playerName);
      }

      const { data, error } = await query;

      if (error) {
        // Check if it's a table doesn't exist error or other database error
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
          console.log('Projection accuracy table does not exist yet - returning defaults');
          return { total: 0, accurate: 0, accuracy: 0 };
        }
        
        console.error('Error fetching projection accuracy:', error);
        // Return default stats when table doesn't exist or has errors
        return { total: 0, accurate: 0, accuracy: 0 };
      }

      // If no data exists yet, return default stats
      if (!data || data.length === 0) {
        console.log('No projection accuracy data found yet - returning defaults');
        return { total: 0, accurate: 0, accuracy: 0 };
      }

      const total = data.length;
      const accurate = data.filter((item: any) => item.accuracy_score > 0.7).length;
      const accuracy = total > 0 ? (accurate / total) * 100 : 0;

      return { total, accurate, accuracy };
    } catch (error) {
      console.error('Error in getProjectionAccuracy:', error);
      // Return default stats on any error
      return { total: 0, accurate: 0, accuracy: 0 };
    }
  }
}
