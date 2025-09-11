// Regression model interfaces and types for WNBA projections

export interface RegressionFeatures {
  // Core situational features (exact features from existing system)
  opponentDefensiveRating: number;
  homeAway: number; // 1 for home, 0 for away
  injuryStatus: number; // 0 for healthy, 1+ for injured
  restDays: number; // Days since last game
  
  // Additional context features
  backToBack: number; // 1 for b2b, 0 otherwise
  teamPace: number; // Team pace factor
  opponentPace: number; // Opponent pace factor
  teammateInjuries: number; // Count of injured starters
}

export interface RegressionPrediction {
  predictedValue: number;
  standardDeviation: number;
  confidenceInterval: {
    lower: number;
    upper: number;
    confidence: number; // e.g., 0.95 for 95%
  };
  predictionInterval: {
    lower: number;
    upper: number;
    confidence: number; // e.g., 0.95 for 95%
  };
  featureImportance: Record<string, number>;
  modelConfidence: number; // 0-1 scale
  residualStandardError: number;
}

export interface RegressionModel {
  playerId: string;
  statType: string;
  season: string;
  coefficients: Record<string, number>;
  intercept: number;
  rSquared: number;
  adjustedRSquared: number;
  standardError: number;
  featureNames: string[];
  trainingDataSize: number;
  lastTrained: Date;
  performanceMetrics: ModelMetrics;
  residualStandardDeviation: number;
}

export interface ModelMetrics {
  rmse: number; // Root Mean Square Error
  mae: number; // Mean Absolute Error
  rSquared: number; // Coefficient of determination
  adjustedRSquared: number; // Adjusted R-squared
  standardError: number; // Standard error of the estimate
  predictionAccuracy: number; // % of predictions within 1 SD
  bookLineHitRate?: number; // % of times prediction > line when actual > line
}

export interface TrainingData {
  features: RegressionFeatures[];
  targets: number[]; // Actual stat values
  gameDates: Date[];
  playerIds: string[];
}

export interface DataSplit {
  training: {
    features: RegressionFeatures[];
    targets: number[];
    gameDates: Date[];
  };
  validation: {
    features: RegressionFeatures[];
    targets: number[];
    gameDates: Date[];
  };
  test: {
    features: RegressionFeatures[];
    targets: number[];
    gameDates: Date[];
  };
}

export interface CrossValidationResults {
  foldResults: {
    fold: number;
    rmse: number;
    mae: number;
    rSquared: number;
  }[];
  averageMetrics: {
    rmse: number;
    mae: number;
    rSquared: number;
  };
  standardDeviation: {
    rmse: number;
    mae: number;
    rSquared: number;
  };
}

export interface ModelPerformance {
  overallMetrics: ModelMetrics;
  crossValidation: CrossValidationResults;
  featureImportance: Record<string, number>;
  predictionIntervals: {
    within1SD: number; // % of predictions within 1 standard deviation
    within2SD: number; // % of predictions within 2 standard deviations
    within3SD: number; // % of predictions within 3 standard deviations
  };
}

// Database table interfaces for Supabase
export interface RegressionModelRecord {
  id?: number;
  player_id: string;
  stat_type: string;
  season: string;
  model_data: RegressionModel;
  created_at?: string;
  updated_at?: string;
}

export interface RegressionPredictionRecord {
  id?: number;
  player_id: string;
  stat_type: string;
  game_date: string;
  predicted_value: number;
  standard_deviation: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  prediction_interval_lower: number;
  prediction_interval_upper: number;
  actual_value?: number;
  accuracy_score?: number;
  created_at?: string;
}

export interface FeatureImportanceRecord {
  id?: number;
  model_id: number;
  feature_name: string;
  importance_score: number;
  coefficient_value: number;
  p_value?: number;
  created_at?: string;
}
