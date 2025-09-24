import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RandomForestPredictor, RandomForestModel, PredictionInput } from '../../../../lib/algorithms/RandomForestPredictor';

// Create Supabase client with service role key for server-side access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normalize player names to handle different spellings
function normalizePlayerName(name: string): string {
  const normalized = name.toLowerCase()
    .replace(/[''`]/g, '') // Remove apostrophes and backticks
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // Handle specific known variations
  if (normalized.includes('aja') && normalized.includes('wilson')) {
    return "A'ja Wilson";
  }
  
  return name; // Return original if no specific mapping found
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerName, team, opponent, statType, isHome, gameDate, daysRest, teammateInjuries, sportsbookLine } = body;

    // Normalize player name to handle different spellings
    const normalizedPlayerName = normalizePlayerName(playerName);
    console.log(`🧠 STAT-MODEL API: Generating ${statType} projection for ${normalizedPlayerName} vs ${opponent} (original: ${playerName})`);

    // Validate stat type
    const validStatTypes = ['points', 'rebounds', 'assists'];
    if (!validStatTypes.includes(statType)) {
      return NextResponse.json({
        success: false,
        message: `Invalid stat type: ${statType}. Must be one of: ${validStatTypes.join(', ')}`
      }, { status: 400 });
    }

    // Try to get Random Forest model first, then fall back to linear regression
    let model = null;
    let modelError = null;
    let isRandomForest = false;
    
    // Use Random Forest models for all players - these are the primary models
    const randomForestModelId = statType === 'points' ? 'RANDOM_FOREST_POINTS' : 
                               statType === 'rebounds' ? 'GENERAL_REBOUNDS_RF' : 
                               statType === 'assists' ? 'RANDOM_FOREST_ASSISTS' : null;
    
    if (randomForestModelId) {
      const { data: randomForestModel, error: rfError } = await supabase
        .from('regression_models')
        .select('*')
        .eq('player_id', randomForestModelId)
        .eq('stat_type', statType)
        .eq('season', '2025')
        .single();
      
      if (!rfError && randomForestModel?.model_data) {
        model = randomForestModel;
        isRandomForest = true;
        
        // Normalize the model data structure for RandomForestPredictor
        if (model.model_data.model_type === 'random_forest') {
          // Convert old structure to new structure
          model.model_data = {
            modelType: 'random_forest',
            hyperparameters: {
              nEstimators: model.model_data.n_estimators || 100,
              maxDepth: model.model_data.max_depth || 10,
              minSamplesSplit: model.model_data.min_samples_split || 5,
              minSamplesLeaf: model.model_data.min_samples_leaf || 1,
              maxFeatures: model.model_data.max_features || 'sqrt'
            },
            performance: {
              rSquared: model.model_data.r_squared || model.r_squared || 0,
              rmse: model.model_data.rmse || model.rmse || 0,
              mae: model.model_data.mae || model.mae || 0
            },
            features: model.model_data.feature_names || [],
            trainingData: {
              total: model.model_data.training_samples || 0,
              '2025': 0,
              '2024': 0
            },
            trainedAt: new Date().toISOString()
          };
        }
        
        console.log(`✅ STAT-MODEL API: Using Random Forest model for ${playerName} - ${statType}`);
      } else {
        modelError = rfError;
        console.log(`❌ STAT-MODEL API: No Random Forest model found for ${statType}`);
      }
    } else {
      modelError = new Error(`Unsupported stat type: ${statType}`);
      console.log(`❌ STAT-MODEL API: Unsupported stat type: ${statType}`);
    }

    if (modelError || !model?.model_data) {
      console.log(`❌ STAT-MODEL API: No trained model found for ${statType}`);
      return NextResponse.json({
        success: false,
        message: `No trained model found for ${statType}. Please ensure the model has been trained.`
      }, { status: 404 });
    }

    console.log(`✅ STAT-MODEL API: Found ${statType} model (ID: ${model.id})`);
    if (isRandomForest) {
      console.log(`   Model Type: Random Forest`);
      const rSquared = model.model_data.performance?.rSquared || model.model_data.r_squared || 0;
      const rmse = model.model_data.performance?.rmse || model.model_data.rmse || 0;
      const mae = model.model_data.performance?.mae || model.model_data.mae || 0;
      console.log(`   Model Performance: R² = ${(rSquared * 100).toFixed(1)}%, RMSE = ${rmse.toFixed(2)}, MAE = ${mae.toFixed(2)}`);
      console.log(`   Features: ${model.model_data.features?.length || model.model_data.feature_names?.length || 0}`);
      console.log(`   Hyperparameters: ${model.model_data.hyperparameters?.nEstimators || model.model_data.n_estimators || 0} trees, depth ${model.model_data.hyperparameters?.maxDepth || model.model_data.max_depth || 0}`);
    } else {
      console.log(`   Model Type: Linear Regression`);
      console.log(`   Model Performance: R² = ${(model.model_data.rSquared * 100).toFixed(1)}%, RMSE = ${model.model_data.rmse.toFixed(2)}, MAE = ${model.model_data.mae.toFixed(2)}`);
      console.log(`   Model structure: intercept=${model.model_data.intercept}, coefficients.length=${model.model_data.coefficients?.length || 0}`);
      console.log(`   Feature names: ${model.model_data.featureNames?.slice(0, 10).join(', ')}...`);
    }

    // Get player's recent game data for feature calculation (last 10 games)
    const { data: recentGames, error: gamesError } = await supabase
      .from('wnba_game_logs')
      .select('*')
      .eq('player_name', normalizedPlayerName)
      .limit(10);
    
    // Sort by date properly (chronological, not alphabetical)
    if (recentGames && recentGames.length > 0) {
      recentGames.sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime());
    }

    // Get ALL games for the season for accurate season count
    const { data: allSeasonGames, error: allGamesError } = await supabase
      .from('wnba_game_logs')
      .select('game_date')
      .eq('player_name', normalizedPlayerName)
      .like('game_date', '%2025%');

    if (gamesError || !recentGames || recentGames.length === 0) {
      return NextResponse.json({
        success: false,
        message: `No game data found for ${normalizedPlayerName}`
      }, { status: 404 });
    }

    // Get player's season averages
    const { data: seasonAverages, error: seasonError } = await supabase
      .from('player_season_stats')
      .select('*')
      .eq('player_name', normalizedPlayerName)
      .eq('season', '2025')
      .single();

    if (seasonError || !seasonAverages) {
      console.log(`⚠️ STAT-MODEL API: No season averages found for ${normalizedPlayerName}, calculating from game logs`);
    }

    // Get player's advanced stats (usage percentage, etc.)
    const { data: advancedStats, error: advancedError } = await supabase
      .from('player_advanced_stats')
      .select('*')
      .eq('player_name', normalizedPlayerName)
      .eq('season', '2025')
      .single();

    if (advancedError || !advancedStats) {
      console.log(`⚠️ STAT-MODEL API: No advanced stats found for ${normalizedPlayerName}`);
    }

    // Calculate recent form with position-specific weighting for rebounds
    let recentForm = 0;
    
    if (statType === 'rebounds') {
      // For rebounds: 30% last 5 games, 30% last 15 games, 40% season average
      const last5Games = recentGames.slice(0, 5);
      const last15Games = recentGames.slice(0, 15);
      
      const last5Values = last5Games.map(game => game[statType]).filter(val => val !== undefined && !isNaN(val));
      const last15Values = last15Games.map(game => game[statType]).filter(val => val !== undefined && !isNaN(val));
      
      const last5Avg = last5Values.length > 0 ? last5Values.reduce((sum, val) => sum + val, 0) / last5Values.length : 0;
      const last15Avg = last15Values.length > 0 ? last15Values.reduce((sum, val) => sum + val, 0) / last15Values.length : 0;
      
      // Get season average from all games
      const seasonValues = allSeasonGames.map(game => game[statType]).filter(val => val !== undefined && !isNaN(val));
      const seasonAvg = seasonValues.length > 0 ? seasonValues.reduce((sum, val) => sum + val, 0) / seasonValues.length : 0;
      
      // Weighted average: 30% last 5 + 30% last 15 + 40% season
      recentForm = (last5Avg * 0.3) + (last15Avg * 0.3) + (seasonAvg * 0.4);
      
      console.log(`🏀 Rebounds Recent Form: L5=${last5Avg.toFixed(1)}, L15=${last15Avg.toFixed(1)}, Season=${seasonAvg.toFixed(1)} → Weighted=${recentForm.toFixed(1)}`);
    } else {
      // For other stats: use simple average of last 10 games
      const recentFormGames = recentGames.slice(0, 10);
      const recentValues = recentFormGames.map(game => game[statType]).filter(val => val !== undefined && !isNaN(val));
      recentForm = recentValues.length > 0 ? recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length : 0;
    }

    // Get team pace data
    const teamNameMap = {
      'WAS': 'Washington Mystics', 'CON': 'Connecticut Sun', 'LVA': 'Las Vegas Aces',
      'IND': 'Indiana Fever', 'MIN': 'Minnesota Lynx', 'NYL': 'New York Liberty',
      'LAS': 'Los Angeles Sparks', 'DAL': 'Dallas Wings', 'PHO': 'Phoenix Mercury',
      'CHI': 'Chicago Sky', 'ATL': 'Atlanta Dream', 'SEA': 'Seattle Storm',
      'GSV': 'Golden State Valkyries'
    };

    const fullTeamName = teamNameMap[team as keyof typeof teamNameMap] || team;
    const fullOpponentName = teamNameMap[opponent as keyof typeof teamNameMap] || opponent;

    // Get team and opponent pace data
    const [teamPaceResult, opponentPaceResult] = await Promise.all([
      supabase.from('team_pace_stats').select('pace, rank').eq('team_name', fullTeamName).eq('season', '2025').single(),
      supabase.from('team_pace_stats').select('pace, rank').eq('team_name', fullOpponentName).eq('season', '2025').single()
    ]);

    const teamPace = teamPaceResult.data?.pace || 100;
    const opponentPace = opponentPaceResult.data?.pace || 100;

    // Get team defensive stats for opponent analysis
    const { data: opponentDefense } = await supabase
      .from('team_defensive_stats')
      .select('overall_avg_allowed, opp_fg_pct, opp_3p_pct, opp_pts')
      .eq('team', fullOpponentName)
      .eq('stat_type', 'points')
      .eq('season', '2025')
      .single();

    // Get player position for position-specific defense analysis
    const { data: playerData } = await supabase
      .from('players')
      .select('position')
      .eq('name', normalizedPlayerName)
      .eq('team', team) // Use the original team code, not the full name
      .single();

    const playerPosition = playerData?.position || 'G';
    
    
    // Map position to stat_type for position-specific defense
    const positionStatType = playerPosition === 'G' ? 'guard_defense' : 
                            playerPosition === 'F' ? 'forward_defense' : 
                            'center_defense';

    // Get position-specific defensive stats
    const { data: positionDefense } = await supabase
      .from('team_defensive_stats')
      .select('overall_avg_allowed, opp_fg_pct, opp_3p_pct, opp_pts')
      .eq('team', fullOpponentName)
      .eq('stat_type', positionStatType)
      .eq('season', '2025')
      .single();


    // Calculate days rest (simplified)
    const daysRestValue = daysRest || 2;

    let projectionResult;

    if (isRandomForest) {
      // Use Random Forest predictor
      console.log(`🌲 STAT-MODEL API: Using Random Forest prediction`);
      
      const predictor = new RandomForestPredictor(model.model_data as RandomForestModel);
      
      const predictionInput: PredictionInput = {
        playerName: normalizedPlayerName,
        team,
        opponent,
        statType: statType as 'points' | 'rebounds' | 'assists',
        isHome,
        gameDate,
        daysRest: daysRestValue,
        sportsbookLine: sportsbookLine ? parseFloat(sportsbookLine) : undefined,
        teammateInjuries: teammateInjuries || []
      };

      const additionalData = {
        seasonAverages,
        advancedStats,
        recentForm: { [statType]: recentForm },
        recentGames: recentGames, // Pass the actual recent games data
        teamPace,
        opponentPace,
        opponentDefense: {
          overall_rating: 100 - (opponentDefense?.overall_avg_allowed || 80) + 80, // Convert to rating scale
          points_allowed: opponentDefense?.opp_pts || 80,
          opp_fg_pct: opponentDefense?.opp_fg_pct || 0.45,
          opp_3p_pct: opponentDefense?.opp_3p_pct || 0.35,
          rebounds_allowed: 40, // Default value since property doesn't exist
          position_rebounds: 40 // Default value since property doesn't exist
        },
        positionDefense: {
          points_allowed: positionDefense?.opp_pts || 80,
          opp_fg_pct: positionDefense?.opp_fg_pct || 0.45,
          opp_3p_pct: positionDefense?.opp_3p_pct || 0.35,
          overall_avg_allowed: positionDefense?.overall_avg_allowed || 80
        },
        playerPosition: playerData?.position || 'G',
        teamOffense: { points_scored: 80 }, // Default team offense
        gamesPlayed: allSeasonGames?.length || recentGames.length,
        timeDecayWeight: 1,
        playerInjured: false,
        teammateInjuries: teammateInjuries || [],
        teammateReboundingStrength: 40 // Default teammate rebounding strength
      };

      // Debug logging for injury data
      console.log(`🔧 API: Request team: ${team}, teammateInjuries from request: ${JSON.stringify(teammateInjuries)}`);
      console.log(`🔧 API: Calling RandomForestPredictor.predict with teammateInjuries: ${JSON.stringify(teammateInjuries)}`);
      projectionResult = await predictor.predict(predictionInput, additionalData);
      console.log(`✅ API: RandomForestPredictor.predict completed with result: ${projectionResult.projectedValue}`);
      
    } else {
      // Use linear regression model (existing logic)
      console.log(`📊 STAT-MODEL API: Using Linear Regression prediction`);
      
      // Create feature vector based on the model's expected features
      const features: Record<string, number> = {};
      
      // Base features that most models expect
      if (model.model_data.featureNames) {
        model.model_data.featureNames.forEach((featureName: any) => {
          switch (featureName) {
            case 'points':
              features[featureName] = statType === 'points' ? recentForm : (seasonAverages?.points_per_game || 0);
              break;
            case 'total_rebounds':
              features[featureName] = statType === 'rebounds' ? recentForm : (seasonAverages?.rebounds_per_game || 0);
              break;
            case 'assists':
              features[featureName] = statType === 'assists' ? recentForm : (seasonAverages?.assists_per_game || 0);
              break;
            case 'home_away':
              features[featureName] = isHome ? 1 : 0;
              break;
            case 'season_2025':
              features[featureName] = 1;
              break;
            case 'team_pace':
              features[featureName] = teamPace / 100;
              break;
            case 'opponent_pace':
              features[featureName] = opponentPace / 100;
              break;
            case 'position_defense_rating':
              features[featureName] = 0.5; // Default value
              break;
            case 'usage_percentage':
              features[featureName] = (seasonAverages?.usage_percentage || 20) / 100;
              break;
            // Handle other stat features that might be in the model
            case 'steals':
              features[featureName] = seasonAverages?.steals_per_game || 1.0;
              break;
            case 'blocks':
              features[featureName] = seasonAverages?.blocks_per_game || 1.0;
              break;
            case 'turnovers':
              features[featureName] = seasonAverages?.turnovers_per_game || 2.0;
              break;
            case 'personal_fouls':
              features[featureName] = seasonAverages?.personal_fouls_per_game || 2.0;
              break;
            case 'minutes_played':
              features[featureName] = seasonAverages?.minutes_per_game || 30.0;
              break;
            case 'field_goal_percentage':
              features[featureName] = (seasonAverages?.field_goal_percentage || 45) / 100;
              break;
            case 'three_point_percentage':
              features[featureName] = (seasonAverages?.three_point_percentage || 30) / 100;
              break;
            case 'free_throw_percentage':
              features[featureName] = (seasonAverages?.free_throw_percentage || 80) / 100;
              break;
            default:
              // Handle team-specific features
              if (featureName.startsWith('team_')) {
                const teamAbbr = featureName.replace('team_', '');
                features[featureName] = team === teamAbbr ? 1 : 0;
              } else if (featureName.startsWith('opponent_')) {
                const oppAbbr = featureName.replace('opponent_', '');
                features[featureName] = opponent === oppAbbr ? 1 : 0;
              } else {
                features[featureName] = 0; // Default for unknown features
              }
          }
        });
      }

      console.log(`📊 STAT-MODEL API: Feature vector created with ${Object.keys(features).length} features`);
      
      // Use the actual trained model for prediction
      console.log(`📊 STAT-MODEL API: Using trained linear model for prediction`);
      
      // Start with intercept
      let prediction = model.model_data.intercept || 0;
      console.log(`📊 STAT-MODEL API: Starting with intercept: ${prediction}`);
      
      // Apply model coefficients to features
      if (model.model_data.coefficients && model.model_data.coefficients.length > 0) {
        console.log(`📊 STAT-MODEL API: Applying ${model.model_data.coefficients.length} coefficients`);
        
        // Apply coefficients to features
        model.model_data.coefficients.forEach((coefficient: number, index: number) => {
          if (model.model_data.featureNames && model.model_data.featureNames[index]) {
            const featureName = model.model_data.featureNames[index];
            const featureValue = features[featureName] || 0;
            const contribution = coefficient * featureValue;
            prediction += contribution;
            
            // Log significant contributions for debugging
            if (Math.abs(contribution) > 0.1) {
              console.log(`   ${featureName}: ${coefficient} × ${featureValue} = ${contribution.toFixed(3)}`);
            }
          }
        });
      }
      
      console.log(`📊 STAT-MODEL API: Raw prediction before rounding: ${prediction}`);
      
      // If model prediction is still 0 or very low, use fallback logic
      if (prediction < 1.0) {
        console.log(`⚠️ STAT-MODEL API: Model prediction too low (${prediction}), using fallback logic`);
        
        let basePrediction = recentForm;
        
        // If we don't have recent form, use season averages or reasonable defaults
        if (basePrediction < 1.0) {
          if (statType === 'points') {
            basePrediction = seasonAverages?.points_per_game || 15.0;
          } else if (statType === 'rebounds') {
            basePrediction = seasonAverages?.rebounds_per_game || 6.0;
          } else if (statType === 'assists') {
            basePrediction = seasonAverages?.assists_per_game || 3.0;
          }
        }
        
        // Adjust for away game (typically slightly lower)
        if (!isHome) {
          basePrediction *= 0.95;
        }
        
        // Adjust for opponent defense (if opponent is strong defensively, reduce prediction)
        if (opponentDefense && opponentDefense.overall_avg_allowed && opponentDefense.overall_avg_allowed < 80) {
          basePrediction *= 0.98; // Slight reduction for strong defense
        }
        
        prediction = basePrediction;
        console.log(`📊 STAT-MODEL API: Fallback logic: ${recentForm} recent form → ${basePrediction.toFixed(1)} base → ${prediction.toFixed(1)} final`);
      }

      // Ensure prediction is reasonable
      prediction = Math.max(0, prediction);
      
      // Round based on stat type
      if (statType === 'points') {
        prediction = Math.round(prediction * 10) / 10; // 1 decimal place
      } else {
        prediction = Math.round(prediction); // Whole numbers for rebounds/assists
      }

      console.log(`🎯 STAT-MODEL API: Prediction: ${prediction} ${statType}`);

      // Calculate confidence based on model performance
      // Handle different data structures: model_data.performance.rSquared, model_data.rSquared, or database r_squared field
      const rSquared = model.model_data?.performance?.rSquared || 
                      model.model_data?.rSquared || 
                      model.r_squared || 
                      0;
      let confidence = 0;
      
      // Random Forest optimized confidence thresholds
      if (rSquared >= 0.8) confidence = 0.9; // Excellent model
      else if (rSquared >= 0.7) confidence = 0.85; // Very good model (Random Forest: 0.7222)
      else if (rSquared >= 0.6) confidence = 0.75; // Good model
      else if (rSquared >= 0.5) confidence = 0.65; // Fair model
      else confidence = 0.5; // Poor model

      // Calculate edge vs sportsbook line if available
      let edge = 0;
      let recommendation: 'OVER' | 'UNDER' | 'PASS' = 'PASS';
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
      
      if (sportsbookLine) {
        const sportsbookValue = parseFloat(sportsbookLine);
        edge = prediction - sportsbookValue;
        
        // Random Forest optimized edge thresholds - more conservative
        if (Math.abs(edge) < 1.0) {
          recommendation = 'PASS'; // Edge too small - need at least 1.0 edge
          riskLevel = 'HIGH';
        } else if (edge > 0) {
          recommendation = 'OVER';
          // Risk based on edge size
          if (Math.abs(edge) >= 2.5) riskLevel = 'LOW'; // Very strong edge
          else if (Math.abs(edge) >= 1.5) riskLevel = 'LOW'; // Strong edge
          else if (Math.abs(edge) >= 1.0) riskLevel = 'MEDIUM'; // Moderate edge
          else riskLevel = 'HIGH'; // Small edge
        } else {
          recommendation = 'UNDER';
          // Risk based on edge size
          if (Math.abs(edge) >= 2.5) riskLevel = 'LOW'; // Very strong edge
          else if (Math.abs(edge) >= 1.5) riskLevel = 'LOW'; // Strong edge
          else if (Math.abs(edge) >= 1.0) riskLevel = 'MEDIUM'; // Moderate edge
          else riskLevel = 'HIGH'; // Small edge
        }
      }

      // Determine risk level based on model performance
      if (rSquared >= 0.7) {
        riskLevel = 'LOW';
      } else if (rSquared >= 0.5) {
        riskLevel = 'MEDIUM';
      } else {
        riskLevel = 'HIGH';
      }

      // Create projection result matching ProjectionResult interface
      projectionResult = {
        projectedValue: prediction,
        confidenceScore: confidence,
        factors: {
          homeAway: isHome ? 1 : 0,
          backToBack: 0, // Default - could be enhanced later
          pace: (teamPace + opponentPace) / 200, // Normalized pace factor
          restFactor: daysRestValue / 7, // Normalized rest factor
          injuryImpact: 1, // Default - could be enhanced later
          headToHead: 0.5, // Default - could be enhanced later
          perFactor: 1, // Default - could be enhanced later
          regressionFactor: 1 // Default - could be enhanced later
        },
        riskLevel: riskLevel,
        edge: edge,
        recommendation: recommendation,
        historicalAccuracy: rSquared * 100,
        recentFormPercentage: ((recentForm / Math.max(prediction, 1)) * 100).toFixed(1),
        matchupAnalysis: (teamPace + opponentPace) / 200,
        seasonGamesCount: allSeasonGames?.length || recentGames.length,
        teammateInjuries: [],
        modelQuality: rSquared >= 0.7 ? 'Excellent' : rSquared >= 0.5 ? 'Good' : rSquared >= 0.3 ? 'Fair' : 'Poor',
        // Additional fields for compatibility
        method: 'linear_regression',
        statType: statType,
        modelId: model.id,
        modelPerformance: {
          rSquared: rSquared,
          rmse: model.model_data?.performance?.rmse || model.model_data?.rmse || model.rmse || 0,
          mae: model.model_data?.performance?.mae || model.model_data?.mae || model.mae || 0
        },
        recentForm: recentForm,
        matchupAnalysisText: `${isHome ? 'Home' : 'Away'} game vs ${opponent} (Pace: ${teamPace} vs ${opponentPace})`,
        features: features,
        // Enhanced breakdown stats for Random Forest
        breakdownStats: {
          recentFormAnalysis: recentForm > prediction * 1.1 ? 'Hot streak' : 
                             recentForm > prediction * 0.9 ? 'Good form' :
                             recentForm > prediction * 0.8 ? 'Average form' : 'Cold streak',
          paceAdvantage: teamPace - opponentPace > 5 ? 'Fast pace advantage' :
                        teamPace - opponentPace < -5 ? 'Slow pace disadvantage' : 'Neutral pace',
          usageRateAnalysis: (advancedStats?.usage_percentage || 20) >= 30 ? 'High usage star' :
                            (advancedStats?.usage_percentage || 20) >= 25 ? 'Primary option' :
                            (advancedStats?.usage_percentage || 20) >= 20 ? 'Secondary option' : 'Role player',
          starterStatus: (seasonAverages?.avg_minutes || 0) > 30 ? 'Heavy minutes starter' :
                        (seasonAverages?.avg_minutes || 0) > 20 ? 'Regular starter' : 'Bench player',
          modelReliability: rSquared >= 0.8 ? 'Excellent' : rSquared >= 0.7 ? 'Very Good' : 
                           rSquared >= 0.6 ? 'Good' : rSquared >= 0.5 ? 'Fair' : 'Poor'
        },
        timestamp: new Date().toISOString()
      };
    }

    console.log(`✅ STAT-MODEL API: ${statType} projection completed successfully`);
    console.log(`   ${normalizedPlayerName}: ${projectionResult.projectedValue} ${statType} (Confidence: ${(projectionResult.confidenceScore * 100).toFixed(1)}%)`);

    return NextResponse.json({
      success: true,
      method: projectionResult.method,
      statType: statType,
      result: projectionResult
    });

  } catch (error) {
    console.error('❌ STAT-MODEL API Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error while generating projection',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
