'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

interface RegressionModel {
  id: number;
  player_id: string;
  stat_type: string;
  season: string;
  model_data: {
    // New model structure from enhanced training
    mae?: number;
    rmse?: number;
    r2?: number;
    rSquared?: number;
    intercept?: number;
    coefficients?: number[];
    featureNames?: string[];
    lastTrained?: string;
    trainingDataSize?: number;
    seasonCombined?: boolean;
    enhancedFeatures?: boolean;
    recencyWeighting?: boolean;
    minMinutesThreshold?: number;
    targetStatType?: string;
    specializedFeatures?: number;
    // Metrics from different model types
    metrics?: {
      ensemble?: {
        mae?: number;
        rmse?: number;
        r2?: number;
      };
      randomForest?: {
        mae?: number;
        rmse?: number;
        r2?: number;
      };
      linearRegression?: {
        mae?: number;
        rmse?: number;
        r2?: number;
      };
    };
    // Model structure details
    modelStructure?: {
      randomForest?: {
        nTrees?: number;
        maxDepth?: number;
        featureImportance?: Array<{
          feature: string;
          importance: number;
        }>;
      };
      linearRegression?: {
        intercept?: number;
        hasCoefficients?: boolean;
        coefficientCount?: number;
      };
    };
    // Legacy fields for backward compatibility
    performanceMetrics?: {
      rmse: number;
      mae: number;
      rSquared: number;
    };
  };
  created_at: string;
  updated_at: string;
}

interface ModelSummary {
  totalModels: number;
  playersCovered: number;
  statTypes: string[];
  averageR2: number;
  averageRMSE: number;
}

export default function RegressionDashboard() {
  const router = useRouter();
  const [models, setModels] = useState<RegressionModel[]>([]);
  const [summary, setSummary] = useState<ModelSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Removed filter and sorting state - simplified dashboard

  useEffect(() => {
    fetchModels();
    
    // Set up auto-refresh every 30 seconds to check for new model data
    const interval = setInterval(() => {
      fetchModels();
    }, 30000); // 30 seconds
    
    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  const fetchModels = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      }
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from('regression_models')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setModels(data || []);
      calculateSummary(data || []);
      setLastUpdated(new Date());
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching models:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateSummary = (modelData: RegressionModel[]) => {
    if (modelData.length === 0) return;

    const uniquePlayers = new Set(modelData.map(m => m.player_id));
    const statTypes = [...new Set(modelData.map(m => m.stat_type))];
    
    // Extract R² values from new model structure
    const r2Values = modelData.map(m => {
      // Try different possible locations for R²
      return m.model_data?.r2 || 
             m.model_data?.rSquared || 
             m.model_data?.metrics?.ensemble?.r2 ||
             m.model_data?.metrics?.randomForest?.r2 ||
             m.model_data?.metrics?.linearRegression?.r2;
    }).filter((r): r is number => r !== undefined && !isNaN(r));
    
    // Extract RMSE values from new model structure
    const rmseValues = modelData.map(m => {
      return m.model_data?.rmse || 
             m.model_data?.metrics?.ensemble?.rmse ||
             m.model_data?.metrics?.randomForest?.rmse ||
             m.model_data?.metrics?.linearRegression?.rmse ||
             m.model_data?.performanceMetrics?.rmse;
    }).filter((r): r is number => r !== undefined && !isNaN(r));
    
    const averageR2 = r2Values.length > 0 ? r2Values.reduce((a, b) => a + b, 0) / r2Values.length : 0;
    const averageRMSE = rmseValues.length > 0 ? rmseValues.reduce((a, b) => a + b, 0) / rmseValues.length : 0;

    setSummary({
      totalModels: modelData.length,
      playersCovered: uniquePlayers.size,
      statTypes,
      averageR2,
      averageRMSE
    });
  };

  // Use all models directly - no filtering or sorting
  const displayModels = models;

  const getPerformanceColor = (r2: number) => {
    if (r2 > 0.3) return 'text-green-600';
    if (r2 > 0.1) return 'text-yellow-600';
    if (r2 > 0) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPerformanceLabel = (r2: number) => {
    if (r2 > 0.3) return 'Excellent';
    if (r2 > 0.1) return 'Good';
    if (r2 > 0) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-lg text-gray-600">Loading regression models...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div>
            <h1 style={{color: '#71FD08'}} className="text-3xl font-bold mb-2">Regression Models Dashboard</h1>
            <p style={{color: '#71FD08'}} className="text-lg">Private dashboard for viewing all trained regression models and performance metrics</p>
            {lastUpdated && (
              <p style={{color: '#9CA3AF'}} className="text-sm mt-2">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => fetchModels(true)}
                disabled={refreshing}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  refreshing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {refreshing ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Refreshing...
                  </span>
                ) : (
                  '🔄 Refresh'
                )}
              </button>
              <button
                onClick={() => router.push('/projections')}
                className="px-4 py-2 rounded-md text-white font-medium bg-black hover:bg-gray-800"
              >
                📊 Projections
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 style={{color: '#71FD08'}} className="text-sm font-medium">Total Models</h3>
              <p style={{color: '#9CA3AF'}} className="text-3xl font-bold">{summary.totalModels}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 style={{color: '#71FD08'}} className="text-sm font-medium">Average R²</h3>
              <p style={{color: '#9CA3AF'}} className="text-3xl font-bold">{summary.averageR2.toFixed(3)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 style={{color: '#71FD08'}} className="text-sm font-medium">Average RMSE</h3>
              <p style={{color: '#9CA3AF'}} className="text-3xl font-bold">{summary.averageRMSE.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 style={{color: '#71FD08'}} className="text-sm font-medium">Performance Distribution</h3>
              <div className="space-y-1 mt-2">
                <div className="text-sm">
                  <span style={{color: '#9CA3AF'}}>Models that are Excellent (R² &gt; 0.3): </span>
                  <span style={{color: '#71FD08'}} className="font-medium">
                    {displayModels.filter(m => (m.model_data?.r2 || m.model_data?.rSquared || 0) > 0.3).length}
                  </span>
                </div>
                <div className="text-sm">
                  <span style={{color: '#9CA3AF'}}>Models that are Good (R² 0.1-0.3): </span>
                  <span style={{color: '#71FD08'}} className="font-medium">
                    {displayModels.filter(m => {
                      const r2 = m.model_data?.r2 || m.model_data?.rSquared || 0;
                      return r2 > 0.1 && r2 <= 0.3;
                    }).length}
                  </span>
                </div>
                <div className="text-sm">
                  <span style={{color: '#9CA3AF'}}>Models that are Fair (R² 0-0.1): </span>
                  <span style={{color: '#71FD08'}} className="font-medium">
                    {displayModels.filter(m => {
                      const r2 = m.model_data?.r2 || m.model_data?.rSquared || 0;
                      return r2 > 0 && r2 <= 0.1;
                    }).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}





        {/* Random Forest Optimization Results */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h3 style={{color: '#71FD08'}} className="text-xl font-semibold mb-4 text-center">🌲 Random Forest Optimization Results</h3>
          <p style={{color: '#9CA3AF'}} className="text-sm mb-6 text-center">Hyperparameter tuning results from 324 parameter combinations</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h4 className="text-lg font-semibold text-green-800 mb-2">🏆 Best Performance</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">R² Score:</span> <span className="text-green-600 font-bold">72.2%</span></div>
                <div><span className="font-medium">RMSE:</span> <span className="text-green-600 font-bold">3.99</span></div>
                <div><span className="font-medium">MAE:</span> <span className="text-green-600 font-bold">2.88</span></div>
                <div><span className="font-medium">Training Samples:</span> <span className="text-green-600 font-bold">6,017</span></div>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="text-lg font-semibold text-blue-800 mb-2">⚙️ Optimal Parameters</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Trees:</span> <span className="text-blue-600 font-bold">100</span></div>
                <div><span className="font-medium">Max Depth:</span> <span className="text-blue-600 font-bold">15</span></div>
                <div><span className="font-medium">Min Split:</span> <span className="text-blue-600 font-bold">5</span></div>
                <div><span className="font-medium">Min Leaf:</span> <span className="text-blue-600 font-bold">5</span></div>
                <div><span className="font-medium">Max Features:</span> <span className="text-blue-600 font-bold">50%</span></div>
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <h4 className="text-lg font-semibold text-purple-800 mb-2">🎯 Top Features</h4>
              <div className="space-y-1 text-sm">
                <div><span className="font-medium">1. shot_volume:</span> <span className="text-purple-600 font-bold">18.52%</span></div>
                <div><span className="font-medium">2. three_point_efficiency:</span> <span className="text-purple-600 font-bold">14.05%</span></div>
                <div><span className="font-medium">3. season_average_points:</span> <span className="text-purple-600 font-bold">12.86%</span></div>
                <div><span className="font-medium">4. two_point_efficiency:</span> <span className="text-purple-600 font-bold">10.35%</span></div>
                <div><span className="font-medium">5. recent_form_composite:</span> <span className="text-purple-600 font-bold">9.65%</span></div>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <h4 className="text-lg font-semibold text-yellow-800 mb-2">⭐ New Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-yellow-800 mb-1">Star Status Feature</div>
                <div className="text-yellow-700">Boosts predictions for high-usage (&gt;30%) or high-scoring (&gt;18 pts) players</div>
              </div>
              <div>
                <div className="font-medium text-yellow-800 mb-1">Enhanced Shooting</div>
                <div className="text-yellow-700">2-point efficiency, shot volume, and opponent post defense for better post player modeling</div>
              </div>
            </div>
          </div>
        </div>

        {/* Model Features Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h3 style={{color: '#71FD08'}} className="text-xl font-semibold mb-4 text-center">Model Features Overview</h3>
          <p style={{color: '#9CA3AF'}} className="text-sm mb-6 text-center">Understanding what features each model uses for predictions</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Random Forest Model Features */}
            <div style={{border: '2px solid #71FD08'}} className="rounded-lg p-4 text-center">
              <h4 style={{color: '#71FD08'}} className="font-semibold text-lg mb-3">🌲 Random Forest Model (OPTIMIZED)</h4>
              <p style={{color: '#9CA3AF'}} className="text-sm mb-2">27 features - Most comprehensive model</p>
              <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-sm font-semibold text-green-800 mb-1">🏆 Best Performance</div>
                <div className="text-xs text-green-700">
                  <div>R² = 72.2% | RMSE = 3.99 | MAE = 2.88</div>
                  <div>100 trees, depth 15, 50% features per split</div>
                  <div>6,017 training samples (2024 + 2025 data)</div>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-left">
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Recent Performance</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• recent_form_composite</div>
                    <div>• recent_form_volatility</div>
                    <div>• recent_non_scoring_contributions</div>
                  </div>
                </div>
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Season Context</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• season_average_points</div>
                    <div>• usage_rate</div>
                    <div>• star_status ⭐</div>
                  </div>
                </div>
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Game Context</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• home_away</div>
                    <div>• is_injured</div>
                    <div>• days_rest_log</div>
                    <div>• is_starter</div>
                  </div>
                </div>
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Pace & Team Stats</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• raw_team_pace</div>
                    <div>• raw_opponent_pace</div>
                    <div>• pace_interaction</div>
                    <div>• team_points_scored_avg</div>
                    <div>• opponent_points_allowed_avg</div>
                  </div>
                </div>
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Shooting Analysis</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• three_point_volume</div>
                    <div>• three_point_efficiency</div>
                    <div>• two_point_efficiency</div>
                    <div>• shot_distribution_ratio</div>
                    <div>• shot_volume</div>
                  </div>
                </div>
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Defense & Role</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• opponent_3pt_defense</div>
                    <div>• opponent_post_defense</div>
                    <div>• player_role_playmaker</div>
                    <div>• assist_to_points_ratio</div>
                    <div>• historical_minutes</div>
                    <div>• starter_minutes_interaction</div>
                    <div>• time_decay_weight</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Linear Regression v2 Model Features */}
            <div style={{border: '2px solid #71FD08'}} className="rounded-lg p-4 text-center">
              <h4 style={{color: '#71FD08'}} className="font-semibold text-lg mb-3">📈 Linear Regression v2</h4>
              <p style={{color: '#9CA3AF'}} className="text-sm mb-2">26 features - Enhanced linear model</p>
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm font-semibold text-blue-800 mb-1">📊 Current Performance</div>
                <div className="text-xs text-blue-700">
                  <div>R² = 65.0% | RMSE = 4.31 | MAE = 3.20</div>
                  <div>Ridge Regression with L2 regularization</div>
                  <div>5,960 training samples (2024 + 2025 data)</div>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-left">
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Recent Performance</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• recent_form_composite</div>
                    <div>• recent_form_volatility</div>
                    <div>• recent_non_scoring_contributions</div>
                  </div>
                </div>
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Season Context</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• season_average_points</div>
                    <div>• usage_rate</div>
                  </div>
                </div>
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Game Context</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• home_away</div>
                    <div>• is_injured</div>
                    <div>• days_rest_log</div>
                    <div>• is_starter</div>
                  </div>
                </div>
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Pace & Team Stats</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• raw_team_pace</div>
                    <div>• raw_opponent_pace</div>
                    <div>• pace_interaction</div>
                    <div>• team_points_scored_avg</div>
                    <div>• opponent_points_allowed_avg</div>
                  </div>
                </div>
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Shooting Analysis</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• three_point_volume</div>
                    <div>• three_point_efficiency</div>
                    <div>• two_point_efficiency</div>
                    <div>• shot_distribution_ratio</div>
                    <div>• shot_volume</div>
                  </div>
                </div>
                <div>
                  <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">Defense & Role</h5>
                  <div style={{color: '#9CA3AF'}} className="text-xs space-y-1">
                    <div>• opponent_3pt_defense</div>
                    <div>• opponent_post_defense</div>
                    <div>• player_role_playmaker</div>
                    <div>• assist_to_points_ratio</div>
                    <div>• historical_minutes</div>
                    <div>• starter_minutes_interaction</div>
                    <div>• time_decay_weight</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Model Comparison */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 style={{color: '#71FD08'}} className="font-semibold text-lg mb-4 text-center">📊 Model Performance Comparison</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h5 className="text-lg font-semibold text-green-800 mb-3">🌲 Random Forest (Winner)</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>R² Score:</span>
                    <span className="font-bold text-green-600">72.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RMSE:</span>
                    <span className="font-bold text-green-600">3.99</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MAE:</span>
                    <span className="font-bold text-green-600">2.88</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Features:</span>
                    <span className="font-bold text-green-600">27</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Training Samples:</span>
                    <span className="font-bold text-green-600">6,017</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h5 className="text-lg font-semibold text-blue-800 mb-3">📈 Linear Regression v2</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>R² Score:</span>
                    <span className="font-bold text-blue-600">65.0%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RMSE:</span>
                    <span className="font-bold text-blue-600">4.31</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MAE:</span>
                    <span className="font-bold text-blue-600">3.20</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Features:</span>
                    <span className="font-bold text-blue-600">26</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Training Samples:</span>
                    <span className="font-bold text-blue-600">5,960</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <h5 className="text-lg font-semibold text-yellow-800 mb-2">🏆 Random Forest Advantages</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700">
                <div>
                  <div className="font-medium mb-1">Better Performance</div>
                  <div>+7.2% R² improvement over Linear model</div>
                </div>
                <div>
                  <div className="font-medium mb-1">Enhanced Features</div>
                  <div>Star status feature for high-usage players</div>
                </div>
                <div>
                  <div className="font-medium mb-1">Non-linear Relationships</div>
                  <div>Captures complex feature interactions</div>
                </div>
                <div>
                  <div className="font-medium mb-1">Feature Importance</div>
                  <div>Clear ranking of most predictive features</div>
                </div>
              </div>
            </div>
          </div>

          {/* Future Models Placeholder */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 style={{color: '#71FD08'}} className="font-semibold text-lg mb-3">🚧 Future Models (Coming Soon)</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-4 opacity-50">
                <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">🏀 Rebounds Model</h5>
                <p style={{color: '#9CA3AF'}} className="text-xs">Features will include rebounding-specific metrics, opponent rebounding stats, and position-based analysis</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4 opacity-50">
                <h5 style={{color: '#71FD08'}} className="font-medium text-sm mb-2">🎯 Assists Model</h5>
                <p style={{color: '#9CA3AF'}} className="text-xs">Features will include playmaking metrics, team assist rates, and offensive system analysis</p>
              </div>
            </div>
          </div>
        </div>

        {/* Models Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 style={{color: '#71FD08'}} className="text-lg font-semibold">
              All Trained Models ({displayModels.length} total)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th style={{color: '#9CA3AF'}} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Player
                  </th>
                  <th style={{color: '#9CA3AF'}} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Stat Type
                  </th>
                  <th style={{color: '#9CA3AF'}} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    R² Score
                  </th>
                  <th style={{color: '#9CA3AF'}} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    RMSE
                  </th>
                  <th style={{color: '#9CA3AF'}} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    MAE
                  </th>
                  <th style={{color: '#9CA3AF'}} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Training Data
                  </th>
                  <th style={{color: '#9CA3AF'}} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Last Trained
                  </th>
                  <th style={{color: '#9CA3AF'}} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Performance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayModels.map((model) => (
                  <tr key={model.id} className="hover:bg-gray-50">
                    <td style={{color: '#9CA3AF'}} className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {model.player_id}
                    </td>
                    <td style={{color: '#9CA3AF'}} className="px-6 py-4 whitespace-nowrap text-sm">
                      {model.stat_type}
                    </td>
                    <td style={{color: '#9CA3AF'}} className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="font-medium">
                        {model.model_data?.r2?.toFixed(3) || model.model_data?.rSquared?.toFixed(3) || 'N/A'}
                      </span>
                    </td>
                    <td style={{color: '#9CA3AF'}} className="px-6 py-4 whitespace-nowrap text-sm">
                      {model.model_data?.rmse?.toFixed(2) || model.model_data?.performanceMetrics?.rmse?.toFixed(2) || 'N/A'}
                    </td>
                    <td style={{color: '#9CA3AF'}} className="px-6 py-4 whitespace-nowrap text-sm">
                      {model.model_data?.mae?.toFixed(2) || 'N/A'}
                    </td>
                    <td style={{color: '#9CA3AF'}} className="px-6 py-4 whitespace-nowrap text-sm">
                      {model.model_data?.trainingDataSize || 'N/A'} games
                    </td>
                    <td style={{color: '#9CA3AF'}} className="px-6 py-4 whitespace-nowrap text-sm">
                      {model.model_data?.lastTrained ? new Date(model.model_data.lastTrained).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{color: '#9CA3AF'}} className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        {getPerformanceLabel(model.model_data?.r2 || model.model_data?.rSquared || 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
