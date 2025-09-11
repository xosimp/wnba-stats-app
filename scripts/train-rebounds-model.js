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
function getCurrentDate() {
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
  
  // Additional rebounding features for better performance (skip if no variance)
  // const defensiveReboundPercentage = advancedStats.defensive_rebound_percentage || 0;
  
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

  return [
    // Player Rebounding Performance (5 features)
    seasonAvgRebounds,
    recentForm,
    volatility,
    offensiveReboundPct,
    defensiveReboundPct,
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
    // Opponent Defensive/Rebounding Strength (3 features)
    opponentReboundsAllowed,
    opponentFieldGoalPercentage,
    opponentPositionRebounds,
    // Injury and Role Context (2 features)
    injuryStatus,
    teammateReboundingStrength,
    // Time-Based Weighting (2 features)
    timeDecayWeight,
    gamesPlayed
  ];
}

// Helper function to get recent rebound form composite from all game logs
function getRecentReboundFormComposite(playerName, targetGameDate, allGameLogs) {
  const targetDate = new Date(targetGameDate);
  
  // Filter player's games before target date with >12 minutes
  const playerGames = allGameLogs
    .filter(game => 
      game.player_name === playerName && 
      getMinutes(game) >= 12 &&
      new Date(game.game_date) < targetDate
    )
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));
  
  if (playerGames.length === 0) return 0;
  
  // Last 5 games
  const last5Games = playerGames.slice(0, 5);
  const last5Avg = last5Games.length > 0 ? 
    last5Games.reduce((sum, game) => sum + getRebounds(game), 0) / last5Games.length : 0;

  // Last 15 games (or all available if less than 15)
  const last15Games = playerGames.slice(0, Math.min(15, playerGames.length));
  const last15Avg = last15Games.length > 0 ? 
    last15Games.reduce((sum, game) => sum + getRebounds(game), 0) / last15Games.length : 0;

  // Composite: 60% last 5 + 40% last 15
  return (last5Avg * 0.6) + (last15Avg * 0.4);
}

// Helper function to get recent rebound volatility from all game logs
function getRecentReboundVolatility(playerName, targetGameDate, allGameLogs) {
  const targetDate = new Date(targetGameDate);
  
  // Filter player's games before target date with >12 minutes
  const playerGames = allGameLogs
    .filter(game => 
      game.player_name === playerName && 
      getMinutes(game) >= 12 &&
      new Date(game.game_date) < targetDate
    )
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));
  
  if (playerGames.length < 2) return 0;
  
  // Take last 5 games for volatility calculation
  const last5Games = playerGames.slice(0, 5);
  const rebounds = last5Games.map(game => getRebounds(game));
  const mean = rebounds.reduce((sum, val) => sum + val, 0) / rebounds.length;
  const variance = rebounds.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rebounds.length;
  
  return Math.sqrt(variance);
}

// Helper function to get historical minutes from all game logs
function getHistoricalMinutes(playerName, targetGameDate, allGameLogs) {
  const targetDate = new Date(targetGameDate);
  
  // Filter player's games before target date with >12 minutes
  const playerGames = allGameLogs
    .filter(game => 
      game.player_name === playerName && 
      getMinutes(game) >= 12 &&
      new Date(game.game_date) < targetDate
    )
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));
  
  if (playerGames.length === 0) return 0;
  
  // Take last 5 games for minutes calculation
  const last5Games = playerGames.slice(0, 5);
  const totalMinutes = last5Games.reduce((sum, game) => sum + getMinutes(game), 0);
  
  return last5Games.length > 0 ? totalMinutes / last5Games.length : 0;
}

// Helper function to get player position from season stats
function getPlayerPosition(position) {
  if (!position) return 1; // Default to guard
  
  const pos = position.toLowerCase();
  
  // Encode position as numeric
  if (pos.includes('center') || pos.includes('c')) {
    return 3;
  } else if (pos.includes('forward') || pos.includes('f')) {
    return 2;
  } else {
    return 1; // Guard (including PG, SG, G)
  }
}

// Helper function to get home/away indicator
function getHomeAway(gameLog) {
  // Handle both 2024 (home_away) and 2025 (ishome) formats
  if (gameLog.ishome !== undefined) {
    return gameLog.ishome === true || gameLog.ishome === 1 ? 1 : 0;
  } else if (gameLog.home_away !== undefined) {
    return gameLog.home_away === 'home' ? 1 : 0;
  }
  
  // Fallback: default to away if we can't determine
  return 0;
}

// Helper function to get days rest (log-transformed)
function getDaysRestLog(playerName, targetGameDate, allGameLogs) {
  const targetDate = new Date(targetGameDate);
  
  // Find the player's previous game
  const playerGames = allGameLogs
    .filter(game => 
      game.player_name === playerName && 
      new Date(game.game_date) < targetDate
    )
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));
  
  if (playerGames.length === 0) {
    return 0; // No previous game
  }
  
  const lastGameDate = new Date(playerGames[0].game_date);
  const daysDiff = Math.floor((targetDate - lastGameDate) / (1000 * 60 * 60 * 24));
  
  // Log-transform the days rest (avoid log(0))
  return daysDiff > 0 ? Math.log(daysDiff) : 0;
}

// Helper function to get team pace
function getTeamPace(teamAbbrev, teamPaceMap, teamNameMap) {
  if (!teamAbbrev || !teamPaceMap || !teamNameMap) return 95.0; // Default WNBA average pace
  
  const fullTeamName = teamNameMap[teamAbbrev];
  if (!fullTeamName) return 95.0;
  
  const teamPace = teamPaceMap[fullTeamName];
  return teamPace || 95.0; // Default to WNBA average if not found
}

// Helper function to get opponent pace
function getOpponentPace(opponentAbbrev, teamPaceMap, teamNameMap) {
  if (!opponentAbbrev || !teamPaceMap || !teamNameMap) return 95.0; // Default WNBA average pace
  
  const fullOpponentName = teamNameMap[opponentAbbrev];
  if (!fullOpponentName) return 95.0;
  
  const opponentPace = teamPaceMap[fullOpponentName];
  return opponentPace || 95.0; // Default to WNBA average if not found
}

// Helper function to get opponent rebounds allowed
function getOpponentReboundsAllowed(opponentAbbrev, teamDefensiveMap, teamNameMap) {
  if (!opponentAbbrev || !teamDefensiveMap || !teamNameMap) return 33.0; // Default WNBA average
  
  const defensiveStats = teamDefensiveMap[opponentAbbrev];
  if (!defensiveStats) return 33.0;
  
  // Use total rebounds allowed per game (opp_reb)
  return defensiveStats.opp_reb || 33.0;
}

// Helper function to get opponent field goal percentage allowed
function getOpponentFieldGoalPercentage(opponentAbbrev, teamDefensiveMap, teamNameMap) {
  if (!opponentAbbrev || !teamDefensiveMap || !teamNameMap) return 0.426; // Default WNBA average
  
  const defensiveStats = teamDefensiveMap[opponentAbbrev];
  if (!defensiveStats) return 0.426;
  
  // Use field goal percentage allowed (opp_fg_pct) - convert from percentage to decimal
  return (defensiveStats.opp_fg_pct || 42.6) / 100.0;
}

// Helper function to get opponent position-specific rebounds allowed
function getOpponentPositionRebounds(opponentAbbrev, playerPosition, teamDefensiveMap, teamNameMap) {
  if (!opponentAbbrev || !teamDefensiveMap || !teamNameMap) return 0.5; // Default normalized value
  
  const defensiveStats = teamDefensiveMap[opponentAbbrev];
  if (!defensiveStats) return 0.5;
  
  // Use total rebounds allowed as proxy for position-specific (since we don't have position breakdown)
  const totalRebounds = defensiveStats.opp_reb || 33.0;
  
  // Normalize based on position (centers get more rebounds, guards get fewer)
  let positionMultiplier = 1.0; // Default for guards
  if (playerPosition === 3) { // Center
    positionMultiplier = 1.3; // Centers get 30% more rebounds
  } else if (playerPosition === 2) { // Forward
    positionMultiplier = 1.1; // Forwards get 10% more rebounds
  }
  
  // Normalize to 0-1 scale (assuming max is around 40 rebounds per game)
  return Math.min(1.0, (totalRebounds * positionMultiplier) / 40.0);
}

// Helper function to get injury status
function getInjuryStatus(playerName, gameDate, injuryMap) {
  if (!injuryMap || !playerName) return 0; // Default to healthy
  
  const playerInjuries = injuryMap[playerName];
  if (!playerInjuries) return 0; // No injury data, assume healthy
  
  const gameDateObj = new Date(gameDate);
  
  // Check if player was injured on this date
  for (const injury of playerInjuries) {
    const injuryStart = new Date(injury.injury_start_date);
    const injuryEnd = injury.injury_end_date ? new Date(injury.injury_end_date) : new Date('2099-12-31');
    
    if (gameDateObj >= injuryStart && gameDateObj <= injuryEnd) {
      return 1; // Injured
    }
  }
  
  return 0; // Healthy
}

// Helper function to get teammate rebounding strength
function getTeammateReboundingStrength(playerName, teamAbbrev, gameDate, seasonStatsMap, teamNameMap) {
  if (!seasonStatsMap || !teamAbbrev || !teamNameMap) return 0; // Default value
  
  const fullTeamName = teamNameMap[teamAbbrev];
  if (!fullTeamName) return 0;
  
  // Get all players on the same team (using team abbreviation from season stats)
  const teamPlayers = Object.keys(seasonStatsMap).filter(name => {
    const stats = seasonStatsMap[name];
    return stats.team === teamAbbrev && name !== playerName;
  });
  
  if (teamPlayers.length === 0) return 0;
  
  // Calculate average rebounds of teammates
  const teammateRebounds = teamPlayers.map(name => seasonStatsMap[name].avg_rebounds || 0);
  const avgTeammateRebounds = teammateRebounds.reduce((sum, rebounds) => sum + rebounds, 0) / teammateRebounds.length;
  
  return avgTeammateRebounds;
}

// Helper function to get time decay weight
function getTimeDecayWeight(gameDate) {
  const gameDateObj = new Date(gameDate);
  const currentDate = new Date();
  const daysDiff = Math.max(0, (currentDate - gameDateObj) / (1000 * 60 * 60 * 24));
  
  // Use exponential decay similar to points model (k = 0.01 for ~100 day half-life)
  const k = 0.01;
  return Math.exp(-k * daysDiff);
}

// Helper function to get games played count
function getGamesPlayed(playerName, gameDate, allGameLogs) {
  if (!allGameLogs || !playerName) return 0;
  
  const gameDateObj = new Date(gameDate);
  
  // Count games played up to this date
  const gamesPlayed = allGameLogs.filter(log => 
    log.player_name === playerName && 
    new Date(log.game_date) <= gameDateObj
  ).length;
  
  return gamesPlayed;
}

// Standardize features for better linear regression performance
function standardizeFeatures(features) {
  const n = features.length;
  const k = features[0].length;
  
  // Calculate means and standard deviations for each feature
  const means = [];
  const stds = [];
  
  for (let j = 0; j < k; j++) {
    const values = features.map(row => row[j]).filter(v => !isNaN(v));
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

// Train linear regression model
function trainReboundsLinearRegression(features, targets) {
  const n = features.length;
  const k = features[0].length; // number of features
  
  if (n < k + 1) {
    throw new Error(`Insufficient data: ${n} samples for ${k} features`);
  }

  // Add bias term (intercept)
  const X = features.map(row => [1, ...row]);
  
  // Convert to matrix form for calculations
  const y = targets;
  
  // Calculate X^T * X with regularization (Ridge regression)
  const XTX = Array(k + 1).fill().map(() => Array(k + 1).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      for (let l = 0; l <= k; l++) {
        XTX[j][l] += X[i][j] * X[i][l];
      }
    }
  }
  
  // Add regularization term (Ridge regression) to prevent singular matrix
  const lambda = 0.01; // Small regularization parameter
  for (let i = 1; i <= k; i++) { // Skip intercept (index 0)
    XTX[i][i] += lambda;
  }
  
  // Calculate X^T * y
  const XTy = Array(k + 1).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      XTy[j] += X[i][j] * y[i];
    }
  }
  
  // Solve (X^T * X) * beta = X^T * y using Gaussian elimination
  const beta = Array(k + 1).fill(0);
  
  // Forward elimination
  for (let i = 0; i <= k; i++) {
    // Find pivot
    let maxRow = i;
    for (let j = i + 1; j <= k; j++) {
      if (Math.abs(XTX[j][i]) > Math.abs(XTX[maxRow][i])) {
        maxRow = j;
      }
    }
    
    // Swap rows
    [XTX[i], XTX[maxRow]] = [XTX[maxRow], XTX[i]];
    [XTy[i], XTy[maxRow]] = [XTy[maxRow], XTy[i]];
    
    // Make diagonal 1
    const pivot = XTX[i][i];
    if (Math.abs(pivot) < 1e-10) {
      throw new Error('Singular matrix - cannot solve');
    }
    
    for (let j = 0; j <= k; j++) {
      XTX[i][j] /= pivot;
    }
    XTy[i] /= pivot;
    
    // Eliminate column
    for (let j = 0; j <= k; j++) {
      if (j !== i) {
        const factor = XTX[j][i];
        for (let l = 0; l <= k; l++) {
          XTX[j][l] -= factor * XTX[i][l];
        }
        XTy[j] -= factor * XTy[i];
      }
    }
  }
  
  // Extract coefficients
  const intercept = XTy[0];
  const coefficients = XTy.slice(1);
  
  // Calculate R-squared and RMSE
  let ssRes = 0;
  let ssTot = 0;
  const yMean = y.reduce((sum, val) => sum + val, 0) / n;
  
  for (let i = 0; i < n; i++) {
    let prediction = intercept;
    for (let j = 0; j < k; j++) {
      prediction += coefficients[j] * features[i][j];
    }
    
    const residual = y[i] - prediction;
    ssRes += residual * residual;
    ssTot += (y[i] - yMean) * (y[i] - yMean);
  }
  
  const rSquared = 1 - (ssRes / ssTot);
  const rmse = Math.sqrt(ssRes / n);
  
  return {
    intercept,
    coefficients,
    rSquared,
    rmse,
    featureNames: [
      // Player Rebounding Performance (5 features)
      'season_average_rebounds',
      'recent_rebound_form_composite',
      'recent_rebound_volatility',
      'offensive_rebound_percentage',
      'defensive_rebound_percentage',
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
      // Opponent Defensive/Rebounding Strength (3 features)
      'opponent_rebounds_allowed',
      'opponent_field_goal_percentage',
      'opponent_position_rebounds',
      // Injury and Role Context (2 features)
      'injury_status',
      'teammate_rebounding_strength',
      // Time-Based Weighting (2 features)
      'time_decay_weight',
      'games_played'
    ]
  };
}

// Main training function
async function trainReboundsModel() {
  try {
    console.log('🏀 Starting Rebounds Model Training!');
    console.log('🔌 Connected to Supabase');
    console.log('📊 Using Player Rebounding Performance features');

    // Get all game logs for both 2024 and 2025 seasons with pagination
    console.log('\n📥 Fetching Game Logs...');
    let allGameLogs = [];
    
    // Fetch 2025 game logs
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: gameLogsError } = await supabase
        .from('wnba_game_logs')
        .select('*')
        .like('game_date', '%2025%')
        .not('rebounds', 'is', null)
        .order('game_date', { ascending: true })
        .range(from, from + batchSize - 1);

      if (gameLogsError) {
        throw new Error(`Error fetching game logs: ${gameLogsError.message}`);
      }

      if (batch && batch.length > 0) {
        allGameLogs = allGameLogs.concat(batch);
        from += batchSize;
        hasMore = batch.length === batchSize;
        console.log(`   📊 Fetched ${allGameLogs.length} records so far...`);
      } else {
        hasMore = false;
      }
    }

    // Fetch 2024 game logs
    console.log('📥 Fetching 2024 Game Logs...');
    from = 0;
    hasMore = true;

    while (hasMore) {
      const { data: batch, error: gameLogs2024Error } = await supabase
        .from('game_logs_2024')
        .select('*')
        .not('total_rebounds', 'is', null)
        .order('game_date', { ascending: true })
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

    // Group by player and filter eligible players (minimum 10 games)
    console.log('\n👥 Analyzing Player Eligibility...');
    
    const playerStats = {};
    allGameLogs.forEach(log => {
      if (!playerStats[log.player_name]) {
        playerStats[log.player_name] = {
          player_name: log.player_name,
          games: [],
          total_games: 0,
          avg_rebounds: 0
        };
      }
      
      playerStats[log.player_name].games.push(log);
      playerStats[log.player_name].total_games++;
      playerStats[log.player_name].avg_rebounds += getRebounds(log);
    });

    // Calculate averages and filter for minimum 10 games
    const eligiblePlayers = Object.values(playerStats)
      .map(player => {
        player.avg_rebounds = player.avg_rebounds / player.total_games;
        return player;
      })
      .filter(player => player.total_games >= 10);

    console.log(`✅ Found ${eligiblePlayers.length} eligible players (10+ games)`);

    // Fetch all supporting data upfront for efficient lookup
    console.log('\n📊 Fetching Supporting Data...');
    
    // Get season stats for both seasons
    const { data: seasonStats2025, error: season2025Error } = await supabase
      .from('player_season_stats')
      .select('*')
      .eq('season', '2025');
    
    const { data: seasonStats2024, error: season2024Error } = await supabase
      .from('player_season_stats')
      .select('*')
      .eq('season', '2024');
    
    if (season2025Error || season2024Error) {
      throw new Error(`Failed to fetch season stats: ${season2025Error?.message || season2024Error?.message}`);
    }
    
    console.log(`📊 Found ${seasonStats2025.length} 2025 season stats`);
    console.log(`📊 Found ${seasonStats2024.length} 2024 season stats`);
    
    // Get advanced stats for both seasons
    const { data: advancedStats2025, error: advanced2025Error } = await supabase
      .from('player_advanced_stats')
      .select('*')
      .eq('season', '2025');
    
    const { data: advancedStats2024, error: advanced2024Error } = await supabase
      .from('player_advanced_stats_2024')
      .select('*');
    
    if (advanced2025Error || advanced2024Error) {
      console.log('⚠️ No advanced stats available, continuing without them');
    } else {
      console.log(`📊 Found ${advancedStats2025.length} 2025 advanced stats`);
      console.log(`📊 Found ${advancedStats2024.length} 2024 advanced stats`);
    }
    
    // Get team pace stats for both seasons
    const { data: teamPace2025, error: pace2025Error } = await supabase
      .from('team_pace_stats')
      .select('*')
      .eq('season', '2025');
    
    const { data: teamPace2024, error: pace2024Error } = await supabase
      .from('team_pace_stats')
      .select('*')
      .eq('season', '2024');
    
    if (pace2025Error || pace2024Error) {
      console.log('⚠️ No team pace data available, using defaults');
    } else {
      console.log(`📊 Found ${teamPace2025.length} 2025 team pace stats`);
      console.log(`📊 Found ${teamPace2024.length} 2024 team pace stats`);
    }
    
    // Create lookup maps
    const seasonStatsMap = {};
    [...seasonStats2025, ...seasonStats2024].forEach(stats => {
      seasonStatsMap[stats.player_name] = stats;
    });
    
    const advancedStatsMap = {};
    [...(advancedStats2025 || []), ...(advancedStats2024 || [])].forEach(stats => {
      advancedStatsMap[stats.player_name] = stats;
    });
    
    // Create team name mapping from abbreviations to full names
    const teamNameMap = {
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
      'GSW': 'Golden State Valkyries'
    };
    
    // Create reverse mapping from full names to abbreviations for defensive stats
    const reverseTeamNameMap = {
      'Las Vegas Aces': 'LVA',
      'New York Liberty': 'NYL',
      'Connecticut Sun': 'CON',
      'Minnesota Lynx': 'MIN',
      'Phoenix Mercury': 'PHX',
      'Seattle Storm': 'SEA',
      'Washington Mystics': 'WAS',
      'Atlanta Dream': 'ATL',
      'Chicago Sky': 'CHI',
      'Los Angeles Sparks': 'LAS',
      'Dallas Wings': 'DAL',
      'Indiana Fever': 'IND',
      'Golden State Valkyries': 'GSV'  // Fixed: GSV not GSW
    };
    
    // Create team pace lookup map
    const teamPaceMap = {};
    [...(teamPace2025 || []), ...(teamPace2024 || [])].forEach(pace => {
      teamPaceMap[pace.team_name] = pace.pace;
    });
    
    console.log(`📊 Team pace range: ${Math.min(...Object.values(teamPaceMap))} - ${Math.max(...Object.values(teamPaceMap))} possessions/game`);
    
    // Get team defensive stats for both seasons (filter for overall team stats)
    const { data: teamDefensive2025, error: defensive2025Error } = await supabase
      .from('team_defensive_stats')
      .select('*')
      .eq('season', '2025')
      .eq('stat_type', 'points');
    
    const { data: teamDefensive2024, error: defensive2024Error } = await supabase
      .from('team_defensive_stats')
      .select('*')
      .eq('season', '2024')
      .eq('stat_type', 'points');
    
    if (defensive2025Error || defensive2024Error) {
      console.log('⚠️ No team defensive data available, using defaults');
    } else {
      console.log(`📊 Found ${teamDefensive2025.length} 2025 team defensive stats`);
      console.log(`📊 Found ${teamDefensive2024.length} 2024 team defensive stats`);
    }
    
    // Create team defensive lookup map (using team abbreviations as keys)
    const teamDefensiveMap = {};
    [...(teamDefensive2025 || []), ...(teamDefensive2024 || [])].forEach(defensive => {
      const teamAbbrev = reverseTeamNameMap[defensive.team];
      if (teamAbbrev) {
        teamDefensiveMap[teamAbbrev] = defensive;
      }
    });
    
    // Debug defensive stats
    console.log(`📊 Defensive stats range: ${Math.min(...Object.values(teamDefensiveMap).map(d => d.opp_reb))} - ${Math.max(...Object.values(teamDefensiveMap).map(d => d.opp_reb))} rebounds allowed`);
    console.log(`📊 FG% allowed range: ${Math.min(...Object.values(teamDefensiveMap).map(d => d.opp_fg_pct))} - ${Math.max(...Object.values(teamDefensiveMap).map(d => d.opp_fg_pct))}% FG allowed`);
    
    // Get injury data
    const { data: injuries, error: injuryError } = await supabase
      .from('active_injuries')
      .select('*');
    
    if (injuryError) {
      console.log('⚠️ No injury data available, using defaults');
    } else {
      console.log(`📊 Found ${injuries.length} injury records`);
    }
    
    // Create injury lookup map
    const injuryMap = {};
    (injuries || []).forEach(injury => {
      if (!injuryMap[injury.player_name]) {
        injuryMap[injury.player_name] = [];
      }
      injuryMap[injury.player_name].push(injury);
    });
    
    // Create features for all players combined
    console.log('\n🎯 Creating Training Features for All Players...');
    
    const features = [];
    const targets = [];
    
    // Process all eligible players to create training data
    const opponentStats = {};
    for (const player of eligiblePlayers) {
      // Skip first 5 games to have enough history for features
      for (let i = 5; i < player.games.length; i++) {
        const gameLog = player.games[i];
        const gameFeatures = createReboundsFeatures(gameLog, player.player_name, seasonStatsMap, advancedStatsMap, allGameLogs, teamPaceMap, teamNameMap, teamDefensiveMap, injuryMap);
        
        // Track opponent stats for debugging
        if (!opponentStats[gameLog.opponent]) {
          opponentStats[gameLog.opponent] = 0;
        }
        opponentStats[gameLog.opponent]++;
        
        features.push(gameFeatures);
        targets.push(getRebounds(gameLog));
      }
    }
    
    // Debug opponent distribution
    console.log('\n📊 Opponent distribution in training data:');
    Object.entries(opponentStats).forEach(([opponent, count]) => {
      console.log(`   ${opponent}: ${count} games`);
    });
    
    // Debug defensive feature values for first few samples
    console.log('\n📊 Sample defensive feature values:');
    for (let i = 0; i < Math.min(5, features.length); i++) {
      const feature = features[i];
      const opponentRebounds = feature[14]; // opponent_rebounds_allowed
      const opponentFG = feature[15]; // opponent_field_goal_percentage
      const opponentPos = feature[16]; // opponent_position_rebounds
      console.log(`   Sample ${i}: rebounds=${opponentRebounds}, fg=${opponentFG}, pos=${opponentPos}`);
    }
    
    if (features.length < 50) {
      throw new Error(`Insufficient training data: ${features.length} samples (need at least 50)`);
    }

    console.log(`✅ Created ${features.length} training samples from ${eligiblePlayers.length} players`);

    // Debug feature statistics
    console.log('\n📊 Feature Statistics:');
    const featureNames = [
      'season_average_rebounds',
      'recent_rebound_form_composite', 
      'recent_rebound_volatility',
      'offensive_rebound_percentage',
      'defensive_rebound_percentage',
      'historical_minutes',
      'is_starter',
      'player_position',
      'usage_rate',
      'home_away',
      'days_rest_log',
      'team_pace',
      'opponent_pace',
      'pace_interaction',
      'opponent_rebounds_allowed',
      'opponent_field_goal_percentage',
      'opponent_position_rebounds',
      'injury_status',
      'teammate_rebounding_strength',
      'time_decay_weight',
      'games_played'
    ];
    
    for (let i = 0; i < featureNames.length; i++) {
      const values = features.map(f => f[i]).filter(v => !isNaN(v));
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      console.log(`   ${featureNames[i]}: mean=${mean.toFixed(3)}, std=${std.toFixed(3)}, min=${Math.min(...values).toFixed(3)}, max=${Math.max(...values).toFixed(3)}`);
    }

    // Train single linear regression model for all players
    console.log('\n🏀 Training Single Rebounds Linear Regression Model...');
    
    const model = trainReboundsLinearRegression(features, targets);
    
    console.log(`✅ Model trained: R² = ${model.rSquared.toFixed(4)}, RMSE = ${model.rmse.toFixed(2)} (${features.length} samples, ${model.featureNames.length} features)`);

    // Save model to database
    console.log('\n💾 Saving model to database...');
    console.log(`   Model ID: GENERAL_REBOUNDS`);
    console.log(`   Stat Type: rebounds`);
    console.log(`   Season: 2025`);
    console.log(`   R²: ${model.rSquared.toFixed(4)}`);
    console.log(`   RMSE: ${model.rmse.toFixed(2)}`);
    console.log(`   Training Samples: ${features.length}`);
    
    // Use robust save utility
    const modelData = {
      player_id: 'GENERAL_REBOUNDS',
      stat_type: 'rebounds',
      season: '2025',
      model_data: {
        intercept: model.intercept,
        coefficients: model.coefficients,
        feature_names: model.featureNames,
        r_squared: model.rSquared,
        rmse: model.rmse,
        sample_count: features.length,
        training_date: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };
    
    await saveModel(modelData);

    console.log('✅ Rebounds model saved to database');
    
    console.log('\n🎯 Player Rebounding Performance Features (5):');
    console.log('   • Season Average Rebounds');
    console.log('   • Recent Rebound Form Composite (60% L5 + 40% L15)');
    console.log('   • Recent Rebound Volatility (Std Dev of L5)');
    console.log('   • Offensive Rebound Percentage');
    console.log('   • Defensive Rebound Percentage');
    console.log('\n🎯 Player Role and Workload Features (4):');
    console.log('   • Historical Minutes (Avg of last 5 games)');
    console.log('   • Is Starter (Binary: 1 if avg minutes > 15)');
    console.log('   • Player Position (3=Center, 2=Forward, 1=Guard)');
    console.log('   • Usage Rate (From advanced stats)');
    console.log('\n🎯 Game Context Features (2):');
    console.log('   • Home/Away (Binary: 1=home, 0=away)');
    console.log('   • Days Rest Log (Log-transformed days since last game)');
    console.log('\n🎯 Team and Opponent Pace Features (3):');
    console.log('   • Team Pace (Raw pace from team_pace_stats)');
    console.log('   • Opponent Pace (Raw pace from team_pace_stats)');
    console.log('   • Pace Interaction (Team Pace × Opponent Pace)');
    console.log('\n🎯 Opponent Defensive/Rebounding Strength Features (3):');
    console.log('   • Opponent Rebounds Allowed (Avg rebounds allowed per game)');
    console.log('   • Opponent Field Goal % (FG% allowed by opponent)');
    console.log('   • Opponent Position Rebounds (Position-specific rebounds allowed)');
    console.log('\n🎯 Injury and Role Context Features (2):');
    console.log('   • Injury Status (Binary: 1=injured, 0=healthy)');
    console.log('   • Teammate Rebounding Strength (Avg rebounds of teammates)');
    console.log('\n🎯 Time-Based Weighting Features (2):');
    console.log('   • Time Decay Weight (Exponential decay based on days since game)');
    console.log('   • Games Played (Count of games played in season)');
    console.log('\n📊 Feature Engineering:');
    console.log('   • Filtered for games with >12 minutes played');
    console.log('   • Used real data from player_season_stats and player_advanced_stats');
    console.log('   • Calculated composite recent form to avoid multicollinearity');
    console.log('   • Position encoding: Centers (3) > Forwards (2) > Guards (1)');
    console.log('   • Log-transformed days rest to capture non-linear effects');
    console.log('   • Pace interaction captures combined team and opponent tempo effects');
    console.log('   • Opponent defensive stats capture rebounding opportunity context');
    console.log('   • Injury status affects playing time and performance');
    console.log('   • Teammate competition for rebounds reduces individual opportunities');
    console.log('   • Time decay weights recent games more heavily for predictions');
    
  } catch (error) {
    console.error('❌ Error during rebounds training:', error.message);
  }
}

// Run the training
trainReboundsModel();