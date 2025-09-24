const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Custom Random Forest implementation for WNBA assists prediction
class RandomForest {
  constructor(nEstimators = 100, maxDepth = 10, minSamplesSplit = 5, minSamplesLeaf = 1, maxFeatures = 'sqrt', randomState = 42) {
    this.nEstimators = nEstimators;
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.minSamplesLeaf = minSamplesLeaf;
    this.maxFeatures = maxFeatures;
    this.randomState = randomState;
    this.trees = [];
    this.featureNames = [];
  }

  // Bootstrap sampling
  bootstrapSample(X, y) {
    const n = X.length;
    const indices = [];
    for (let i = 0; i < n; i++) {
      indices.push(Math.floor(Math.random() * n));
    }
    return {
      X: indices.map(i => X[i]),
      y: indices.map(i => y[i])
    };
  }

  // Calculate variance for regression
  calculateVariance(y) {
    if (y.length === 0) return 0;
    const mean = y.reduce((sum, val) => sum + val, 0) / y.length;
    return y.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / y.length;
  }

  // Find best split for a node
  findBestSplit(X, y, features) {
    let bestVariance = Infinity;
    let bestFeature = -1;
    let bestThreshold = 0;

    for (const feature of features) {
      const values = X.map(row => row[feature]).filter(val => val != null);
      const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
      
      for (let i = 0; i < uniqueValues.length - 1; i++) {
        const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;
        
        const leftIndices = [];
        const rightIndices = [];
        
        for (let j = 0; j < X.length; j++) {
          if (X[j][feature] <= threshold) {
            leftIndices.push(j);
          } else {
            rightIndices.push(j);
          }
        }

        if (leftIndices.length < this.minSamplesSplit || rightIndices.length < this.minSamplesSplit ||
            leftIndices.length < this.minSamplesLeaf || rightIndices.length < this.minSamplesLeaf) {
          continue;
        }

        const leftY = leftIndices.map(i => y[i]);
        const rightY = rightIndices.map(i => y[i]);
        
        const leftVariance = this.calculateVariance(leftY);
        const rightVariance = this.calculateVariance(rightY);
        
        const weightedVariance = (leftY.length * leftVariance + rightY.length * rightVariance) / y.length;
        
        if (weightedVariance < bestVariance) {
          bestVariance = weightedVariance;
          bestFeature = feature;
          bestThreshold = threshold;
        }
      }
    }

    return { feature: bestFeature, threshold: bestThreshold, variance: bestVariance };
  }

  // Build a single decision tree
  buildTree(X, y, depth = 0) {
    if (depth >= this.maxDepth || y.length < this.minSamplesSplit || this.calculateVariance(y) === 0) {
      return {
        isLeaf: true,
        prediction: y.reduce((sum, val) => sum + val, 0) / y.length
      };
    }

    const nFeatures = X[0].length;
    let nFeaturesToTry;
    
    // Calculate number of features to try based on maxFeatures strategy
    if (this.maxFeatures === 'sqrt') {
      nFeaturesToTry = Math.max(1, Math.floor(Math.sqrt(nFeatures)));
    } else if (this.maxFeatures === 'log2') {
      nFeaturesToTry = Math.max(1, Math.floor(Math.log2(nFeatures)));
    } else if (typeof this.maxFeatures === 'number') {
      nFeaturesToTry = Math.max(1, Math.floor(this.maxFeatures * nFeatures));
    } else {
      nFeaturesToTry = Math.max(1, Math.floor(Math.sqrt(nFeatures)));
    }
    
    const features = [];
    
    // Random feature selection
    const availableFeatures = Array.from({ length: nFeatures }, (_, i) => i);
    for (let i = 0; i < nFeaturesToTry; i++) {
      const randomIndex = Math.floor(Math.random() * availableFeatures.length);
      features.push(availableFeatures.splice(randomIndex, 1)[0]);
    }

    const split = this.findBestSplit(X, y, features);
    
    if (split.feature === -1) {
      return {
        isLeaf: true,
        prediction: y.reduce((sum, val) => sum + val, 0) / y.length
      };
    }

    const leftIndices = [];
    const rightIndices = [];
    
    for (let i = 0; i < X.length; i++) {
      if (X[i][split.feature] <= split.threshold) {
        leftIndices.push(i);
      } else {
        rightIndices.push(i);
      }
    }

    const leftX = leftIndices.map(i => X[i]);
    const leftY = leftIndices.map(i => y[i]);
    const rightX = rightIndices.map(i => X[i]);
    const rightY = rightIndices.map(i => y[i]);

    return {
      isLeaf: false,
      feature: split.feature,
      threshold: split.threshold,
      left: this.buildTree(leftX, leftY, depth + 1),
      right: this.buildTree(rightX, rightY, depth + 1)
    };
  }

  // Train the Random Forest
  fit(X, y, featureNames) {
    this.featureNames = featureNames;
    this.trees = [];
    
    console.log(`🌲 Building ${this.nEstimators} decision trees...`);
    
    for (let i = 0; i < this.nEstimators; i++) {
      if (i % 20 === 0) {
        console.log(`   Tree ${i + 1}/${this.nEstimators}...`);
      }
      
      const sample = this.bootstrapSample(X, y);
      const tree = this.buildTree(sample.X, sample.y);
      this.trees.push(tree);
    }
    
    console.log(`✅ Random Forest training completed!`);
  }

  // Predict using a single tree
  predictTree(tree, features) {
    if (tree.isLeaf) {
      return tree.prediction;
    }
    
    if (features[tree.feature] <= tree.threshold) {
      return this.predictTree(tree.left, features);
    } else {
      return this.predictTree(tree.right, features);
    }
  }

  // Predict using the entire forest
  predict(X) {
    const predictions = [];
    
    for (const features of X) {
      const treePredictions = this.trees.map(tree => this.predictTree(tree, features));
      const averagePrediction = treePredictions.reduce((sum, pred) => sum + pred, 0) / treePredictions.length;
      predictions.push(averagePrediction);
    }
    
    return predictions;
  }

  // Calculate feature importance
  getFeatureImportance() {
    const importance = new Array(this.featureNames.length).fill(0);
    
    for (const tree of this.trees) {
      this.calculateTreeImportance(tree, importance);
    }
    
    // Normalize importance scores
    const totalImportance = importance.reduce((sum, imp) => sum + imp, 0);
    return importance.map(imp => imp / totalImportance);
  }

  calculateTreeImportance(node, importance, depth = 0) {
    if (node.isLeaf) return;
    
    // Add importance based on variance reduction and depth
    const weight = Math.pow(0.5, depth);
    importance[node.feature] += weight;
    
    this.calculateTreeImportance(node.left, importance, depth + 1);
    this.calculateTreeImportance(node.right, importance, depth + 1);
  }
}

// Evaluation metrics
function calculateMetrics(actual, predicted) {
  const n = actual.length;
  
  // R² (Coefficient of Determination)
  const actualMean = actual.reduce((sum, val) => sum + val, 0) / n;
  const ssRes = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  const ssTot = actual.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
  const r2 = 1 - (ssRes / ssTot);
  
  // RMSE (Root Mean Square Error)
  const rmse = Math.sqrt(ssRes / n);
  
  // MAE (Mean Absolute Error)
  const mae = actual.reduce((sum, val, i) => sum + Math.abs(val - predicted[i]), 0) / n;
  
  return { r2, rmse, mae };
}

// Standardize features for better Random Forest performance
function standardizeFeatures(features) {
  const n = features.length;
  const k = features[0].length;
  
  // Calculate means and standard deviations for each feature
  const means = [];
  const stds = [];
  
  for (let j = 0; j < k; j++) {
    const values = features.map(row => row[j]).filter(v => !isNaN(v) && isFinite(v));
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    
    means.push(mean);
    stds.push(std > 0 ? std : 1); // Avoid division by zero
  }
  
  // Standardize features
  const standardizedFeatures = features.map(row => 
    row.map((value, j) => (value - means[j]) / stds[j])
  );
  
  return { standardizedFeatures, means, stds };
}

// Hyperparameter tuning function
async function tuneRandomForest(XTrain, yTrain, XTest, yTest, featureNames) {
  console.log('🔧 Starting hyperparameter tuning...\n');
  
  const paramGrid = {
    nEstimators: [75], // Optimal for assists variance (0-10) and role-driven nature
    maxDepth: [10],    // Moderate depth for assists
    minSamplesSplit: [5],
    minSamplesLeaf: [2],
    maxFeatures: ['sqrt']
  };
  
  let bestScore = -Infinity;
  let bestParams = null;
  let bestModel = null;
  const results = [];
  
  let totalCombinations = 1;
  Object.values(paramGrid).forEach(arr => totalCombinations *= arr.length);
  
  console.log(`📊 Testing ${totalCombinations} parameter combinations...\n`);
  
  let combination = 0;
  
  for (const nEstimators of paramGrid.nEstimators) {
    for (const maxDepth of paramGrid.maxDepth) {
      for (const minSamplesSplit of paramGrid.minSamplesSplit) {
        for (const minSamplesLeaf of paramGrid.minSamplesLeaf) {
          for (const maxFeatures of paramGrid.maxFeatures) {
            combination++;
            
            if (combination % 10 === 0) {
              console.log(`   Testing combination ${combination}/${totalCombinations}...`);
            }
            
            try {
              const model = new RandomForest(nEstimators, maxDepth, minSamplesSplit, minSamplesLeaf, maxFeatures, 42);
              model.fit(XTrain, yTrain, featureNames);
              
              const trainPredictions = model.predict(XTrain);
              const testPredictions = model.predict(XTest);
              
              const trainMetrics = calculateMetrics(yTrain, trainPredictions);
              const testMetrics = calculateMetrics(yTest, testPredictions);
              
              const score = testMetrics.r2; // Use R² as the scoring metric
              
              results.push({
                params: { nEstimators, maxDepth, minSamplesSplit, minSamplesLeaf, maxFeatures },
                trainR2: trainMetrics.r2,
                testR2: testMetrics.r2,
                testRMSE: testMetrics.rmse,
                testMAE: testMetrics.mae,
                score: score
              });
              
              if (score > bestScore) {
                bestScore = score;
                bestParams = { nEstimators, maxDepth, minSamplesSplit, minSamplesLeaf, maxFeatures };
                bestModel = model;
              }
            } catch (error) {
              console.log(`   ⚠️  Skipped combination ${combination} due to error: ${error.message}`);
            }
          }
        }
      }
    }
  }
  
  // Sort results by test R²
  results.sort((a, b) => b.score - a.score);
  
  console.log('\n🏆 Top 10 Parameter Combinations:');
  results.slice(0, 10).forEach((result, index) => {
    console.log(`   ${index + 1}. R²=${(result.testR2 * 100).toFixed(1)}%, RMSE=${result.testRMSE.toFixed(2)}, MAE=${result.testMAE.toFixed(2)}`);
    console.log(`      n_estimators=${result.params.nEstimators}, max_depth=${result.params.maxDepth}, min_samples_split=${result.params.minSamplesSplit}, min_samples_leaf=${result.params.minSamplesLeaf}, max_features=${result.params.maxFeatures}`);
  });
  
  console.log(`\n🎯 Best Parameters:`);
  console.log(`   n_estimators: ${bestParams.nEstimators}`);
  console.log(`   max_depth: ${bestParams.maxDepth}`);
  console.log(`   min_samples_split: ${bestParams.minSamplesSplit}`);
  console.log(`   min_samples_leaf: ${bestParams.minSamplesLeaf}`);
  console.log(`   max_features: ${bestParams.maxFeatures}`);
  console.log(`   Best Test R²: ${(bestScore * 100).toFixed(1)}%`);
  
  return { bestModel, bestParams, bestScore, results };
}

async function trainRandomForestAssistsModel() {
  console.log('🌲 Training WNBA Assists Prediction Random Forest Model...\n');

  try {
    // Get current date in CT for filtering 2025 games
    const today = new Date();
    const ctDate = new Date(today.toLocaleString("en-US", {timeZone: "America/Chicago"}));
    const ctDateString = ctDate.toISOString().split('T')[0];
    
    console.log(`📅 Using CT date: ${ctDateString} for 2025 game filtering\n`);

    // Load all required data
    console.log('📊 Loading training data...');
    
    // Load game logs for both seasons (with pagination to get ALL data)
    let gameLogs2025 = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('wnba_game_logs')
        .select('*')
        .range(from, from + limit - 1);

      if (batchError) {
        console.error('Error loading 2025 game logs batch:', batchError);
        throw batchError;
      }
      
      if (batch && batch.length > 0) {
        gameLogs2025 = gameLogs2025.concat(batch);
        from += limit;
        hasMore = batch.length === limit;
      } else {
        hasMore = false;
      }
    }

    // Load 2024 game logs with pagination to get ALL data
    let gameLogs2024 = [];
    from = 0;
    hasMore = true;
    
    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('game_logs_2024')
        .select('*')
        .range(from, from + limit - 1);

      if (batchError) {
        console.error('Error loading 2024 game logs batch:', batchError);
        throw batchError;
      }
      
      if (batch && batch.length > 0) {
        gameLogs2024 = gameLogs2024.concat(batch);
        from += limit;
        hasMore = batch.length === limit;
      } else {
        hasMore = false;
      }
    }

    console.log(`   Loaded ${gameLogs2025.length} 2025 games, ${gameLogs2024.length} 2024 games`);

    // Load season averages
    const { data: seasonAverages2025, error: season2025Error } = await supabase
      .from('player_season_stats')
      .select('*')
      .eq('season', '2025');

    const { data: seasonAverages2024, error: season2024Error } = await supabase
      .from('player_season_stats_2024')
      .select('*');

    if (season2025Error) throw season2025Error;
    if (season2024Error) throw season2024Error;

    console.log(`   Loaded ${seasonAverages2025.length} 2025 season averages, ${seasonAverages2024.length} 2024 season averages`);

    // Load pace stats
    const { data: paceStats2025, error: pace2025Error } = await supabase
      .from('team_pace_stats')
      .select('*')
      .eq('season', '2025');

    const { data: paceStats2024, error: pace2024Error } = await supabase
      .from('team_pace_stats')
      .select('*')
      .eq('season', '2024');

    if (pace2025Error) throw pace2025Error;
    if (pace2024Error) throw pace2024Error;

    console.log(`   Loaded ${paceStats2025.length} 2025 pace stats, ${paceStats2024.length} 2024 pace stats`);

    // Load defensive stats
    const { data: defensiveStats2025, error: defense2025Error } = await supabase
      .from('team_defensive_stats')
      .select('*')
      .eq('season', '2025');

    const { data: defensiveStats2024, error: defense2024Error } = await supabase
      .from('team_defensive_stats')
      .select('*')
      .eq('season', '2024');

    if (defense2025Error) throw defense2025Error;
    if (defense2024Error) throw defense2024Error;

    console.log(`   Loaded ${defensiveStats2025.length} 2025 defensive stats, ${defensiveStats2024.length} 2024 defensive stats`);

    // Note: Team offense data is included in pace stats (points_scored field)
    console.log(`   Team offense data loaded via pace stats`);

    // Load usage data
    const { data: usageStats2025, error: usage2025Error } = await supabase
      .from('player_advanced_stats')
      .select('*');

    const { data: usageStats2024, error: usage2024Error } = await supabase
      .from('player_advanced_stats_2024')
      .select('*');

    if (usage2025Error) throw usage2025Error;
    if (usage2024Error) throw usage2024Error;

    console.log(`   Loaded ${usageStats2025.length} 2025 usage stats, ${usageStats2024.length} 2024 usage stats`);

    // Load injury data
    const { data: injuryData, error: injuryError } = await supabase
      .from('active_injuries')
      .select('*');

    if (injuryError) throw injuryError;
    console.log(`   Loaded ${injuryData.length} injury records`);

    // Create lookup maps
    const seasonMap = {};
    
    // Handle 2025 data (already has season field)
    seasonAverages2025.forEach(avg => {
      const key = `${avg.player_name}_${avg.season}`;
      seasonMap[key] = avg;
    });
    
    // Handle 2024 data (add season field)
    seasonAverages2024.forEach(avg => {
      const key = `${avg.player_name}_2024`;
      seasonMap[key] = { ...avg, season: '2024' };
    });

    // Team abbreviation mapping for consistency
    const teamAbbreviationMap = {
      'LVA': 'Las Vegas Aces',
      'NYL': 'New York Liberty', 
      'CON': 'Connecticut Sun',
      'MIN': 'Minnesota Lynx',
      'PHX': 'Phoenix Mercury',
      'PHO': 'Phoenix Mercury',
      'SEA': 'Seattle Storm',
      'WAS': 'Washington Mystics',
      'ATL': 'Atlanta Dream',
      'CHI': 'Chicago Sky',
      'LAS': 'Los Angeles Sparks',
      'DAL': 'Dallas Wings',
      'IND': 'Indiana Fever',
      'GSW': 'Golden State Valkyries',
      'GSV': 'Golden State Valkyries'
    };

    // League averages for missing data imputation
    const leagueAverages = {
      assists: 4.0,           // ~4 assists/game WNBA average
      pace: 95.0,             // ~95 possessions/game WNBA average
      stealRate: 0.08,        // ~8% steal rate WNBA average
      fgPercentage: 0.45,     // ~45% FG% WNBA average
      defensiveRating: 0.5,   // Normalized defensive rating
      usageRate: 0.20,        // ~20% usage rate WNBA average
      minutes: 25.0           // ~25 minutes/game WNBA average
    };

    const paceMap = {};
    [...paceStats2025, ...paceStats2024].forEach(stat => {
      const key = `${stat.team}_${stat.season}`;
      paceMap[key] = stat;
    });

    const defenseMap = {};
    [...defensiveStats2025, ...defensiveStats2024].forEach(stat => {
      const key = `${stat.team}_${stat.season}`;
      if (!defenseMap[key]) {
        defenseMap[key] = {};
      }
      defenseMap[key][stat.stat_type] = stat.overall_avg_allowed;
      defenseMap[key].points_allowed = stat.points_allowed;
      defenseMap[key].three_point_percentage_allowed = stat.three_point_percentage_allowed;
      defenseMap[key].points_in_paint_allowed = stat.points_in_paint_allowed;
    });

    // Team offense data is included in pace stats
    const offenseMap = paceMap; // Reuse paceMap which contains points_scored

    const usageMap = {};
    [...usageStats2025, ...usageStats2024].forEach(stat => {
      const key = `${stat.player_name}_${stat.season}`;
      const usageRate = stat.season === '2025' ? stat.usage_percentage : stat.usage_pct;
      usageMap[key] = usageRate;
    });

    const injuryMap = {};
    if (injuryData) {
      injuryData.forEach(injury => {
        if (injury.status === 'Out' || injury.status === 'Questionable') {
          injuryMap[injury.player_name] = injury.status;
        }
      });
    }

    // Player Playmaking Performance + Role and Workload + Game Context + Team Pace + Teammate/Opponent Defense + Injury/Time features (20 features)
    const featureNames = [
      // Player Playmaking Performance (5 features)
      'season_average_assists',
      'recent_assist_form_composite',
      'recent_assist_volatility',
      'assist_percentage',
      'assist_to_turnover_ratio',
      // Player Role and Workload (4 features)
      'historical_minutes',
      'is_starter',
      'player_position',
      'usage_rate',
      // Game Context (2 features)
      'home_away',
      'days_rest_log',
      // Team and Opponent Pace (3 features)
      'team_pace',
      'opponent_pace',
      'pace_interaction',
      // Teammate and Opponent Defensive Features (4 features)
      'teammate_shooting_efficiency',
      'opponent_steal_rate',
      'opponent_defensive_rating',
      'teammate_assist_dependency',
      // Additional Teammate Efficiency Features (2 features)
      'teammate_rebounding_strength',
      'lineup_shift_multiplier',
      // Injury and Time-Based Features (2 features)
      'injury_status',
      'time_decay_weight'
    ];

    console.log('🔄 Processing game logs for assists training data...\n');

    // Combine all game logs and sort by date properly
    const allGameLogs = [
      ...gameLogs2025.map(game => ({ ...game, season: '2025' })),
      ...gameLogs2024.map(game => ({ ...game, season: '2024' }))
    ];
    allGameLogs.sort((a, b) => new Date(a.game_date) - new Date(b.game_date));

    // Group by player
    const playerGames = {};
    allGameLogs.forEach(game => {
      if (!playerGames[game.player_name]) {
        playerGames[game.player_name] = [];
      }
      playerGames[game.player_name].push(game);
    });

    const trainingData = [];
    let processedPlayers = 0;

    for (const [playerName, games] of Object.entries(playerGames)) {
      if (games.length < 15) continue; // Need at least 15 games for features
      
      processedPlayers++;
      if (processedPlayers % 50 === 0) {
        console.log(`👤 Processed ${processedPlayers} players...`);
      }

      // Sort games by date
      games.sort((a, b) => new Date(a.game_date) - new Date(b.game_date));

      for (let i = 15; i < games.length; i++) { // Need at least 15 previous games
        const currentGame = games[i];
        
        // Skip games with insufficient minutes (focus on key contributors)
        const minutes = currentGame.season === '2025' ? currentGame.minutes : currentGame.minutes_played;
        if (!minutes || minutes < 15) continue;

        // Skip games with missing assists data
        if (currentGame.assists === null || currentGame.assists === undefined) continue;

        // Get recent games for feature calculation
        const last5Games = games.slice(Math.max(0, i - 5), i);
        const last15Games = games.slice(Math.max(0, i - 15), i);

        if (last5Games.length < 5) continue;

        // Calculate assists-specific features
        const seasonKey = `${playerName}_${currentGame.season}`;
        const seasonAvg = seasonMap[seasonKey];
        
        // 1. Season Average Assists (handle different column names + imputation)
        let seasonAverageAssists = leagueAverages.assists; // Default to league average
        if (seasonAvg) {
          if (currentGame.season === '2025') {
            seasonAverageAssists = seasonAvg.avg_assists || leagueAverages.assists;
          } else {
            seasonAverageAssists = seasonAvg.assists || leagueAverages.assists; // 2024 uses 'assists' column
          }
        }
        
        // 2. Recent Assist Form Composite (60% last 5 + 40% last 15)
        const recentAssists5 = last5Games.reduce((sum, game) => sum + (game.assists || 0), 0) / last5Games.length;
        const recentAssists15 = last15Games.reduce((sum, game) => sum + (game.assists || 0), 0) / last15Games.length;
        const recentAssistFormComposite = 0.6 * recentAssists5 + 0.4 * recentAssists15;
        
        // 3. Recent Assist Volatility (Standard deviation of last 5 games)
        const recentAssistValues = last5Games.map(game => game.assists || 0);
        const mean = recentAssistValues.reduce((sum, val) => sum + val, 0) / recentAssistValues.length;
        const variance = recentAssistValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentAssistValues.length;
        const recentAssistVolatility = Math.sqrt(variance);
        
        // 4. Assist Percentage (assists / teammate FG attempts)
        let assistPercentage = 0;
        if (seasonAvg) {
          let avgAssists, avgFgAttempts;
          if (currentGame.season === '2025') {
            avgAssists = seasonAvg.avg_assists || 0;
            avgFgAttempts = seasonAvg.avg_field_goals_attempted || 0;
          } else {
            avgAssists = seasonAvg.assists || 0;
            avgFgAttempts = seasonAvg.field_goal_attempted || 0; // 2024 uses 'field_goal_attempted'
          }
          
          if (avgAssists > 0 && avgFgAttempts > 0) {
            const teamFgAttempts = avgFgAttempts * 5; // Approximate team attempts
            assistPercentage = avgAssists / teamFgAttempts;
          }
        }
        
        // Fallback to recent games calculation if season data not available
        if (assistPercentage === 0) {
          const recentAssists = last5Games.reduce((sum, game) => sum + (game.assists || 0), 0);
          const recentFgAttempts = last5Games.reduce((sum, game) => {
            const fga = game.season === '2025' ? game.field_goals_attempted : game.field_goal_attempted;
            return sum + (fga || 0);
          }, 0);
          const teamFgAttempts = recentFgAttempts * 5; // Approximate team attempts
          assistPercentage = teamFgAttempts > 0 ? recentAssists / teamFgAttempts : 0;
        }
        
        // 5. Assist-to-Turnover Ratio
        let assistToTurnoverRatio = 0;
        const recentAssistsTotal = last5Games.reduce((sum, game) => sum + (game.assists || 0), 0);
        const recentTurnovers = last5Games.reduce((sum, game) => sum + (game.turnovers || 0), 0);
        if (recentTurnovers > 0) {
          assistToTurnoverRatio = recentAssistsTotal / recentTurnovers;
        } else if (recentAssistsTotal > 0) {
          assistToTurnoverRatio = recentAssistsTotal; // No turnovers, use assists as ratio
        }
        
        // Player Role and Workload Features (4 features)
        
        // 6. Historical Minutes (average from last 5 games)
        const historicalMinutes = last5Games.reduce((sum, game) => {
          const gameMinutes = game.season === '2025' ? game.minutes : game.minutes_played;
          return sum + (gameMinutes || 0);
        }, 0) / last5Games.length;
        
        // 7. Is Starter (binary flag: 1 if average minutes > 20)
        const isStarter = historicalMinutes > 20 ? 1 : 0;
        
        // 8. Player Position (numeric encoding)
        let playerPosition = 1; // Default to guard
        if (seasonAvg && seasonAvg.position) {
          const pos = seasonAvg.position.toLowerCase();
          if (pos.includes('center') || pos.includes('c')) {
            playerPosition = 3; // Center
          } else if (pos.includes('forward') || pos.includes('f')) {
            playerPosition = 2; // Forward
          } else {
            playerPosition = 1; // Guard (including PG, SG, G)
          }
        }
        
        // 9. Usage Rate
        const usageKey = `${playerName}_${currentGame.season}`;
        let usageRate = 0.2; // Default usage rate
        if (usageMap[usageKey] && usageMap[usageKey] > 0) {
          usageRate = usageMap[usageKey];
        } else {
          // Calculate from recent games if not available
          const recentUsage = last5Games.length > 0 
            ? last5Games.reduce((sum, game) => {
                const gameMinutes = game.season === '2025' ? game.minutes : game.minutes_played;
                const gamePoints = game.points || 0;
                const gameAssists = game.assists || 0;
                const gameRebounds = game.rebounds || 0;
                const gameTurnovers = game.turnovers || 0;
                const gameFga = game.season === '2025' ? game.field_goals_attempted : game.field_goal_attempted;
                const gameFta = game.season === '2025' ? game.free_throws_attempted : game.free_throw_attempted;
                
                if (gameMinutes > 0) {
                  const possessions = (gameFga || 0) + 0.44 * (gameFta || 0) + (gameTurnovers || 0);
                  const usage = possessions / (gameMinutes / 40 * 100); // Approximate team possessions
                  return sum + Math.min(usage, 0.5); // Cap at 50%
                }
                return sum;
              }, 0) / last5Games.length
            : 0.2;
          usageRate = recentUsage;
        }
        
        // Game Context Features (2 features)
        
        // 10. Home/Away (binary flag)
        let homeAway = 0; // Default to away
        if (currentGame.ishome !== undefined) {
          homeAway = currentGame.ishome === true || currentGame.ishome === 1 ? 1 : 0;
        } else if (currentGame.home_away !== undefined) {
          homeAway = currentGame.home_away === 'home' ? 1 : 0;
        }
        
        // 11. Days Rest (log-transformed)
        let daysRestLog = 0;
        if (i > 0) {
          const lastGameDate = new Date(games[i - 1].game_date);
          const currentGameDate = new Date(currentGame.game_date);
          const daysRest = Math.max(0, (currentGameDate - lastGameDate) / (1000 * 60 * 60 * 24));
          daysRestLog = Math.log(daysRest + 1); // Log-transform with +1 to avoid log(0)
        }
        
        // Team and Opponent Pace Features (3 features)
        
        // 12. Team Pace (with proper team mapping and imputation)
        const teamFullName = teamAbbreviationMap[currentGame.team] || currentGame.team;
        const teamPaceKey = `${teamFullName}_${currentGame.season}`;
        const teamPaceData = paceMap[teamPaceKey];
        const teamPace = teamPaceData ? teamPaceData.pace : leagueAverages.pace;
        
        // 13. Opponent Pace (with proper team mapping and imputation)
        const opponentFullName = teamAbbreviationMap[currentGame.opponent] || currentGame.opponent;
        const opponentPaceKey = `${opponentFullName}_${currentGame.season}`;
        const opponentPaceData = paceMap[opponentPaceKey];
        const opponentPace = opponentPaceData ? opponentPaceData.pace : leagueAverages.pace;
        
        // 14. Pace Interaction
        const paceInteraction = teamPace * opponentPace;
        
        // Teammate and Opponent Defensive Features (4 features)
        
        // 15. Teammate Shooting Efficiency (with imputation)
        let teammateShootingEfficiency = leagueAverages.fgPercentage; // Default WNBA average
        // Get teammates' shooting efficiency from season stats
        const teamPlayers = Object.keys(seasonMap).filter(key => {
          const stats = seasonMap[key];
          return stats.team === currentGame.team && key !== seasonKey;
        });
        
        if (teamPlayers.length > 0) {
          const teammateFgPct = teamPlayers.map(key => {
            const stats = seasonMap[key];
            if (currentGame.season === '2025') {
              return stats.avg_field_goal_percentage || leagueAverages.fgPercentage;
            } else {
              return stats.field_goal_percentage || leagueAverages.fgPercentage;
            }
          });
          
          teammateShootingEfficiency = teammateFgPct.reduce((sum, pct) => sum + pct, 0) / teammateFgPct.length;
        }
        
        // 16. Opponent Steal Rate (with imputation)
        const opponentDefenseKey = `${opponentFullName}_${currentGame.season}`;
        const opponentDefenseData = defenseMap[opponentDefenseKey];
        const opponentStealRate = opponentDefenseData?.steals_per_game || leagueAverages.stealRate;
        
        // 17. Opponent Defensive Rating (with imputation)
        let opponentDefensiveRating = leagueAverages.defensiveRating; // Default normalized value
        if (opponentDefenseData) {
          // Use overall defensive rating and normalize (assuming range 80-110)
          const rawRating = opponentDefenseData.points_allowed || 85;
          opponentDefensiveRating = Math.max(0, Math.min(1, (110 - rawRating) / 30)); // Normalize to 0-1
        }
        
        // 18. Teammate Assist Dependency (simplified version)
        let teammateAssistDependency = 0.3; // Default assumption
        // This would require more complex analysis of assist patterns
        // For now, use a proxy based on team assist distribution
        if (seasonAvg) {
          const teamAssists = seasonAvg.team_assists || 0;
          const playerAssists = currentGame.season === '2025' ? 
            (seasonAvg.avg_assists || 0) : (seasonAvg.assists || 0);
          if (teamAssists > 0) {
            teammateAssistDependency = Math.min(1, playerAssists / teamAssists);
          }
        }
        
        // Additional Teammate Efficiency Features (2 features)
        
        // 19. Teammate Rebounding Strength (simplified)
        const teammateReboundingStrength = 35; // Default team rebounding strength
        
        // 20. Lineup Shift Multiplier (simplified)
        const lineupShiftMultiplier = 1.0; // Default no lineup shift
        
        // Injury and Time-Based Features (2 features)
        
        // 21. Injury Status (player + key teammates)
        let injuryStatus = 0; // Default to healthy
        if (injuryMap[playerName]) {
          injuryStatus = 1; // Player is injured
        } else {
          // Check for key teammate injuries (simplified: check if any teammate is injured)
          const injuredTeammates = teamPlayers.filter(key => {
            const teammateName = key.split('_')[0]; // Extract player name from key
            return injuryMap[teammateName];
          });
          if (injuredTeammates.length > 0) {
            injuryStatus = 0.5; // Key teammates injured (partial impact)
          }
        }
        
        // 20. Time Decay Weight (exponential decay based on days since game)
        const gameDate = new Date(currentGame.game_date);
        const currentDate = new Date();
        const daysSinceGame = Math.max(0, (currentDate - gameDate) / (1000 * 60 * 60 * 24));
        const decayRate = 0.0025; // Same as points model (k = 0.0025 for ~277 day half-life)
        const timeDecayWeight = Math.exp(-decayRate * daysSinceGame);
        
        const features = [
          // Player Playmaking Performance (5 features)
          seasonAverageAssists,
          recentAssistFormComposite,
          recentAssistVolatility,
          assistPercentage,
          assistToTurnoverRatio,
          // Player Role and Workload (4 features)
          historicalMinutes,
          isStarter,
          playerPosition,
          usageRate,
          // Game Context (2 features)
          homeAway,
          daysRestLog,
          // Team and Opponent Pace (3 features)
          teamPace,
          opponentPace,
          paceInteraction,
          // Teammate and Opponent Defensive Features (4 features)
          teammateShootingEfficiency,
          opponentStealRate,
          opponentDefensiveRating,
          teammateAssistDependency,
          // Additional Teammate Efficiency Features (2 features)
          teammateReboundingStrength,
          lineupShiftMultiplier,
          // Injury and Time-Based Features (2 features)
          injuryStatus,
          timeDecayWeight
        ];

        // Validate features
        const hasInvalidFeatures = features.some(val => isNaN(val) || !isFinite(val));
        if (hasInvalidFeatures) continue;

        trainingData.push({
          features,
          target: currentGame.assists,
          player: playerName,
          game: currentGame
        });
      }
    }

    console.log(`📊 Prepared ${trainingData.length} training samples`);
    console.log(`   2025 samples: ${trainingData.filter(s => s.game.season === '2025').length}`);
    console.log(`   2024 samples: ${trainingData.filter(s => s.game.season === '2024').length}\n`);

    if (trainingData.length === 0) {
      throw new Error('No valid training data found');
    }

    // Prepare data for training
    const X = trainingData.map(sample => sample.features);
    const y = trainingData.map(sample => sample.target);

    // Feature standardization for better Random Forest performance
    console.log('🔧 Standardizing features...');
    const { standardizedFeatures, means, stds } = standardizeFeatures(X);
    console.log(`   Standardized ${X.length} samples with ${X[0].length} features each`);

    // Split data for validation (80% train, 20% test)
    const splitIndex = Math.floor(trainingData.length * 0.8);
    const XTrain = standardizedFeatures.slice(0, splitIndex);
    const yTrain = y.slice(0, splitIndex);
    const XTest = standardizedFeatures.slice(splitIndex);
    const yTest = y.slice(splitIndex);

    console.log(`🌲 Training Random Forest model with hyperparameter tuning...`);
    console.log(`   Training samples: ${XTrain.length}`);
    console.log(`   Test samples: ${XTest.length}`);
    console.log(`   Features: ${featureNames.length}\n`);

    // Perform hyperparameter tuning
    const { bestModel: randomForest, bestParams, bestScore, results } = await tuneRandomForest(XTrain, yTrain, XTest, yTest, featureNames);

    // Make predictions with best model
    console.log('\n🔮 Making predictions with optimized model...');
    const trainPredictions = randomForest.predict(XTrain);
    const testPredictions = randomForest.predict(XTest);

    // Calculate metrics
    const trainMetrics = calculateMetrics(yTrain, trainPredictions);
    const testMetrics = calculateMetrics(yTest, testPredictions);

    console.log('\n📊 Random Forest Model Performance:');
    console.log(`   Training R² = ${(trainMetrics.r2 * 100).toFixed(1)}%`);
    console.log(`   Training RMSE = ${trainMetrics.rmse.toFixed(2)}`);
    console.log(`   Training MAE = ${trainMetrics.mae.toFixed(2)}`);
    console.log(`   Test R² = ${(testMetrics.r2 * 100).toFixed(1)}%`);
    console.log(`   Test RMSE = ${testMetrics.rmse.toFixed(2)}`);
    console.log(`   Test MAE = ${testMetrics.mae.toFixed(2)}`);

    // Feature importance
    console.log('\n🎯 Top 10 Most Important Features:');
    const importance = randomForest.getFeatureImportance();
    const featureImportance = featureNames.map((name, index) => ({
      name,
      importance: importance[index]
    })).sort((a, b) => b.importance - a.importance);

    featureImportance.slice(0, 10).forEach((feature, index) => {
      console.log(`   ${index + 1}. ${feature.name}: ${(feature.importance * 100).toFixed(2)}%`);
    });

    // Test with sample data
    console.log('\n🧪 Testing with sample data...');
    const sampleIndex = Math.floor(Math.random() * XTest.length);
    const sampleFeatures = XTest[sampleIndex];
    const sampleActual = yTest[sampleIndex];
    const samplePredicted = randomForest.predict([sampleFeatures])[0];
    const samplePlayer = trainingData[splitIndex + sampleIndex].player;
    const sampleGame = trainingData[splitIndex + sampleIndex].game;

    console.log(`   Sample: ${samplePlayer} vs ${sampleGame.opponent} (${sampleGame.season})`);
    console.log(`   Actual: ${sampleActual} assists`);
    console.log(`   Predicted: ${samplePredicted.toFixed(1)} assists`);
    console.log(`   Error: ${Math.abs(sampleActual - samplePredicted).toFixed(1)} assists`);

    // Save optimized model to database
    console.log('\n💾 Saving optimized Random Forest model to database...');
    try {
      // Prepare model data (similar to Linear model structure)
      const modelData = {
        modelType: 'random_forest',
        hyperparameters: bestParams,
        performance: {
          rSquared: testMetrics.r2,
          rmse: testMetrics.rmse,
          mae: testMetrics.mae
        },
        features: featureNames,
        trainingData: {
          total: trainingData.length,
          '2025': trainingData.filter(d => d.game.season === '2025').length,
          '2024': trainingData.filter(d => d.game.season === '2024').length
        },
        trainedAt: new Date().toISOString()
      };
      
      console.log(`   Model ID: RANDOM_FOREST_ASSISTS`);
      console.log(`   Stat Type: assists`);
      console.log(`   Season: 2025`);
      console.log(`   R²: ${testMetrics.r2.toFixed(4)}`);
      console.log(`   RMSE: ${testMetrics.rmse.toFixed(2)}`);
      console.log(`   MAE: ${testMetrics.mae.toFixed(2)}`);
      console.log(`   Training Samples: ${trainingData.length}`);
      
      // Delete existing Random Forest model if it exists
      const { error: deleteError } = await supabase
        .from('regression_models')
        .delete()
        .eq('player_id', 'RANDOM_FOREST_ASSISTS')
        .eq('stat_type', 'assists')
        .eq('season', '2025');

      if (deleteError) {
        console.log(`   ⚠️  Warning deleting existing model: ${deleteError.message}`);
      } else {
        console.log(`   🗑️  Deleted existing Random Forest model successfully`);
      }

      // Save new optimized model
      const { error: insertError } = await supabase
        .from('regression_models')
        .upsert({
          player_id: 'RANDOM_FOREST_ASSISTS',
          stat_type: 'assists',
          season: '2025',
          model_data: modelData,
          r_squared: testMetrics.r2,
          rmse: testMetrics.rmse,
          mae: testMetrics.mae,
          training_samples: trainingData.length,
          created_at: new Date().toISOString()
        }, { onConflict: 'player_id,stat_type,season' });

      if (insertError) {
        console.error(`   ❌ Error saving model: ${insertError.message}`);
        throw insertError;
      }

      console.log(`   ✅ Optimized Random Forest model saved successfully!`);
      console.log(`   📊 Model Performance: R² = ${(testMetrics.r2 * 100).toFixed(1)}%, RMSE = ${testMetrics.rmse.toFixed(2)}, MAE = ${testMetrics.mae.toFixed(2)}`);
      console.log(`   🎯 Best Parameters: ${bestParams.nEstimators} trees, depth ${bestParams.maxDepth}, features ${bestParams.maxFeatures}`);
    } catch (dbError) {
      console.error(`   ❌ Database error: ${dbError.message}`);
      // Don't throw - we still want to show results even if DB save fails
    }

    console.log('\n🎉 Optimized Random Forest Assists Training Complete!');
    console.log('📊 Summary:');
    console.log(`   • Total samples: ${trainingData.length}`);
    console.log(`   • Test R² = ${(testMetrics.r2 * 100).toFixed(1)}%`);
    console.log(`   • Test RMSE = ${testMetrics.rmse.toFixed(2)}`);
    console.log(`   • Test MAE = ${testMetrics.mae.toFixed(2)}`);
    console.log(`   • Optimized Parameters:`);
    console.log(`     - n_estimators: ${bestParams.nEstimators}`);
    console.log(`     - max_depth: ${bestParams.maxDepth}`);
    console.log(`     - min_samples_split: ${bestParams.minSamplesSplit}`);
    console.log(`     - min_samples_leaf: ${bestParams.minSamplesLeaf}`);
    console.log(`     - max_features: ${bestParams.maxFeatures}`);
    console.log(`   • Features: ${featureNames.length} (Player Playmaking Performance + Role and Workload + Game Context + Team Pace + Teammate/Opponent Defense + Injury/Time)`);
    console.log(`   • Player Playmaking Performance Features (5):`);
    console.log(`     - Season Average Assists: Baseline assist production`);
    console.log(`     - Recent Assist Form Composite: 60% L5 + 40% L15 weighted average`);
    console.log(`     - Recent Assist Volatility: Standard deviation of L5 games`);
    console.log(`     - Assist Percentage: Assists relative to teammate FG attempts`);
    console.log(`     - Assist-to-Turnover Ratio: Efficiency in playmaking`);
    console.log(`   • Player Role and Workload Features (4):`);
    console.log(`     - Historical Minutes: Average minutes from last 5 games`);
    console.log(`     - Is Starter: Binary flag (1 if avg minutes > 20)`);
    console.log(`     - Player Position: Numeric encoding (3=Center, 2=Forward, 1=Guard)`);
    console.log(`     - Usage Rate: Ball-handling frequency and playmaking opportunities`);
    console.log(`   • Game Context Features (2):`);
    console.log(`     - Home/Away: Binary flag (1=home, 0=away) for team chemistry effects`);
    console.log(`     - Days Rest Log: Log-transformed days since last game for fatigue effects`);
    console.log(`   • Team and Opponent Pace Features (3):`);
    console.log(`     - Team Pace: Raw possessions per game (WNBA avg ~95)`);
    console.log(`     - Opponent Pace: Opponent's possessions per game`);
    console.log(`     - Pace Interaction: Team Pace × Opponent Pace for overall game speed`);
    console.log(`   • Teammate and Opponent Defensive Features (4):`);
    console.log(`     - Teammate Shooting Efficiency: Average FG% of teammates (assist conversion)`);
    console.log(`     - Opponent Steal Rate: Opponent steals per game (pass disruption)`);
    console.log(`     - Opponent Defensive Rating: Normalized opponent defensive strength`);
    console.log(`     - Teammate Assist Dependency: Player's assist share of team total`);
    console.log(`   • Injury and Time-Based Features (2):`);
    console.log(`     - Injury Status: Player injury (1) + teammate injuries (0.5) + healthy (0)`);
    console.log(`     - Time Decay Weight: Exponential decay based on days since game (recent games weighted more)`);
    console.log(`\n📊 Data Quality and Preprocessing:`);
    console.log(`   • Filters: Games with >15 minutes played, valid assist data`);
    console.log(`   • Missing Data Imputation: League averages (4 assists/game, 95 pace, 8% steal rate, 45% FG%)`);
    console.log(`   • Feature Scaling: StandardScaler applied for Random Forest optimization`);
    console.log(`   • Team Mapping: Consistent abbreviation mapping (LVA→Las Vegas Aces, etc.)`);
    console.log(`   • Data Validation: NaN and infinite value filtering`);

  } catch (error) {
    console.error('❌ Error training Random Forest assists model:', error);
    throw error;
  }
}

// Run the training
if (require.main === module) {
  trainRandomForestAssistsModel()
    .then(() => {
      console.log('\n🚀 Random Forest assists model training completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Training failed:', error);
      process.exit(1);
    });
}

module.exports = { trainRandomForestAssistsModel, RandomForest, calculateMetrics };
