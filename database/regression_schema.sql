-- Regression Models Database Schema
-- This file contains the SQL statements to create the necessary tables for storing
-- regression models, predictions, and feature importance data.

-- Table for storing trained regression models
CREATE TABLE IF NOT EXISTS regression_models (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(255) NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  season VARCHAR(10) NOT NULL,
  model_data JSONB NOT NULL, -- Serialized model coefficients, metrics, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, stat_type, season)
);

-- Table for storing regression prediction history
CREATE TABLE IF NOT EXISTS regression_predictions (
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

-- Table for storing feature importance data
CREATE TABLE IF NOT EXISTS regression_feature_importance (
  id SERIAL PRIMARY KEY,
  model_id INTEGER REFERENCES regression_models(id) ON DELETE CASCADE,
  feature_name VARCHAR(100) NOT NULL,
  importance_score DECIMAL(8,4) NOT NULL,
  coefficient_value DECIMAL(10,6) NOT NULL,
  p_value DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table for storing model training history and performance metrics
CREATE TABLE IF NOT EXISTS regression_model_performance (
  id SERIAL PRIMARY KEY,
  model_id INTEGER REFERENCES regression_models(id) ON DELETE CASCADE,
  training_date TIMESTAMP NOT NULL,
  r_squared DECIMAL(8,4) NOT NULL,
  adjusted_r_squared DECIMAL(8,4) NOT NULL,
  rmse DECIMAL(8,4) NOT NULL,
  mae DECIMAL(8,4) NOT NULL,
  standard_error DECIMAL(8,4) NOT NULL,
  residual_standard_deviation DECIMAL(8,4) NOT NULL,
  training_data_size INTEGER NOT NULL,
  validation_metrics JSONB, -- Additional validation metrics
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table for storing cross-validation results
CREATE TABLE IF NOT EXISTS regression_cross_validation (
  id SERIAL PRIMARY KEY,
  model_id INTEGER REFERENCES regression_models(id) ON DELETE CASCADE,
  fold_number INTEGER NOT NULL,
  r_squared DECIMAL(8,4) NOT NULL,
  rmse DECIMAL(8,4) NOT NULL,
  mae DECIMAL(8,4) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_regression_models_player_stat ON regression_models(player_id, stat_type);
CREATE INDEX IF NOT EXISTS idx_regression_models_season ON regression_models(season);
CREATE INDEX IF NOT EXISTS idx_regression_predictions_player_date ON regression_predictions(player_id, game_date);
CREATE INDEX IF NOT EXISTS idx_regression_predictions_stat_type ON regression_predictions(stat_type);
CREATE INDEX IF NOT EXISTS idx_regression_feature_importance_model ON regression_feature_importance(model_id);
CREATE INDEX IF NOT EXISTS idx_regression_model_performance_model ON regression_model_performance(model_id);

-- Comments for documentation
COMMENT ON TABLE regression_models IS 'Stores trained regression models for each player/stat combination';
COMMENT ON TABLE regression_predictions IS 'Stores historical regression predictions for tracking accuracy';
COMMENT ON TABLE regression_feature_importance IS 'Stores feature importance scores and coefficients for each model';
COMMENT ON TABLE regression_model_performance IS 'Stores model performance metrics and training history';
COMMENT ON TABLE regression_cross_validation IS 'Stores cross-validation results for model evaluation';

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER update_regression_models_updated_at 
    BEFORE UPDATE ON regression_models 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for easy access to model performance summary
CREATE OR REPLACE VIEW regression_model_summary AS
SELECT 
  rm.id,
  rm.player_id,
  rm.stat_type,
  rm.season,
  rm.created_at,
  rm.updated_at,
  rmp.r_squared,
  rmp.adjusted_r_squared,
  rmp.rmse,
  rmp.mae,
  rmp.standard_error,
  rmp.residual_standard_deviation,
  rmp.training_data_size,
  rmp.training_date
FROM regression_models rm
LEFT JOIN regression_model_performance rmp ON rm.id = rmp.model_id
WHERE rmp.training_date = (
  SELECT MAX(training_date) 
  FROM regression_model_performance 
  WHERE model_id = rm.id
);

-- View for feature importance summary
CREATE OR REPLACE VIEW regression_feature_importance_summary AS
SELECT 
  rm.player_id,
  rm.stat_type,
  rm.season,
  rfi.feature_name,
  rfi.importance_score,
  rfi.coefficient_value,
  rfi.p_value
FROM regression_models rm
JOIN regression_feature_importance rfi ON rm.id = rfi.model_id
ORDER BY rm.player_id, rm.stat_type, rm.season, rfi.importance_score DESC;
