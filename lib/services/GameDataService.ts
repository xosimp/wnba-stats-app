import { createClient } from '@supabase/supabase-js';
import { TeamDefensiveStats } from '../algorithms/Algorithms';

/**
 * Service for handling game data, upcoming games, and defensive statistics
 * Manages game-related queries and defensive data
 */
export class GameDataService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get upcoming games
   */
  async getUpcomingGames(limit: number = 10): Promise<any[]> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('wnba_game_logs')
        .select('game_date, team, opponent')
        .gte('game_date', todayString)
        .order('game_date', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching upcoming games:', error);
        return [];
      }

      // Remove duplicates and clean team names
      const uniqueGames = new Map<string, any>();
      
      if (data) {
        data.forEach((game: any) => {
          const cleanTeam = game.team.replace(/\s*\([^)]*\)\s*Table?/g, '').trim();
          const cleanOpponent = game.opponent.replace(/\s*\([^)]*\)\s*Table?/g, '').trim();
          
          const gameKey = `${cleanTeam}_${cleanOpponent}_${game.game_date}`;
          if (!uniqueGames.has(gameKey)) {
            uniqueGames.set(gameKey, {
              game_date: game.game_date,
              team: cleanTeam,
              opponent: cleanOpponent
            });
          }
        });
      }

      return Array.from(uniqueGames.values());
    } catch (error) {
      console.error('Error in getUpcomingGames:', error);
      return [];
    }
  }

  /**
   * Get team defensive stats for a specific stat type and season
   */
  async getTeamDefensiveStats(statType: string, season: string = '2025'): Promise<TeamDefensiveStats[]> {
    try {
      const { data, error } = await this.supabase
        .from('team_defensive_stats')
        .select('*')
        .eq('stat_type', statType)
        .eq('season', season);

      if (error) {
        console.error('Error fetching team defensive stats:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getTeamDefensiveStats:', error);
      return [];
    }
  }

  /**
   * Get opponent team defensive stats
   */
  async getOpponentTeamDefensiveStats(opponent: string, season: string = '2025'): Promise<number | null> {
    try {
      const { data, error } = await this.supabase
        .from('team_defensive_stats')
        .select('overall_avg_allowed')
        .eq('team', opponent)
        .eq('stat_type', 'overall_defense')
        .eq('season', season)
        .single();

      if (error) {
        console.log(`No overall defensive stats found for ${opponent}`);
        return null;
      }

      return data?.overall_avg_allowed || null;
    } catch (error) {
      console.error('Error in getOpponentTeamDefensiveStats:', error);
      return null;
    }
  }

  /**
   * Get official team defensive stats from WNBA stats
   */
  async getOfficialTeamDefensiveStats(season: string = '2025'): Promise<Map<string, number>> {
    try {
      const { data, error } = await this.supabase
        .from('team_defensive_stats')
        .select('team, overall_avg_allowed')
        .eq('stat_type', 'overall_defense')
        .eq('season', season);

      if (error) {
        console.error('Error fetching official team defensive stats:', error);
        return new Map();
      }

      const defensiveMap = new Map<string, number>();
      
      if (data) {
        data.forEach((team: any) => {
          if (team.overall_avg_allowed) {
            defensiveMap.set(team.team, team.overall_avg_allowed);
          }
        });
      }

      return defensiveMap;
    } catch (error) {
      console.error('Error in getOfficialTeamDefensiveStats:', error);
      return new Map();
    }
  }

  /**
   * Test defensive calculations for debugging
   */
  async testDefensiveCalculations(opponent: string, statType: string = 'points', season: string = '2025'): Promise<void> {
    try {
      console.log(`\n🧪 Testing defensive calculations for ${opponent} vs ${statType} in ${season}...`);
      
      // Get overall team defense
      const overallDefense = await this.getOpponentTeamDefensiveStats(opponent, season);
      console.log(`📊 Overall team defense: ${overallDefense || 'N/A'}`);
      
      // Get position-specific defense
      const { data: positionDefense, error } = await this.supabase
        .from('team_defensive_stats')
        .select('overall_avg_allowed')
        .eq('team', opponent)
        .eq('stat_type', `${statType}_defense`)
        .eq('season', season)
        .single();

      if (error) {
        console.log(`📊 Position-specific defense: Not found`);
      } else {
        console.log(`📊 Position-specific defense: ${positionDefense?.overall_avg_allowed || 'N/A'}`);
      }

      // Get league average
      const leagueAverage = statType === 'points' ? 82.5 : 0;
      console.log(`📊 League average: ${leagueAverage}`);
      
      if (overallDefense && leagueAverage > 0) {
        const defensiveRatio = overallDefense / leagueAverage;
        console.log(`📊 Defensive ratio: ${defensiveRatio.toFixed(3)}`);
        
        if (defensiveRatio > 1.1) {
          console.log(`🎯 Result: Weak defense (${((defensiveRatio - 1) * 100).toFixed(1)}% above average)`);
        } else if (defensiveRatio < 0.9) {
          console.log(`🎯 Result: Strong defense (${((1 - defensiveRatio) * 100).toFixed(1)}% below average)`);
        } else {
          console.log(`🎯 Result: Average defense (±10% of league average)`);
        }
      }
      
    } catch (error) {
      console.error('Error in testDefensiveCalculations:', error);
    }
  }

  /**
   * Extract season from a game date string (e.g., "Fri, May 16, 2025" -> "2025")
   */
  extractSeasonFromDate(gameDate: string): string {
    const date = new Date(gameDate);
    return date.getFullYear().toString();
  }
}
