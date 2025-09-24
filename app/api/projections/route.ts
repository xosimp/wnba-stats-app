import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key for server-side access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerName, team, opponent, statType, isHome, gameDate, daysRest, teammateInjuries, sportsbookLine } = body;

    console.log('🧠 API: Generating projection for:', { playerName, statType, opponent });

    // FIRST: Try to use PACE-enhanced regression models as primary method
    console.log('🧠 API: Attempting regression model projection first...');
    
    try {
      // First try individual player model, then fall back to general model
      let model = null;
      let modelError = null;
      
      // Try individual player model first
      const { data: individualModel, error: individualError } = await supabase
        .from('regression_models')
        .select('model_data')
        .eq('player_id', playerName)
        .eq('stat_type', statType)
        .eq('season', '2025')
        .single();
      
      if (!individualError && individualModel?.model_data) {
        model = individualModel;
        console.log(`✅ API: Found individual model for ${playerName} - ${statType}`);
      } else {
        console.log(`⚠️ API: No individual model for ${playerName}, trying general model...`);
        
        // Fall back to general model
        const { data: generalModel, error: generalError } = await supabase
          .from('regression_models')
          .select('model_data')
          .eq('player_id', 'GENERAL_POINTS')
          .eq('stat_type', statType)
          .eq('season', '2025')
          .single();
        
        if (!generalError && generalModel?.model_data) {
          model = generalModel;
          console.log(`✅ API: Using general model for ${playerName} - ${statType}`);
        } else {
          modelError = generalError;
          console.log(`❌ API: No general model found for ${statType}`);
        }
      }
      
      if (modelError || !model?.model_data) {
        console.log(`❌ API: No regression model found for ${playerName} - ${statType}`);
        console.log(`   Error: ${modelError?.message || 'No model data'}`);
      } else {
        console.log(`✅ API: Found regression model with ${model.model_data.featureNames?.length || 0} features`);
        console.log(`   Features: ${model.model_data.featureNames?.join(', ')}`);
        
        // Check if PACE features are included
        const hasPace = model.model_data.featureNames?.includes('team_pace') && 
                       model.model_data.featureNames?.includes('opponent_pace');
        
        console.log(`⚡ API: PACE Features: ${hasPace ? '✅ INCLUDED' : '❌ MISSING'}`);
        
        // Get player's advanced stats for features
        const { data: playerStats, error: statsError } = await supabase
          .from('player_advanced_stats')
          .select('usage_percentage, position, team, avg_minutes')
          .eq('player_name', playerName)
          .eq('season', '2025')
          .single();
        
        if (statsError || !playerStats) {
          console.log(`❌ API: No advanced stats found for ${playerName}`);
        } else {
          // Get team pace data
          const teamNameMap = {
            'WAS': 'Washington Mystics',
            'CON': 'Connecticut Sun', 
            'LVA': 'Las Vegas Aces',
            'IND': 'Indiana Fever',
            'MIN': 'Minnesota Lynx',
            'NYL': 'New York Liberty',
            'LAS': 'Los Angeles Sparks',
            'DAL': 'Dallas Wings',
            'PHO': 'Phoenix Mercury',
            'CHI': 'Chicago Sky',
            'ATL': 'Atlanta Dream',
            'SEA': 'Seattle Storm',
            'GSV': 'Golden State Valkyries'
          };
          
          const fullTeamName = teamNameMap[playerStats.team as keyof typeof teamNameMap] || playerStats.team;
          
          const { data: teamPace, error: paceError } = await supabase
            .from('team_pace_stats')
            .select('pace, rank')
            .eq('team_name', fullTeamName)
            .eq('season', '2025')
            .single();
          
          if (paceError || !teamPace) {
            console.log(`❌ API: No team pace data found for ${fullTeamName}`);
          } else {
            // Get opponent pace data
            const { data: opponentPace, error: opponentPaceError } = await supabase
              .from('team_pace_stats')
              .select('pace, rank')
              .eq('team_name', opponent)
              .eq('season', '2025')
              .single();
            
            if (opponentPaceError || !opponentPace) {
              console.log(`❌ API: No opponent pace data found for ${opponent}`);
            } else {
                            // Get recent form (last 10 games) and compare to bookline
              // Fetch all games first, then sort manually to handle mixed date formats
              const { data: allGames, error: gamesError } = await supabase
                .from('wnba_game_logs')
                .select('points, rebounds, assists, steals, blocks, turnovers, game_date, opponent')
                .eq('player_name', playerName);
            
            if (gamesError) {
              console.log(`❌ API: Error fetching recent games: ${gamesError.message}`);
            } else {
              // Sort by actual date (convert string dates to Date objects for proper sorting)
              const sortedGames = allGames.sort((a, b) => {
                const dateA = new Date(a.game_date);
                const dateB = new Date(b.game_date);
                return dateB.getTime() - dateA.getTime(); // Most recent first
              });
              
              // Get the most recent 10
              const recentGames = sortedGames.slice(0, 10);
              // Calculate recent form average from last 10 games
              const recentValues = recentGames.map(game => game[statType as keyof typeof game] as number).filter(val => val !== undefined && !isNaN(val));
              const recentForm = recentValues.length > 0 ? recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length : 0;
              
              // Calculate recent form vs bookline if available
              const recentFormVsBookline = sportsbookLine ? (recentForm - sportsbookLine) : 0;
              
              console.log(`📊 API: Recent Form: ${recentForm.toFixed(1)} avg (last ${recentValues.length} games)`);
              console.log(`📊 API: Last 10 games: ${recentGames.map(g => `${g[statType as keyof typeof g]} vs ${g.opponent}`).join(', ')}`);
              if (sportsbookLine) {
                console.log(`📊 API: Recent Form vs Bookline: ${recentFormVsBookline > 0 ? '+' : ''}${recentFormVsBookline.toFixed(1)}`);
              }
                
                // Create feature values for prediction
                const features = {
                  usage_percentage: (playerStats.usage_percentage || 20) / 100,
                  position_defense_rating: 0.5, // Default - will be enhanced later
                  opponent_usage_allowed: 0.2, // Default - will be enhanced later
                  opponent_minutes_allowed: 0.25, // Default - will be enhanced later
                  rest_days: daysRest ? Math.min(7, daysRest) / 7 : 0.5,
                  recent_form: recentForm > 0 ? Math.max(0, recentForm) / 50 : 0.5,
                  season_avg: (playerStats.usage_percentage || 20) / 100,
                  team_pace: teamPace.pace / 100,
                  opponent_pace: opponentPace.pace / 100
                };
                
                console.log(`📊 API: Feature values:`, features);
                
                // Make prediction using the model
                const { coefficients, intercept } = model.model_data;
                
                if (coefficients && intercept !== null && intercept !== undefined) {
                  let prediction = intercept;
                  
                  // Apply each feature coefficient
                  Object.entries(coefficients).forEach(([feature, coefficient]) => {
                    if (coefficient !== null && features[feature as keyof typeof features] !== undefined) {
                      prediction += (coefficient as number) * features[feature as keyof typeof features];
                    }
                  });
                  
                  // Validate prediction
                  if (!isNaN(prediction) && isFinite(prediction)) {
                    // Calculate confidence intervals
                    const confidence = model.model_data.residualStandardDeviation || 5;
                    const confidenceInterval = {
                      lower: Math.max(0, prediction - confidence),
                      upper: prediction + confidence
                    };
                    
                    // Calculate honest confidence score based primarily on model performance
                    let baseConfidence = 0;
                    
                    // R² is the PRIMARY factor - models with poor R² get very low confidence
                    const rSquared = model.model_data.rSquared || 0;
                    if (rSquared >= 0.7) {
                        baseConfidence += 0.6; // Excellent model
                    } else if (rSquared >= 0.5) {
                        baseConfidence += 0.4; // Good model
                    } else if (rSquared >= 0.3) {
                        baseConfidence += 0.25; // Fair model
                    } else if (rSquared >= 0.1) {
                        baseConfidence += 0.1; // Poor model
                    } else {
                        baseConfidence += 0.05; // Worthless model (R² < 0.1)
                    }
                    
                    // Data quality impact (secondary factor)
                    const dataQuality = Math.min(1.0, recentGames.length / 15); // 15+ games = full quality
                    baseConfidence += dataQuality * 0.2;
                    
                    // RMSE impact (tertiary factor) - only matters if R² is decent
                    if (rSquared >= 0.3) {
                        const rmse = model.model_data.performanceMetrics?.rmse || 10;
                        if (rmse < 6) baseConfidence += 0.1; // Very low error
                        else if (rmse < 8) baseConfidence += 0.05; // Low error
                    }
                    
                    // PACE features bonus (only if R² is reasonable)
                    if (rSquared >= 0.2 && hasPace) {
                        baseConfidence += 0.05;
                    }
                    
                    // Cap confidence based on R² - poor models can't have high confidence
                    let maxConfidence = 0.95;
                    if (rSquared < 0.3) maxConfidence = 0.6; // Poor models capped at 60%
                    if (rSquared < 0.1) maxConfidence = 0.3; // Worthless models capped at 30%
                    
                    const confidenceScore = Math.min(maxConfidence, Math.max(0.05, baseConfidence));
                    
                    // Log detailed confidence calculation for transparency
                    console.log(`🔍 API: Confidence Calculation Breakdown:`);
                    console.log(`   R²: ${rSquared.toFixed(3)} (${rSquared >= 0.7 ? 'Excellent' : rSquared >= 0.5 ? 'Good' : rSquared >= 0.3 ? 'Fair' : rSquared >= 0.1 ? 'Poor' : 'Worthless'})`);
                    console.log(`   Data Quality: ${recentGames.length}/15 games = ${(dataQuality * 100).toFixed(0)}%`);
                    console.log(`   RMSE Impact: ${model.model_data.performanceMetrics?.rmse ? (model.model_data.performanceMetrics.rmse < 6 ? 'High' : model.model_data.performanceMetrics.rmse < 8 ? 'Medium' : 'None') : 'None'}`);
                    console.log(`   PACE Bonus: ${rSquared >= 0.2 && hasPace ? 'Yes' : 'No'}`);
                    console.log(`   Max Confidence Cap: ${(maxConfidence * 100).toFixed(0)}%`);
                    console.log(`   Final Confidence: ${(confidenceScore * 100).toFixed(0)}%`);
                    
                    // Determine risk level based on confidence and edge
                    let riskLevel = 'Very High';
                    if (confidenceScore >= 0.7) riskLevel = 'Low';
                    else if (confidenceScore >= 0.5) riskLevel = 'Medium';
                    else if (confidenceScore >= 0.3) riskLevel = 'High';
                    else riskLevel = 'Very High'; // R² < 0.1 models
                    
                    // Calculate edge vs sportsbook line if provided
                    const edge = sportsbookLine ? Math.max(0, prediction) - sportsbookLine : 0;
                    
                    // Get head-to-head performance vs this specific opponent
                    // Fetch all H2H games first, then sort manually to handle mixed date formats
                    const { data: allH2hGames, error: h2hError } = await supabase
                      .from('wnba_game_logs')
                      .select('points, rebounds, assists, steals, blocks, turnovers, game_date')
                      .eq('player_name', playerName)
                      .eq('opponent', opponent);
                    
                    let h2hGames: any[] = []; // Initialize h2hGames
                    
                    if (h2hError) {
                      console.log(`❌ API: Error fetching H2H games: ${h2hError.message}`);
                    } else {
                      // Sort by actual date (convert string dates to Date objects for proper sorting)
                      const sortedH2hGames = allH2hGames.sort((a, b) => {
                        const dateA = new Date(a.game_date);
                        const dateB = new Date(b.game_date);
                        return dateB.getTime() - dateA.getTime(); // Most recent first
                      });
                      
                      // Get the most recent 10 H2H games
                      h2hGames = sortedH2hGames.slice(0, 10);
                    }
                    
                    if (h2hError) {
                      console.log(`❌ API: Error fetching H2H data: ${h2hError.message}`);
                    }
                    
                    // Get opponent's defensive stats against this player's position
                    let opponentDefense = null;
                    let defenseError = null;
                    
                    // First try to get position-specific defensive stats
                    const { data: positionDefense, error: posDefenseError } = await supabase
                      .from('team_position_defense')
                      .select('*')
                      .eq('team', opponent)
                      .eq('season', '2025')
                      .eq('stat_type', statType)
                      .single();
                    
                    if (!posDefenseError && positionDefense) {
                      console.log(`✅ API: Found position-specific defensive stats for ${opponent}:`, positionDefense);
                      opponentDefense = [positionDefense]; // Convert to array for compatibility
                    } else {
                      console.log(`⚠️ API: No position-specific defense found, falling back to overall stats`);
                      
                      // Fallback to overall defensive stats
                      const { data: overallDefense, error: overallDefenseError } = await supabase
                        .from('team_defensive_stats')
                        .select('*')
                        .eq('team', opponent)
                        .eq('season', '2025');
                      
                      if (overallDefenseError) {
                        console.log(`❌ API: Error fetching overall defensive stats: ${overallDefenseError.message}`);
                        defenseError = overallDefenseError;
                      } else {
                        console.log(`✅ API: Found ${overallDefense.length} overall defensive stat records for ${opponent}`);
                        opponentDefense = overallDefense;
                        // Find the specific stat type record
                        const statRecord = overallDefense.find(stat => stat.stat_type === statType);
                        if (statRecord) {
                          console.log(`✅ API: Found ${statType} overall stats:`, statRecord);
                        }
                      }
                    }
                    
                    // Calculate H2H performance vs this opponent
                    let h2hPerformance = 0;
                    let h2hGamesCount = 0;
                    if (h2hGames && h2hGames.length > 0) {
                      const h2hValues = h2hGames.map(game => game[statType as keyof typeof game] as number).filter(val => val !== undefined && !isNaN(val));
                      if (h2hValues.length > 0) {
                        h2hPerformance = h2hValues.reduce((sum, val) => sum + val, 0) / h2hValues.length;
                        h2hGamesCount = h2hValues.length;
                      }
                    }
                    
                    // Enhanced matchup analysis using H2H + defensive stats (no recent form)
                    const matchupRating = calculateMatchupRating(
                      h2hPerformance, 
                      features.season_avg * 100, 
                      opponentDefense, 
                      playerStats.position,
                      statType
                    );
                    const matchupAnalysis = generateMatchupAnalysis(matchupRating, opponent, h2hPerformance, h2hGamesCount);
                    
                                          // Debug recent form calculation
                      console.log(`🔍 API: Recent Form Calculation Debug:`);
                      console.log(`   recentForm: ${recentForm}`);
                      console.log(`   playerStats.usage_percentage: ${playerStats.usage_percentage}`);
                      console.log(`   season average fallback: 15`);
                      console.log(`   calculated percentage: ${recentForm > 0 ? Math.round((recentForm / 15) * 100) : 100}%`);
                    
                    const result = {
                      projectedValue: Math.max(0, prediction),
                      confidenceInterval,
                      confidenceScore,
                      riskLevel,
                      edge,
                      // Add recommendation based on edge and confidence
                      recommendation: sportsbookLine ? (Math.abs(edge) >= 1.0 ? 
                        (edge > 0 ? 'Over' : 'Under') : 'Pass') : 'Pass',
                      factors: {
                        seasonAverage: features.season_avg * 100,
                        recentForm: recentForm,
                        teamPace: teamPace.pace,
                        opponentPace: opponentPace.pace,
                        usagePercentage: playerStats.usage_percentage,
                        position: playerStats.position
                      },
                      modelMetrics: {
                        rSquared: model.model_data.rSquared,
                        rmse: model.model_data.performanceMetrics?.rmse,
                        hasPaceFeatures: hasPace
                      },
                      // Legacy fields for compatibility
                      historicalAccuracy: Math.round(confidenceScore * 100),
                      recentFormPercentage: recentForm > 0 ? Math.round((recentForm / 15) * 100) : 100,
                      matchupAnalysis: matchupRating, // Return the numeric rating for UI comparison
                      matchupAnalysisText: matchupAnalysis, // Keep the text description
                      teammateInjuries: teammateInjuries || [],
                      seasonGamesCount: recentGames.length,
                      isHome: isHome || false,
                      // Enhanced confidence and risk metrics
                      confidenceLevel: Math.round(confidenceScore * 100),
                      riskAssessment: generateRiskAssessment(confidenceScore, Math.abs(edge)),
                      modelQuality: rSquared >= 0.7 ? 'Excellent' : rSquared >= 0.5 ? 'Good' : rSquared >= 0.3 ? 'Fair' : rSquared >= 0.1 ? 'Poor' : 'Worthless',
                      paceAdvantage: teamPace.pace > opponentPace.pace ? 'Favorable' : teamPace.pace < opponentPace.pace ? 'Unfavorable' : 'Neutral',
                      // Injury impact calculation
                      injuryImpact: calculateInjuryImpact(teammateInjuries, playerStats.position, team),
                      recentFormVsBookline: recentFormVsBookline
                    };
                    
                    console.log(`✅ API: Regression projection completed:`);
                    console.log(`   ${playerName}: ${prediction.toFixed(1)} ${statType}`);
                    console.log(`   Confidence: ${confidenceInterval.lower.toFixed(1)} - ${confidenceInterval.upper.toFixed(1)}`);
                    console.log(`   R²: ${model.model_data.rSquared?.toFixed(3)}`);
                    console.log(`   PACE Impact: Team ${teamPace.pace} vs Opponent ${opponentPace.pace}`);
                    console.log(`🔍 API: Final response data:`);
                    console.log(`   recentFormPercentage: ${recentForm > 0 ? Math.round((recentForm / 15) * 100) : 100}%`);
                    console.log(`   matchupAnalysis: ${matchupRating}`);
                    console.log(`   matchupAnalysisText: ${matchupAnalysis}`);
                    
                    return NextResponse.json({
                      success: true,
                      method: 'regression',
                      result
                    });
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ API: Error with regression service:', error);
    }
    
    // FALLBACK: Return error to trigger legacy method on client
    console.log('🔄 API: Regression failed, client should use legacy method');
    return NextResponse.json({
      success: false,
      method: 'fallback',
      message: 'Regression model not available, use legacy method'
    });
    
  } catch (error) {
    console.error('❌ API: Error in projection route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper methods for enhanced analysis
function calculateMatchupRating(
  h2hPerformance: number, 
  seasonAvg: number, 
  opponentDefense: any, 
  playerPosition: string, 
  statType: string
): number {
  let rating = 50; // Base neutral rating
  
  // Adjust based on H2H performance vs this opponent (70% weight - most important)
  if (h2hPerformance > 0 && seasonAvg > 0) {
    const h2hFactor = h2hPerformance / seasonAvg;
    if (h2hFactor > 1.3) rating += 35; // Dominates this opponent
    else if (h2hFactor > 1.1) rating += 25; // Performs well vs this opponent
    else if (h2hFactor > 0.9) rating += 10; // Slightly above average vs this opponent
    else if (h2hFactor < 0.9) rating -= 25; // Struggles vs this opponent
    else if (h2hFactor < 0.7) rating -= 35; // Really struggles vs this opponent
  }
  
  // Adjust based on opponent's defensive strength against this position (30% weight)
  if (opponentDefense && playerPosition) {
    let positionDefenseRating = 0;
    
    // Check if we have position-specific defensive stats
    if (opponentDefense.length === 1 && opponentDefense[0].center_defense !== undefined) {
      // Using position-specific defensive stats table
      const defenseStats = opponentDefense[0];
      
      if (playerPosition.includes('C') || playerPosition.includes('F-C') || playerPosition.includes('C-F')) {
        positionDefenseRating = defenseStats.center_defense || 0;
        console.log(`🛡️ API: Using center defense for ${playerPosition}: ${positionDefenseRating}`);
      } else if (playerPosition.includes('F') || playerPosition.includes('F-G') || playerPosition.includes('G-F')) {
        positionDefenseRating = defenseStats.forward_defense || 0;
        console.log(`🛡️ API: Using forward defense for ${playerPosition}: ${positionDefenseRating}`);
      } else if (playerPosition.includes('G') || playerPosition.includes('PG') || playerPosition.includes('SG')) {
        positionDefenseRating = defenseStats.guard_defense || 0;
        console.log(`🛡️ API: Using guard defense for ${playerPosition}: ${positionDefenseRating}`);
      }
      
      // Use league average from the table if available
      let leagueAverage = defenseStats.league_average || 0;
      if (leagueAverage === 0) {
        // Fallback to hardcoded averages
        if (statType === 'points') leagueAverage = 15;
        else if (statType === 'rebounds') leagueAverage = 8;
        else if (statType === 'assists') leagueAverage = 5;
      }
      
      if (leagueAverage > 0 && positionDefenseRating > 0) {
        const defenseFactor = positionDefenseRating / leagueAverage;
        console.log(`🛡️ API: Defense factor: ${positionDefenseRating}/${leagueAverage} = ${defenseFactor.toFixed(2)}`);
        if (defenseFactor < 0.8) rating += 20; // Weak defense at this position
        else if (defenseFactor > 1.2) rating -= 20; // Strong defense at this position
      }
    } else {
      // Using overall defensive stats table (fallback)
      const overallDefense = opponentDefense.find((stat: any) => stat.stat_type === statType);
      
      if (overallDefense) {
        console.log(`🛡️ API: Using overall defensive stats as fallback`);
        // For now, use overall defense as a proxy for position defense
        // This will be improved once position-specific data is available
        const overallRating = overallDefense.overall_avg_allowed || 0;
        if (overallRating > 0) {
          // Simple adjustment based on overall team defense
          if (overallRating < 80) rating += 10; // Strong overall defense
          else if (overallRating > 85) rating -= 10; // Weak overall defense
        }
      }
    }
  }
  
  return Math.max(0, Math.min(100, rating));
}

function generateMatchupAnalysis(matchupRating: number, opponent: string, h2hPerformance: number, h2hGamesCount: number): string {
  let baseText = '';
  
  if (matchupRating >= 75) baseText = 'Very Favorable';
  else if (matchupRating >= 65) baseText = 'Favorable';
  else if (matchupRating >= 45) baseText = 'Neutral';
  else if (matchupRating >= 35) baseText = 'Unfavorable';
  else baseText = 'Very Unfavorable';
  
  // Add H2H context if available
  if (h2hGamesCount > 0) {
    return `${baseText} vs ${opponent} (H2H: ${h2hPerformance.toFixed(1)} avg in ${h2hGamesCount} games)`;
  } else {
    return `${baseText} vs ${opponent} (no H2H data)`;
  }
}

function generateRiskAssessment(confidenceScore: number, edge: number): string {
  if (confidenceScore >= 0.7 && edge >= 3) return 'Low Risk - High Confidence';
  if (confidenceScore >= 0.6 && edge >= 2) return 'Medium Risk - Good Confidence';
  if (confidenceScore >= 0.5 && edge >= 1) return 'Medium Risk - Moderate Confidence';
  if (confidenceScore >= 0.3 && edge >= 1) return 'High Risk - Low Confidence';
  if (confidenceScore >= 0.1) return 'Very High Risk - Poor Model';
  return 'Extreme Risk - Worthless Model';
}

function calculateInjuryImpact(teammateInjuries: any[], playerPosition: string, team: string): string {
  if (!teammateInjuries || teammateInjuries.length === 0) {
    return 'No significant injuries';
  }
  
  // Count injuries by position
  const positionInjuries = teammateInjuries.filter(injury => {
    if (typeof injury === 'string') return true; // Simple string format
    return injury.playerName && injury.injuryStatus !== 'Probable';
  });
  
  if (positionInjuries.length === 0) {
    return 'No significant injuries';
  }
  
  // Calculate impact based on number of injuries
  if (positionInjuries.length === 1) {
    return `Minor impact: ${positionInjuries.length} injured teammate`;
  } else if (positionInjuries.length <= 3) {
    return `Moderate impact: ${positionInjuries.length} injured teammates`;
  } else {
    return `Major impact: ${positionInjuries.length} injured teammates`;
  }
}
