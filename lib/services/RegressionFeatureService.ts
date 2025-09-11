import { createClient } from '@supabase/supabase-js';
import {
  RegressionFeatures,
  TrainingData,
  DataSplit
} from '../algorithms/RegressionTypes';
import { PlayerGameLog } from '../algorithms/Algorithms';

export class RegressionFeatureService {
  private supabase: any;
  private static instance: RegressionFeatureService;

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  public static getInstance(): RegressionFeatureService {
    if (!RegressionFeatureService.instance) {
      RegressionFeatureService.instance = new RegressionFeatureService();
    }
    return RegressionFeatureService.instance;
  }

  /**
   * Extract regression features from game logs for a specific player and stat type
   */
  async extractFeatures(
    playerId: string,
    statType: string,
    season: string
  ): Promise<TrainingData> {
    try {
      console.log(`🔍 Extracting features for ${playerId} - ${statType} (${season})`);
      
      // Get player game logs
      const gameLogs = await this.getPlayerGameLogs(playerId, season);
      
      if (gameLogs.length < 10) {
        throw new Error(`Insufficient game logs: ${gameLogs.length}. Need at least 10 games.`);
      }

      // Sort by date for proper time-based splitting
      gameLogs.sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());

      const features: RegressionFeatures[] = [];
      const targets: number[] = [];
      const gameDates: Date[] = [];
      const playerIds: string[] = [];

      // Process each game log
      for (let i = 0; i < gameLogs.length; i++) {
        const gameLog = gameLogs[i];
        
        try {
          // Extract features for this game
          const feature = await this.extractGameFeatures(gameLog, i, gameLogs, statType);
          const target = this.extractTargetValue(gameLog, statType);
          
          if (feature && target !== null) {
            features.push(feature);
            targets.push(target);
            gameDates.push(new Date(gameLog.gameDate));
            playerIds.push(playerId);
          }
        } catch (error) {
          console.warn(`⚠️ Skipping game ${gameLog.gameDate} due to error:`, error);
          continue;
        }
      }

      if (features.length < 10) {
        throw new Error(`Insufficient valid features: ${features.length}. Need at least 10 games.`);
      }

      console.log(`✅ Extracted ${features.length} feature sets for training`);
      
      return {
        features,
        targets,
        gameDates,
        playerIds
      };
    } catch (error) {
      console.error('❌ Error extracting features:', error);
      throw error;
    }
  }

  /**
   * Split data into training, validation, and test sets (time-based)
   */
  async splitData(
    features: RegressionFeatures[],
    targets: number[],
    gameDates: Date[]
  ): Promise<DataSplit> {
    const totalGames = features.length;
    
    // Time-based split: 70% training, 15% validation, 15% test
    const trainingEndIndex = Math.floor(totalGames * 0.7);
    const validationEndIndex = Math.floor(totalGames * 0.85);
    
    return {
      training: {
        features: features.slice(0, trainingEndIndex),
        targets: targets.slice(0, trainingEndIndex),
        gameDates: gameDates.slice(0, trainingEndIndex)
      },
      validation: {
        features: features.slice(trainingEndIndex, validationEndIndex),
        targets: targets.slice(trainingEndIndex, validationEndIndex),
        gameDates: gameDates.slice(trainingEndIndex, validationEndIndex)
      },
      test: {
        features: features.slice(validationEndIndex),
        targets: targets.slice(validationEndIndex),
        gameDates: gameDates.slice(validationEndIndex)
      }
    };
  }

  /**
   * Extract features for a specific game
   */
  private async extractGameFeatures(
    gameLog: PlayerGameLog,
    gameIndex: number,
    allGameLogs: PlayerGameLog[],
    statType: string
  ): Promise<RegressionFeatures> {
    // Get opponent defensive rating
    const opponentDefensiveRating = await this.getOpponentDefensiveRating(
      gameLog.opponent,
      statType,
'2025'
    );

    // Home/Away (1 for home, 0 for away)
    const homeAway = gameLog.isHome ? 1 : 0;

    // Injury status (0 for healthy, 1+ for injured)
    const injuryStatus = 0; // PlayerGameLog doesn't have injury_status, default to 0

    // Rest days since last game
    const restDays = this.calculateRestDays(gameIndex, allGameLogs);

    // Back-to-back games (1 for b2b, 0 otherwise)
    const backToBack = restDays === 0 ? 1 : 0;

    // Team pace factor
    const teamPace = await this.getTeamPace(gameLog.team, '2025');

    // Opponent pace factor
    const opponentPace = await this.getTeamPace(gameLog.opponent, '2025');

    // Teammate injuries count
    const teammateInjuries = await this.getTeammateInjuriesCount(
      gameLog.team,
      gameLog.gameDate,
'2025'
    );

    return {
      opponentDefensiveRating,
      homeAway,
      injuryStatus,
      restDays,
      backToBack,
      teamPace,
      opponentPace,
      teammateInjuries
    };
  }

  /**
   * Extract target value for the specified stat type
   */
  private extractTargetValue(gameLog: PlayerGameLog, statType: string): number | null {
    switch (statType) {
      case 'points':
        return gameLog.points || 0;
      case 'rebounds':
        return gameLog.rebounds || 0;
      case 'assists':
        return gameLog.assists || 0;
      case 'pa': // Points + Assists
        return (gameLog.points || 0) + (gameLog.assists || 0);
      case 'pr': // Points + Rebounds
        return (gameLog.points || 0) + (gameLog.rebounds || 0);
      case 'ra': // Rebounds + Assists
        return (gameLog.rebounds || 0) + (gameLog.assists || 0);
      case 'pra': // Points + Rebounds + Assists
        return (gameLog.points || 0) + (gameLog.rebounds || 0) + (gameLog.assists || 0);
      default:
        return gameLog.points || 0; // Default to points
    }
  }

  /**
   * Get opponent defensive rating for the specified stat type
   */
  private async getOpponentDefensiveRating(
    opponent: string,
    statType: string,
    season: string
  ): Promise<number> {
    try {
      // Map stat types to defensive stat columns
      const statColumnMap: Record<string, string> = {
        'points': 'points_allowed',
        'rebounds': 'rebounds_allowed',
        'assists': 'assists_allowed',
        'pa': 'points_allowed', // Use points defense for combined stats
        'pr': 'points_allowed',
        'ra': 'rebounds_allowed',
        'pra': 'points_allowed'
      };

      const statColumn = statColumnMap[statType] || 'points_allowed';
      const homeAway = 'home'; // Default to home stats

      const { data, error } = await this.supabase
        .from('team_defensive_stats')
        .select(`${homeAway}_avg_allowed`)
        .eq('team', opponent)
        .eq('stat_type', statColumn)
        .eq('season', season)
        .single();

      if (error || !data) {
        // Fallback to league average if no defensive stats found
        console.warn(`⚠️ No defensive stats found for ${opponent} - ${statType}, using league average`);
        return this.getLeagueAverage(statType);
      }

      return data[`${homeAway}_avg_allowed`] || this.getLeagueAverage(statType);
    } catch (error) {
      console.warn(`⚠️ Error getting defensive rating for ${opponent} - ${statType}:`, error);
      return this.getLeagueAverage(statType);
    }
  }

  /**
   * Get team pace factor
   */
  private async getTeamPace(team: string, season: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('team_pace_stats')
        .select('pace_factor')
        .eq('team', team)
        .eq('season', season)
        .single();

      if (error || !data) {
        return 1.0; // Default to average pace
      }

      return data.pace_factor || 1.0;
    } catch (error) {
      console.warn(`⚠️ Error getting pace for ${team}:`, error);
      return 1.0;
    }
  }

  /**
   * Get teammate injuries count
   */
  private async getTeammateInjuriesCount(
    team: string,
    gameDate: string,
    season: string
  ): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('player_injuries')
        .select('player_id')
        .eq('team', team)
        .eq('season', season)
        .eq('status', 'injured')
        .lte('injury_date', gameDate)
        .gte('return_date', gameDate);

      if (error) {
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.warn(`⚠️ Error getting teammate injuries for ${team}:`, error);
      return 0;
    }
  }

  /**
   * Calculate rest days since last game
   */
  private calculateRestDays(gameIndex: number, allGameLogs: PlayerGameLog[]): number {
    if (gameIndex === 0) {
      return 7; // First game of season, assume 7 days rest
    }

    const currentGameDate = new Date(allGameLogs[gameIndex].gameDate);
    const previousGameDate = new Date(allGameLogs[gameIndex - 1].gameDate);
    
    const timeDiff = currentGameDate.getTime() - previousGameDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return Math.max(0, daysDiff - 1); // Subtract 1 since same day = 0 rest days
  }

  /**
   * Get league average for a stat type (fallback)
   */
  private getLeagueAverage(statType: string): number {
    const leagueAverages: Record<string, number> = {
      'points': 13.2,
      'rebounds': 5.4,
      'assists': 3.3,
      'pa': 16.5, // Points + Assists
      'pr': 18.6, // Points + Rebounds
      'ra': 8.7,  // Rebounds + Assists
      'pra': 21.9 // Points + Rebounds + Assists
    };

    return leagueAverages[statType] || 13.2;
  }

  /**
   * Get player game logs from database
   */
  private async getPlayerGameLogs(playerId: string, season: string): Promise<PlayerGameLog[]> {
    try {
      const { data, error } = await this.supabase
        .from('wnba_game_logs')
        .select('*')
        .eq('player_id', playerId)
        .eq('season', season)
        .order('gameDate', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error getting player game logs:', error);
      throw error;
    }
  }

  /**
   * Validate features for data quality
   */
  validateFeatures(features: RegressionFeatures[]): boolean {
    for (const feature of features) {
      // Check for NaN or infinite values
      if (Object.values(feature).some(value => 
        typeof value !== 'number' || 
        isNaN(value) || 
        !isFinite(value)
      )) {
        return false;
      }

      // Check for reasonable ranges
      if (feature.opponentDefensiveRating < 0 || feature.opponentDefensiveRating > 200) {
        return false;
      }

      if (feature.homeAway !== 0 && feature.homeAway !== 1) {
        return false;
      }

      if (feature.injuryStatus < 0 || feature.injuryStatus > 10) {
        return false;
      }

      if (feature.restDays < 0 || feature.restDays > 30) {
        return false;
      }
    }

    return true;
  }

  /**
   * Normalize features to 0-1 range (optional, for some algorithms)
   */
  normalizeFeatures(features: RegressionFeatures[]): RegressionFeatures[] {
    if (features.length === 0) return features;

    const featureNames = Object.keys(features[0]) as (keyof RegressionFeatures)[];
    const minMax: Record<keyof RegressionFeatures, { min: number; max: number }> = {} as any;

    // Calculate min/max for each feature
    featureNames.forEach(featureName => {
      const values = features.map(f => f[featureName] as number);
      minMax[featureName] = {
        min: Math.min(...values),
        max: Math.max(...values)
      };
    });

    // Normalize features
    return features.map(feature => {
      const normalized: RegressionFeatures = {} as RegressionFeatures;
      
      featureNames.forEach(featureName => {
        const { min, max } = minMax[featureName];
        const value = feature[featureName] as number;
        
        if (max === min) {
          normalized[featureName] = 0.5; // Avoid division by zero
        } else {
          normalized[featureName] = (value - min) / (max - min);
        }
      });

      return normalized;
    });
  }
}
