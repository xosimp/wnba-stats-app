import { 
  ProjectionRequest, 
  ProjectionResult, 
  ProjectionFactors 
} from '../algorithms/Algorithms';
import { RegressionModelService } from './RegressionModelService';
import { RegressionFeatureService } from './RegressionFeatureService';
import { RegressionFeatures, RegressionPrediction } from '../algorithms/RegressionTypes';
import { ProjectionDataService } from './ProjectionDataService';

export class HybridProjectionService {
  private static instance: HybridProjectionService;
  private regressionService: RegressionModelService;
  private featureService: RegressionFeatureService;
  private projectionService: ProjectionDataService;

  private constructor() {
    this.regressionService = RegressionModelService.getInstance();
    this.featureService = RegressionFeatureService.getInstance();
    this.projectionService = ProjectionDataService.getInstance();
  }

  public static getInstance(): HybridProjectionService {
    if (!HybridProjectionService.instance) {
      HybridProjectionService.instance = new HybridProjectionService();
    }
    return HybridProjectionService.instance;
  }

  /**
   * Generate hybrid projection combining existing system with regression model
   */
  async generateHybridProjection(request: ProjectionRequest): Promise<ProjectionResult> {
    try {
      console.log(`🔄 Generating hybrid projection for ${request.playerName} - ${request.statType}`);
      
      // Get existing projection
      const existingProjection = await this.projectionService.generateProjection(request);
      
      // Check if regression model exists
      const hasRegressionModel = await this.regressionService.modelExists(request.playerName, request.statType);
      
      if (!hasRegressionModel) {
        console.log(`⚠️ No regression model found for ${request.playerName} - ${request.statType}, using existing projection only`);
        if (!existingProjection) {
          throw new Error('No existing projection available and no regression model found');
        }
        return this.addRegressionMetadata(existingProjection, null);
      }

      // Generate regression features for upcoming game
      const regressionFeatures = await this.generateUpcomingGameFeatures(request);
      
      // Get regression prediction
      const regressionPrediction = await this.regressionService.predict(
        request.playerName,
        request.statType,
        regressionFeatures
      );

      // Combine projections using weighted ensemble
      if (!existingProjection) {
        throw new Error('No existing projection available for combination');
      }
      const combinedProjection = this.combineProjections(
        existingProjection,
        regressionPrediction,
        this.calculateOptimalWeights(existingProjection, regressionPrediction)
      );

      // Calculate combined uncertainty
      const combinedUncertainty = this.calculateCombinedUncertainty(
        existingProjection,
        regressionPrediction
      );

      // Create hybrid result
      const hybridResult: ProjectionResult = {
        ...existingProjection,
        projectedValue: combinedProjection,
        confidenceScore: this.calculateCombinedConfidence(existingProjection, regressionPrediction),
        factors: this.updateFactorsWithRegression(existingProjection.factors, regressionPrediction),
        riskLevel: this.assessRiskLevel(combinedUncertainty),
        edge: this.calculateEdge(combinedProjection, request.sportsbookLine?.toString() || ''),
        recommendation: this.generateRecommendation(combinedProjection, combinedUncertainty, request.sportsbookLine?.toString() || '')
      };

      console.log(`✅ Hybrid projection generated: ${combinedProjection.toFixed(1)} ± ${combinedUncertainty.toFixed(2)}`);
      
      return hybridResult;
    } catch (error) {
      console.error('❌ Error generating hybrid projection:', error);
      
      // Fallback to existing projection if regression fails
      console.log('🔄 Falling back to existing projection system');
      const existingProjection = await this.projectionService.generateProjection(request);
      if (!existingProjection) {
        throw new Error('No existing projection available for fallback');
      }
      return this.addRegressionMetadata(existingProjection, null);
    }
  }

  /**
   * Generate features for upcoming game based on projection request
   */
  private async generateUpcomingGameFeatures(request: ProjectionRequest): Promise<RegressionFeatures> {
    // Extract features from the projection request context
    const features: RegressionFeatures = {
      opponentDefensiveRating: await this.getOpponentDefensiveRating(request.opponent, request.statType),
      homeAway: request.isHome ? 1 : 0,
      injuryStatus: 0, // Assume healthy for upcoming game
      restDays: await this.calculateRestDays(request.playerName),
      backToBack: 0, // Would need schedule data to determine
      teamPace: await this.getTeamPace(request.team || '', '2025'),
      opponentPace: await this.getTeamPace(request.opponent, '2025'),
      teammateInjuries: await this.getTeammateInjuriesCount(request.team || '', new Date())
    };

    return features;
  }

  /**
   * Combine existing and regression projections using weighted ensemble
   */
  private combineProjections(
    existingProjection: ProjectionResult,
    regressionPrediction: RegressionPrediction,
    weights: { existing: number; regression: number }
  ): number {
    const existingValue = existingProjection.projectedValue;
    const regressionValue = regressionPrediction.predictedValue;
    
    const combinedValue = (weights.existing * existingValue) + (weights.regression * regressionValue);
    
    console.log(`📊 Combining projections: ${existingValue.toFixed(1)} × ${weights.existing.toFixed(2)} + ${regressionValue.toFixed(1)} × ${weights.regression.toFixed(2)} = ${combinedValue.toFixed(1)}`);
    
    return combinedValue;
  }

  /**
   * Calculate optimal weights for combining projections
   */
  private calculateOptimalWeights(
    existingProjection: ProjectionResult,
    regressionPrediction: RegressionPrediction
  ): { existing: number; regression: number } {
    // Base weights: favor existing system initially, adjust based on regression confidence
    let existingWeight = 0.7;
    let regressionWeight = 0.3;

    // Adjust weights based on regression model confidence
    if (regressionPrediction.modelConfidence > 0.8) {
      // High confidence regression model gets more weight
      existingWeight = 0.5;
      regressionWeight = 0.5;
    } else if (regressionPrediction.modelConfidence < 0.5) {
      // Low confidence regression model gets less weight
      existingWeight = 0.8;
      regressionWeight = 0.2;
    }

    // Adjust based on existing projection confidence
    if (existingProjection.confidenceScore > 0.8) {
      existingWeight += 0.1;
      regressionWeight -= 0.1;
    } else if (existingProjection.confidenceScore < 0.5) {
      existingWeight -= 0.1;
      regressionWeight += 0.1;
    }

    // Ensure weights sum to 1
    const totalWeight = existingWeight + regressionWeight;
    existingWeight /= totalWeight;
    regressionWeight /= totalWeight;

    return { existing: existingWeight, regression: regressionWeight };
  }

  /**
   * Calculate combined uncertainty from both models
   */
  private calculateCombinedUncertainty(
    existingProjection: ProjectionResult,
    regressionPrediction: RegressionPrediction
  ): number {
    // Estimate existing projection uncertainty based on confidence score
    const existingUncertainty = (1 - existingProjection.confidenceScore) * existingProjection.projectedValue * 0.3;
    
    // Use regression standard deviation
    const regressionUncertainty = regressionPrediction.standardDeviation;
    
    // Combine using variance addition formula
    const combinedVariance = Math.pow(existingUncertainty, 2) + Math.pow(regressionUncertainty, 2);
    const combinedUncertainty = Math.sqrt(combinedVariance);
    
    console.log(`📏 Combined uncertainty: ${existingUncertainty.toFixed(2)}² + ${regressionUncertainty.toFixed(2)}² = ${combinedUncertainty.toFixed(2)}`);
    
    return combinedUncertainty;
  }

  /**
   * Calculate combined confidence score
   */
  private calculateCombinedConfidence(
    existingProjection: ProjectionResult,
    regressionPrediction: RegressionPrediction
  ): number {
    const existingConfidence = existingProjection.confidenceScore;
    const regressionConfidence = regressionPrediction.modelConfidence;
    
    // Weighted average of confidence scores
    const combinedConfidence = (0.6 * existingConfidence) + (0.4 * regressionConfidence);
    
    return Math.min(1, Math.max(0, combinedConfidence));
  }

  /**
   * Update projection factors with regression information
   */
  private updateFactorsWithRegression(
    existingFactors: ProjectionFactors,
    regressionPrediction: RegressionPrediction
  ): ProjectionFactors {
    // Add regression factor to existing factors
    return {
      ...existingFactors,
      regressionFactor: regressionPrediction.modelConfidence
    };
  }

  /**
   * Assess risk level based on combined uncertainty
   */
  private assessRiskLevel(uncertainty: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (uncertainty < 2.0) return 'LOW';
    if (uncertainty < 4.0) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Calculate edge vs sportsbook line
   */
  private calculateEdge(projection: number, sportsbookLine: string): number {
    if (!sportsbookLine) return 0;
    
    const lineValue = parseFloat(sportsbookLine);
    if (isNaN(lineValue)) return 0;
    
    return projection - lineValue;
  }

  /**
   * Generate betting recommendation
   */
  private generateRecommendation(
    projection: number,
    uncertainty: number,
    sportsbookLine: string
  ): 'OVER' | 'UNDER' | 'PASS' {
    if (!sportsbookLine) return 'PASS';
    
    const lineValue = parseFloat(sportsbookLine);
    if (isNaN(lineValue)) return 'PASS';
    
    const edge = projection - lineValue;
    const edgeRatio = Math.abs(edge) / uncertainty;
    
    // Need significant edge relative to uncertainty
    if (edgeRatio < 1.0) return 'PASS';
    
    return edge > 0 ? 'OVER' : 'UNDER';
  }

  /**
   * Add regression metadata to existing projection
   */
  private addRegressionMetadata(
    projection: ProjectionResult,
    regressionPrediction: RegressionPrediction | null
  ): ProjectionResult {
    if (!regressionPrediction) {
      return {
        ...projection,
        factors: {
          ...projection.factors,
          regressionFactor: 0 // No regression model available
        }
      };
    }

    return projection;
  }

  // Helper methods for feature generation

  private async getOpponentDefensiveRating(opponent: string, statType: string): Promise<number> {
    // This would integrate with your existing defensive stats service
    // For now, return a default value
    return 100.0;
  }

  private async calculateRestDays(playerId: string): Promise<number> {
    // This would calculate rest days since last game
    // For now, return a default value
    return 2;
  }

  private async getTeamPace(team: string, season: string): Promise<number> {
    // This would integrate with your existing pace service
    // For now, return a default value
    return 1.0;
  }

  private async getTeammateInjuriesCount(team: string, date: Date): Promise<number> {
    // This would integrate with your existing injury service
    // For now, return a default value
    return 0;
  }

  /**
   * Train regression model for a player/stat combination
   */
  async trainRegressionModel(
    playerId: string,
    statType: string,
    season: string = '2025'
  ): Promise<boolean> {
    try {
      console.log(`🧠 Training regression model for ${playerId} - ${statType}`);
      
      // Extract features from game logs
      const trainingData = await this.featureService.extractFeatures(playerId, statType, season);
      
      // Train the model
      const model = await this.regressionService.trainModel(playerId, statType, season, trainingData);
      
      console.log(`✅ Regression model trained successfully for ${playerId} - ${statType}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to train regression model for ${playerId} - ${statType}:`, error);
      return false;
    }
  }

  /**
   * Get regression model performance metrics
   */
  async getModelPerformance(
    playerId: string,
    statType: string
  ): Promise<any> {
    try {
      const model = await this.regressionService.loadModel(playerId, statType);
      if (!model) {
        return null;
      }

      return {
        rSquared: model.rSquared,
        adjustedRSquared: model.adjustedRSquared,
        rmse: model.performanceMetrics.rmse,
        mae: model.performanceMetrics.mae,
        standardError: model.standardError,
        residualStandardDeviation: model.residualStandardDeviation,
        trainingDataSize: model.trainingDataSize,
        lastTrained: model.lastTrained,
        featureImportance: (model.performanceMetrics as any).featureImportance || []
      };
    } catch (error) {
      console.error('❌ Error getting model performance:', error);
      return null;
    }
  }
}
