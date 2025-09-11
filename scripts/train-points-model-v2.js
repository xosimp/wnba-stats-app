require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { MultivariateLinearRegression } = require('ml-regression');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Ridge Regression implementation for WNBA data
function trainRidgeRegression(X, y, lambda) {
  const n = X.length;
  const p = X[0].length;
  
  // Convert to matrices
  const Xt = transpose(X);
  const XtX = multiplyMatrices(Xt, X);
  const Xty = multiplyMatrixVector(Xt, y.map(row => row[0]));
  
  // Add regularization term: XtX + lambda * I
  for (let i = 0; i < p; i++) {
    XtX[i][i] += lambda;
  }
  
  // Solve (XtX + lambda*I) * beta = Xty
  const coefficients = solveLinearSystem(XtX, Xty);
  
  return {
    coefficients,
    predict: (x) => {
      const prediction = x.reduce((sum, val, idx) => sum + val * coefficients[idx], 0);
      return [prediction];
    }
  };
}

// Matrix operations for Ridge regression
function transpose(matrix) {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

function multiplyMatrices(a, b) {
  const result = [];
  for (let i = 0; i < a.length; i++) {
    result[i] = [];
    for (let j = 0; j < b[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < b.length; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map(row => 
    row.reduce((sum, val, idx) => sum + val * vector[idx], 0)
  );
}

function solveLinearSystem(A, b) {
  const n = A.length;
  const x = new Array(n).fill(0);
  
  // Gaussian elimination with partial pivoting
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    
    // Swap rows
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];
    
    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[i][i]) < 1e-10) continue;
      const factor = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j];
      }
      b[k] -= factor * b[i];
    }
  }
  
  // Back substitution
  for (let i = n - 1; i >= 0; i--) {
    x[i] = b[i];
    for (let j = i + 1; j < n; j++) {
      x[i] -= A[i][j] * x[j];
    }
    if (Math.abs(A[i][i]) > 1e-10) {
      x[i] /= A[i][i];
    }
  }
  
  return x;
}

async function trainPointsModel() {
  console.log('🚀 Training new points model with proper features (2025 + 2024 data)...');
  
  try {
    // Get ALL 2025 game logs (with pagination)
    let gameLogs2025 = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('wnba_game_logs')
        .select('*')
        .order('game_date', { ascending: true })
        .range(from, from + limit - 1);
      
      if (batchError) {
        throw new Error(`Failed to fetch 2025 game logs: ${batchError.message}`);
      }
      
      if (batch && batch.length > 0) {
        gameLogs2025 = gameLogs2025.concat(batch);
        from += limit;
        hasMore = batch.length === limit;
      } else {
        hasMore = false;
      }
    }
    
    // Get ALL 2024 game logs (with pagination)
    let gameLogs2024 = [];
    from = 0;
    hasMore = true;
    
    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('game_logs_2024')
        .select('*')
        .order('game_date', { ascending: true })
        .range(from, from + limit - 1);
      
      if (batchError) {
        throw new Error(`Failed to fetch 2024 game logs: ${batchError.message}`);
      }
      
      if (batch && batch.length > 0) {
        gameLogs2024 = gameLogs2024.concat(batch);
        from += limit;
        hasMore = batch.length === limit;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 Found ${gameLogs2025.length} 2025 game logs`);
    console.log(`📊 Found ${gameLogs2024.length} 2024 game logs`);
    
    // Get 2025 season averages
    const { data: seasonAverages2025, error: season2025Error } = await supabase
      .from('player_season_stats')
      .select('*');
    
    if (season2025Error) {
      throw new Error(`Failed to fetch 2025 season averages: ${season2025Error.message}`);
    }
    
    // Get 2024 season averages
    const { data: seasonAverages2024, error: season2024Error } = await supabase
      .from('player_season_stats_2024')
      .select('*');
    
    if (season2024Error) {
      throw new Error(`Failed to fetch 2024 season averages: ${season2024Error.message}`);
    }
    
    console.log(`📊 Found ${seasonAverages2025.length} 2025 season averages`);
    console.log(`📊 Found ${seasonAverages2024.length} 2024 season averages`);
    
    // Get pace stats for both seasons
    const { data: paceStats2025, error: pace2025Error } = await supabase
      .from('team_pace_stats')
      .select('*')
      .eq('season', '2025');
    
    const { data: paceStats2024, error: pace2024Error } = await supabase
      .from('team_pace_stats')
      .select('*')
      .eq('season', '2024');
    
    if (pace2025Error || pace2024Error) {
      throw new Error(`Failed to fetch pace stats: ${pace2025Error?.message || pace2024Error?.message}`);
    }
    
    console.log(`📊 Found ${paceStats2025.length} 2025 pace stats`);
    console.log(`📊 Found ${paceStats2024.length} 2024 pace stats`);
    
    // Get defensive stats for both seasons
    const { data: defensiveStats2025, error: defense2025Error } = await supabase
      .from('team_defensive_stats')
      .select('*')
      .eq('season', '2025');
    
    const { data: defensiveStats2024, error: defense2024Error } = await supabase
      .from('team_defensive_stats')
      .select('*')
      .eq('season', '2024');
    
    if (defense2025Error || defense2024Error) {
      throw new Error(`Failed to fetch defensive stats: ${defense2025Error?.message || defense2024Error?.message}`);
    }
    
    console.log(`📊 Found ${defensiveStats2025.length} 2025 defensive stats`);
    console.log(`📊 Found ${defensiveStats2024.length} 2024 defensive stats`);
    
    // Get active injuries
    const { data: injuries, error: injuryError } = await supabase
      .from('active_injuries')
      .select('*');
    
    if (injuryError) {
      console.log('⚠️ No injury data available, continuing without it');
    } else {
      console.log(`📊 Found ${injuries.length} active injury records`);
    }
    
    // Create lookup maps
    const seasonAvgMap = {};
    [...seasonAverages2025, ...seasonAverages2024].forEach(avg => {
      seasonAvgMap[avg.player_name] = {
        ...avg,
        points_per_game: avg.avg_points || 0 // Map avg_points to points_per_game for consistency
      };
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
      'DAL': 'Dallas Wings',
      'IND': 'Indiana Fever',
      'LAS': 'Los Angeles Sparks',
      'GSV': 'Golden State Valkyries',
      'GS': 'Golden State Valkyries',
      'GV': 'Golden State Valkyries'
    };
    
    const paceMap = {};
    [...paceStats2025, ...paceStats2024].forEach(pace => {
      const key = `${pace.team_name}_${pace.season}`;
      paceMap[key] = {
        pace: pace.pace,
        points_scored: pace.points_scored
      };
    });
    
    console.log(`📊 Loaded ${Object.keys(paceMap).length} pace entries`);
    console.log('Sample pace entries:', Object.keys(paceMap).slice(0, 5));
    
    const injuryMap = {};
    if (injuries) {
      injuries.forEach(injury => {
        if (injury.status === 'Out' || injury.status === 'Questionable') {
          injuryMap[injury.player_name] = injury.status;
        }
      });
    }
    
    // Create defensive stats lookup by team, season, and position
    const defenseMap = {};
    [...defensiveStats2025, ...defensiveStats2024].forEach(stat => {
      const key = `${stat.team}_${stat.season}`;
      if (!defenseMap[key]) {
        defenseMap[key] = {};
      }
      defenseMap[key][stat.stat_type] = stat.overall_avg_allowed;
      defenseMap[key].points_allowed = stat.points_allowed; // Add points allowed
    });
    
    console.log(`📊 Loaded ${Object.keys(defenseMap).length} defensive entries`);
    console.log('Sample defensive entries:', Object.keys(defenseMap).slice(0, 5));
    
    // Create player position lookup (2024 has position, 2025 doesn't)
    const positionMap = {};
    seasonAverages2024.forEach(avg => {
      if (avg.position) {
        positionMap[avg.player_name] = avg.position;
      }
    });
    
    // For 2025, we'll need to get positions from a different source or use defaults
    // For now, we'll use the 2024 positions as a fallback
    
    // Prepare training data
    const trainingData = [];
    const featureNames = [
      'recent_form_composite',
      'recent_form_volatility',
      'recent_non_scoring_contributions',
      'season_average_points',
      'home_away',
      'raw_team_pace',
      'raw_opponent_pace',
      'pace_interaction',
      'is_injured',
      'days_rest_log', // Only log-transformed rest (removed raw days_rest)
      'opponent_points_allowed_avg',
      'team_points_scored_avg',
      'is_starter',
      'historical_minutes', // Historical average minutes (last 5 games)
      'starter_minutes_interaction', // is_starter * historical_minutes
      'usage_rate',
      'three_point_volume',
      'three_point_efficiency',
      'shot_distribution_ratio', // 3PT / Total FG ratio
      'two_point_efficiency', // 2-point shooting percentage (for post players)
      'shot_volume', // Total field goal attempts per game
      'opponent_3pt_defense', // Opponent 3PT FG% allowed
      'opponent_post_defense', // Opponent points allowed in paint
      'player_role_playmaker', // Binary flag for playmaker vs scorer
      'assist_to_points_ratio', // Recent assists/points ratio
      'time_decay_weight' // Exponential decay based on game recency
    ];
    
    console.log('🔄 Processing game logs for training data...');
    
    // Calculate player vs opponent matchup history
    console.log('📊 Calculating player vs opponent matchup history...');
    const matchupMap = {};
    
    // Process all games to build matchup history
    const allGamesForMatchup = [
      ...gameLogs2025.map(game => ({ ...game, season: '2025' })),
      ...gameLogs2024.map(game => ({ ...game, season: '2024' }))
    ];
    
    // Group by player-opponent pairs
    const matchupGroups = {};
    allGamesForMatchup.forEach(game => {
      const key = `${game.player_name}_vs_${game.opponent}`;
      if (!matchupGroups[key]) {
        matchupGroups[key] = [];
      }
      matchupGroups[key].push(game);
    });
    
    // Calculate averages for each matchup
    Object.keys(matchupGroups).forEach(key => {
      const games = matchupGroups[key];
      const validGames = games.filter(game => 
        game.points !== null && 
        game.points !== undefined && 
        game.points > 0
      );
      
      if (validGames.length > 0) {
        const avgPoints = validGames.reduce((sum, game) => sum + game.points, 0) / validGames.length;
        matchupMap[key] = avgPoints;
      }
    });
    
    console.log(`📊 Calculated matchup history for ${Object.keys(matchupMap).length} player-opponent pairs`);
    
    // Load usage rate data from both 2024 and 2025
    console.log('📊 Loading usage rate data...');
    const usageMap = {};
    
    // Load 2025 usage data
    const { data: usageData2025, error: usageError2025 } = await supabase
      .from('player_advanced_stats')
      .select('player_name, usage_percentage');
    
    if (usageError2025) {
      console.log('⚠️  Error loading 2025 usage data:', usageError2025);
    } else if (usageData2025) {
      usageData2025.forEach(player => {
        usageMap[player.player_name] = player.usage_percentage / 100; // Convert to decimal
      });
      console.log(`📊 Loaded 2025 usage rates for ${usageData2025.length} players`);
    }
    
    // Load 2024 usage data
    const { data: usageData2024, error: usageError2024 } = await supabase
      .from('player_advanced_stats_2024')
      .select('player_name, usage_pct');
    
    if (usageError2024) {
      console.log('⚠️  Error loading 2024 usage data:', usageError2024);
    } else if (usageData2024) {
      usageData2024.forEach(player => {
        // Only add if not already in map (2025 takes precedence)
        if (!usageMap[player.player_name]) {
          usageMap[player.player_name] = player.usage_pct / 100; // Convert to decimal
        }
      });
      console.log(`📊 Loaded 2024 usage rates for ${usageData2024.length} players`);
    }
    
    console.log(`📊 Total unique players with usage data: ${Object.keys(usageMap).length}`);
    
    // Process data with time decay weighting (exponential decay based on game recency)
    const allGameLogs = [
      ...gameLogs2025.map(game => ({ ...game, season: '2025' })),
      ...gameLogs2024.map(game => ({ ...game, season: '2024' }))
    ];
    
    // Group games by player
    const playerGames = {};
    allGameLogs.forEach(game => {
      if (!playerGames[game.player_name]) {
        playerGames[game.player_name] = [];
      }
      playerGames[game.player_name].push(game);
    });
    
    let processedGames = 0;
    
    for (const [playerName, games] of Object.entries(playerGames)) {
      
      console.log(`\n👤 Processing player: ${playerName} (${games.length} games)`);
      
      // Sort games by date
      games.sort((a, b) => new Date(a.game_date) - new Date(b.game_date));
      
      let playerSamplesAdded = 0;
      
      for (let i = 15; i < games.length; i++) { // Need at least 15 previous games
        const currentGame = games[i];
        const previousGames = games.slice(0, i);
        
        // Calculate recent form from today's date going backwards
        // Use Central Time (CT) timezone
        const today = new Date();
        // Convert to Central Time using Intl.DateTimeFormat
        const ctToday = new Date(today.toLocaleString("en-US", {timeZone: "America/Chicago"}));
        const currentGameDate = new Date(currentGame.game_date);
        
        // For 2024 games, use ALL games from the entire season
        // For 2025 games, only use games before today
        const recentGames = previousGames.filter(game => {
          const gameDate = new Date(game.game_date);
          if (currentGame.season === '2024') {
            return true; // Use ALL 2024 games for recent form
          } else {
            return gameDate < ctToday; // Only 2025 games before today (CT)
          }
        });
        
        const last3Games = recentGames.slice(-3);
        const last5Games = recentGames.slice(-5);
        const last10Games = recentGames.slice(-10);
        const last15Games = recentGames.slice(-15);
        
        // Calculate new composite features
        const recentForm5 = last5Games.length > 0 
          ? last5Games.reduce((sum, game) => sum + (game.points || 0), 0) / last5Games.length 
          : 0;
        
        const recentForm15 = last15Games.length > 0 
          ? last15Games.reduce((sum, game) => sum + (game.points || 0), 0) / last15Games.length 
          : 0;
        
        // 1. Composite recent form (weighted average of 5 and 15 game form)
        const recentFormComposite = 0.6 * recentForm5 + 0.4 * recentForm15;
        
        // 2. Volatility (standard deviation of points over last 5 games)
        const recentFormVolatility = last5Games.length > 1 
          ? Math.sqrt(last5Games.reduce((sum, game) => {
              const diff = (game.points || 0) - recentForm5;
              return sum + diff * diff;
            }, 0) / last5Games.length)
          : 0;
        
        // 3. Recent non-scoring contributions (assists + rebounds over last 5 games)
        const recentNonScoringContributions = last5Games.length > 0 
          ? last5Games.reduce((sum, game) => {
              const assists = game.assists || 0;
              const rebounds = game.rebounds || 0;
              return sum + assists + rebounds;
            }, 0) / last5Games.length
          : 0;
        
        // Get season average
        const seasonAvg = seasonAvgMap[playerName];
        const seasonAveragePoints = seasonAvg?.points_per_game || seasonAvg?.avg_points || 0;
        
        // Debug: Log if this is a 2024 game and why it might be skipped
        if (currentGame.season === '2024' && processedGames < 10) {
          console.log(`   🔍 Debug 2024: ${playerName} - ${currentGame.game_date} vs ${currentGame.opponent}`);
          console.log(`      Recent games: ${recentGames.length}, Previous games: ${previousGames.length}`);
          console.log(`      Season avg: ${seasonAveragePoints}, Recent form 15: ${recentForm15}`);
        }
        
        // Calculate days rest - use raw value to let model learn the relationship
        let daysRest = 2; // Default for first game of season
        if (i > 0) {
          const prevGame = games[i - 1];
          const prevDate = new Date(prevGame.game_date);
          const currentDate = new Date(currentGame.game_date);
          const rawDays = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));
          
          // Use raw days rest - let the model learn the optimal relationship
          // This allows for non-linear effects (e.g., older players vs younger players)
          daysRest = rawDays;
        }
        
        // Calculate log-transformed days rest for non-linear modeling
        // Add 1 to avoid log(0) for back-to-back games
        const daysRestLog = Math.log(daysRest + 1);
        
        // Calculate historical minutes (last 5 games) as proxy for expected minutes
        const historicalMinutes = last5Games.length > 0 
          ? last5Games.reduce((sum, game) => {
              const minutes = game.season === '2025' ? game.minutes : game.minutes_played;
              return sum + (minutes || 0);
            }, 0) / last5Games.length
          : 25; // Default to 25 minutes if no history
        
        // Get team pace factors using team name mapping
        let teamFullName = teamNameMap[currentGame.team] || currentGame.team;
        let opponentFullName = teamNameMap[currentGame.opponent] || currentGame.opponent;
        
        // For 2024 data, the pace data already has asterisks, so don't add them
        // The team names in pace data are already formatted with asterisks
        
        // For 2024, we need to add asterisks to match the pace data format
        const teamPaceKey = currentGame.season === '2024' 
          ? `${teamFullName}*_${currentGame.season}` 
          : `${teamFullName}_${currentGame.season}`;
        const opponentPaceKey = currentGame.season === '2024' 
          ? `${opponentFullName}*_${currentGame.season}` 
          : `${opponentFullName}_${currentGame.season}`;
        const teamPaceData = paceMap[teamPaceKey];
        const opponentPaceData = paceMap[opponentPaceKey];
        
        // Raw pace values (let model learn team-specific effects)
        // Use actual pace data or calculate league average from available data
        const leagueAvgPace = 95; // WNBA league average pace
        const rawTeamPace = teamPaceData ? teamPaceData.pace : leagueAvgPace;
        const rawOpponentPace = opponentPaceData ? opponentPaceData.pace : leagueAvgPace;
        
        // Pace interaction term (captures pace mismatch effects)
        const paceInteraction = rawTeamPace * rawOpponentPace;
        
        // Get defensive stats from database with fallbacks
        const opponentDefenseKey = currentGame.season === '2024' 
          ? `${opponentFullName}*_${currentGame.season}` 
          : `${opponentFullName}_${currentGame.season}`;
        const teamOffenseKey = currentGame.season === '2024' 
          ? `${teamFullName}*_${currentGame.season}` 
          : `${teamFullName}_${currentGame.season}`;
        const opponentDefenseData = defenseMap[opponentDefenseKey];
        const teamOffenseData = paceMap[teamOffenseKey];
        
        // Use actual defensive data or calculate league averages
        const leagueAvgPointsAllowed = 82; // WNBA league average points allowed
        const leagueAvgPointsScored = 82; // WNBA league average points scored
        const opponentPointsAllowed = opponentDefenseData ? (opponentDefenseData.points_allowed || leagueAvgPointsAllowed) : leagueAvgPointsAllowed;
        const teamPointsScored = teamOffenseData ? (teamOffenseData.points_scored || leagueAvgPointsScored) : leagueAvgPointsScored;
        
        // Check if player is injured
        const isInjured = injuryMap[playerName] ? 1 : 0;
        
        // 5. Expected minutes played feature - use actual season data
        let expectedMinutes = 25; // Default expected minutes
        if (seasonAvg && seasonAvg.avg_minutes && seasonAvg.avg_minutes > 0) {
          // Use actual season average minutes played
          expectedMinutes = seasonAvg.avg_minutes;
        } else {
          // Calculate from historical data if season average not available
          const historicalMinutes = last5Games.length > 0 
            ? last5Games.reduce((sum, game) => {
                const minutes = game.season === '2025' ? game.minutes : game.minutes_played;
                return sum + (minutes || 0);
              }, 0) / last5Games.length
            : 25;
          expectedMinutes = historicalMinutes;
        }
        
        // WNBA-specific: Determine if player is a starter based on expected minutes
        // In WNBA, starters typically play 25+ minutes per game
        const isStarter = expectedMinutes >= 25 ? 1 : 0;
        
        // 4. Usage rate feature - use actual usage data
        let usageRate = 0.2; // Default 20% usage rate
        if (usageMap[playerName] && usageMap[playerName] > 0) {
          usageRate = usageMap[playerName];
        } else {
          // Calculate approximate usage rate from recent games if not available
          const recentUsage = last5Games.length > 0 
            ? last5Games.reduce((sum, game) => {
                const minutes = game.season === '2025' ? game.minutes : game.minutes_played;
                const points = game.points || 0;
                const assists = game.assists || 0;
                const rebounds = game.rebounds || 0;
                const turnovers = game.turnovers || 0;
                const fga = game.season === '2025' ? game.field_goals_attempted : game.field_goal_attempted;
                const fta = game.season === '2025' ? game.free_throws_attempted : game.free_throw_attempted;
                
                // Approximate usage rate: (FGA + 0.44 * FTA + TO) / (Team Possessions)
                // For simplicity, use a rough estimate based on player stats
                const usage = minutes > 0 ? Math.min(0.4, (points + assists + rebounds) / (minutes * 2)) : 0.2;
                return sum + usage;
              }, 0) / last5Games.length
            : 0.2;
          usageRate = recentUsage;
        }
        
        // 5. Enhanced shooting features
        let threePointVolume = 0; // 3-point attempts per game
        let threePointEfficiency = 0; // 3-point percentage
        let shotDistributionRatio = 0; // 3PT / Total FG ratio (0-1)
        let twoPointEfficiency = 0; // 2-point shooting percentage
        let shotVolume = 0; // Total field goal attempts per game
        
        // Handle different column names for 2024 vs 2025
        const threePointAttempted = currentGame.season === '2025' 
          ? currentGame.three_points_attempted 
          : currentGame.three_point_attempted;
        const threePointMade = currentGame.season === '2025' 
          ? currentGame.three_points_made 
          : currentGame.three_point_made;
        const fieldGoalAttempted = currentGame.season === '2025' 
          ? currentGame.field_goals_attempted 
          : currentGame.field_goal_attempted;
        const fieldGoalMade = currentGame.season === '2025' 
          ? currentGame.field_goals_made 
          : currentGame.field_goal_made;
        
        // Calculate shot volume (total attempts)
        shotVolume = fieldGoalAttempted || 0;
        
        // Calculate 3PT volume and efficiency
        if (threePointAttempted && threePointAttempted > 0) {
          threePointVolume = threePointAttempted;
          threePointEfficiency = threePointMade / threePointAttempted;
        }
        
        // Calculate 2PT efficiency (for post players like Wilson)
        const twoPointAttempted = fieldGoalAttempted - threePointAttempted;
        const twoPointMade = fieldGoalMade - threePointMade;
        if (twoPointAttempted && twoPointAttempted > 0) {
          twoPointEfficiency = twoPointMade / twoPointAttempted;
        }
        
        // Calculate shot distribution ratio (3PT / Total FG attempts)
        if (fieldGoalAttempted && fieldGoalAttempted > 0) {
          shotDistributionRatio = (threePointAttempted || 0) / fieldGoalAttempted;
        } else {
          // Use season averages if game data missing
          const playerGames = allGameLogs.filter(game => game.player_name === playerName);
          const validShotGames = playerGames.filter(game => {
            const fgAttempts = game.season === '2025' ? game.field_goals_attempted : game.field_goal_attempted;
            return fgAttempts && fgAttempts > 0;
          });
          
          if (validShotGames.length > 0) {
            const total3ptAttempts = validShotGames.reduce((sum, game) => {
              const attempts = game.season === '2025' ? game.three_points_attempted : game.three_point_attempted;
              return sum + (attempts || 0);
            }, 0);
            const totalFgAttempts = validShotGames.reduce((sum, game) => {
              const fgAttempts = game.season === '2025' ? game.field_goals_attempted : game.field_goal_attempted;
              return sum + (fgAttempts || 0);
            }, 0);
            const total3ptMade = validShotGames.reduce((sum, game) => {
              const made = game.season === '2025' ? game.three_points_made : game.three_point_made;
              return sum + (made || 0);
            }, 0);
            
            const totalFgMade = validShotGames.reduce((sum, game) => {
              const made = game.season === '2025' ? game.field_goals_made : game.field_goal_made;
              return sum + (made || 0);
            }, 0);
            const total2ptAttempts = totalFgAttempts - total3ptAttempts;
            const total2ptMade = totalFgMade - total3ptMade;
            
            threePointVolume = total3ptAttempts / validShotGames.length;
            threePointEfficiency = total3ptAttempts > 0 ? total3ptMade / total3ptAttempts : 0;
            shotDistributionRatio = totalFgAttempts > 0 ? total3ptAttempts / totalFgAttempts : 0;
            shotVolume = totalFgAttempts / validShotGames.length;
            twoPointEfficiency = total2ptAttempts > 0 ? total2ptMade / total2ptAttempts : 0;
          }
        }
        
        // Get opponent 3PT defense from team_defensive_stats (reuse existing opponentDefenseData)
        const leagueAvg3ptDefense = 0.33; // WNBA league average 3PT defense
        const opponent3ptDefense = opponentDefenseData?.three_point_percentage_allowed || leagueAvg3ptDefense;
        
        // Get opponent post defense (points allowed in paint) for post players like Wilson
        const leagueAvgPostDefense = 40; // WNBA league average points allowed in paint
        const opponentPostDefense = opponentDefenseData?.points_in_paint_allowed || leagueAvgPostDefense;
        
        // Calculate player role features (playmaker vs scorer)
        const recentAssists = last5Games.reduce((sum, game) => sum + (game.assists || 0), 0);
        const recentPoints = last5Games.reduce((sum, game) => sum + (game.points || 0), 0);
        const assistToPointsRatio = recentPoints > 0 ? recentAssists / recentPoints : 0;
        
        // Binary flag for playmaker role (assist-to-points ratio > 0.3)
        const playerRolePlaymaker = assistToPointsRatio > 0.3 ? 1 : 0;
        
        // Calculate time decay weight based on game recency
        // More recent games get higher weight, with exponential decay
        const gameDate = new Date(currentGame.game_date);
        const currentDate = new Date();
        const daysSinceGame = Math.max(0, (currentDate - gameDate) / (1000 * 60 * 60 * 24));
        
        // Exponential decay: weight = e^(-decay_rate * days)
        // Much slower decay rate to preserve 2024 data value
        // Half-life of ~277 days means 2024 games retain significant weight
        const decayRate = 0.0025; // Very slow decay (half-life ~277 days)
        const timeDecayWeight = Math.exp(-decayRate * daysSinceGame);
        
        // Ensure time decay weight is valid
        if (isNaN(timeDecayWeight) || !isFinite(timeDecayWeight)) {
          console.log(`⚠️  Invalid time decay weight for ${playerName} on ${currentGame.game_date}: ${timeDecayWeight}`);
        }
        
        // Calculate starter-minutes interaction term
        const starterMinutesInteraction = isStarter * historicalMinutes;
        
        // Create feature vector with advanced refinements
        const features = [
          recentFormComposite, // Weighted composite of recent form
          recentFormVolatility, // Standard deviation of recent points
          recentNonScoringContributions, // Assists + rebounds per game
          seasonAveragePoints, // Season average points per game
          currentGame.ishome ? 1 : 0, // Home court advantage
          rawTeamPace, // Raw team pace (let model learn team effects)
          rawOpponentPace, // Raw opponent pace
          paceInteraction, // Team pace * opponent pace interaction
          isInjured, // Injury status
          daysRestLog, // Log-transformed days rest (removed raw days_rest)
          opponentPointsAllowed, // Use raw defensive stat
          teamPointsScored, // Use raw offensive stat
          isStarter, // WNBA-specific starter status (1 if 25+ min expected)
          historicalMinutes, // Historical average minutes (last 5 games)
          starterMinutesInteraction, // is_starter * historical_minutes
          usageRate, // Player usage rate (0-1)
          threePointVolume, // 3-point attempts per game
          threePointEfficiency, // 3-point shooting percentage
          shotDistributionRatio, // 3PT / Total FG ratio
          twoPointEfficiency, // 2-point shooting percentage (for post players)
          shotVolume, // Total field goal attempts per game
          opponent3ptDefense, // Opponent 3PT FG% allowed
          opponentPostDefense, // Opponent points allowed in paint
          playerRolePlaymaker, // Binary flag for playmaker vs scorer
          assistToPointsRatio, // Recent assists/points ratio
          timeDecayWeight // Exponential decay based on game recency
        ];
        
        // Validate all features for NaN/Inf values
        const invalidFeatures = features.map((val, idx) => ({ val, idx, name: featureNames[idx] }))
          .filter(item => isNaN(item.val) || !isFinite(item.val));
        
        if (invalidFeatures.length > 0) {
          console.log(`⚠️  Invalid features for ${playerName} on ${currentGame.game_date}:`);
          invalidFeatures.forEach(item => {
            console.log(`   ${item.name}: ${item.val}`);
          });
        }
        
        // Only include if we have valid data and player played meaningful minutes (>10)
        // For 2025: use 'minutes' column, for 2024: use 'minutes_played' column
        const minutesPlayed = currentGame.season === '2025' ? currentGame.minutes : currentGame.minutes_played;
        
        // Require >10 minutes played for both seasons to include bench players
        const hasValidMinutes = minutesPlayed && minutesPlayed > 10;
        
        if (currentGame.points !== null && currentGame.points !== undefined && hasValidMinutes) {
          
                  // Debug: Log first few samples to verify data quality
        if (trainingData.length < 5) {
          console.log(`\n🔍 Sample ${trainingData.length + 1} features:`);
          console.log(`   Player: ${playerName}`);
          console.log(`   Game: ${currentGame.game_date} vs ${currentGame.opponent} (${currentGame.season})`);
          console.log(`   Recent Form Composite: ${recentFormComposite.toFixed(1)} (5g: ${recentForm5.toFixed(1)}, 15g: ${recentForm15.toFixed(1)})`);
          console.log(`   Recent Volatility: ${recentFormVolatility.toFixed(2)} (consistency measure)`);
          console.log(`   Non-Scoring Contributions: ${recentNonScoringContributions.toFixed(1)} (assists + rebounds)`);
          console.log(`   Season Avg: ${seasonAveragePoints}`);
          console.log(`   Raw Pace: Team=${rawTeamPace.toFixed(1)}${teamPaceData ? ' (actual)' : ' (league avg)'}, Opponent=${rawOpponentPace.toFixed(1)}${opponentPaceData ? ' (actual)' : ' (league avg)'}`);
          console.log(`   Pace Interaction: ${paceInteraction.toFixed(0)} (team × opponent)`);
          console.log(`   Defense: Opponent=${opponentPointsAllowed}${opponentDefenseData ? ' (actual)' : ' (league avg)'}, Team=${teamPointsScored}${teamOffenseData ? ' (actual)' : ' (league avg)'}`);
          console.log(`   Starter Status: ${isStarter ? 'Yes' : 'No'} (${expectedMinutes.toFixed(1)} min expected, ${historicalMinutes.toFixed(1)} min historical)`);
          console.log(`   Starter-Minutes Interaction: ${starterMinutesInteraction.toFixed(1)}`);
          console.log(`   Usage Rate: ${(usageRate * 100).toFixed(1)}%${usageMap[playerName] ? ' (actual)' : ' (calculated)'}`);
          console.log(`   3PT Volume: ${threePointVolume.toFixed(1)} attempts`);
          console.log(`   3PT Efficiency: ${(threePointEfficiency * 100).toFixed(1)}%`);
          console.log(`   2PT Efficiency: ${(twoPointEfficiency * 100).toFixed(1)}% (for post players)`);
          console.log(`   Shot Volume: ${shotVolume.toFixed(1)} total attempts`);
          console.log(`   Shot Distribution: ${(shotDistributionRatio * 100).toFixed(1)}% 3PT attempts`);
          console.log(`   Opponent 3PT Defense: ${(opponent3ptDefense * 100).toFixed(1)}% allowed${opponentDefenseData ? ' (actual)' : ' (league avg)'}`);
          console.log(`   Opponent Post Defense: ${opponentPostDefense.toFixed(1)} pts allowed in paint${opponentDefenseData ? ' (actual)' : ' (league avg)'}`);
          console.log(`   Player Role: ${playerRolePlaymaker ? 'Playmaker' : 'Scorer'} (A/P: ${assistToPointsRatio.toFixed(2)})`);
          console.log(`   Time Decay Weight: ${timeDecayWeight.toFixed(3)} (${daysSinceGame.toFixed(0)} days ago)`);
          console.log(`   Days Rest (log): ${daysRestLog.toFixed(2)}`);
          console.log(`   Actual Points: ${currentGame.points}`);
        }
          
          trainingData.push({
            features,
            target: currentGame.points,
            player: playerName,
            gameDate: currentGame.game_date,
            opponent: currentGame.opponent,
            season: currentGame.season
          });
          processedGames++;
          playerSamplesAdded++;
          
          // Log every 5th sample for this player
          if (playerSamplesAdded % 5 === 0) {
            console.log(`   📊 Added ${playerSamplesAdded} samples for ${playerName} (${currentGame.game_date} vs ${currentGame.opponent}: ${currentGame.points} pts)`);
          }
        }
      }
      
      // Log completion for this player
      if (playerSamplesAdded > 0) {
        console.log(`   ✅ Completed ${playerName}: ${playerSamplesAdded} samples added`);
      } else {
        console.log(`   ⚠️  Skipped ${playerName}: No valid samples (insufficient data)`);
      }
    }
    
    console.log(`📊 Prepared ${trainingData.length} training samples`);
    console.log(`   2025 samples: ${trainingData.filter(d => d.season === '2025').length}`);
    console.log(`   2024 samples: ${trainingData.filter(d => d.season === '2024').length}`);
    
    if (trainingData.length < 100) {
      throw new Error('Not enough training data. Need at least 100 samples.');
    }
    
    // Prepare data for training with weights
    const X = trainingData.map(d => d.features);
    const y = trainingData.map(d => d.target);
    const weights = trainingData.map(d => d.weight);
    
    // WNBA-specific: Apply Ridge regularization to prevent overfitting
    // Lambda = 0.1 is a good starting point for WNBA data size
    const lambda = 0.1;
    
    console.log('\n🤖 Training WNBA-optimized Ridge regression model...');
    console.log(`   Training with ${trainingData.length} total samples`);
    console.log(`   Features: ${featureNames.length} (advanced feature engineering)`);
    console.log(`   Regularization (λ): ${lambda} (prevents overfitting for WNBA sample size)`);
    console.log(`   Advanced Features: Player Roles, Time Decay Weighting, Enhanced Shooting (2PT/3PT), Post Defense`);
    
    // Debug: Check time decay weights
    const timeDecayWeights = trainingData.map(sample => sample.features[sample.features.length - 1]);
    const validWeights = timeDecayWeights.filter(w => !isNaN(w) && w > 0);
    console.log(`   Time Decay Weights: Min=${Math.min(...validWeights).toFixed(3)}, Max=${Math.max(...validWeights).toFixed(3)}, Avg=${(validWeights.reduce((a,b) => a+b, 0) / validWeights.length).toFixed(3)}`);
    
    // Train the model with time decay weighting (exponential decay based on game recency)
    const weightedX = [];
    const weightedY = [];
    
    trainingData.forEach((sample, index) => {
      // For now, use simple weighting without time decay to fix NaN issue
      // 2025 data gets 1.5x weight, 2024 data gets 1.0x weight
      const season = sample.season || '2024'; // Default to 2024 if no season
      
      if (season === '2025') {
        // 2025 data: add 1 sample + 50% chance for 2nd sample = 1.5x on average
        weightedX.push(sample.features);
        weightedY.push(sample.target);
        if (Math.random() < 0.5) { // 50% chance for the 0.5x
          weightedX.push(sample.features);
          weightedY.push(sample.target);
        }
      } else {
        // 2024 data: add 1 sample = 1x
        weightedX.push(sample.features);
        weightedY.push(sample.target);
      }
    });
    
    // Convert to proper format for Ridge Regression (regularized linear regression)
    const XMatrix = weightedX.map(row => [1, ...row]); // Add intercept column
    const yMatrix = weightedY.map(val => [val]); // Convert to 2D array
    
    // Debug: Check for invalid values
    console.log(`   Weighted samples: ${weightedX.length}`);
    console.log(`   XMatrix dimensions: ${XMatrix.length} x ${XMatrix[0]?.length || 0}`);
    console.log(`   yMatrix dimensions: ${yMatrix.length} x ${yMatrix[0]?.length || 0}`);
    
    // Check for NaN or infinite values
    const hasNaN = XMatrix.some(row => row.some(val => isNaN(val) || !isFinite(val)));
    const yHasNaN = yMatrix.some(row => row.some(val => isNaN(val) || !isFinite(val)));
    console.log(`   XMatrix has NaN/Inf: ${hasNaN}`);
    console.log(`   yMatrix has NaN/Inf: ${yHasNaN}`);
    
    // Implement Ridge Regression for WNBA data
    const regression = trainRidgeRegression(XMatrix, yMatrix, lambda);
    console.log('   ✅ Ridge regression model training completed');
    
    // Calculate performance metrics
    const predictions = XMatrix.map(x => regression.predict(x)[0]); // Extract single value
    const residuals = yMatrix.map((actual, i) => actual[0] - predictions[i]); // Extract single value
    const mse = residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length;
    const rmse = Math.sqrt(mse);
    const mae = residuals.reduce((sum, r) => sum + Math.abs(r), 0) / residuals.length;
    
    // Calculate R²
    const yMean = yMatrix.reduce((sum, val) => sum + val[0], 0) / yMatrix.length;
    const ssRes = residuals.reduce((sum, r) => sum + r * r, 0);
    const ssTot = yMatrix.reduce((sum, val) => sum + (val[0] - yMean) * (val[0] - yMean), 0);
    const rSquared = 1 - (ssRes / ssTot);
    
    console.log('📊 Model Performance:');
    console.log(`   R² = ${(rSquared * 100).toFixed(1)}%`);
    console.log(`   RMSE = ${rmse.toFixed(2)}`);
    console.log(`   MAE = ${mae.toFixed(2)}`);
    console.log(`   Intercept = ${regression.coefficients[0].toFixed(4)}`);
    
    // Save model to database
    const modelData = {
      intercept: regression.coefficients[0], // Extract single value
      coefficients: regression.coefficients.slice(1), // Extract single values
      featureNames: featureNames,
      rSquared: rSquared,
      rmse: rmse,
      mae: mae,
      trainingSamples: trainingData.length,
      seasonBreakdown: {
        '2025': trainingData.filter(d => d.season === '2025').length,
        '2024': trainingData.filter(d => d.season === '2024').length
      },
      trainedAt: new Date().toISOString()
    };
    
    console.log('\n💾 Saving model to database...');
    console.log(`   Model ID: GENERAL_POINTS`);
    console.log(`   Stat Type: points`);
    console.log(`   Season: 2025`);
    console.log(`   R²: ${rSquared.toFixed(4)}`);
    console.log(`   RMSE: ${rmse.toFixed(2)}`);
    console.log(`   MAE: ${mae.toFixed(2)}`);
    console.log(`   Training Samples: ${trainingData.length}`);
    
    // Delete existing model first, then insert new one
    const { error: deleteError } = await supabase
      .from('regression_models')
      .delete()
      .eq('player_id', 'GENERAL_POINTS')
      .eq('stat_type', 'points')
      .eq('season', '2025');
    
    if (deleteError) {
      console.log('⚠️  Warning: Could not delete existing model:', deleteError.message);
    } else {
      console.log('🗑️  Deleted existing model successfully');
    }
    
    const { error: saveError } = await supabase
      .from('regression_models')
      .insert({
        player_id: 'GENERAL_POINTS',
        stat_type: 'points',
        season: '2025',
        model_data: modelData,
        created_at: new Date().toISOString()
      });
    
    if (saveError) {
      throw new Error(`Failed to save model: ${saveError.message}`);
    }
    
    console.log('✅ Points model trained and saved successfully to database!');
    console.log('🎯 Model is now ready for projections!');
    console.log('🎯 Features used:', featureNames.join(', '));
    
    // Test the model with sample data
    console.log('\n🧪 Testing model with sample data...');
    const testSample = trainingData[0];
    const testFeatures = [1, ...testSample.features]; // Add intercept
    const testPrediction = regression.predict(testFeatures)[0]; // Extract single value
    console.log(`   Sample: ${testSample.player} vs ${testSample.opponent} (${testSample.season})`);
    console.log(`   Actual: ${testSample.target} points`);
    console.log(`   Predicted: ${testPrediction.toFixed(1)} points`);
    console.log(`   Error: ${Math.abs(testSample.target - testPrediction).toFixed(1)} points`);
    
    console.log('\n🎉 TRAINING COMPLETE!');
    console.log('📊 Summary:');
    console.log(`   • Total players processed: ${Object.keys(playerGames).length}`);
    console.log(`   • Total training samples: ${trainingData.length}`);
    console.log(`   • 2025 samples: ${trainingData.filter(d => d.season === '2025').length}`);
    console.log(`   • 2024 samples: ${trainingData.filter(d => d.season === '2024').length}`);
    console.log(`   • Model performance: R² = ${rSquared.toFixed(4)}, RMSE = ${rmse.toFixed(2)}`);
    console.log(`   • Model saved to database: ✅`);
    console.log('🚀 Ready for projections!');
    
  } catch (error) {
    console.error('❌ Error training points model:', error);
    process.exit(1);
  }
}

trainPointsModel();

