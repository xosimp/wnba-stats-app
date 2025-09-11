import { createClient } from '@supabase/supabase-js';
import { Matrix } from 'ml-matrix';
import MultivariateLinearRegression from 'ml-regression-multivariate-linear';
import {
  RegressionFeatures,
  RegressionPrediction,
  RegressionModel,
  ModelMetrics,
  TrainingData,
  DataSplit,
  CrossValidationResults,
  ModelPerformance,
  RegressionModelRecord,
  RegressionPredictionRecord,
  FeatureImportanceRecord
} from '../algorithms/RegressionTypes';

export class RegressionModelService {
  private supabase: any;
  private static instance: RegressionModelService;

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  public static getInstance(): RegressionModelService {
    if (!RegressionModelService.instance) {
      RegressionModelService.instance = new RegressionModelService();
    }
    return RegressionModelService.instance;
  }

  /**
   * Train a regression model for a specific player and stat type
   */
  async trainModel(
    playerId: string,
    statType: string,
    season: string,
    trainingData: TrainingData
  ): Promise<RegressionModel> {
    try {
      console.log(`🧠 Training regression model for ${playerId} - ${statType} (${season})`);
      
      // Prepare data for training
      const { features, targets } = trainingData;
      
      if (features.length < 10) {
        throw new Error(`Insufficient data: ${features.length} games. Need at least 10 games for training.`);
      }

      // Convert features to matrix format
      const featureMatrix = this.featuresToMatrix(features);
      const targetMatrix = new Matrix(targets.map(t => [t]));

      // Train multivariate linear regression
      const regression = new MultivariateLinearRegression(featureMatrix, targetMatrix);

      // Extract coefficients and intercept
      const coefficients = this.extractCoefficients(regression, features[0]);
      const intercept = (regression as any).intercept ? (regression as any).intercept[0] : 0;

      // Calculate model performance metrics
      const predictions = regression.predict(featureMatrix);
      const predictionsArray = predictions.to2DArray();
      const performanceMetrics = this.calculateModelMetrics(targets, predictionsArray.map(p => p[0]));

      // Calculate residual standard deviation
      const residualSD = this.calculateResidualStandardDeviation(targets, predictionsArray.map(p => p[0]));

      // Create regression model
      const model: RegressionModel = {
        playerId,
        statType,
        season,
        coefficients,
        intercept,
        rSquared: performanceMetrics.rSquared,
        adjustedRSquared: performanceMetrics.adjustedRSquared,
        standardError: performanceMetrics.standardError,
        featureNames: Object.keys(features[0]),
        trainingDataSize: features.length,
        lastTrained: new Date(),
        performanceMetrics,
        residualStandardDeviation: residualSD
      };

      // Save model to database
      await this.saveModel(model);

      console.log(`✅ Model trained successfully! R²: ${model.rSquared.toFixed(3)}, RMSE: ${performanceMetrics.rmse.toFixed(3)}`);
      
      return model;
    } catch (error) {
      console.error('❌ Error training regression model:', error);
      throw error;
    }
  }

  /**
   * Make predictions using a trained model
   */
  async predict(
    playerId: string,
    statType: string,
    features: RegressionFeatures
  ): Promise<RegressionPrediction> {
    try {
      // Load the trained model
      const model = await this.loadModel(playerId, statType);
      if (!model) {
        throw new Error(`No trained model found for ${playerId} - ${statType}`);
      }

      // Prepare features for prediction
      const featureMatrix = this.featuresToMatrix([features]);
      
      // Make prediction
      const prediction = this.predictWithModel(model, features);
      
      // Calculate prediction intervals
      const confidenceInterval = this.calculateConfidenceInterval(prediction, model.standardError, 0.95);
      const predictionInterval = this.calculatePredictionInterval(prediction, model.residualStandardDeviation, 0.95);
      
      // Calculate feature importance (based on coefficient magnitudes)
      const featureImportance = this.calculateFeatureImportance(model);
      
      // Calculate model confidence based on R² and data size
      const modelConfidence = this.calculateModelConfidence(model);

      const result: RegressionPrediction = {
        predictedValue: prediction,
        standardDeviation: model.residualStandardDeviation,
        confidenceInterval,
        predictionInterval,
        featureImportance,
        modelConfidence,
        residualStandardError: model.standardError
      };

      return result;
    } catch (error) {
      console.error('❌ Error making prediction:', error);
      throw error;
    }
  }

  /**
   * Calculate standard deviation for uncertainty quantification
   */
  async calculateStandardDeviation(model: RegressionModel): Promise<number> {
    return model.residualStandardDeviation;
  }

  /**
   * Generate prediction intervals
   */
  async generatePredictionIntervals(
    prediction: number,
    sd: number,
    confidence: number = 0.95
  ): Promise<{ lower: number; upper: number; confidence: number }> {
    const zScore = this.getZScore(confidence);
    const margin = zScore * sd;
    
    return {
      lower: Math.max(0, prediction - margin), // Stats can't be negative
      upper: prediction + margin,
      confidence
    };
  }

  /**
   * Save model to Supabase database
   */
  async saveModel(model: RegressionModel): Promise<void> {
    try {
      const modelRecord: RegressionModelRecord = {
        player_id: model.playerId,
        stat_type: model.statType,
        season: model.season,
        model_data: model
      };

      const { error } = await this.supabase
        .from('regression_models')
        .upsert(modelRecord, { onConflict: 'player_id,stat_type,season' });

      if (error) {
        throw error;
      }

      console.log(`💾 Model saved to database for ${model.playerId} - ${model.statType}`);
    } catch (error) {
      console.error('❌ Error saving model to database:', error);
      throw error;
    }
  }

  /**
   * Load model from Supabase database
   */
  async loadModel(playerId: string, statType: string): Promise<RegressionModel | null> {
    try {
      const { data, error } = await this.supabase
        .from('regression_models')
        .select('model_data')
        .eq('player_id', playerId)
        .eq('stat_type', statType)
        .single();

      if (error || !data) {
        return null;
      }

      return data.model_data as RegressionModel;
    } catch (error) {
      console.error('❌ Error loading model from database:', error);
      return null;
    }
  }

  /**
   * Evaluate model performance
   */
  async evaluateModel(model: RegressionModel, testData: any[]): Promise<ModelMetrics> {
    // This would be implemented with actual test data
    // For now, return the training metrics
    return model.performanceMetrics;
  }

  /**
   * Check if a model exists for a player/stat combination
   */
  async modelExists(playerId: string, statType: string): Promise<boolean> {
    const model = await this.loadModel(playerId, statType);
    return model !== null;
  }

  /**
   * Get all available models for a player
   */
  async getPlayerModels(playerId: string): Promise<RegressionModel[]> {
    try {
      const { data, error } = await this.supabase
        .from('regression_models')
        .select('model_data')
        .eq('player_id', playerId);

      if (error || !data) {
        return [];
      }

      return data.map(row => row.model_data as RegressionModel);
    } catch (error) {
      console.error('❌ Error loading player models:', error);
      return [];
    }
  }

  // Private helper methods

  private featuresToMatrix(features: RegressionFeatures[]): Matrix {
    const featureNames = Object.keys(features[0]);
    const matrixData = features.map(feature => 
      featureNames.map(name => feature[name as keyof RegressionFeatures] as number)
    );
    return new Matrix(matrixData);
  }

  private extractCoefficients(regression: MultivariateLinearRegression, sampleFeatures: RegressionFeatures): Record<string, number> {
    const coefficients: Record<string, number> = {};
    const featureNames = Object.keys(sampleFeatures);
    
    regression.weights.forEach((weight, index) => {
      if (index < featureNames.length) {
        coefficients[featureNames[index]] = weight[0];
      }
    });
    
    return coefficients;
  }

  private predictWithModel(model: RegressionModel, features: RegressionFeatures): number {
    let prediction = model.intercept;
    
    Object.entries(features).forEach(([featureName, value]) => {
      if (model.coefficients[featureName] !== undefined) {
        prediction += value * model.coefficients[featureName];
      }
    });
    
    return Math.max(0, prediction); // Stats can't be negative
  }

  private calculateModelMetrics(targets: number[], predictions: number[]): ModelMetrics {
    const n = targets.length;
    const residuals = targets.map((target, i) => target - predictions[i]);
    
    // Calculate RMSE
    const mse = residuals.reduce((sum, residual) => sum + residual * residual, 0) / n;
    const rmse = Math.sqrt(mse);
    
    // Calculate MAE
    const mae = residuals.reduce((sum, residual) => sum + Math.abs(residual), 0) / n;
    
    // Calculate R²
    const meanTarget = targets.reduce((sum, target) => sum + target, 0) / n;
    const totalSS = targets.reduce((sum, target) => sum + Math.pow(target - meanTarget, 2), 0);
    const residualSS = residuals.reduce((sum, residual) => sum + residual * residual, 0);
    const rSquared = 1 - (residualSS / totalSS);
    
    // Calculate adjusted R²
    const p = Object.keys(predictions[0] || {}).length; // Number of features
    const adjustedRSquared = 1 - ((1 - rSquared) * (n - 1) / (n - p - 1));
    
    // Calculate standard error
    const standardError = Math.sqrt(residualSS / (n - p - 1));
    
    // Calculate prediction accuracy (within 1 SD)
    const sd = Math.sqrt(mse);
    const within1SD = predictions.filter((pred, i) => Math.abs(pred - targets[i]) <= sd).length / n;
    
    return {
      rmse,
      mae,
      rSquared,
      adjustedRSquared,
      standardError,
      predictionAccuracy: within1SD
    };
  }

  private calculateResidualStandardDeviation(targets: number[], predictions: number[]): number {
    const residuals = targets.map((target, i) => target - predictions[i]);
    const meanResidual = residuals.reduce((sum, residual) => sum + residual, 0) / residuals.length;
    const variance = residuals.reduce((sum, residual) => sum + Math.pow(residual - meanResidual, 2), 0) / residuals.length;
    return Math.sqrt(variance);
  }

  private calculateConfidenceInterval(prediction: number, standardError: number, confidence: number): { lower: number; upper: number; confidence: number } {
    const zScore = this.getZScore(confidence);
    const margin = zScore * standardError;
    
    return {
      lower: Math.max(0, prediction - margin),
      upper: prediction + margin,
      confidence
    };
  }

  private calculatePredictionInterval(prediction: number, residualSD: number, confidence: number): { lower: number; upper: number; confidence: number } {
    const zScore = this.getZScore(confidence);
    const margin = zScore * residualSD;
    
    return {
      lower: Math.max(0, prediction - margin),
      upper: prediction + margin,
      confidence
    };
  }

  private calculateFeatureImportance(model: RegressionModel): Record<string, number> {
    const importance: Record<string, number> = {};
    const maxCoeff = Math.max(...Object.values(model.coefficients).map(Math.abs));
    
    Object.entries(model.coefficients).forEach(([feature, coefficient]) => {
      importance[feature] = Math.abs(coefficient) / maxCoeff;
    });
    
    return importance;
  }

  private calculateModelConfidence(model: RegressionModel): number {
    // Combine R² and data size for confidence score
    const r2Weight = 0.7;
    const dataSizeWeight = 0.3;
    
    const r2Score = Math.max(0, model.rSquared);
    const dataSizeScore = Math.min(1, model.trainingDataSize / 50); // Normalize to 0-1
    
    return (r2Weight * r2Score) + (dataSizeWeight * dataSizeScore);
  }

  private getZScore(confidence: number): number {
    // Common confidence levels and their Z-scores
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    
    return zScores[confidence] || 1.96; // Default to 95% confidence
  }
}
