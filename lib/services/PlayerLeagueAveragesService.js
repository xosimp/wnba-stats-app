const { createClient } = require('@supabase/supabase-js');

/**
 * Service for calculating dynamic player-level league averages from the database
 * This replaces the hardcoded LEAGUE_AVERAGES in Algorithms.ts
 */
class PlayerLeagueAveragesService {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // Load league averages from database on service initialization
    this.loadLeagueAveragesFromDatabase().catch(error => {
      console.error('Failed to load player league averages from database:', error);
    });
  }

  static instance = null;
  
  // Dynamic player-level league averages (calculated from database)
  static PLAYER_LEAGUE_AVERAGES = {
    points: 13.2,
    rebounds: 5.4,
    assists: 3.3,
    turnovers: 2.3,
    steals: 1.3,
    blocks: 0.9,
    minutes: 29.1
  };

  // Top 1% thresholds (calculated dynamically)
  static TOP_1_PERCENT_THRESHOLDS = {
    points: 21.0,
    rebounds: 9.0,
    assists: 5.5,
    turnovers: 3.8,
    steals: 2.5,
    blocks: 1.8,
    minutes: 34.0
  };

  // Bottom 1% thresholds (calculated dynamically)
  static BOTTOM_1_PERCENT_THRESHOLDS = {
    points: 4.2,
    rebounds: 1.8,
    assists: 0.8,
    turnovers: 0.5,
    steals: 0.2,
    blocks: 0.1,
    minutes: 12.5
  };

  /**
   * Get singleton instance
   */
  static getInstance(supabaseUrl, supabaseKey) {
    if (!PlayerLeagueAveragesService.instance) {
      // Use provided credentials or fall back to environment variables
      const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!url || !key) {
        throw new Error('Supabase credentials required for first initialization');
      }
      PlayerLeagueAveragesService.instance = new PlayerLeagueAveragesService(url, key);
    }
    return PlayerLeagueAveragesService.instance;
  }

  /**
   * Get the current player-level league average for a specific stat type
   */
  getLeagueAverage(statType) {
    return PlayerLeagueAveragesService.PLAYER_LEAGUE_AVERAGES[statType] || 0;
  }

  /**
   * Get top 1% threshold for a specific stat type
   */
  getTop1PercentThreshold(statType) {
    return PlayerLeagueAveragesService.TOP_1_PERCENT_THRESHOLDS[statType] || 0;
  }

  /**
   * Get bottom 1% threshold for a specific stat type
   */
  getBottom1PercentThreshold(statType) {
    return PlayerLeagueAveragesService.BOTTOM_1_PERCENT_THRESHOLDS[statType] || 0;
  }

  /**
   * Get all current thresholds
   */
  getAllThresholds() {
    return {
      leagueAvg: { ...PlayerLeagueAveragesService.PLAYER_LEAGUE_AVERAGES },
      top1: { ...PlayerLeagueAveragesService.TOP_1_PERCENT_THRESHOLDS },
      bottom1: { ...PlayerLeagueAveragesService.BOTTOM_1_PERCENT_THRESHOLDS }
    };
  }

  /**
   * Update player-level league averages from database
   * This calculates averages from individual player game logs
   */
  async updateLeagueAverages(season = '2025') {
    try {
      console.log('🔄 Updating player-level league averages from database...');
      
      // Get ALL player game logs for the season using pagination
      // We need to fetch all 4000+ rows for accurate calculations
      let allGameLogs = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await this.supabase
          .from('wnba_game_logs')
          .select('points, rebounds, assists, turnovers, steals, blocks, minutes, game_date')
          .gte('game_date', `${season}-01-01`)
          .lt('game_date', `${parseInt(season) + 1}-01-01`)
          .not('points', 'is', null)
          .gt('minutes', 18) // Only include players who played at least 18 minutes
          .range(from, from + batchSize - 1);

        if (error) {
          console.error('❌ Error fetching game logs batch:', error);
          break;
        }

        if (batch && batch.length > 0) {
          allGameLogs = allGameLogs.concat(batch);
          from += batchSize;
          console.log(`📊 Fetched ${allGameLogs.length} game logs so far...`);
          
          // If we got less than batchSize, we've reached the end
          if (batch.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      const gameLogs = allGameLogs;

      if (!gameLogs || gameLogs.length === 0) {
        console.log('⚠️ No game logs found for league average calculation');
        return;
      }

      console.log(`📊 Calculating averages from ${gameLogs.length} game logs...`);

      // Calculate league averages for each stat type
      const statTypes = ['points', 'rebounds', 'assists', 'turnovers', 'steals', 'blocks', 'minutes'];
      const leagueAverages = {};
      const allValues = {};

      for (const statType of statTypes) {
        const validValues = gameLogs
          .map((game) => game[statType])
          .filter((value) => typeof value === 'number' && !isNaN(value) && value >= 0);
        
        if (validValues.length > 0) {
          const average = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
          leagueAverages[statType] = Math.round(average * 10) / 10; // Round to 1 decimal
          allValues[statType] = validValues;
          console.log(`📈 League average for ${statType}: ${leagueAverages[statType]} (from ${validValues.length} games)`);
        }
      }

      // Calculate percentiles for top/bottom 1% thresholds
      const top1Thresholds = {};
      const bottom1Thresholds = {};

      for (const statType of statTypes) {
        if (allValues[statType] && allValues[statType].length > 0) {
          const sortedValues = [...allValues[statType]].sort((a, b) => a - b);
          const top1Index = Math.ceil(sortedValues.length * 0.99) - 1;
          const bottom1Index = Math.ceil(sortedValues.length * 0.01) - 1;
          
          top1Thresholds[statType] = Math.round(sortedValues[Math.max(0, top1Index)] * 10) / 10;
          
          // For bottom 1%, use 5th percentile instead of 1st to avoid getting mostly 0s
          const bottom5Index = Math.ceil(sortedValues.length * 0.05) - 1;
          bottom1Thresholds[statType] = Math.round(sortedValues[Math.max(0, bottom5Index)] * 10) / 10;
          
          console.log(`📊 ${statType} thresholds - Top 1%: ${top1Thresholds[statType]}, Bottom 5%: ${bottom1Thresholds[statType]}`);
        }
      }

      // Update the static constants
      Object.assign(PlayerLeagueAveragesService.PLAYER_LEAGUE_AVERAGES, leagueAverages);
      Object.assign(PlayerLeagueAveragesService.TOP_1_PERCENT_THRESHOLDS, top1Thresholds);
      Object.assign(PlayerLeagueAveragesService.BOTTOM_1_PERCENT_THRESHOLDS, bottom1Thresholds);
      
      console.log('✅ Player-level league averages updated successfully:', {
        leagueAvg: PlayerLeagueAveragesService.PLAYER_LEAGUE_AVERAGES,
        top1: PlayerLeagueAveragesService.TOP_1_PERCENT_THRESHOLDS,
        bottom1: PlayerLeagueAveragesService.BOTTOM_1_PERCENT_THRESHOLDS
      });
      
      // Save to database for persistence
      await this.saveLeagueAveragesToDatabase(leagueAverages, top1Thresholds, bottom1Thresholds, season);
      
    } catch (error) {
      console.error('❌ Error updating player league averages:', error);
    }
  }

  /**
   * Save league averages to database for persistence
   */
  async saveLeagueAveragesToDatabase(averages, top1, bottom1, season) {
    try {
      const { error } = await this.supabase
        .from('player_league_averages')
        .upsert({
          season,
          updated_at: new Date().toISOString(),
          // League averages
          points_avg: averages.points,
          rebounds_avg: averages.rebounds,
          assists_avg: averages.assists,
          turnovers_avg: averages.turnovers,
          steals_avg: averages.steals,
          blocks_avg: averages.blocks,
          minutes_avg: averages.minutes,
          // Top 1% thresholds
          points_top1: top1.points,
          rebounds_top1: top1.rebounds,
          assists_top1: top1.assists,
          turnovers_top1: top1.turnovers,
          steals_top1: top1.steals,
          blocks_top1: top1.blocks,
          minutes_top1: top1.minutes,
          // Bottom 1% thresholds
          points_bottom1: bottom1.points,
          rebounds_bottom1: bottom1.rebounds,
          assists_bottom1: bottom1.assists,
          turnovers_bottom1: bottom1.turnovers,
          steals_bottom1: bottom1.steals,
          blocks_bottom1: bottom1.blocks,
          minutes_bottom1: bottom1.minutes
        }, {
          onConflict: 'season'
        });

      if (error) {
        console.error('❌ Error saving player league averages to database:', error);
      } else {
        console.log('✅ Player league averages saved to database successfully');
      }
    } catch (error) {
      console.error('❌ Error in saveLeagueAveragesToDatabase:', error);
    }
  }

  /**
   * Load league averages from database on service initialization
   */
  async loadLeagueAveragesFromDatabase(season = '2025') {
    try {
      const { data, error } = await this.supabase
        .from('player_league_averages')
        .select('*')
        .eq('season', season)
        .single();

      if (error) {
        console.log('📊 No player league averages found in database, using defaults');
        // Try to calculate from current data
        await this.updateLeagueAverages(season);
        return;
      }

      if (data) {
        // Update static constants with database values
        PlayerLeagueAveragesService.PLAYER_LEAGUE_AVERAGES = {
          points: data.points_avg || 13.2,
          rebounds: data.rebounds_avg || 5.4,
          assists: data.assists_avg || 3.3,
          turnovers: data.turnovers_avg || 2.3,
          steals: data.steals_avg || 1.3,
          blocks: data.blocks_avg || 0.9,
          minutes: data.minutes_avg || 29.1
        };

        PlayerLeagueAveragesService.TOP_1_PERCENT_THRESHOLDS = {
          points: data.points_top1 || 21.0,
          rebounds: data.rebounds_top1 || 9.0,
          assists: data.assists_top1 || 5.5,
          turnovers: data.turnovers_top1 || 3.8,
          steals: data.steals_top1 || 2.5,
          blocks: data.blocks_top1 || 1.8,
          minutes: data.minutes_top1 || 34.0
        };

        PlayerLeagueAveragesService.BOTTOM_1_PERCENT_THRESHOLDS = {
          points: data.points_bottom1 || 4.2,
          rebounds: data.rebounds_bottom1 || 1.8,
          assists: data.assists_bottom1 || 0.8,
          turnovers: data.turnovers_bottom1 || 0.5,
          steals: data.steals_bottom1 || 0.2,
          blocks: data.blocks_bottom1 || 0.1,
          minutes: data.minutes_bottom1 || 12.5
        };
        
        console.log('✅ Player league averages loaded from database:', {
          leagueAvg: PlayerLeagueAveragesService.PLAYER_LEAGUE_AVERAGES,
          top1: PlayerLeagueAveragesService.TOP_1_PERCENT_THRESHOLDS,
          bottom1: PlayerLeagueAveragesService.BOTTOM_1_PERCENT_THRESHOLDS
        });
      }
    } catch (error) {
      console.error('❌ Error loading player league averages from database:', error);
    }
  }

  /**
   * Force refresh of league averages (useful for manual updates)
   */
  async refreshLeagueAverages(season = '2025') {
    console.log('🔄 Force refreshing player league averages...');
    await this.updateLeagueAverages(season);
  }
}

module.exports = { PlayerLeagueAveragesService };
