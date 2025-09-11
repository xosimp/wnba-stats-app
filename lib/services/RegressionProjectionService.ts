import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ProjectionRequest, ProjectionResult } from '../algorithms/Algorithms';

export class RegressionProjectionService {
  private static instance: RegressionProjectionService;
  private supabase: SupabaseClient;

  private constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    console.log('✅ RegressionProjectionService initialized with provided Supabase client');
  }

  public static getInstance(supabaseClient?: SupabaseClient): RegressionProjectionService {
    if (!RegressionProjectionService.instance) {
      if (supabaseClient) {
        RegressionProjectionService.instance = new RegressionProjectionService(supabaseClient);
      } else {
        // Create default Supabase client
        const defaultClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        RegressionProjectionService.instance = new RegressionProjectionService(defaultClient);
      }
    }
    return RegressionProjectionService.instance;
  }

  /**
   * Generate projection using PACE-enhanced regression models
   */
  async generateProjection(request: ProjectionRequest): Promise<ProjectionResult | null> {
    console.log(`🧠 REGRESSION PROJECTION: Starting with request:`, request);
    
    try {
      // Get the trained regression model for this player and stat type
      const { data: model, error: modelError } = await this.supabase
        .from('regression_models')
        .select('model_data')
        .eq('player_id', request.playerName)
        .eq('stat_type', request.statType)
        .eq('season', '2025')
        .single();

      if (modelError || !model?.model_data) {
        console.log(`❌ No regression model found for ${request.playerName} - ${request.statType}`);
        return null;
      }

      console.log(`✅ Found regression model with ${model.model_data.featureNames?.length || 0} features`);
      console.log(`   Features: ${model.model_data.featureNames?.join(', ')}`);

      // Check if PACE features are included
      const hasPace = model.model_data.featureNames?.includes('team_pace') && 
                     model.model_data.featureNames?.includes('opponent_pace');
      
      console.log(`⚡ PACE Features: ${hasPace ? '✅ INCLUDED' : '❌ MISSING'}`);

      // Get player's advanced stats for features
      const { data: playerStats, error: statsError } = await this.supabase
        .from('player_advanced_stats')
        .select('usage_percentage, position, team, avg_minutes')
        .eq('player_name', request.playerName)
        .eq('season', '2025')
        .single();

      if (statsError || !playerStats) {
        console.log(`❌ No advanced stats found for ${request.playerName}`);
        return null;
      }

      // Get team pace data
      const teamNameMap = {
        'WAS': 'Washington Mystics',
        'CON': 'Connecticut Sun', 
        'LVA': 'Las Vegas Aces',
        'IND': 'Indiana Fever',
        'MIN': 'Minnesota Lynx',
        'NYL': 'New York Liberty',
        'LAS': 'Los Angeles Sparks',
        'DAL': 'Dallas Wings',
        'PHO': 'Phoenix Mercury',
        'CHI': 'Chicago Sky',
        'ATL': 'Atlanta Dream',
        'SEA': 'Seattle Storm',
        'GSV': 'Golden State Valkyries'
      };

      const fullTeamName = teamNameMap[playerStats.team as keyof typeof teamNameMap] || playerStats.team;
      
      const { data: teamPace, error: paceError } = await this.supabase
        .from('team_pace_stats')
        .select('pace, rank')
        .eq('team_name', fullTeamName)
        .eq('season', '2025')
        .single();

      if (paceError || !teamPace) {
        console.log(`❌ No team pace data found for ${fullTeamName}`);
        return null;
      }

      // Get opponent pace data
      const { data: opponentPace, error: opponentPaceError } = await this.supabase
        .from('team_pace_stats')
        .select('pace, rank')
        .eq('team_name', request.opponent)
        .eq('season', '2025')
        .single();

      if (opponentPaceError || !opponentPace) {
        console.log(`❌ No opponent pace data found for ${request.opponent}`);
        return null;
      }

      // Get recent form (last 3 games)
      const { data: recentGames, error: gamesError } = await this.supabase
        .from('wnba_game_logs')
        .select('points, rebounds, assists, steals, blocks, turnovers')
        .eq('player_name', request.playerName)
        .order('game_date', { ascending: false })
        .limit(3);

      if (gamesError) {
        console.log(`❌ Error fetching recent games: ${gamesError.message}`);
        return null;
      }

      // Calculate recent form average
      const recentValues = recentGames.map(game => {
        const value = game[request.statType as keyof typeof game];
        return typeof value === 'number' ? value : 0;
      }).filter(val => !isNaN(val));
      const recentForm = recentValues.length > 0 ? recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length : 0;

      // Create feature values for prediction
      const features = {
        usage_percentage: (playerStats.usage_percentage || 20) / 100,
        position_defense_rating: 0.5, // Default - will be enhanced later
        opponent_usage_allowed: 0.2, // Default - will be enhanced later
        opponent_minutes_allowed: 0.25, // Default - will be enhanced later
        rest_days: request.daysRest ? Math.min(7, request.daysRest) / 7 : 0.5,
        recent_form: recentForm > 0 ? Math.max(0, recentForm) / 50 : 0.5,
        season_avg: (playerStats.usage_percentage || 20) / 100,
        team_pace: teamPace.pace / 100,
        opponent_pace: opponentPace.pace / 100
      };

      console.log(`📊 Feature values:`, features);

      // Make prediction using the model
      const prediction = this.predictWithModel(model.model_data, features);
      
      if (prediction === null) {
        console.log(`❌ Prediction calculation failed`);
        return null;
      }

      // Calculate confidence intervals
      const confidence = model.model_data.residualStandardDeviation || 5;
      const confidenceInterval = {
        lower: Math.max(0, prediction - confidence),
        upper: prediction + confidence
      };

      // Calculate edge vs sportsbook line if provided
      let edge = 0;
      if (request.sportsbookLine) {
        edge = prediction - request.sportsbookLine;
      }

      // Calculate confidence score based on model R² and data quality
      const confidenceScore = Math.min(1.0, Math.max(0.1, 
        (model.model_data.rSquared || 0) * 0.7 + 
        (recentGames.length / 3) * 0.3
      ));

      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
      if (confidenceScore >= 0.8) riskLevel = 'LOW';
      else if (confidenceScore <= 0.4) riskLevel = 'HIGH';

      // Determine recommendation
      let recommendation: 'OVER' | 'UNDER' | 'PASS' = 'PASS';
      if (Math.abs(edge) >= confidence * 0.5) {
        recommendation = edge > 0 ? 'OVER' : 'UNDER';
      }

      const result: ProjectionResult = {
        projectedValue: prediction,
        edge,
        confidenceScore,
        riskLevel,
        recommendation,
        factors: {
          seasonAverage: Number(features.season_avg) * 100,
          recentForm: Number(recentForm),
          opponentDefense: features.opponent_usage_allowed * 100,
          homeAway: 0.5, // Default neutral value
          backToBack: 1.0, // Default no fatigue
          pace: Number(teamPace.pace),
          restFactor: Number(features.rest_days),
          injuryImpact: 1.0, // Default no injury impact
          headToHead: 0.5, // Default neutral
          perFactor: 1.0, // Default no PER boost
          regressionFactor: 1.0,
          lineupShiftMultiplier: 1.0
        },
        // Legacy fields for compatibility
        historicalAccuracy: confidenceScore * 100,
        recentFormPercentage: recentForm > 0 ? (recentForm / (features.season_avg * 100)) * 100 : 100,
        matchupAnalysis: Number(opponentPace.pace),
        teammateInjuries: request.teammateInjuries || [],
        seasonGamesCount: recentGames.length
      };

      console.log(`✅ Regression projection completed:`);
      console.log(`   ${request.playerName}: ${prediction.toFixed(1)} ${request.statType}`);
      console.log(`   Confidence: ${confidenceInterval.lower.toFixed(1)} - ${confidenceInterval.upper.toFixed(1)}`);
      console.log(`   Edge: ${edge > 0 ? '+' : ''}${edge.toFixed(1)}`);
      console.log(`   R²: ${model.model_data.rSquared?.toFixed(3)}`);
      console.log(`   PACE Impact: Team ${teamPace.pace} vs Opponent ${opponentPace.pace}`);

      return result;

    } catch (error) {
      console.error('❌ Error in regression projection:', error);
      return null;
    }
  }

  /**
   * Make prediction using trained model coefficients
   */
  private predictWithModel(modelData: any, features: any): number | null {
    try {
      const { coefficients, intercept } = modelData;
      
      if (!coefficients || intercept === null || intercept === undefined) {
        console.log(`❌ Invalid model data: missing coefficients or intercept`);
        return null;
      }

      let prediction = intercept;
      
      // Apply each feature coefficient
      Object.entries(coefficients).forEach(([feature, coefficient]) => {
        if (coefficient !== null && features[feature] !== undefined) {
          prediction += (coefficient as number) * features[feature];
        }
      });

      // Validate prediction
      if (isNaN(prediction) || !isFinite(prediction)) {
        console.log(`❌ Invalid prediction result: ${prediction}`);
        return null;
      }

      return Math.max(0, prediction); // Ensure non-negative

    } catch (error) {
      console.error('❌ Error in prediction calculation:', error);
      return null;
    }
  }

  /**
   * Check if a player has a trained regression model
   */
  async hasTrainedModel(playerName: string, statType: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('regression_models')
        .select('id')
        .eq('player_id', playerName)
        .eq('stat_type', statType)
        .eq('season', '2025')
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get model performance metrics
   */
  async getModelMetrics(playerName: string, statType: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('regression_models')
        .select('model_data')
        .eq('player_id', playerName)
        .eq('stat_type', statType)
        .eq('season', '2025')
        .single();

      if (error || !data) return null;

      return {
        rSquared: data.model_data.rSquared,
        rmse: data.model_data.performanceMetrics?.rmse,
        hasPaceFeatures: data.model_data.featureNames?.includes('team_pace'),
        featureCount: data.model_data.featureNames?.length || 0
      };
    } catch (error) {
      return null;
    }
  }
}
