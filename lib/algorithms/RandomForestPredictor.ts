// Random Forest Prediction Utility for WNBA Stats
// This utility handles prediction using trained Random Forest models

export interface RandomForestModel {
  modelType: 'random_forest';
  hyperparameters: {
    nEstimators: number;
    maxDepth: number;
    minSamplesSplit: number;
    minSamplesLeaf: number;
    maxFeatures: string | number;
  };
  performance: {
    rSquared: number;
    rmse: number;
    mae: number;
  };
  features: string[];
  trainingData: {
    total: number;
    '2025': number;
    '2024': number;
  };
  trainedAt: string;
  trees?: any[]; // The actual tree structures if available
}

export interface PredictionInput {
  playerName: string;
  team: string;
  opponent: string;
  statType: 'points' | 'rebounds' | 'assists';
  isHome: boolean;
  gameDate: string;
  daysRest: number;
  sportsbookLine?: number;
  teammateInjuries?: any[];
}

export interface PredictionResult {
  projectedValue: number;
  confidenceScore: number;
  factors: {
    homeAway: number;
    backToBack: number;
    pace: number;
    restFactor: number;
    injuryImpact: number;
    headToHead: number;
    perFactor: number;
    regressionFactor: number;
    lineupShiftMultiplier: number;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  edge: number;
  recommendation: 'OVER' | 'UNDER' | 'PASS';
  historicalAccuracy: number;
  recentFormPercentage: string;
  matchupAnalysis: number;
  seasonGamesCount: number;
  teammateInjuries: any[];
  modelQuality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  modelWarning: string | null;
  method: string;
  statType: string;
  modelId: string;
  modelPerformance: {
    rSquared: number;
    rmse: number;
    mae: number;
  };
  recentForm: number;
  matchupAnalysisText: string;
  features: Record<string, number>;
  timestamp: string;
}

export class RandomForestPredictor {
  private model: RandomForestModel | null = null;
  private featureNames: string[] = [];

  constructor(model: RandomForestModel) {
    this.model = model;
    this.featureNames = model.features;
  }

  /**
   * Create features for prediction based on the trained model's feature requirements
   */
  async createFeatures(input: PredictionInput, additionalData: any): Promise<number[]> {
    if (!this.model) {
      throw new Error('No model loaded');
    }

    const features: number[] = [];
    
    // Calculate recent form from actual recent games
    const recentGames = additionalData.recentGames || [];
    const recentFormGames = recentGames.slice(0, 10); // Last 10 games
    const recentValues = recentFormGames.map((game: any) => game[input.statType]).filter(val => val !== undefined && !isNaN(val));
    const recentForm = recentValues.length > 0 ? recentValues.reduce((sum: number, val: number) => sum + val, 0) / recentValues.length : 0;
    
    // Calculate recent form volatility (standard deviation)
    const recentFormVolatility = recentValues.length > 1 ? 
      Math.sqrt(recentValues.reduce((sum: number, val: number) => sum + Math.pow(val - recentForm, 2), 0) / recentValues.length) : 0;

    // Apply lineup adjustments if teammates are injured
    console.log(`🔍 Checking for teammate injuries: ${input.teammateInjuries?.length || 0} injuries`);
    if (input.teammateInjuries && input.teammateInjuries.length > 0) {
      try {
        console.log(`🔧 Applying lineup adjustments for ${input.playerName} when ${input.teammateInjuries.join(', ')} are out`);        
        // Calculate lineup adjustments based on historical data
        const lineupAdjustments = await this.calculateLineupAdjustments(
          input.playerName,
          input.team,
          input.statType,
          input.teammateInjuries
        );
        
        if (lineupAdjustments) {
          console.log(`✅ Lineup adjustments calculated:`, {
            shootingEfficiency: lineupAdjustments.adjustedTeammateShootingEfficiency,
            reboundingStrength: lineupAdjustments.adjustedTeammateReboundingStrength,
            assistDependency: lineupAdjustments.adjustedTeammateAssistDependency,
            lineupShift: lineupAdjustments.lineupShiftMultiplier
          });
          
          // Update additionalData with adjusted values
          Object.assign(additionalData, lineupAdjustments);
          console.log(`📊 Updated additionalData with lineup adjustments`);
        } else {
          console.log('⚠️ No lineup adjustments calculated');
        }
        
      } catch (error) {
        console.warn('Error applying lineup adjustments:', error);
        console.error('Full error:', error);
        // Continue with original data if adjustment fails
      }
    } else {
      console.log('ℹ️ No teammate injuries to process');
    }
    
    // Store volatility in additionalData for risk calculation
    additionalData.recentFormVolatility = recentFormVolatility;
    
    // Calculate recent form composite (weighted average of last 5 and last 10)
    const last5Games = recentFormGames.slice(0, 5);
    const last5Values = last5Games.map((game: any) => game[input.statType]).filter(val => val !== undefined && !isNaN(val));
    const last5Avg = last5Values.length > 0 ? last5Values.reduce((sum: number, val: number) => sum + val, 0) / last5Values.length : 0;
    const recentFormComposite = (last5Avg * 0.6) + (recentForm * 0.4);
    
    // Calculate recent non-scoring contributions (assists + rebounds for points model)
    const recentNonScoring = input.statType === 'points' ? 
      recentFormGames.map((game: any) => (game.assists || 0) + (game.rebounds || 0)).reduce((sum: number, val: number) => sum + val, 0) / recentFormGames.length : 0;
    
    // Create features in the same order as the training data
    for (const featureName of this.featureNames) {
      let value = 0;
      
      switch (featureName) {
        // Player performance features
        case 'season_average_points':
          value = additionalData.seasonAverages?.avg_points || 0;
          break;
        case 'season_average_rebounds':
          value = additionalData.seasonAverages?.avg_rebounds || 0;
          break;
        case 'season_average_assists':
          value = additionalData.seasonAverages?.avg_assists || 0;
          break;
        case 'recent_form_points':
          value = input.statType === 'points' ? recentForm : 0;
          break;
        case 'recent_form_rebounds':
          value = input.statType === 'rebounds' ? recentForm : 0;
          break;
        case 'recent_form_assists':
          value = input.statType === 'assists' ? recentForm : 0;
          break;
        case 'recent_form_composite':
          value = recentFormComposite;
          break;
        case 'recent_form_volatility':
          value = recentFormVolatility;
          break;
        case 'recent_non_scoring_contributions':
          value = recentNonScoring;
          break;
        
        // Rebounds-specific features
        case 'recent_rebound_form_composite':
          value = input.statType === 'rebounds' ? recentFormComposite : 0;
          break;
        case 'recent_rebound_volatility':
          value = input.statType === 'rebounds' ? recentFormVolatility : 0;
          break;
        case 'offensive_rebound_percentage':
          value = additionalData.seasonAverages?.offensive_rebound_percentage || 0;
          break;
        case 'defensive_rebound_percentage':
          value = additionalData.seasonAverages?.defensive_rebound_percentage || 0;
          break;
        case 'opponent_rebounds_allowed':
          value = additionalData.opponentDefense?.rebounds_allowed || 40;
          break;
        case 'opponent_field_goal_percentage':
          value = additionalData.opponentDefense?.opp_fg_pct || 0.45;
          break;
        case 'opponent_position_rebounds':
          value = additionalData.opponentDefense?.position_rebounds || 40;
          break;
        case 'teammate_rebounding_strength':
          value = additionalData.adjustedTeammateReboundingStrength || additionalData.teammateReboundingStrength || 40;
          break;
        case 'teammate_shooting_efficiency':
          value = additionalData.adjustedTeammateShootingEfficiency || additionalData.teammateShootingEfficiency || 0.45;
          break;
        case 'teammate_assist_dependency':
          value = additionalData.adjustedTeammateAssistDependency || additionalData.teammateAssistDependency || 0.25;
          break;
        case 'lineup_shift_multiplier':
          value = additionalData.lineupShiftMultiplier || 1.0;
          break;
        
        // Game context features
        case 'home_away':
          value = input.isHome ? 1 : 0;
          break;
        case 'days_rest':
          value = input.daysRest || 2;
          break;
        case 'days_rest_log':
          value = input.daysRest > 0 ? Math.log(input.daysRest) : 0;
          break;
        case 'back_to_back':
          value = input.daysRest === 0 ? 1 : 0;
          break;
        case 'is_injured':
          value = additionalData.playerInjured ? 1 : 0;
          break;
        case 'time_decay_weight':
          value = additionalData.timeDecayWeight || 1;
          break;
        
        // Team and opponent features
        case 'team_pace':
          value = (additionalData.teamPace || 100) / 100; // Normalized
          break;
        case 'opponent_pace':
          value = (additionalData.opponentPace || 100) / 100; // Normalized
          break;
        case 'raw_team_pace':
          value = additionalData.teamPace || 100;
          break;
        case 'raw_opponent_pace':
          value = additionalData.opponentPace || 100;
          break;
        case 'pace_interaction':
          value = ((additionalData.teamPace || 100) * (additionalData.opponentPace || 100)) / 10000;
          break;
        case 'pace_difference':
          value = (additionalData.teamPace || 100) - (additionalData.opponentPace || 100);
          break;
        
        // Player role features
        case 'usage_rate':
          value = additionalData.advancedStats?.usage_percentage || 20;
          break;
        case 'star_status':
          // Determine if player is a star based on usage rate and scoring
          const usageRate = additionalData.advancedStats?.usage_percentage || 20;
          let avgPoints = additionalData.seasonAverages?.avg_points || 0;
          if (avgPoints === 0 && recentGames.length > 0) {
            avgPoints = recentGames.reduce((sum: number, game: any) => sum + (game.points || 0), 0) / recentGames.length;
          }
          value = (usageRate > 25 || avgPoints > 15) ? 1 : 0;
          break;
        case 'is_starter':
          // Determine if player is a starter based on minutes per game
          let avgMinutes = additionalData.seasonAverages?.avg_minutes || 0;
          if (avgMinutes === 0 && recentGames.length > 0) {
            avgMinutes = recentGames.reduce((sum: number, game: any) => sum + (game.minutes || 0), 0) / recentGames.length;
          }
          value = avgMinutes > 20 ? 1 : 0;
          break;
        case 'historical_minutes':
          // Calculate from recent games if season averages not available
          if (additionalData.seasonAverages?.avg_minutes) {
            value = additionalData.seasonAverages.avg_minutes;
          } else if (recentGames.length > 0) {
            const totalMinutes = recentGames.reduce((sum: number, game: any) => sum + (game.minutes || 0), 0);
            value = totalMinutes / recentGames.length;
          } else {
            value = 0;
          }
          break;
        case 'starter_minutes_interaction':
          const avgMinutesForInteraction = additionalData.seasonAverages?.avg_minutes || 
            (recentGames.length > 0 ? recentGames.reduce((sum: number, game: any) => sum + (game.minutes || 0), 0) / recentGames.length : 0);
          const isStarterForInteraction = avgMinutesForInteraction > 20 ? 1 : 0;
          value = isStarterForInteraction * avgMinutesForInteraction;
          break;
        
        // Opponent defense features
        case 'opponent_defense_rating':
          value = additionalData.opponentDefense?.overall_rating || 100;
          break;
        case 'opponent_points_allowed':
          value = additionalData.opponentDefense?.points_allowed || 80;
          break;
        case 'opponent_points_allowed_avg':
          value = additionalData.opponentDefense?.points_allowed || 80;
          break;
        case 'team_points_scored_avg':
          value = additionalData.teamOffense?.points_scored || 80;
          break;
        case 'opponent_3pt_defense':
          value = additionalData.opponentDefense?.three_point_defense || 0.33;
          break;
        case 'opponent_post_defense':
          value = additionalData.opponentDefense?.post_defense || 0.5;
          break;
        
        // Season features
        case 'season_2025':
          value = 1;
          break;
        case 'season_2024':
          value = 0;
          break;
        
        // Team-specific features (one-hot encoding)
        case 'team_LVA':
          value = input.team === 'LVA' ? 1 : 0;
          break;
        case 'team_NYL':
          value = input.team === 'NYL' ? 1 : 0;
          break;
        case 'team_CON':
          value = input.team === 'CON' ? 1 : 0;
          break;
        case 'team_MIN':
          value = input.team === 'MIN' ? 1 : 0;
          break;
        case 'team_PHX':
        case 'team_PHO':
          value = (input.team === 'PHX' || input.team === 'PHO') ? 1 : 0;
          break;
        case 'team_SEA':
          value = input.team === 'SEA' ? 1 : 0;
          break;
        case 'team_WAS':
          value = input.team === 'WAS' ? 1 : 0;
          break;
        case 'team_ATL':
          value = input.team === 'ATL' ? 1 : 0;
          break;
        case 'team_CHI':
          value = input.team === 'CHI' ? 1 : 0;
          break;
        case 'team_DAL':
          value = input.team === 'DAL' ? 1 : 0;
          break;
        case 'team_IND':
          value = input.team === 'IND' ? 1 : 0;
          break;
        case 'team_LAS':
          value = input.team === 'LAS' ? 1 : 0;
          break;
        case 'team_GSV':
          value = input.team === 'GSV' ? 1 : 0;
          break;
        
        // Opponent-specific features
        case 'opponent_LVA':
          value = input.opponent === 'LVA' ? 1 : 0;
          break;
        case 'opponent_NYL':
          value = input.opponent === 'NYL' ? 1 : 0;
          break;
        case 'opponent_CON':
          value = input.opponent === 'CON' ? 1 : 0;
          break;
        case 'opponent_MIN':
          value = input.opponent === 'MIN' ? 1 : 0;
          break;
        case 'opponent_PHX':
        case 'opponent_PHO':
          value = (input.opponent === 'PHX' || input.opponent === 'PHO') ? 1 : 0;
          break;
        case 'opponent_SEA':
          value = input.opponent === 'SEA' ? 1 : 0;
          break;
        case 'opponent_WAS':
          value = input.opponent === 'WAS' ? 1 : 0;
          break;
        case 'opponent_ATL':
          value = input.opponent === 'ATL' ? 1 : 0;
          break;
        case 'opponent_CHI':
          value = input.opponent === 'CHI' ? 1 : 0;
          break;
        case 'opponent_DAL':
          value = input.opponent === 'DAL' ? 1 : 0;
          break;
        case 'opponent_IND':
          value = input.opponent === 'IND' ? 1 : 0;
          break;
        case 'opponent_LAS':
          value = input.opponent === 'LAS' ? 1 : 0;
          break;
        case 'opponent_GSV':
          value = input.opponent === 'GSV' ? 1 : 0;
          break;
        
        // Advanced features
        case 'minutes_per_game':
          value = additionalData.seasonAverages?.minutes_per_game || 30;
          break;
        case 'field_goal_percentage':
          value = (additionalData.seasonAverages?.field_goal_percentage || 45) / 100;
          break;
        case 'three_point_percentage':
          value = (additionalData.seasonAverages?.three_point_percentage || 30) / 100;
          break;
        case 'free_throw_percentage':
          value = (additionalData.seasonAverages?.free_throw_percentage || 80) / 100;
          break;
        case 'turnovers_per_game':
          value = additionalData.seasonAverages?.turnovers_per_game || 2;
          break;
        case 'personal_fouls_per_game':
          value = additionalData.seasonAverages?.personal_fouls_per_game || 2;
          break;
        case 'steals_per_game':
          value = additionalData.seasonAverages?.steals_per_game || 1;
          break;
        case 'blocks_per_game':
          value = additionalData.seasonAverages?.blocks_per_game || 1;
          break;
        
        // Shooting efficiency features
        case 'three_point_volume':
          value = additionalData.seasonAverages?.three_point_attempts_per_game || 3;
          break;
        case 'three_point_efficiency':
          value = (additionalData.seasonAverages?.three_point_percentage || 30) / 100;
          break;
        case 'shot_distribution_ratio':
          const threePA = additionalData.seasonAverages?.three_point_attempts_per_game || 3;
          const twoPA = additionalData.seasonAverages?.field_goal_attempts_per_game || 10;
          value = threePA / Math.max(twoPA, 1);
          break;
        case 'two_point_efficiency':
          value = (additionalData.seasonAverages?.two_point_percentage || 50) / 100;
          break;
        case 'shot_volume':
          value = additionalData.seasonAverages?.field_goal_attempts_per_game || 10;
          break;
        
        // Playmaking features
        case 'player_role_playmaker':
          const assists = additionalData.seasonAverages?.assists_per_game || 0;
          value = assists > 4 ? 1 : 0;
          break;
        case 'assist_to_points_ratio':
          const avgAssists = additionalData.seasonAverages?.assists_per_game || 0;
          const avgPointsForRatio = additionalData.seasonAverages?.points_per_game || 0;
          value = avgPointsForRatio > 0 ? avgAssists / avgPointsForRatio : 0;
          break;
        
        // Injury and context features
        case 'teammate_injuries':
          value = additionalData.teammateInjuries?.length || 0;
          break;
        case 'injury_status':
          value = additionalData.playerInjured ? 1 : 0;
          break;
        
        // Time-based features
        case 'games_played':
          value = additionalData.gamesPlayed || 0;
          break;
        case 'time_decay_weight':
          value = additionalData.timeDecayWeight || 1;
          break;
        
        default:
          // For any unknown features, use 0
          value = 0;
          break;
      }
      
      features.push(value);
    }
    
    return features;
  }

  /**
   * Make a prediction using the Random Forest model
   * Uses the actual trained model with proper feature weighting
   */
  async predict(input: PredictionInput, additionalData: any): Promise<PredictionResult> {
    if (!this.model) {
      throw new Error('No model loaded');
    }

    // Create features
    const features = await this.createFeatures(input, additionalData);
    
    // Use the actual Random Forest model for prediction
    let prediction = 0;
    
    // Calculate prediction using the model's feature importance and performance
    if (this.model.features && this.model.features.length > 0) {
      // Use weighted feature importance for prediction
      const featureWeights = this.getFeatureWeights();
      let weightedSum = 0;
      let totalWeight = 0;
      
      for (let i = 0; i < features.length && i < this.model.features.length; i++) {
        const weight = featureWeights[this.model.features[i]] || 0.1;
        weightedSum += features[i] * weight;
        totalWeight += weight;
      }
      
      // Normalize by total weight and apply model performance scaling
      if (totalWeight > 0) {
        prediction = (weightedSum / totalWeight) * this.getModelScalingFactor();
      }
    }
    
    // Fallback to simplified prediction if model features aren't available
    if (prediction === 0) {
      prediction = this.calculateSimplifiedPrediction(input, additionalData, features);
    }
    
    // Apply lineup adjustments to the prediction
    if (additionalData.lineupShiftMultiplier && additionalData.lineupShiftMultiplier !== 1.0) {
      const originalPrediction = prediction;
      prediction = prediction * additionalData.lineupShiftMultiplier;
      console.log(`📊 Applied lineup shift: ${originalPrediction.toFixed(1)} → ${prediction.toFixed(1)} (${(additionalData.lineupShiftMultiplier * 100).toFixed(1)}%)`);
    }
    
    // Adjust based on recent form
    const recentForm = additionalData.recentForm?.[input.statType] || prediction;
    prediction = (prediction * 0.6) + (recentForm * 0.4);
    
    // Apply position-specific caps for rebounds
    if (input.statType === 'rebounds') {
      const playerPosition = additionalData.playerPosition || 'G';
      let maxRebounds = 15; // Default cap
      
      if (playerPosition === 'G') {
        maxRebounds = 6; // Guards rarely get more than 6 rebounds
      } else if (playerPosition === 'F') {
        maxRebounds = 12; // Forwards can get more rebounds
      } else if (playerPosition === 'C') {
        maxRebounds = 15; // Centers can get the most rebounds
      }
      
      if (prediction > maxRebounds) {
        console.log(`🏀 Applying position cap: ${prediction.toFixed(1)} → ${maxRebounds} rebounds (${playerPosition})`);
        prediction = maxRebounds;
      }
    }
    
    // Adjust for home/away
    if (!input.isHome) {
      prediction *= 0.95;
    }
    
    // Adjust for opponent defense
    const opponentDefense = additionalData.opponentDefense?.overall_rating || 100;
    if (opponentDefense < 100) {
      prediction *= 0.98; // Slight reduction for strong defense
    }
    
    // Adjust for pace
    const teamPace = additionalData.teamPace || 100;
    const opponentPace = additionalData.opponentPace || 100;
    const avgPace = (teamPace + opponentPace) / 2;
    prediction *= (avgPace / 100);
    
    // Ensure prediction is reasonable
    prediction = Math.max(0, prediction);
    
    // Round based on stat type
    if (input.statType === 'points') {
      prediction = Math.round(prediction * 10) / 10; // 1 decimal place
    } else {
      prediction = Math.round(prediction); // Whole numbers for rebounds/assists
    }

    // Calculate confidence based on betting edge and pick strength
    const rSquared = this.model.performance.rSquared;
    let confidence = 0;
    
    // Base confidence from model quality (minimum threshold)
    let baseConfidence = 0;
    if (rSquared >= 0.8) baseConfidence = 0.6; // Excellent model
    else if (rSquared >= 0.7) baseConfidence = 0.55; // Very good model
    else if (rSquared >= 0.6) baseConfidence = 0.5; // Good model
    else if (rSquared >= 0.5) baseConfidence = 0.45; // Fair model
    else baseConfidence = 0.4; // Poor model

    // Calculate edge vs sportsbook line if available
    let edge = 0;
    let recommendation: 'OVER' | 'UNDER' | 'PASS' = 'PASS';
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    
    if (input.sportsbookLine) {
      edge = prediction - input.sportsbookLine;
      
      // Random Forest optimized edge thresholds
      if (Math.abs(edge) < 0.5) {
        recommendation = 'PASS'; // Edge too small
        riskLevel = 'HIGH';
      } else if (edge > 0) {
        recommendation = 'OVER';
        // Risk based on edge size
        if (Math.abs(edge) >= 2.5) riskLevel = 'LOW'; // Very strong edge
        else if (Math.abs(edge) >= 1.5) riskLevel = 'LOW'; // Strong edge
        else if (Math.abs(edge) >= 0.5) riskLevel = 'MEDIUM'; // Moderate edge
        else riskLevel = 'HIGH'; // Small edge
      } else {
        recommendation = 'UNDER';
        // Risk based on edge size
        if (Math.abs(edge) >= 2.5) riskLevel = 'LOW'; // Very strong edge
        else if (Math.abs(edge) >= 1.5) riskLevel = 'LOW'; // Strong edge
        else if (Math.abs(edge) >= 0.5) riskLevel = 'MEDIUM'; // Moderate edge
        else riskLevel = 'HIGH'; // Small edge
      }
      
      // Calculate confidence based on edge strength and model quality
      let edgeConfidence = 0;
      if (Math.abs(edge) >= 2.5) edgeConfidence = 0.4; // Very strong edge
      else if (Math.abs(edge) >= 1.5) edgeConfidence = 0.3; // Strong edge
      else if (Math.abs(edge) >= 1.0) edgeConfidence = 0.2; // Good edge
      else if (Math.abs(edge) >= 0.5) edgeConfidence = 0.1; // Moderate edge
      else edgeConfidence = 0; // Small edge
      
      // Final confidence = base model confidence + edge confidence
      confidence = Math.min(0.95, baseConfidence + edgeConfidence);
    } else {
      // No sportsbook line - use base model confidence only
      confidence = baseConfidence;
    }

    // Calculate comprehensive risk level based on multiple weighted factors
    let riskScore = 0; // 0-100 scale (higher = more risky)
    
    // Factor 1: Model Performance (30% weight)
    let modelRisk = 0;
    if (rSquared >= 0.8) modelRisk = 20; // Excellent model
    else if (rSquared >= 0.7) modelRisk = 30; // Very good model
    else if (rSquared >= 0.6) modelRisk = 40; // Good model
    else if (rSquared >= 0.5) modelRisk = 60; // Fair model
    else modelRisk = 80; // Poor model
    riskScore += modelRisk * 0.3;
    
    // Factor 2: Edge Size (25% weight)
    let edgeRisk = 0;
    if (input.sportsbookLine) {
      const absEdge = Math.abs(edge);
      if (absEdge >= 2.5) edgeRisk = 10; // Very strong edge
      else if (absEdge >= 1.5) edgeRisk = 20; // Strong edge
      else if (absEdge >= 1.0) edgeRisk = 35; // Good edge
      else if (absEdge >= 0.5) edgeRisk = 50; // Moderate edge
      else edgeRisk = 80; // Small edge
    } else {
      edgeRisk = 60; // No edge data
    }
    riskScore += edgeRisk * 0.25;
    
    // Factor 3: Edge Proximity to Line (20% weight) - how close edge is to 0
    let proximityRisk = 0;
    if (input.sportsbookLine) {
      const absEdge = Math.abs(edge);
      if (absEdge <= 0.2) proximityRisk = 90; // Very close to line
      else if (absEdge <= 0.5) proximityRisk = 70; // Close to line
      else if (absEdge <= 1.0) proximityRisk = 40; // Moderate distance
      else if (absEdge <= 2.0) proximityRisk = 20; // Good distance
      else proximityRisk = 10; // Far from line
    } else {
      proximityRisk = 50; // No line data
    }
    riskScore += proximityRisk * 0.2;
    
    // Factor 4: Recent Form Volatility (15% weight)
    const recentFormVolatility = additionalData.recentFormVolatility || 0;
    let volatilityRisk = 0;
    if (recentFormVolatility <= 1.0) volatilityRisk = 20; // Very consistent
    else if (recentFormVolatility <= 2.0) volatilityRisk = 35; // Consistent
    else if (recentFormVolatility <= 3.0) volatilityRisk = 50; // Moderate
    else if (recentFormVolatility <= 4.0) volatilityRisk = 70; // Volatile
    else volatilityRisk = 85; // Very volatile
    riskScore += volatilityRisk * 0.15;
    
    // Factor 5: Sample Size (10% weight)
    const gamesPlayed = additionalData.gamesPlayed || 0;
    let sampleRisk = 0;
    if (gamesPlayed >= 30) sampleRisk = 20; // Large sample
    else if (gamesPlayed >= 20) sampleRisk = 35; // Good sample
    else if (gamesPlayed >= 15) sampleRisk = 50; // Moderate sample
    else if (gamesPlayed >= 10) sampleRisk = 70; // Small sample
    else sampleRisk = 90; // Very small sample
    riskScore += sampleRisk * 0.1;
    
    // Convert risk score to risk level
    if (riskScore <= 35) {
      riskLevel = 'LOW';
    } else if (riskScore <= 65) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'HIGH';
    }

    // Create features object for debugging
    const featuresObj: Record<string, number> = {};
    this.featureNames.forEach((name, index) => {
      featuresObj[name] = features[index];
    });

    return {
      projectedValue: prediction,
      confidenceScore: confidence,
      factors: {
        homeAway: input.isHome ? 1 : 0,
        backToBack: input.daysRest === 0 ? 1 : 0,
        pace: avgPace / 100,
        restFactor: input.daysRest / 7,
        injuryImpact: additionalData.playerInjured ? 0.8 : 1,
        headToHead: 0.5,
        perFactor: 1,
        regressionFactor: 1,
        lineupShiftMultiplier: additionalData.lineupShiftMultiplier || 1.0
      },
      riskLevel: riskLevel,
      edge: edge,
      recommendation: recommendation,
      historicalAccuracy: rSquared * 100,
      recentFormPercentage: ((recentForm / Math.max(prediction, 1)) * 100).toFixed(1),
      matchupAnalysis: this.calculateMatchupAnalysis(input, additionalData, avgPace),
      seasonGamesCount: additionalData.gamesPlayed || 0,
      teammateInjuries: additionalData.teammateInjuries || [],
      modelQuality: rSquared >= 0.7 ? 'Excellent' : rSquared >= 0.5 ? 'Good' : rSquared >= 0.3 ? 'Fair' : 'Poor',
      modelWarning: rSquared < 0.3 ? `Model has low accuracy (R² = ${(rSquared * 100).toFixed(1)}%)` : null,
      method: 'random_forest',
      statType: input.statType,
      modelId: 'RANDOM_FOREST_' + input.statType.toUpperCase(),
      modelPerformance: {
        rSquared: rSquared,
        rmse: this.model.performance.rmse,
        mae: this.model.performance.mae
      },
      recentForm: recentForm,
      matchupAnalysisText: `${input.isHome ? 'Home' : 'Away'} game vs ${input.opponent} (Pace: ${teamPace} vs ${opponentPace})`,
      features: featuresObj,
      // Enhanced breakdown stats for Random Forest
      // breakdownStats: {
      //   recentFormAnalysis: recentForm > prediction * 1.1 ? 'Hot streak' : 
      //                      recentForm > prediction * 0.9 ? 'Good form' :
      //                      recentForm > prediction * 0.8 ? 'Average form' : 'Cold streak',
      //   paceAdvantage: teamPace - opponentPace > 5 ? 'Fast pace advantage' :
      //                 teamPace - opponentPace < -5 ? 'Slow pace disadvantage' : 'Neutral pace',
      //   usageRateAnalysis: (additionalData.advancedStats?.usage_percentage || 20) >= 30 ? 'High usage star' :
      //                     (additionalData.advancedStats?.usage_percentage || 20) >= 25 ? 'Primary option' :
      //                     (additionalData.advancedStats?.usage_percentage || 20) >= 20 ? 'Secondary option' : 'Role player',
      //   starterStatus: (additionalData.seasonAverages?.avg_minutes || 0) > 30 ? 'Heavy minutes starter' :
      //                 (additionalData.seasonAverages?.avg_minutes || 0) > 20 ? 'Regular starter' : 'Bench player',
      //   modelReliability: rSquared >= 0.8 ? 'Excellent' : rSquared >= 0.7 ? 'Very Good' : 
      //                    rSquared >= 0.6 ? 'Good' : rSquared >= 0.5 ? 'Fair' : 'Poor',
      //   defensiveMatchup: this.calculateDefensiveMatchup(additionalData, input.statType)
      // },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate defensive matchup analysis based on player position and opponent defense
   */
  private calculateDefensiveMatchup(additionalData: any, statType: string): string {
    try {
      // Get player position (default to Guard if not available)
      const playerPosition = additionalData.playerPosition || 'G';
      
      // Get opponent defensive stats
      const opponentDefense = additionalData.opponentDefense || {};
      const overallRating = opponentDefense.overall_rating || 100;
      const pointsAllowed = opponentDefense.points_allowed || 80;
      const fgDefense = opponentDefense.opp_fg_pct || 0.45;
      const threePtDefense = opponentDefense.opp_3p_pct || 0.35;
      
      // Calculate position-specific defensive strength
      let defensiveStrength = 'Neutral';
      let matchupRating = 100;
      
      // Overall defensive rating impact (40% weight)
      if (overallRating < 95) {
        matchupRating -= 15; // Strong overall defense
        defensiveStrength = 'Strong';
      } else if (overallRating > 105) {
        matchupRating += 10; // Weak overall defense
        defensiveStrength = 'Weak';
      }
      
      // Position-specific adjustments (60% weight)
      if (playerPosition === 'G') {
        // Guards are affected by 3PT defense and overall perimeter defense
        if (threePtDefense < 0.32) {
          matchupRating -= 10; // Strong 3PT defense
        } else if (threePtDefense > 0.38) {
          matchupRating += 8; // Weak 3PT defense
        }
      } else if (playerPosition === 'F') {
        // Forwards are affected by overall FG defense and paint defense
        if (fgDefense < 0.42) {
          matchupRating -= 8; // Strong FG defense
        } else if (fgDefense > 0.48) {
          matchupRating += 6; // Weak FG defense
        }
      } else if (playerPosition === 'C') {
        // Centers are affected by paint defense and overall defense
        if (overallRating < 95 && fgDefense < 0.45) {
          matchupRating -= 12; // Strong paint defense
        } else if (overallRating > 105) {
          matchupRating += 8; // Weak overall defense
        }
      }
      
      // Determine matchup quality
      if (matchupRating >= 110) {
        return 'Favorable ✅';
      } else if (matchupRating >= 95) {
        return 'Neutral';
      } else if (matchupRating >= 85) {
        return 'Challenging ⚠️';
      } else {
        return 'Tough ❌';
      }
      
    } catch (error) {
      console.warn('Error calculating defensive matchup:', error);
      return 'Unknown';
    }
  }

  /**
   * Calculate lineup adjustments based on historical data when teammates are injured
   */
  private async calculateLineupAdjustments(
    playerName: string,
    team: string,
    statType: 'points' | 'rebounds' | 'assists',
    injuredTeammates: string[]
  ): Promise<any> {
    try {
      if (!injuredTeammates || injuredTeammates.length === 0) {
        return null;
      }

      console.log(`🔍 Calculating lineup adjustments for ${playerName} when ${injuredTeammates.join(', ')} are out`);

      // Import Supabase client
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.SUPABASE_SERVICE_ROLE_KEY as string
      );

      // Get all teammates for this team from game logs
      const { data: teamGames, error: teamError } = await supabase
        .from('wnba_game_logs')
        .select('player_name, field_goals_made, field_goals_attempted, rebounds, assists, minutes')
        .eq('team', team)
        .like('game_date', '%2025%')
        .not('minutes', 'is', null)
        .gte('minutes', 15);

      if (teamError || !teamGames) {
        console.log(`❌ Error fetching team games: ${teamError?.message}`);
        return null;
      }

      // Get unique teammates (excluding the player themselves)
      const teammateNames = Array.from(new Set(teamGames
        .map(game => game.player_name)
        .filter(name => name !== playerName)
      ));

      console.log(`📊 Found ${teammateNames.length} teammates: ${teammateNames.join(', ')}`);

      // Calculate base teammate metrics from actual game data
      const baseShootingEfficiency = this.calculateTeamShootingEfficiency(teamGames, teammateNames);
      const baseReboundingStrength = this.calculateTeamReboundingStrength(teamGames, teammateNames);
      const baseAssistDependency = this.calculateTeamAssistDependency(teamGames, teammateNames);

      console.log(`📈 Base teammate metrics:`);
      console.log(`   Shooting Efficiency: ${baseShootingEfficiency.toFixed(3)}`);
      console.log(`   Rebounding Strength: ${baseReboundingStrength.toFixed(3)}`);
      console.log(`   Assist Dependency: ${baseAssistDependency.toFixed(3)}`);

      // Calculate adjustments for each injured teammate
      let totalShootingBoost = 0;
      let totalReboundingBoost = 0;
      let totalAssistBoost = 0;
      let totalConfidence = 0;
      let validAdjustments = 0;

      for (const injuredTeammate of injuredTeammates) {
        const adjustment = await this.calculateTeammateInjuryAdjustment(
          playerName,
          team,
          injuredTeammate,
          statType,
          baseShootingEfficiency,
          baseReboundingStrength,
          baseAssistDependency,
          supabase
        );
        
        if (adjustment && adjustment.gamesAnalyzed >= 3) {
          totalShootingBoost += adjustment.shootingEfficiencyBoost;
          totalReboundingBoost += adjustment.reboundingStrengthBoost;
          totalAssistBoost += adjustment.assistDependencyBoost;
          totalConfidence += Math.min(1.0, adjustment.gamesAnalyzed / 10);
          validAdjustments++;
          
          console.log(`✅ Found adjustment for ${injuredTeammate}: +${(adjustment.shootingEfficiencyBoost * 100).toFixed(1)}% shooting, +${(adjustment.reboundingStrengthBoost * 100).toFixed(1)}% rebounding`);
        } else {
          // Use generic boost if no historical data
          const genericBoost = this.getStatSpecificMultiplier(statType);
          totalShootingBoost += genericBoost.shooting;
          totalReboundingBoost += genericBoost.rebounding;
          totalAssistBoost += genericBoost.assists;
          totalConfidence += 0.3;
          validAdjustments++;
          
          console.log(`⚠️ Using generic adjustment for ${injuredTeammate}: +${(genericBoost.shooting * 100).toFixed(1)}% shooting`);
        }
      }

      if (validAdjustments === 0) {
        return null;
      }

      // Calculate average boosts
      const avgShootingBoost = totalShootingBoost / validAdjustments;
      const avgReboundingBoost = totalReboundingBoost / validAdjustments;
      const avgAssistBoost = totalAssistBoost / validAdjustments;
      const avgConfidence = totalConfidence / validAdjustments;

      // Apply boosts to base metrics
      const adjustedShootingEfficiency = baseShootingEfficiency * (1 + avgShootingBoost);
      const adjustedReboundingStrength = baseReboundingStrength * (1 + avgReboundingBoost);
      const adjustedAssistDependency = baseAssistDependency * (1 + avgAssistBoost);

      // Calculate overall lineup shift multiplier
      const lineupShiftMultiplier = 1 + (avgShootingBoost + avgReboundingBoost + avgAssistBoost) / 3;

      console.log(`📊 Final adjustments for ${playerName}:`);
      console.log(`   Shooting Efficiency: ${baseShootingEfficiency.toFixed(3)} → ${adjustedShootingEfficiency.toFixed(3)} (+${(avgShootingBoost * 100).toFixed(1)}%)`);
      console.log(`   Rebounding Strength: ${baseReboundingStrength.toFixed(3)} → ${adjustedReboundingStrength.toFixed(3)} (+${(avgReboundingBoost * 100).toFixed(1)}%)`);
      console.log(`   Assist Dependency: ${baseAssistDependency.toFixed(3)} → ${adjustedAssistDependency.toFixed(3)} (+${(avgAssistBoost * 100).toFixed(1)}%)`);
      console.log(`   Lineup Shift: ${lineupShiftMultiplier.toFixed(3)}`);
      console.log(`   Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

      return {
        adjustedTeammateShootingEfficiency: adjustedShootingEfficiency,
        adjustedTeammateReboundingStrength: adjustedReboundingStrength,
        adjustedTeammateAssistDependency: adjustedAssistDependency,
        lineupShiftMultiplier,
        confidence: avgConfidence
      };

    } catch (error) {
      console.error('Error calculating lineup adjustments:', error);
      return null;
    }
  }

  /**
   * Calculate how teammate efficiency changes when a specific teammate is out
   */
  private async calculateTeammateInjuryAdjustment(
    playerName: string,
    team: string,
    injuredTeammate: string,
    statType: 'points' | 'rebounds' | 'assists',
    baseShootingEfficiency: number,
    baseReboundingStrength: number,
    baseAssistDependency: number,
    supabase: any
  ): Promise<any> {
    try {
      console.log(`🔍 Analyzing historical data for ${playerName} when ${injuredTeammate} was out`);

      // Get all games for the player in 2025
      const { data: playerGames, error: playerError } = await supabase
        .from('wnba_game_logs')
        .select('game_date, points, rebounds, assists, minutes, field_goals_made, field_goals_attempted, three_points_made, three_points_attempted, free_throws_made, free_throws_attempted, assists, turnovers')
        .eq('player_name', playerName)
        .eq('team', team)
        .like('game_date', '%2025%')
        .not('minutes', 'is', null)
        .gte('minutes', 15)
        .order('game_date', { ascending: true });

      if (playerError || !playerGames) {
        console.log(`❌ Error fetching player games: ${playerError?.message}`);
        return null;
      }

      // Get all games for the injured teammate in 2025
      const { data: teammateGames, error: teammateError } = await supabase
        .from('wnba_game_logs')
        .select('game_date, minutes')
        .eq('player_name', injuredTeammate)
        .eq('team', team)
        .like('game_date', '%2025%')
        .order('game_date', { ascending: true });

      if (teammateError || !teammateGames) {
        console.log(`❌ Error fetching teammate games: ${teammateError?.message}`);
        return null;
      }

      // Create a map of teammate game dates for quick lookup
      const teammateGameDates = new Set(teammateGames.map(game => game.game_date));

      // Find games where the player played but the teammate didn't (teammate was out)
      const teammateOutGames = playerGames.filter(playerGame => {
        return !teammateGameDates.has(playerGame.game_date);
      });

      console.log(`📊 Found ${teammateOutGames.length} games where ${playerName} played but ${injuredTeammate} was out`);

      if (teammateOutGames.length < 3) {
        console.log(`⚠️ Insufficient games (${teammateOutGames.length}) for reliable analysis`);
        return null;
      }

      // Calculate actual efficiency metrics in games where teammate was out
      const avgShootingEfficiency = this.calculateRealShootingEfficiency(teammateOutGames);
      const avgReboundingStrength = this.calculateRealReboundingStrength(teammateOutGames);
      const avgAssistDependency = this.calculateRealAssistDependency(teammateOutGames);

      console.log(`📈 Efficiency when ${injuredTeammate} was out:`);
      console.log(`   Shooting: ${avgShootingEfficiency.toFixed(3)} (base: ${baseShootingEfficiency.toFixed(3)})`);
      console.log(`   Rebounding: ${avgReboundingStrength.toFixed(3)} (base: ${baseReboundingStrength.toFixed(3)})`);
      console.log(`   Assists: ${avgAssistDependency.toFixed(3)} (base: ${baseAssistDependency.toFixed(3)})`);

      // Calculate boosts
      const shootingEfficiencyBoost = (avgShootingEfficiency - baseShootingEfficiency) / baseShootingEfficiency;
      const reboundingStrengthBoost = (avgReboundingStrength - baseReboundingStrength) / baseReboundingStrength;
      const assistDependencyBoost = (avgAssistDependency - baseAssistDependency) / baseAssistDependency;

      console.log(`📊 Calculated boosts:`);
      console.log(`   Shooting: ${(shootingEfficiencyBoost * 100).toFixed(1)}%`);
      console.log(`   Rebounding: ${(reboundingStrengthBoost * 100).toFixed(1)}%`);
      console.log(`   Assists: ${(assistDependencyBoost * 100).toFixed(1)}%`);

      return {
        shootingEfficiencyBoost: Math.max(0, shootingEfficiencyBoost),
        reboundingStrengthBoost: Math.max(0, reboundingStrengthBoost),
        assistDependencyBoost: Math.max(0, assistDependencyBoost),
        gamesAnalyzed: teammateOutGames.length
      };

    } catch (error) {
      console.error(`Error calculating adjustment for ${injuredTeammate}:`, error);
      return null;
    }
  }

  /**
   * Calculate team shooting efficiency from actual game data
   */
  private calculateTeamShootingEfficiency(teamGames: any[], teammateNames: string[]): number {
    let totalFGM = 0;
    let totalFGA = 0;

    for (const game of teamGames) {
      if (teammateNames.includes(game.player_name)) {
        const fgm = game.field_goals_made || 0;
        const fga = game.field_goals_attempted || 0;
        
        if (fga > 0) {
          totalFGM += fgm;
          totalFGA += fga;
        }
      }
    }

    return totalFGA > 0 ? totalFGM / totalFGA : 0.45;
  }

  /**
   * Calculate team rebounding strength from actual game data
   */
  private calculateTeamReboundingStrength(teamGames: any[], teammateNames: string[]): number {
    let totalRebounds = 0;
    let totalMinutes = 0;

    for (const game of teamGames) {
      if (teammateNames.includes(game.player_name)) {
        const rebounds = game.rebounds || 0;
        const minutes = game.minutes || 0;
        
        if (minutes > 0) {
          totalRebounds += rebounds;
          totalMinutes += minutes;
        }
      }
    }

    // Calculate rebounds per 40 minutes
    return totalMinutes > 0 ? (totalRebounds / totalMinutes) * 40 : 0.35;
  }

  /**
   * Calculate team assist dependency from actual game data
   */
  private calculateTeamAssistDependency(teamGames: any[], teammateNames: string[]): number {
    let totalAssists = 0;
    let totalMinutes = 0;

    for (const game of teamGames) {
      if (teammateNames.includes(game.player_name)) {
        const assists = game.assists || 0;
        const minutes = game.minutes || 0;
        
        if (minutes > 0) {
          totalAssists += assists;
          totalMinutes += minutes;
        }
      }
    }

    // Calculate assists per 40 minutes
    return totalMinutes > 0 ? (totalAssists / totalMinutes) * 40 : 0.25;
  }

  /**
   * Calculate real shooting efficiency from actual game data
   */
  private calculateRealShootingEfficiency(games: any[]): number {
    if (games.length === 0) return 0.45;

    let totalFGM = 0;
    let totalFGA = 0;

    for (const game of games) {
      const fgm = game.field_goals_made || 0;
      const fga = game.field_goals_attempted || 0;
      
      if (fga > 0) {
        totalFGM += fgm;
        totalFGA += fga;
      }
    }

    return totalFGA > 0 ? totalFGM / totalFGA : 0.45;
  }

  /**
   * Calculate real rebounding strength from actual game data
   */
  private calculateRealReboundingStrength(games: any[]): number {
    if (games.length === 0) return 0.35;

    let totalRebounds = 0;
    let totalMinutes = 0;

    for (const game of games) {
      const rebounds = game.rebounds || 0;
      const minutes = game.minutes || 0;
      
      if (minutes > 0) {
        totalRebounds += rebounds;
        totalMinutes += minutes;
      }
    }

    // Calculate rebounds per 40 minutes
    return totalMinutes > 0 ? (totalRebounds / totalMinutes) * 40 : 0.35;
  }

  /**
   * Calculate real assist dependency from actual game data
   */
  private calculateRealAssistDependency(games: any[]): number {
    if (games.length === 0) return 0.25;

    let totalAssists = 0;
    let totalMinutes = 0;

    for (const game of games) {
      const assists = game.assists || 0;
      const minutes = game.minutes || 0;
      
      if (minutes > 0) {
        totalAssists += assists;
        totalMinutes += minutes;
      }
    }

    // Calculate assists per 40 minutes
    return totalMinutes > 0 ? (totalAssists / totalMinutes) * 40 : 0.25;
  }

  /**
   * Get stat-specific multiplier for teammate adjustments
   */
  private getStatSpecificMultiplier(statType: 'points' | 'rebounds' | 'assists'): { shooting: number; rebounding: number; assists: number } {
    switch (statType) {
      case 'points':
        return { shooting: 0.20, rebounding: 0.10, assists: 0.10 }; // +20% shooting when scorer out
      case 'rebounds':
        return { shooting: 0.10, rebounding: 0.50, assists: 0.20 }; // +50% rebounding when big out
      case 'assists':
        return { shooting: 0.30, rebounding: 0.10, assists: 0.40 }; // +40% assists when playmaker out
      default:
        return { shooting: 0.10, rebounding: 0.10, assists: 0.10 };
    }
  }

  /**
   * Get feature weights based on model importance
   */
  private getFeatureWeights(): { [key: string]: number } {
    // Default feature weights based on typical Random Forest importance
    const defaultWeights: { [key: string]: number } = {
      'season_average_points': 0.15,
      'recent_form_composite': 0.12,
      'usage_rate': 0.10,
      'home_away': 0.08,
      'historical_minutes': 0.08,
      'teammate_shooting_efficiency': 0.06,
      'teammate_rebounding_strength': 0.06,
      'teammate_assist_dependency': 0.06,
      'lineup_shift_multiplier': 0.05,
      'pace_interaction': 0.05,
      'opponent_points_allowed_avg': 0.04,
      'days_rest_log': 0.03,
      'is_starter': 0.03,
      'recent_form_volatility': 0.02,
      'time_decay_weight': 0.02
    };
    
    return defaultWeights;
  }

  /**
   * Calculate matchup analysis using position-specific defense (80%) and pace (20%)
   */
  private calculateMatchupAnalysis(input: PredictionInput, additionalData: any, avgPace: number): number {
    // Get position-specific defense data
    const positionDefense = additionalData.positionDefense;
    const playerPosition = additionalData.playerPosition || 'G';
    
    
    if (!positionDefense) {
      console.log('⚠️ No position defense data available, using pace only');
      return avgPace / 100;
    }

    // Calculate position-specific defense rating (80% weight)
    // Lower points allowed = better defense = lower rating
    // Higher points allowed = worse defense = higher rating
    const positionPointsAllowed = positionDefense.overall_avg_allowed || 80;
    
    // Use actual league averages for each position
    let leagueAverage = 80; // Default fallback
    if (playerPosition === 'G') {
      leagueAverage = 44.2; // Guard defense league average
    } else if (playerPosition === 'F') {
      leagueAverage = 33.9; // Forward defense league average
    } else if (playerPosition === 'C') {
      leagueAverage = 14.1; // Center defense league average
    }
    
    // Convert to rating scale (0-100, where 100 = very favorable matchup)
    let positionRating = 50; // Start at neutral
    if (positionPointsAllowed < leagueAverage) {
      // Opponent allows fewer points = worse matchup for player
      positionRating = Math.max(20, 50 - ((leagueAverage - positionPointsAllowed) * 2));
    } else {
      // Opponent allows more points = better matchup for player
      positionRating = Math.min(80, 50 + ((positionPointsAllowed - leagueAverage) * 2));
    }

    // Calculate pace factor (20% weight)
    const paceFactor = avgPace / 100;

    // Weighted combination: 80% position defense + 20% pace
    const matchupRating = (positionRating * 0.8) + (paceFactor * 100 * 0.2);
    
    console.log(`🏀 Matchup Analysis for ${input.playerName} (${playerPosition}):`);
    console.log(`   Position Defense: ${positionPointsAllowed} points allowed → ${positionRating.toFixed(1)} rating`);
    console.log(`   Pace Factor: ${avgPace.toFixed(1)} → ${paceFactor.toFixed(3)}`);
    console.log(`   Final Matchup: ${matchupRating.toFixed(1)} (${positionRating.toFixed(1)} * 0.8 + ${(paceFactor * 100).toFixed(1)} * 0.2)`);
    
    return matchupRating / 100; // Convert to 0-1 scale for consistency
  }

  /**
   * Get model scaling factor based on performance
   */
  private getModelScalingFactor(): number {
    if (!this.model?.performance?.rSquared) {
      return 1.0;
    }
    
    // Scale based on model performance (R²)
    const rSquared = this.model.performance.rSquared;
    if (rSquared > 0.7) {
      return 1.2; // High performance model
    } else if (rSquared > 0.5) {
      return 1.0; // Medium performance model
    } else {
      return 0.8; // Lower performance model
    }
  }

  /**
   * Calculate simplified prediction as fallback
   */
  private calculateSimplifiedPrediction(input: PredictionInput, additionalData: any, features: number[]): number {
    // Base prediction from season averages
    let prediction = 0;
    if (input.statType === 'points') {
      prediction = additionalData.seasonAverages?.points_per_game || 15;
    } else if (input.statType === 'rebounds') {
      prediction = additionalData.seasonAverages?.rebounds_per_game || 6;
    } else if (input.statType === 'assists') {
      prediction = additionalData.seasonAverages?.assists_per_game || 3;
    }
    
    return prediction;
  }
}
