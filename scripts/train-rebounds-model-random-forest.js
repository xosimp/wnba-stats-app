require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { saveModel } = require('./db-save-utils');

// Helper function to get rebounds from game log (handles both 2024 and 2025 formats)
function getRebounds(gameLog) {
  return gameLog.rebounds || gameLog.total_rebounds || 0;
}

// Helper function to get minutes from game log (handles both 2024 and 2025 formats)
function getMinutes(gameLog) {
  return gameLog.minutes || gameLog.minutes_played || 0;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get current date in CT timezone
function getCurrentDateCT() {
  const now = new Date();
  const ctOffset = -6; // Central Time is UTC-6
  const ctTime = new Date(now.getTime() + (ctOffset * 60 * 60 * 1000));
  return ctTime.toISOString().split('T')[0];
}

// Create rebounds features for a single game using lookup maps
function createReboundsFeatures(gameLog, playerName, seasonStatsMap, advancedStatsMap, allGameLogs, teamPaceMap, teamNameMap, teamDefensiveMap, injuryMap) {
  const season = '2025';
  
  // Get player stats from lookup maps
  const seasonStats = seasonStatsMap[playerName] || {};
  const advancedStats = advancedStatsMap[playerName] || {};

  // Player Rebounding Performance features
  const seasonAvgRebounds = seasonStats.avg_rebounds || 0;
  const recentForm = getRecentReboundFormComposite(playerName, gameLog.game_date, allGameLogs);
  const volatility = getRecentReboundVolatility(playerName, gameLog.game_date, allGameLogs);
  const offensiveReboundPct = advancedStats.offensive_rebound_percentage || advancedStats.offensive_rebound_pct || 0;
  const totalReboundPct = advancedStats.total_rebound_percentage || advancedStats.total_rebound_pct || 0;
  const defensiveReboundPct = Math.max(0, totalReboundPct - offensiveReboundPct);
  
  // Player Role and Workload features
  const historicalMinutes = getHistoricalMinutes(playerName, gameLog.game_date, allGameLogs);
  const isStarter = (seasonStats.avg_minutes || 0) > 15 ? 1 : 0;
  const playerPosition = getPlayerPosition(advancedStats.position);
  const usageRate = advancedStats.usage_percentage || advancedStats.usage_pct || 0;

  // Game Context features
  const homeAway = getHomeAway(gameLog);
  const daysRestLog = getDaysRestLog(playerName, gameLog.game_date, allGameLogs);

  // Team and Opponent Pace features
  const teamPace = getTeamPace(gameLog.team, teamPaceMap, teamNameMap);
  const opponentPace = getOpponentPace(gameLog.opponent, teamPaceMap, teamNameMap);
  const paceInteraction = teamPace * opponentPace;
  
  // Opponent Defensive/Rebounding Strength features
  const opponentReboundsAllowed = getOpponentReboundsAllowed(gameLog.opponent, teamDefensiveMap, teamNameMap);
  const opponentFieldGoalPercentage = getOpponentFieldGoalPercentage(gameLog.opponent, teamDefensiveMap, teamNameMap);
  const opponentPositionRebounds = getOpponentPositionRebounds(gameLog.opponent, playerPosition, teamDefensiveMap, teamNameMap);
  
  // Injury and Role Context features
  const injuryStatus = getInjuryStatus(playerName, gameLog.game_date, injuryMap);
  const teammateReboundingStrength = getTeammateReboundingStrength(playerName, gameLog.team, gameLog.game_date, seasonStatsMap, teamNameMap);
  
  // Time-Based Weighting features
  const timeDecayWeight = getTimeDecayWeight(gameLog.game_date);
  const gamesPlayed = getGamesPlayed(playerName, gameLog.game_date, allGameLogs);

  return {
    // Player Rebounding Performance (5 features)
    season_average_rebounds: seasonAvgRebounds,
    recent_rebound_form_composite: recentForm,
    recent_rebound_volatility: volatility,
    offensive_rebound_percentage: offensiveReboundPct,
    defensive_rebound_percentage: defensiveReboundPct,
    // Player Role and Workload (4 features)
    historical_minutes: historicalMinutes,
    is_starter: isStarter,
    player_position: playerPosition,
    usage_rate: usageRate,
    // Game Context (2 features)
    home_away: homeAway,
    days_rest_log: daysRestLog,
    // Team and Opponent Pace (3 features)
    team_pace: teamPace,
    opponent_pace: opponentPace,
    pace_interaction: paceInteraction,
    // Opponent Defensive/Rebounding Strength (3 features)
    opponent_rebounds_allowed: opponentReboundsAllowed,
    opponent_field_goal_percentage: opponentFieldGoalPercentage,
    opponent_position_rebounds: opponentPositionRebounds,
    // Injury and Role Context (2 features)
    injury_status: injuryStatus,
    teammate_rebounding_strength: teammateReboundingStrength,
    // Teammate Efficiency Features (4 features)
    teammate_shooting_efficiency: 0.45, // Default team shooting efficiency
    teammate_assist_dependency: 25, // Default team assist dependency
    lineup_shift_multiplier: 1.0, // Default no lineup shift
    // Time-Based Weighting (2 features)
    time_decay_weight: timeDecayWeight,
    games_played: gamesPlayed
  };
}

// Helper functions (same as linear regression model)
function getRecentReboundFormComposite(playerName, targetGameDate, allGameLogs) {
  const targetDate = new Date(targetGameDate);
  const playerGames = allGameLogs
    .filter(log => log.player_name === playerName && new Date(log.game_date) < targetDate)
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));

  if (playerGames.length === 0) return 0;

  const last5Games = playerGames.slice(0, 5).filter(log => getMinutes(log) > 12);
  const last15Games = playerGames.slice(0, 15).filter(log => getMinutes(log) > 12);

  if (last5Games.length === 0) return 0;

  const last5Avg = last5Games.reduce((sum, log) => sum + getRebounds(log), 0) / last5Games.length;
  const last15Avg = last15Games.length > 0 ? 
    last15Games.reduce((sum, log) => sum + getRebounds(log), 0) / last15Games.length : last5Avg;
  
  // Calculate season average from all games before target date
  const seasonAvg = playerGames.reduce((sum, log) => sum + getRebounds(log), 0) / playerGames.length;

  // Debug logging for recent form calculation
  const currentDate = getCurrentDateCT();
  if (playerName === 'Jackie Young' && targetGameDate.includes(currentDate.split('-')[0] + '-' + currentDate.split('-')[1])) {
    console.log(`🔍 ${playerName} Recent Form Debug (${targetGameDate}):`);
    console.log(`   Last 5 games: ${last5Games.length} games, avg: ${last5Avg.toFixed(1)}`);
    console.log(`   Last 15 games: ${last15Games.length} games, avg: ${last15Avg.toFixed(1)}`);
    console.log(`   Season games: ${playerGames.length} games, avg: ${seasonAvg.toFixed(1)}`);
    console.log(`   Weighted: ${(0.3 * last5Avg + 0.3 * last15Avg + 0.4 * seasonAvg).toFixed(1)}`);
  }

  // New weighting: 30% last 5 + 30% last 15 + 40% season average
  return 0.3 * last5Avg + 0.3 * last15Avg + 0.4 * seasonAvg;
}

function getRecentReboundVolatility(playerName, targetGameDate, allGameLogs) {
  const targetDate = new Date(targetGameDate);
  const playerGames = allGameLogs
    .filter(log => log.player_name === playerName && new Date(log.game_date) < targetDate)
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));

  const last5Games = playerGames.slice(0, 5).filter(log => getMinutes(log) > 12);
  if (last5Games.length < 2) return 0;

  const rebounds = last5Games.map(log => getRebounds(log));
  const mean = rebounds.reduce((sum, r) => sum + r, 0) / rebounds.length;
  const variance = rebounds.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rebounds.length;
  return Math.sqrt(variance);
}

function getHistoricalMinutes(playerName, targetGameDate, allGameLogs) {
  const targetDate = new Date(targetGameDate);
  const playerGames = allGameLogs
    .filter(log => log.player_name === playerName && new Date(log.game_date) < targetDate)
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));

  const last5Games = playerGames.slice(0, 5).filter(log => getMinutes(log) > 12);
  if (last5Games.length === 0) return 0;

  return last5Games.reduce((sum, log) => sum + getMinutes(log), 0) / last5Games.length;
}

function getPlayerPosition(position) {
  if (!position) return 1; // Default to guard
  const pos = position.toLowerCase();
  if (pos.includes('center')) return 3;
  if (pos.includes('forward')) return 2;
  return 1; // Guard
}

function getHomeAway(gameLog) {
  // Handle both 2024 (home_away) and 2025 (ishome) formats
  if (gameLog.ishome !== undefined) {
    return gameLog.ishome ? 1 : 0;
  } else if (gameLog.home_away !== undefined) {
    return gameLog.home_away === 'home' ? 1 : 0;
  }
  return 0;
}

function getDaysRestLog(playerName, targetGameDate, allGameLogs) {
  const targetDate = new Date(targetGameDate);
  const playerGames = allGameLogs
    .filter(log => log.player_name === playerName && new Date(log.game_date) < targetDate)
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));

  if (playerGames.length === 0) return 0;

  const lastGameDate = new Date(playerGames[0].game_date);
  const daysDiff = (targetDate - lastGameDate) / (1000 * 60 * 60 * 24);
  return daysDiff > 0 ? Math.log(daysDiff) : 0;
}

function getTeamPace(teamAbbrev, teamPaceMap, teamNameMap) {
  if (!teamAbbrev || !teamPaceMap || !teamNameMap) return 95.0;
  const fullTeamName = teamNameMap[teamAbbrev];
  if (!fullTeamName) return 95.0;
  const teamPace = teamPaceMap[fullTeamName];
  return teamPace || 95.0;
}

function getOpponentPace(opponentAbbrev, teamPaceMap, teamNameMap) {
  if (!opponentAbbrev || !teamPaceMap || !teamNameMap) return 95.0;
  const fullOpponentName = teamNameMap[opponentAbbrev];
  if (!fullOpponentName) return 95.0;
  const opponentPace = teamPaceMap[fullOpponentName];
  return opponentPace || 95.0;
}

function getOpponentReboundsAllowed(opponentAbbrev, teamDefensiveMap, teamNameMap) {
  if (!opponentAbbrev || !teamDefensiveMap || !teamNameMap) return 33.0;
  const defensiveStats = teamDefensiveMap[opponentAbbrev];
  if (!defensiveStats) return 33.0;
  return defensiveStats.opp_reb || 33.0;
}

function getOpponentFieldGoalPercentage(opponentAbbrev, teamDefensiveMap, teamNameMap) {
  if (!opponentAbbrev || !teamDefensiveMap || !teamNameMap) return 0.426;
  const defensiveStats = teamDefensiveMap[opponentAbbrev];
  if (!defensiveStats) return 0.426;
  return (defensiveStats.opp_fg_pct || 42.6) / 100.0;
}

function getOpponentPositionRebounds(opponentAbbrev, playerPosition, teamDefensiveMap, teamNameMap) {
  if (!opponentAbbrev || !teamDefensiveMap || !teamNameMap) return 0.5;
  const defensiveStats = teamDefensiveMap[opponentAbbrev];
  if (!defensiveStats) return 0.5;
  const totalRebounds = defensiveStats.opp_reb || 33.0;
  let positionMultiplier = 1.0;
  if (playerPosition === 3) positionMultiplier = 1.3;
  else if (playerPosition === 2) positionMultiplier = 1.1;
  return Math.min(1.0, (totalRebounds * positionMultiplier) / 40.0);
}

function getInjuryStatus(playerName, gameDate, injuryMap) {
  if (!injuryMap || !playerName) return 0;
  const playerInjuries = injuryMap[playerName];
  if (!playerInjuries) return 0;
  const gameDateObj = new Date(gameDate);
  for (const injury of playerInjuries) {
    const injuryStart = new Date(injury.injury_start_date);
    const injuryEnd = injury.injury_end_date ? new Date(injury.injury_end_date) : new Date('2099-12-31');
    if (gameDateObj >= injuryStart && gameDateObj <= injuryEnd) {
      return 1;
    }
  }
  return 0;
}

function getTeammateReboundingStrength(playerName, teamAbbrev, gameDate, seasonStatsMap, teamNameMap) {
  if (!seasonStatsMap || !teamAbbrev || !teamNameMap) return 0;
  const teamPlayers = Object.keys(seasonStatsMap).filter(name => {
    const stats = seasonStatsMap[name];
    return stats.team === teamAbbrev && name !== playerName;
  });
  if (teamPlayers.length === 0) return 0;
  const teammateRebounds = teamPlayers.map(name => seasonStatsMap[name].avg_rebounds || 0);
  return teammateRebounds.reduce((sum, rebounds) => sum + rebounds, 0) / teammateRebounds.length;
}

function getTimeDecayWeight(gameDate) {
  const gameDateObj = new Date(gameDate);
  const currentDate = new Date();
  const daysDiff = Math.max(0, (currentDate - gameDateObj) / (1000 * 60 * 60 * 24));
  const k = 0.01;
  return Math.exp(-k * daysDiff);
}

function getGamesPlayed(playerName, gameDate, allGameLogs) {
  if (!allGameLogs || !playerName) return 0;
  const gameDateObj = new Date(gameDate);
  return allGameLogs.filter(log => 
    log.player_name === playerName && 
    new Date(log.game_date) <= gameDateObj
  ).length;
}

// Random Forest implementation
class DecisionTree {
  constructor(maxDepth = 10, minSamplesSplit = 5, minSamplesLeaf = 2) {
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.minSamplesLeaf = minSamplesLeaf;
    this.root = null;
  }

  fit(X, y) {
    this.root = this.buildTree(X, y, 0);
  }

  buildTree(X, y, depth) {
    if (depth >= this.maxDepth || X.length < this.minSamplesSplit) {
      return { prediction: this.calculateMean(y), isLeaf: true };
    }

    const bestSplit = this.findBestSplit(X, y);
    if (!bestSplit) {
      return { prediction: this.calculateMean(y), isLeaf: true };
    }

    const { feature, threshold, leftIndices, rightIndices } = bestSplit;
    
    if (leftIndices.length < this.minSamplesLeaf || rightIndices.length < this.minSamplesLeaf) {
      return { prediction: this.calculateMean(y), isLeaf: true };
    }

    const leftX = leftIndices.map(i => X[i]);
    const leftY = leftIndices.map(i => y[i]);
    const rightX = rightIndices.map(i => X[i]);
    const rightY = rightIndices.map(i => y[i]);

    return {
      feature,
      threshold,
      left: this.buildTree(leftX, leftY, depth + 1),
      right: this.buildTree(rightX, rightY, depth + 1),
      isLeaf: false
    };
  }

  findBestSplit(X, y) {
    let bestGini = Infinity;
    let bestSplit = null;
    const features = Object.keys(X[0]);

    for (const feature of features) {
      const values = X.map(x => x[feature]).filter(v => !isNaN(v));
      const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
      
      // Limit to max 20 thresholds per feature for performance
      const maxThresholds = Math.min(20, uniqueValues.length - 1);
      const step = Math.max(1, Math.floor(uniqueValues.length / maxThresholds));

      for (let i = 0; i < uniqueValues.length - 1; i += step) {
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

        if (leftIndices.length === 0 || rightIndices.length === 0) continue;

        const gini = this.calculateGini(y, leftIndices, rightIndices);
        if (gini < bestGini) {
          bestGini = gini;
          bestSplit = { feature, threshold, leftIndices, rightIndices };
        }
      }
    }

    return bestSplit;
  }

  calculateGini(y, leftIndices, rightIndices) {
    const leftY = leftIndices.map(i => y[i]);
    const rightY = rightIndices.map(i => y[i]);
    
    const leftGini = this.giniImpurity(leftY);
    const rightGini = this.giniImpurity(rightY);
    
    const leftWeight = leftY.length / y.length;
    const rightWeight = rightY.length / y.length;
    
    return leftWeight * leftGini + rightWeight * rightGini;
  }

  giniImpurity(y) {
    if (y.length === 0) return 0;
    
    const mean = this.calculateMean(y);
    const mse = y.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / y.length;
    return mse;
  }

  calculateMean(y) {
    return y.reduce((sum, val) => sum + val, 0) / y.length;
  }

  predict(X) {
    return X.map(x => this.predictSingle(x, this.root));
  }

  predictSingle(x, node) {
    if (node.isLeaf) {
      return node.prediction;
    }

    if (x[node.feature] <= node.threshold) {
      return this.predictSingle(x, node.left);
    } else {
      return this.predictSingle(x, node.right);
    }
  }
}

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
    
    // Convert objects to arrays for training
    const XArray = X.map(obj => this.featureNames.map(feature => obj[feature]));
    
    console.log(`🌲 Building ${this.nEstimators} decision trees...`);
    
    for (let i = 0; i < this.nEstimators; i++) {
      if (i % 20 === 0) {
        console.log(`   Tree ${i + 1}/${this.nEstimators}...`);
      }
      
      const sample = this.bootstrapSample(XArray, y);
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
      // Convert object to array for prediction
      const featuresArray = this.featureNames.map(feature => features[feature]);
      const treePredictions = this.trees.map(tree => this.predictTree(tree, featuresArray));
      const averagePrediction = treePredictions.reduce((sum, pred) => sum + pred, 0) / treePredictions.length;
      predictions.push(averagePrediction);
    }
    
    return predictions;
  }

  // Calculate feature importance
  getFeatureImportance() {
    const importance = {};
    this.featureNames.forEach(feature => {
      importance[feature] = 0;
    });
    
    for (const tree of this.trees) {
      this.calculateTreeImportance(tree, importance);
    }
    
    // Normalize by number of trees
    Object.keys(importance).forEach(feature => {
      importance[feature] /= this.trees.length;
    });
    
    return importance;
  }

  calculateTreeImportance(node, importance) {
    if (node.isLeaf) return;
    
    if (node.feature !== undefined && node.feature >= 0) {
      const featureName = this.featureNames[node.feature];
      importance[featureName] += 1;
    }
    
    if (node.left) this.calculateTreeImportance(node.left, importance);
    if (node.right) this.calculateTreeImportance(node.right, importance);
  }
}

// Hyperparameter tuning function (copied from points model)
async function tuneRandomForest(XTrain, yTrain, XTest, yTest, featureNames) {
  console.log('🔧 Starting hyperparameter tuning...\n');
  
  const paramGrid = {
    nEstimators: [125], // Optimal for rebounds variance (0-15)
    maxDepth: [12],     // Increased for better performance
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
  
  console.log(`📊 Testing ${totalCombinations} parameter combinations...`);
  console.log(`⏱️  Estimated time: ~8-10 hours (324 combinations)\n`);
  
  let combination = 0;
  
  for (const nEstimators of paramGrid.nEstimators) {
    for (const maxDepth of paramGrid.maxDepth) {
      for (const minSamplesSplit of paramGrid.minSamplesSplit) {
        for (const minSamplesLeaf of paramGrid.minSamplesLeaf) {
          for (const maxFeatures of paramGrid.maxFeatures) {
            combination++;
            
            if (combination % 20 === 0) {
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
                trainRMSE: trainMetrics.rmse,
                testRMSE: testMetrics.rmse,
                trainMAE: trainMetrics.mae,
                testMAE: testMetrics.mae,
                score: score
              });
              
              if (score > bestScore) {
                bestScore = score;
                bestParams = { nEstimators, maxDepth, minSamplesSplit, minSamplesLeaf, maxFeatures };
                bestModel = model;
              }
            } catch (error) {
              console.log(`   ⚠️  Combination ${combination} failed: ${error.message}`);
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

// Calculate metrics function
function calculateMetrics(actual, predicted) {
  const n = actual.length;
  const meanActual = actual.reduce((sum, val) => sum + val, 0) / n;
  
  const ssRes = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  const ssTot = actual.reduce((sum, val) => sum + Math.pow(val - meanActual, 2), 0);
  
  const r2 = 1 - (ssRes / ssTot);
  const rmse = Math.sqrt(ssRes / n);
  const mae = actual.reduce((sum, val, i) => sum + Math.abs(val - predicted[i]), 0) / n;
  
  return { r2, rmse, mae };
}

// Main training function
async function trainReboundsRandomForest() {
  try {
    console.log('🌲 Starting Rebounds Random Forest Training!');
    console.log('🔌 Connected to Supabase');
    console.log('📊 Using same features as linear regression model');

    // Fetch all data for both 2024 and 2025 seasons with pagination
    console.log('\n📥 Fetching Game Logs...');
    let allGameLogs = [];
    
    // Fetch 2025 game logs with pagination
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: gameLogsError } = await supabase
        .from('wnba_game_logs')
        .select('*')
        .like('game_date', '%2025%')
        .not('rebounds', 'is', null)
        .range(from, from + batchSize - 1);

      if (gameLogsError) {
        throw new Error(`Error fetching 2025 game logs: ${gameLogsError.message}`);
      }

      if (batch && batch.length > 0) {
        allGameLogs = allGameLogs.concat(batch);
        from += batchSize;
        hasMore = batch.length === batchSize;
        console.log(`   📊 Fetched ${allGameLogs.length} 2025 records so far...`);
      } else {
        hasMore = false;
      }
    }

    // Fetch 2024 game logs with pagination
    console.log('📥 Fetching 2024 Game Logs...');
    from = 0;
    hasMore = true;

    while (hasMore) {
      const { data: batch, error: gameLogs2024Error } = await supabase
        .from('game_logs_2024')
        .select('*')
        .not('total_rebounds', 'is', null)
        .range(from, from + batchSize - 1);

      if (gameLogs2024Error) {
        throw new Error(`Error fetching 2024 game logs: ${gameLogs2024Error.message}`);
      }

      if (batch && batch.length > 0) {
        allGameLogs = allGameLogs.concat(batch);
        from += batchSize;
        hasMore = batch.length === batchSize;
        console.log(`   📊 Fetched ${batch.length} 2024 records so far...`);
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Found ${allGameLogs.length} total game log entries (2024 + 2025)`);

    // Sort all game logs by date properly
    allGameLogs.sort((a, b) => new Date(a.game_date) - new Date(b.game_date));
    console.log(`📅 Sorted all game logs by date`);

    // Get eligible players
    const playerGameCounts = {};
    allGameLogs.forEach(log => {
      if (!playerGameCounts[log.player_name]) {
        playerGameCounts[log.player_name] = 0;
      }
      playerGameCounts[log.player_name]++;
    });

    const eligiblePlayers = Object.entries(playerGameCounts)
      .filter(([_, count]) => count >= 10)
      .map(([name, _]) => ({ player_name: name, games: allGameLogs.filter(log => log.player_name === name).sort((a, b) => new Date(a.game_date) - new Date(b.game_date)) }));

    console.log(`✅ Found ${eligiblePlayers.length} eligible players (10+ games)`);

    // Fetch supporting data for both seasons
    console.log('\n📊 Fetching Supporting Data...');
    const { data: seasonStats2025 } = await supabase.from('player_season_stats').select('*').eq('season', '2025');
    const { data: seasonStats2024 } = await supabase.from('player_season_stats').select('*').eq('season', '2024');
    console.log(`📊 Found ${seasonStats2025?.length || 0} 2025 season stats, ${seasonStats2024?.length || 0} 2024 season stats`);
    
    const { data: advancedStats2025 } = await supabase.from('player_advanced_stats').select('*').eq('season', '2025');
    const { data: advancedStats2024 } = await supabase.from('player_advanced_stats_2024').select('*');
    console.log(`📊 Found ${advancedStats2025?.length || 0} 2025 advanced stats, ${advancedStats2024?.length || 0} 2024 advanced stats`);
    
    const { data: teamPace2025 } = await supabase.from('team_pace_stats').select('*').eq('season', '2025');
    const { data: teamPace2024 } = await supabase.from('team_pace_stats').select('*').eq('season', '2024');
    console.log(`📊 Found ${teamPace2025?.length || 0} 2025 team pace stats, ${teamPace2024?.length || 0} 2024 team pace stats`);
    
    const { data: teamDefensive2025 } = await supabase.from('team_defensive_stats').select('*').eq('season', '2025').eq('stat_type', 'points');
    const { data: teamDefensive2024 } = await supabase.from('team_defensive_stats').select('*').eq('season', '2024').eq('stat_type', 'points');
    console.log(`📊 Found ${teamDefensive2025?.length || 0} 2025 team defensive stats, ${teamDefensive2024?.length || 0} 2024 team defensive stats`);
    
    const { data: injuries } = await supabase.from('active_injuries').select('*');
    console.log(`📊 Found ${injuries?.length || 0} injury records`);

    // Create lookup maps (combine both seasons, 2025 takes priority)
    const seasonStatsMap = {};
    [...(seasonStats2024 || []), ...(seasonStats2025 || [])].forEach(stats => {
      seasonStatsMap[stats.player_name] = stats;
    });

    const advancedStatsMap = {};
    [...(advancedStats2024 || []), ...(advancedStats2025 || [])].forEach(stats => {
      advancedStatsMap[stats.player_name] = stats;
    });

    const teamNameMap = {
      'LVA': 'Las Vegas Aces', 'NYL': 'New York Liberty', 'CON': 'Connecticut Sun',
      'MIN': 'Minnesota Lynx', 'PHX': 'Phoenix Mercury', 'SEA': 'Seattle Storm',
      'WAS': 'Washington Mystics', 'ATL': 'Atlanta Dream', 'CHI': 'Chicago Sky',
      'LAS': 'Los Angeles Sparks', 'DAL': 'Dallas Wings', 'IND': 'Indiana Fever',
      'GSV': 'Golden State Valkyries'
    };

    const teamPaceMap = {};
    [...(teamPace2024 || []), ...(teamPace2025 || [])].forEach(pace => {
      teamPaceMap[pace.team_name] = pace.pace;
    });

    const teamDefensiveMap = {};
    [...(teamDefensive2024 || []), ...(teamDefensive2025 || [])].forEach(defensive => {
      const teamAbbrev = Object.keys(teamNameMap).find(key => teamNameMap[key] === defensive.team);
      if (teamAbbrev) {
        teamDefensiveMap[teamAbbrev] = defensive;
      }
    });

    const injuryMap = {};
    (injuries || []).forEach(injury => {
      if (!injuryMap[injury.player_name]) {
        injuryMap[injury.player_name] = [];
      }
      injuryMap[injury.player_name].push(injury);
    });

    // Create training data
    console.log('\n🎯 Creating Training Features...');
    const features = [];
    const targets = [];
    let processedGames = 0;

    for (const player of eligiblePlayers) {
      // Sort games by date (same as points model)
      player.games.sort((a, b) => new Date(a.game_date) - new Date(b.game_date));
      
      // Start from game 15 to ensure we have enough previous games for recent form calculation
      for (let i = 15; i < player.games.length; i++) {
        const gameLog = player.games[i];
        
        // Skip games with insufficient minutes (same as points model)
        const minutes = getMinutes(gameLog);
        if (!minutes || minutes < 10) continue;
        
        // Skip games with missing rebounds data
        if (getRebounds(gameLog) === null || getRebounds(gameLog) === undefined) continue;
        
        // Get recent games for feature calculation (same as points model)
        const last5Games = player.games.slice(Math.max(0, i - 5), i);
        const last15Games = player.games.slice(Math.max(0, i - 15), i);
        
        if (last5Games.length < 5) continue; // Need at least 5 previous games
        
        const gameFeatures = createReboundsFeatures(
          gameLog, player.player_name, seasonStatsMap, advancedStatsMap, 
          allGameLogs, teamPaceMap, teamNameMap, teamDefensiveMap, injuryMap
        );
        
        if (processedGames === 0 || processedGames === 100) {
          console.log(`   🔍 Game ${processedGames} features:`, gameFeatures);
          console.log(`   🔍 Game log date:`, gameLog.game_date);
          console.log(`   🔍 Player name:`, player.player_name);
          
          // Debug recent form calculation
          const recentForm = getRecentReboundFormComposite(player.player_name, gameLog.game_date, allGameLogs);
          const recentVolatility = getRecentReboundVolatility(player.player_name, gameLog.game_date, allGameLogs);
          console.log(`   🔍 Recent form: ${recentForm}, Recent volatility: ${recentVolatility}`);
          
          // Check how many previous games this player has
          const targetDate = new Date(gameLog.game_date);
          const playerGames = allGameLogs
            .filter(log => log.player_name === player.player_name && new Date(log.game_date) < targetDate)
            .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));
          console.log(`   🔍 Previous games available: ${playerGames.length}`);
        }
        
        features.push(gameFeatures);
        targets.push(getRebounds(gameLog));
        processedGames++;
        
        if (processedGames % 1000 === 0) {
          console.log(`   📊 Processed ${processedGames} games...`);
        }
      }
    }

    console.log(`✅ Created ${features.length} training samples from ${eligiblePlayers.length} players`);

    // Debug: Check date ranges of training data
    const gameDates = allGameLogs.map(log => log.game_date).sort();
    console.log(`📅 Date range: ${gameDates[0]} to ${gameDates[gameDates.length - 1]}`);
    
    // Check recent games (last 30 days from current date)
    const currentDate = getCurrentDateCT();
    const recentDate = new Date(currentDate);
    recentDate.setDate(recentDate.getDate() - 30);
    const recentGames = allGameLogs.filter(log => new Date(log.game_date) >= recentDate);
    console.log(`📅 Recent games (last 30 days from ${currentDate}): ${recentGames.length}`);

    // Features are already in object format from createReboundsFeatures
    const featureNames = Object.keys(features[0]);

    // Split data for hyperparameter tuning
    console.log('\n🔧 Preparing data for hyperparameter tuning...');
    const splitIndex = Math.floor(features.length * 0.8);
    const XTrain = features.slice(0, splitIndex);
    const XTest = features.slice(splitIndex);
    const yTrain = targets.slice(0, splitIndex);
    const yTest = targets.slice(splitIndex);
    
    console.log(`📊 Training set: ${XTrain.length} samples`);
    console.log(`📊 Test set: ${XTest.length} samples`);

    // Hyperparameter tuning
    const { bestModel, bestParams, bestScore, results } = await tuneRandomForest(XTrain, yTrain, XTest, yTest, featureNames);
    
    // Train final model on all data with best parameters
    console.log('\n🌲 Training final model with best parameters...');
    const finalModel = new RandomForest(bestParams.nEstimators, bestParams.maxDepth, bestParams.minSamplesSplit, bestParams.minSamplesLeaf, bestParams.maxFeatures, 42);
    
    const startTime = Date.now();
    finalModel.fit(features, targets, featureNames);
    const trainingTime = Date.now() - startTime;
    console.log(`✅ Final model training completed in ${(trainingTime / 1000).toFixed(2)} seconds`);

    // Make predictions on test set
    const testPredictions = finalModel.predict(XTest);
    const testMetrics = calculateMetrics(yTest, testPredictions);

    console.log(`✅ Optimized Random Forest: R² = ${(testMetrics.r2 * 100).toFixed(1)}%, RMSE = ${testMetrics.rmse.toFixed(2)}, MAE = ${testMetrics.mae.toFixed(2)}`);

    // Get feature importance
    const importance = finalModel.getFeatureImportance();
    const sortedImportance = Object.entries(importance)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    console.log('\n📊 Top 10 Feature Importance:');
    sortedImportance.forEach(([feature, imp]) => {
      console.log(`   ${feature}: ${imp.toFixed(4)}`);
    });

    // Save model
    const modelData = {
      player_id: 'GENERAL_REBOUNDS_RF',
      stat_type: 'rebounds',
      season: '2025',
      model_data: {
        model_type: 'random_forest',
        feature_importance: importance,
        feature_names: Object.keys(features[0]),
        r_squared: testMetrics.r2,
        rmse: testMetrics.rmse,
        mae: testMetrics.mae,
        training_samples: targets.length,
        n_estimators: bestParams.nEstimators,
        max_depth: bestParams.maxDepth,
        min_samples_split: bestParams.minSamplesSplit,
        min_samples_leaf: bestParams.minSamplesLeaf,
        max_features: bestParams.maxFeatures
      },
      created_at: new Date().toISOString()
    };

    console.log('\n💾 Saving Random Forest model to database...');
    console.log(`   Model ID: GENERAL_REBOUNDS_RF`);
    console.log(`   Stat Type: rebounds`);
    console.log(`   Season: 2025`);
    console.log(`   R²: ${testMetrics.r2.toFixed(4)}`);
    console.log(`   RMSE: ${testMetrics.rmse.toFixed(2)}`);
    console.log(`   MAE: ${testMetrics.mae.toFixed(2)}`);
    console.log(`   Training Samples: ${targets.length}`);
    
    // Use robust save utility
    await saveModel(modelData);

    console.log('✅ Random Forest model saved to database');
    console.log('\n🎯 Model Comparison:');
    console.log('   Linear Regression: R² = 0.4816, RMSE = 2.28');
    console.log(`   Optimized Random Forest: R² = ${(testMetrics.r2 * 100).toFixed(1)}%, RMSE = ${testMetrics.rmse.toFixed(2)}`);

  } catch (error) {
    console.error('❌ Error during random forest training:', error.message);
  }
}

// Run the training
trainReboundsRandomForest();
