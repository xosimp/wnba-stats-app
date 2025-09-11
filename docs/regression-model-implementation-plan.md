# WNBA Regression Model Implementation Plan

## Overview
This document outlines the step-by-step implementation of a new regression model with standard deviation for WNBA player performance projections. The model will be integrated with your existing projection system to provide statistical rigor and uncertainty quantification.

## Current System Analysis
Your existing system already has:
- ✅ Multi-factor projection engine with weights (season average, recent form, opponent defense, etc.)
- ✅ Regression factor for outliers (basic regression to mean)
- ✅ Comprehensive player data services and game logs
- ✅ Supabase database with player stats, team defensive stats, and projections
- ✅ TypeScript/Node.js architecture

## Implementation Strategy
We'll implement the new regression model as a **complementary component** that can be:
1. **Standalone**: Used independently for regression-based projections
2. **Hybrid**: Combined with your existing model via ensembling
3. **Integrated**: Gradually replace certain factors in your current system

## Phase 1: Core Regression Model Development

### 1.1 Create Regression Model Service
**File**: `lib/services/RegressionModelService.ts`

**Features**:
- Multiple linear regression using statsmodels-equivalent JavaScript library
- Feature engineering for WNBA-specific factors
- Standard deviation calculation for uncertainty
- Prediction intervals and confidence intervals
- Model validation and performance metrics

**Key Methods**:
```typescript
class RegressionModelService {
  // Core regression methods
  async trainModel(playerId: string, statType: string, season: string): Promise<RegressionModel>
  async predict(playerId: string, statType: string, features: RegressionFeatures): Promise<RegressionPrediction>
  async calculateStandardDeviation(model: RegressionModel): Promise<number>
  async generatePredictionIntervals(prediction: number, sd: number, confidence: number): Promise<PredictionInterval>
  
  // Model management
  async saveModel(model: RegressionModel): Promise<void>
  async loadModel(playerId: string, statType: string): Promise<RegressionModel>
  async evaluateModel(model: RegressionModel, testData: any[]): Promise<ModelMetrics>
}
```

### 1.2 Define Regression Interfaces
**File**: `lib/algorithms/RegressionTypes.ts`

**New Interfaces**:
```typescript
export interface RegressionFeatures {
  // Historical performance features
  avgLast5Games: number;
  avgLast10Games: number;
  avgLast20Games: number;
  recentTrend: number; // Linear regression slope
  
  // Game context features
  opponentDefensiveRating: number;
  homeAway: number; // 1 for home, 0 for away
  restDays: number;
  backToBack: number; // 1 for b2b, 0 otherwise
  
  // Team context features
  teamPace: number;
  teammateInjuries: number; // Count of injured starters
  opponentPace: number;
  
  // Advanced features
  minutesProjection: number;
  usageRate: number;
  efficiencyRating: number;
}

export interface RegressionPrediction {
  predictedValue: number;
  standardDeviation: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  predictionInterval: {
    lower: number;
    upper: number;
    confidence: number; // e.g., 0.95 for 95%
  };
  featureImportance: Record<string, number>;
  modelConfidence: number; // 0-1 scale
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
}
```

### 1.3 Install Required Dependencies
**Package**: `ml-matrix`, `ml-regression-multivariate-linear`, `ml-regression-polynomial`

```bash
npm install ml-matrix ml-regression-multivariate-linear ml-regression-polynomial
npm install --save-dev @types/ml-matrix
```

## Phase 2: Data Preparation & Feature Engineering

### 2.1 Create Feature Engineering Service
**File**: `lib/services/RegressionFeatureService.ts`

**Responsibilities**:
- Extract and transform raw game log data into regression features
- Handle missing data and outliers
- Create lagged features (rolling averages, trends)
- Normalize/scale features appropriately
- Split data into training/validation/test sets

**Key Methods**:
```typescript
class RegressionFeatureService {
  async extractFeatures(playerId: string, statType: string, season: string): Promise<RegressionFeatures[]>
  async createRollingAverages(gameLogs: PlayerGameLog[], window: number): Promise<number[]>
  async calculateTrendSlope(values: number[]): Promise<number>
  async normalizeFeatures(features: RegressionFeatures[]): Promise<NormalizedFeatures[]>
  async splitData(features: RegressionFeatures[], target: number[]): Promise<DataSplit>
}
```

### 2.2 Database Schema Updates
**New Tables**:

```sql
-- Regression models storage
CREATE TABLE regression_models (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(255) NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  season VARCHAR(10) NOT NULL,
  model_data JSONB NOT NULL, -- Serialized model coefficients, metrics, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, stat_type, season)
);

-- Regression predictions history
CREATE TABLE regression_predictions (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(255) NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  game_date DATE NOT NULL,
  predicted_value DECIMAL(8,2) NOT NULL,
  standard_deviation DECIMAL(8,2) NOT NULL,
  confidence_interval_lower DECIMAL(8,2),
  confidence_interval_upper DECIMAL(8,2),
  prediction_interval_lower DECIMAL(8,2),
  prediction_interval_upper DECIMAL(8,2),
  actual_value DECIMAL(8,2),
  accuracy_score DECIMAL(5,4),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Feature importance tracking
CREATE TABLE regression_feature_importance (
  id SERIAL PRIMARY KEY,
  model_id INTEGER REFERENCES regression_models(id),
  feature_name VARCHAR(100) NOT NULL,
  importance_score DECIMAL(8,4) NOT NULL,
  coefficient_value DECIMAL(10,6) NOT NULL,
  p_value DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Phase 3: Model Training & Validation

### 3.1 Implement Training Pipeline
**File**: `lib/services/RegressionTrainingService.ts`

**Training Process**:
1. **Data Collection**: Gather 2+ seasons of player game logs
2. **Feature Engineering**: Transform raw data into regression features
3. **Model Selection**: Choose between linear, polynomial, or ensemble models
4. **Cross-Validation**: Use time-based splits to avoid future data leakage
5. **Hyperparameter Tuning**: Optimize model parameters
6. **Performance Evaluation**: Calculate RMSE, MAE, R², and prediction accuracy

**Key Methods**:
```typescript
class RegressionTrainingService {
  async trainPlayerModel(playerId: string, statType: string, season: string): Promise<RegressionModel>
  async crossValidateModel(features: RegressionFeatures[], target: number[]): Promise<CrossValidationResults>
  async selectBestModel(features: RegressionFeatures[], target: number[]): Promise<RegressionModel>
  async evaluateModelPerformance(model: RegressionModel, testData: any[]): Promise<ModelPerformance>
}
```

### 3.2 Model Validation & Testing
**Validation Metrics**:
- **RMSE**: Root Mean Square Error for overall accuracy
- **MAE**: Mean Absolute Error for average deviation
- **R²**: Coefficient of determination for model fit
- **Prediction Accuracy**: % of predictions within 1 SD, 2 SD of actual values
- **Book Line Comparison**: Hit rate vs. sportsbook over/under lines

## Phase 4: Integration with Existing System

### 4.1 Hybrid Projection Engine
**File**: `lib/services/HybridProjectionService.ts`

**Integration Strategies**:

1. **Weighted Ensemble**:
```typescript
// Combine existing model with regression model
const finalProjection = (existingWeight * existingProjection) + (regressionWeight * regressionProjection);
const combinedSD = Math.sqrt((existingWeight * existingSD²) + (regressionWeight * regressionSD²));
```

2. **Conditional Use**:
```typescript
// Use regression when certain conditions are met
if (hasRecentData && modelConfidence > 0.7) {
  return regressionProjection;
} else {
  return existingProjection;
}
```

3. **Meta-Model Stacking**:
```typescript
// Train a meta-model to learn optimal combination
const metaFeatures = [existingProjection, regressionProjection, confidenceScores];
const metaModel = trainMetaModel(metaFeatures, actualValues);
```

### 4.2 Update Existing Projection Services
**Files to Modify**:
- `ProjectionDataService.ts` - Add regression model integration
- `AssistsProjectionService.ts` - Integrate regression for assists
- `ReboundsProjectionService.ts` - Integrate regression for rebounds
- `Algorithms.ts` - Add regression-related interfaces and constants

**Integration Points**:
```typescript
// In existing projection services
async calculateProjection(request: ProjectionRequest): Promise<ProjectionResult> {
  // ... existing logic ...
  
  // Add regression model prediction
  const regressionPrediction = await this.regressionService.predict(
    request.playerId, 
    request.statType, 
    features
  );
  
  // Combine with existing projection
  const finalProjection = this.combineProjections(
    existingProjection, 
    regressionPrediction,
    weights
  );
  
  // Include uncertainty from both models
  const combinedUncertainty = this.calculateCombinedUncertainty(
    existingUncertainty,
    regressionPrediction.standardDeviation
  );
}
```

## Phase 5: Advanced Features & Optimization

### 5.1 Bayesian Regression Implementation
**File**: `lib/services/BayesianRegressionService.ts`

**Benefits**:
- Probabilistic outputs with full uncertainty distributions
- Better handling of small sample sizes
- Automatic feature selection and regularization
- More robust predictions for edge cases

### 5.2 Player-Specific Model Optimization
**Features**:
- Individual model training per player (when sufficient data exists)
- Position-specific feature engineering
- Injury and rest day impact modeling
- Head-to-head matchup history integration

### 5.3 Real-Time Model Updates
**Implementation**:
- Daily model retraining with new game data
- Online learning for continuous improvement
- A/B testing of different model versions
- Performance monitoring and alerting

## Phase 6: Production Deployment & Monitoring

### 6.1 API Endpoints
**New Endpoints**:
```typescript
// Regression model endpoints
POST /api/regression/train/:playerId/:statType
GET /api/regression/model/:playerId/:statType
POST /api/regression/predict
GET /api/regression/performance/:playerId/:statType

// Hybrid projection endpoints
POST /api/projections/hybrid
GET /api/projections/compare/:playerId/:statType
```

### 6.2 Performance Monitoring
**Metrics to Track**:
- Model prediction accuracy over time
- Standard deviation reliability
- Book line hit rates
- Model training time and resource usage
- Feature importance evolution

### 6.3 Automated Retraining
**Cron Jobs**:
```bash
# Daily model updates
0 2 * * * /usr/bin/node /path/to/scripts/update-regression-models.js

# Weekly full retraining
0 3 * * 0 /usr/bin/node /path/to/scripts/retrain-all-models.js
```

## Implementation Timeline

### Week 1: Core Infrastructure
- [ ] Set up regression model service structure
- [ ] Install required dependencies
- [ ] Create database schema updates
- [ ] Implement basic feature engineering

### Week 2: Model Development
- [ ] Implement multiple linear regression
- [ ] Add standard deviation calculations
- [ ] Create prediction intervals
- [ ] Basic model validation

### Week 3: Integration & Testing
- [ ] Integrate with existing projection services
- [ ] Implement hybrid projection engine
- [ ] Test with real player data
- [ ] Performance optimization

### Week 4: Advanced Features & Deployment
- [ ] Add Bayesian regression options
- [ ] Implement automated retraining
- [ ] Deploy to production
- [ ] Monitor and iterate

## Questions for Clarification

Before proceeding with implementation, I need clarification on:

1. **Data Requirements**: How many seasons of historical data do you have available for training? Minimum data requirements per player?

2. **Integration Preference**: Do you prefer to start with the hybrid approach (keeping existing model) or gradually replace certain factors with regression?

3. **Performance Targets**: What accuracy improvements are you targeting? Any specific RMSE or prediction accuracy goals?

4. **Computational Constraints**: Any limitations on model training time or resource usage?

5. **Feature Priority**: Which features from your existing system are most important to preserve vs. potentially replace?

6. **Deployment Strategy**: Should this be deployed incrementally (player by player) or all at once?

## Success Metrics

The implementation will be considered successful when:
- [ ] Regression models achieve R² > 0.6 for all stat types
- [ ] Standard deviation accurately reflects prediction uncertainty (68% of predictions within 1 SD)
- [ ] Hybrid projections show improved accuracy over existing system
- [ ] Book line hit rates improve by >5%
- [ ] Model training completes in <30 minutes per player
- [ ] System maintains <100ms response time for predictions

## Risk Mitigation

**Potential Risks**:
1. **Overfitting**: Use cross-validation and regularization
2. **Data Quality**: Implement robust data validation and cleaning
3. **Performance Degradation**: Gradual rollout with fallback to existing system
4. **Model Complexity**: Start simple, add complexity incrementally

**Mitigation Strategies**:
- Comprehensive testing with historical data
- A/B testing in production
- Real-time performance monitoring
- Automated rollback capabilities
