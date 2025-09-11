import { createClient } from '@supabase/supabase-js';

/**
 * Service for handling player and team data queries
 * Manages player information, team assignments, and availability
 */
export class PlayerDataService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get all available players from the database
   */
  async getAvailablePlayers(): Promise<string[]> {
    try {
      // Get players from players table
      const playersResult = await this.supabase
        .from('players')
        .select('name')
        .not('name', 'is', null);

      // Get all game logs using pagination to overcome Supabase's default limit
      let allGameLogs: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await this.supabase
          .from('wnba_game_logs')
          .select('player_name')
          .range(offset, offset + pageSize - 1);

        if (error) {
          console.error('Error fetching game logs:', error);
          break;
        }
        
        if (!data || data.length === 0) {
          break;
        }
        
        allGameLogs.push(...data);
        offset += pageSize;
        
        if (data.length < pageSize) {
          break;
        }
      }

      if (playersResult.error) {
        console.error('Error fetching from players table:', playersResult.error);
      }

      // Combine all player names
      const allNames: string[] = [];
      
      // Add names from players table
      if (playersResult.data) {
        allNames.push(...playersResult.data.map((player: any) => player.name));
      }
      
      // Add names from game logs
      allNames.push(...allGameLogs.map((log: any) => log.player_name));

      // Get unique names, filter out abbreviated names, and sort alphabetically
      const uniqueNames = [...new Set(allNames)];
      
      // Filter out abbreviated names (those with single letters followed by a dot)
      const fullNames = uniqueNames.filter(name => !/^[A-Z]\.\s/.test(name));
      
      // Normalize accented characters to fix duplicates like "Azurá Stevens" vs "Azura Stevens"
      const normalizedNames = fullNames.map(name => 
        name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );
      
      // Get unique names after normalization and sort alphabetically
      const finalPlayers = [...new Set(normalizedNames)].sort();
      
      return finalPlayers;
    } catch (error) {
      console.error('Error in getAvailablePlayers:', error);
      return [];
    }
  }

  /**
   * Get all available teams from the database
   */
  async getAvailableTeams(): Promise<string[]> {
    try {
      // Get teams from game logs - only use opponent column for full team names
      const { data: gameLogs, error } = await this.supabase
        .from('wnba_game_logs')
        .select('opponent')
        .not('opponent', 'is', null);

      if (error) {
        console.error('Error fetching teams from game logs:', error);
        return [];
      }

      // Extract unique team names from opponent column only (full names)
      const allTeams = new Set<string>();
      
      if (gameLogs) {
        gameLogs.forEach((log: any) => {
          // Clean team names (remove "(X-X) Table" suffix)
          const cleanOpponent = log.opponent.replace(/\s*\([^)]*\)\s*Table?/g, '').trim();
          
          if (cleanOpponent && cleanOpponent !== '') allTeams.add(cleanOpponent);
        });
      }

      // Convert to array and sort
      const teams = Array.from(allTeams).sort();
      
      return teams;
    } catch (error) {
      console.error('Error in getAvailableTeams:', error);
      return [];
    }
  }

  /**
   * Get the team a player belongs to
   */
  async getPlayerTeam(playerName: string): Promise<string | null> {
    try {
      // First try to get from players table
      const { data: playerData, error: playerError } = await this.supabase
        .from('players')
        .select('team')
        .eq('name', playerName)
        .single();

      if (!playerError && playerData?.team) {
        return playerData.team;
      }

      // Fallback: get from most recent game log
      const { data: gameLogs, error: gameError } = await this.supabase
        .from('wnba_game_logs')
        .select('team')
        .eq('player_name', playerName)
        .order('game_date', { ascending: false })
        .limit(1);

      if (gameError || !gameLogs || gameLogs.length === 0) {
        return null;
      }

      // Clean team name (remove "(X-X) Table" suffix)
      const team = gameLogs[0].team.replace(/\s*\([^)]*\)\s*Table?/g, '').trim();
      return team;

    } catch (error) {
      console.error('Error in getPlayerTeam:', error);
      return null;
    }
  }

  /**
   * Get player game logs for analysis
   */
  async getPlayerGameLogs(
    playerName: string,
    limit: number = 20,
    statType?: string
  ): Promise<any[]> {
    try {
      let query = this.supabase
        .from('wnba_game_logs')
        .select('*')
        .eq('player_name', playerName)
        .order('game_date', { ascending: false })
        .limit(limit);

      if (statType) {
        query = query.not(statType, 'is', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching player game logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getPlayerGameLogs:', error);
      return [];
    }
  }

  /**
   * Calculate days of rest for a player before a specific game
   */
  async calculateDaysRest(playerName: string, gameDate: string): Promise<number> {
    try {
      const targetDate = new Date(gameDate);
      if (isNaN(targetDate.getTime())) {
        return 0;
      }

      // Get the most recent game before the target date
      const { data: recentGames, error } = await this.supabase
        .from('wnba_game_logs')
        .select('game_date')
        .eq('player_name', playerName)
        .lt('game_date', gameDate)
        .order('game_date', { ascending: false })
        .limit(1);

      if (error || !recentGames || recentGames.length === 0) {
        return 7; // Default to 7 days if no recent games found
      }

      const lastGameDate = new Date(recentGames[0].game_date);
      const daysDiff = Math.floor((targetDate.getTime() - lastGameDate.getTime()) / (1000 * 60 * 60 * 24));

      return Math.max(0, daysDiff);
    } catch (error) {
      console.error('Error calculating days rest:', error);
      return 0;
    }
  }

  /**
   * Get teammate injuries for a specific team and game date
   */
  async getTeammateInjuries(team: string, gameDate: string): Promise<string[]> {
    try {
      // Import the injury impact service dynamically to avoid circular dependencies
      const { InjuryImpactService } = await import('./InjuryImpactService');
      
      // Get injury summary for the team
      const injurySummary = await InjuryImpactService.getTeamInjurySummary(team);
      
      // Return names of significant injured players
      const result = injurySummary.significantInjuries.map(injury => injury.playerName);
      return result;
      
    } catch (error) {
      console.error('Error getting teammate injuries:', error);
      return [];
    }
  }
}
