import { NextRequest, NextResponse } from 'next/server';
import { isSameTeam } from '../../../../../lib/utils/opponent-normalization';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Simple in-memory cache for API responses
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Clean up expired cache entries
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
}

// Clean up cache every 10 minutes
setInterval(cleanupCache, 10 * 60 * 1000);

// WNBA API configuration
const RAPIDAPI_KEY = 'b9fef5cbcbmsh3ae24f367e6e0acp12f58ejsn3c7ad2cc0f9f';
const RAPIDAPI_HOST = 'wnba-api.p.rapidapi.com';

// Player ID mappings - we need to find the correct WNBA API player IDs
const PLAYER_ID_MAPPINGS: Record<string, string> = {
  '62': '4433403',  // Caitlin Clark (IND) - CONFIRMED WORKING
  '54': '4066553',  // Aari McDonald (IND)
  '55': '2529130',  // Natasha Howard (IND)
  '56': '4432831',  // Aliyah Boston (IND)
  '57': '3907781',  // Sophie Cunningham (IND)
  '58': '4398829',  // Lexie Hull (IND)
  '59': '3142086',  // Brianna Turner (IND)
  '60': '2955898',  // Damiris Dantas (IND)
  '61': '4433546',  // Makayla Timpson (IND)
  '63': '1004',     // Sydney Colson (IND)
  '121': '918',     // Tina Charles (CONN) - CONFIRMED WORKING
  '145': '4433795', // Sania Feagin (LA)
  '146': '4433630', // Rickea Jackson (LA)
  '147': '2566106', // Dearica Hamby (LA)
  '149': '4398764', // Rae Burrell (LA)
  '150': '4703794', // Sarah Ashlee Barker (LA)
  '151': '4001679', // Julie Allemand (LA)
  '152': '4433404', // Cameron Brink (LA)
  '154': '2284331', // Emma Cannon (LA)
  '155': '2566110', // Julie Vanloo (LA)
  '168': '4398911', // Shakira Austin (WAS)
  '169': '4068159', // Sug Sutton (WAS)
  '171': '5017726', // Jade Melbourne (WAS)
  '172': '4704180', // Georgia Amoore (WAS)
  '174': '4398729', // Emily Engstler (WAS)
  '176': '4433408', // Aaliyah Edwards (WAS)
  '177': '2529183', // Stefanie Dolson (WAS)
  '178': '4433815', // Lucy Olsen (WAS)
  '180': '4433635', // Diamond Miller (MIN)
  '181': '3906753', // Natisha Hiedeman (MIN)
  '182': '3906972', // Bridget Carleton (MIN)
  '183': '5278237', // Anastasiia Olairi Kosu (MIN)
  '184': '3913881', // Alanna Smith (MIN)
  '186': '3906949', // Jessica Shepard (MIN)
  '189': '3056730', // Karlie Samuelson (MIN)
  '190': '4329370', // Maria Kliundikova (MIN)
  '192': '4399342', // Lexi Held (PHX)
  '193': '2998938', // Kahleah Copper (PHX)
  '194': '4068042', // Natasha Mack (PHX)
  '195': '5274110', // Monique Akoa Makani (PHX)
  '196': '3920741', // Kitija Laksa (PHX)
  '197': '869',     // DeWanna Bonner (PHX)
  '198': '3916514', // Kalani Brown (PHX)
  '199': '4282168', // Kiana Williams (PHX)
  '200': '3142087', // Kathryn Westbeld (PHX)
  '202': '887',     // Sami Whitcomb (PHX)
  // Need to find: Jewell Loyd, A'ja Wilson, Breanna Stewart, etc.
};

function parsePlayerStats(apiResponse: any) {
  try {
    const playerStats = apiResponse.player_stats;
    
    if (!playerStats || !playerStats.categories) {
      return null;
    }

    // Find the averages category
    const averagesCategory = playerStats.categories.find((cat: any) => cat.name === 'averages');
    
    if (!averagesCategory || !averagesCategory.statistics) {
      return null;
    }

    // Get the 2025 season stats (most recent)
    const currentSeasonStats = averagesCategory.statistics.find((stat: any) => 
      stat.season && stat.season.year === 2025
    );

    if (!currentSeasonStats) {
      return null;
    }

    const stats = currentSeasonStats.stats;
    
    // Map the stats to our database format
    return {
      gamesPlayed: parseFloat(stats[0]) || 0,
      gamesStarted: parseFloat(stats[1]) || 0,
      avgMinutes: parseFloat(stats[2]) || 0,
      avgPoints: parseFloat(stats[3]) || 0,
      avgOffensiveRebounds: parseFloat(stats[4]) || 0,
      avgDefensiveRebounds: parseFloat(stats[5]) || 0,
      avgRebounds: parseFloat(stats[6]) || 0,
      avgAssists: parseFloat(stats[7]) || 0,
      avgSteals: parseFloat(stats[8]) || 0,
      avgBlocks: parseFloat(stats[9]) || 0,
      avgTurnovers: parseFloat(stats[10]) || 0,
      fieldGoalsMade: parseFloat(stats[11].split('-')[0]) || 0,
      fieldGoalsAttempted: parseFloat(stats[11].split('-')[1]) || 0,
      fieldGoalPercentage: parseFloat(stats[12]) || 0,
      threePointersMade: parseFloat(stats[13].split('-')[0]) || 0,
      threePointersAttempted: parseFloat(stats[13].split('-')[1]) || 0,
      threePointPercentage: parseFloat(stats[14]) || 0,
      freeThrowsMade: parseFloat(stats[15].split('-')[0]) || 0,
      freeThrowsAttempted: parseFloat(stats[15].split('-')[1]) || 0,
      freeThrowPercentage: parseFloat(stats[16]) || 0,
      avgFouls: parseFloat(stats[17]) || 0
    };
    
  } catch (error) {
    console.error('Error parsing player stats:', error);
    return null;
  }
}

async function fetchLivePlayerStats(playerId: string) {
  try {
    const wnbaPlayerId = PLAYER_ID_MAPPINGS[playerId];
    
    if (!wnbaPlayerId) {
      return null;
    }

    const url = `https://wnba-api.p.rapidapi.com/player-statistic?playerId=${wnbaPlayerId}`;
    const options = {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    };

    const response = await fetch(url, options);
    
    if (!response.ok) {
      return null;
    }

    const result = await response.text();
    const data = JSON.parse(result);
    
    return parsePlayerStats(data);
  } catch (error) {
    console.error('Error fetching live player stats:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { searchParams } = new URL(request.url);
  const statType = searchParams.get('statType') || 'PTS'; // Default to points if not specified
  try {
    const { playerId } = await params;
    const { searchParams } = new URL(request.url);
    const useExternalAPI = searchParams.get('external') === 'true';
    const period = searchParams.get('period'); // Get the period parameter (L5, L10, etc.)
    const opponentParam = (searchParams.get('opponent') || '').trim();
    
    // Check cache first
    const cacheKey = `${playerId}-${period}-${statType}-${useExternalAPI}-${opponentParam}`;
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_DURATION) {
      console.log(`Cache hit for player ${playerId} with period ${period} and external=${useExternalAPI}`);
      return NextResponse.json(cachedResponse.data);
    }

    // Get player first, then get game logs using player name
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Get game logs and season stats using player name
    let gameStats = null;
    let seasonStats = null;
    let statsError = null;
    let seasonError = null;
    
    try {
      const [gameLogsResult, seasonStatsResult] = await Promise.all([
        supabase
          .from('wnba_game_logs')
          .select('*')
          .eq('player_name', player.name)
          .order('game_date', { ascending: false })
          .limit(50),
        supabase
          .from('player_season_stats')
          .select('*')
          .eq('player_name', player.name)
          .eq('season', '2025')
          .order('created_at', { ascending: false })
          .limit(1)
      ]);

      gameStats = gameLogsResult.data;
      seasonStats = seasonStatsResult.data;
      statsError = gameLogsResult.error;
      seasonError = seasonStatsResult.error;
      
      console.log('Database query results:', {
        gameLogsCount: gameStats?.length || 0,
        seasonStatsCount: seasonStats?.length || 0,
        statsError: statsError?.message || null,
        seasonError: seasonError?.message || null
      });
      
    } catch (queryError: any) {
      console.error('Error during database queries:', queryError);
      console.error('Query error details:', {
        message: queryError?.message || 'Unknown error',
        name: queryError?.name || 'Unknown error type',
        stack: queryError?.stack || 'No stack trace'
      });
      // Continue with empty data rather than failing completely
      gameStats = [];
      seasonStats = [];
      statsError = queryError;
      seasonError = queryError;
    }

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    if (statsError) {
      console.error('Error fetching game stats from database:', statsError);
    }

    // Process games based on period
    let processedGames: any[] = [];
    if (gameStats && gameStats.length > 0) {
      // Convert wnba_game_logs format to the format expected by the frontend
      const allGames = gameStats.map(stat => {
        // Calculate the appropriate stat value based on statType
        let statValue = 0;
        switch (statType) {
          case 'PTS':
            statValue = stat.points || 0;
            break;
          case 'REB':
            statValue = stat.rebounds || 0;
            break;
          case 'AST':
            statValue = stat.assists || 0;
            break;
          case 'PA':
            statValue = (stat.points || 0) + (stat.assists || 0);
            break;
          case 'PRA':
            statValue = (stat.points || 0) + (stat.assists || 0) + (stat.rebounds || 0);
            break;
          case 'PR':
            statValue = (stat.points || 0) + (stat.rebounds || 0);
            break;
          case 'FGA':
            statValue = stat.field_goals_attempted || 0;
            break;
          case '3PA':
            statValue = stat.three_points_attempted || 0;
            break;
          case 'FTA':
            statValue = stat.free_throws_attempted || 0;
            break;
          default:
            statValue = stat.points || 0;
        }

        return {
          date: stat.game_date,
          opponent: stat.opponent || '',
          homeAway: 'Home', // Default since we don't have this in game logs
          points: stat.points || 0,
          assists: stat.assists || 0,
          rebounds: stat.rebounds || stat.total_rebounds || stat.reb || 0,
          steals: stat.steals || 0,
          blocks: stat.blocks || 0,
          turnovers: stat.turnovers || 0,
          fieldGoalsMade: stat.field_goals_made || 0,
          fieldGoalsAttempted: stat.field_goals_attempted || 0,
          threePointersMade: stat.three_points_made || 0,
          threePointersAttempted: stat.three_points_attempted || 0,
          freeThrowsMade: stat.free_throws_made || 0,
          freeThrowsAttempted: stat.free_throws_attempted || 0,
          minutesPlayed: 0, // Not available in game logs
          plusMinus: 0, // Not available in game logs
          gameId: stat.game_id || '',
          statValue: statValue // Add the calculated stat value
        };
      });

      // Sort games by date (most recent first)
      try {
        allGames.sort((a, b) => {
          try {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            
            // Validate dates
            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
              console.warn('Invalid date detected during sorting:', { dateA: a.date, dateB: b.date });
              return 0; // Keep original order for invalid dates
            }
            
            return dateB.getTime() - dateA.getTime(); // Most recent first
          } catch (sortError) {
            console.error('Date sorting error:', sortError);
            return 0; // Keep original order on error
          }
        });
      } catch (sortError) {
        console.error('Games sorting error:', sortError);
        // Continue with unsorted games rather than failing
      }

      // Filter games based on period
      if (period === 'L5') {
        processedGames = allGames.slice(0, 5).reverse(); // Take the 5 most recent games, then reverse for display
      } else if (period === 'L10') {
        processedGames = allGames.slice(0, 10).reverse(); // Take the 10 most recent games, then reverse for display
      } else if (period === 'H2H') {
        if (opponentParam) {
          try {
            processedGames = allGames.filter(game => {
              try {
                const sameTeam = game.opponent && isSameTeam(game.opponent, opponentParam);
                const isCurrentSeason = (() => {
                  try {
                    const d = new Date(game.date);
                    return !isNaN(d.getTime()) && d.getFullYear() === 2025;
                  } catch (dateError) {
                    console.error('Date parsing error:', dateError);
                    return false;
                  }
                })();
                return Boolean(sameTeam && isCurrentSeason);
              } catch (filterError) {
                console.error('Game filtering error:', filterError);
                return false;
              }
            });
          } catch (h2hError) {
            console.error('H2H processing error:', h2hError);
            processedGames = [];
          }
        } else {
          processedGames = [];
        }
        // Reverse for H2H to show chronological order
        processedGames.reverse();
      } else {
        // Season or no period specified - return all games
        processedGames = allGames;
        // Reverse for Season to show chronological order
        processedGames.reverse();
      }
    }

    let finalSeasonStats = null;

    // If we have database season stats, use them
    if (seasonStats && seasonStats.length > 0) {
      const dbStats = seasonStats[0];
      finalSeasonStats = {
        gamesPlayed: dbStats.games_played,
        avgPoints: dbStats.avg_points,
        avgAssists: dbStats.avg_assists,
        avgRebounds: dbStats.avg_rebounds,
        avgSteals: dbStats.avg_steals,
        avgBlocks: dbStats.avg_blocks,
        avgTurnovers: dbStats.avg_turnovers,
        avgMinutes: dbStats.avg_minutes,
        fieldGoalPercentage: dbStats.field_goal_percentage,
        threePointPercentage: dbStats.three_point_percentage,
        freeThrowPercentage: dbStats.free_throw_percentage,
        totalPoints: dbStats.total_points,
        totalAssists: dbStats.total_assists,
        totalRebounds: dbStats.total_rebounds
      };
    } else {
      // Calculate season stats from game logs if no season stats table data
      console.log(`No season stats found for player ${playerId} (${player.name}), calculating from game logs...`);
      
      if (gameStats && gameStats.length > 0) {
        // Filter for 2025 games only
        const season2025Games = gameStats.filter(game => {
          try {
            const gameDate = new Date(game.game_date);
            return gameDate.getFullYear() === 2025;
          } catch (error) {
            console.error('Error parsing game date:', error);
            return false;
          }
        });
        
        if (season2025Games.length > 0) {
          // Calculate averages from 2025 game logs
          const totalGames = season2025Games.length;
          const totalPoints = season2025Games.reduce((sum, game) => sum + (game.points || 0), 0);
          const totalAssists = season2025Games.reduce((sum, game) => sum + (game.assists || 0), 0);
          const totalRebounds = season2025Games.reduce((sum, game) => sum + (game.rebounds || game.total_rebounds || game.reb || 0), 0);
          const totalSteals = season2025Games.reduce((sum, game) => sum + (game.steals || 0), 0);
          const totalBlocks = season2025Games.reduce((sum, game) => sum + (game.blocks || 0), 0);
          const totalTurnovers = season2025Games.reduce((sum, game) => sum + (game.turnovers || 0), 0);
          const totalMinutes = season2025Games.reduce((sum, game) => sum + (game.minutes || 0), 0);
          
          finalSeasonStats = {
            gamesPlayed: totalGames,
            avgPoints: totalGames > 0 ? totalPoints / totalGames : 0,
            avgAssists: totalGames > 0 ? totalAssists / totalGames : 0,
            avgRebounds: totalGames > 0 ? totalRebounds / totalGames : 0,
            avgSteals: totalGames > 0 ? totalSteals / totalGames : 0,
            avgBlocks: totalGames > 0 ? totalBlocks / totalGames : 0,
            avgTurnovers: totalGames > 0 ? totalTurnovers / totalGames : 0,
            avgMinutes: totalGames > 0 ? totalMinutes / totalGames : 0,
            fieldGoalPercentage: 0, // Not available in game logs
            threePointPercentage: 0, // Not available in game logs
            freeThrowPercentage: 0, // Not available in game logs
            totalPoints: totalPoints,
            totalAssists: totalAssists,
            totalRebounds: totalRebounds
          };
          
          console.log(`Calculated 2025 season stats for ${player.name}:`, finalSeasonStats);
        } else {
          console.log(`No 2025 games found for player ${player.name}`);
        }
      }
    }

    // If we have database stats (either game stats or season stats), return them
    if ((processedGames && processedGames.length > 0) || finalSeasonStats) {
      // For now, provide a fallback points line based on season average
      let nextGamePointsLine: number | null = null;
      if (finalSeasonStats && finalSeasonStats.avgPoints) {
        nextGamePointsLine = Math.round(finalSeasonStats.avgPoints * 10) / 10; // Round to 1 decimal
        console.log('API Route: Using season average as points line for', player.name, ':', nextGamePointsLine);
      }

      const response = {
        player: {
          id: player.id,
          name: player.name,
          team: player.team,
          position: player.position
        },
        games: processedGames,
        seasonStats: finalSeasonStats,
        nextGamePointsLine,
        source: 'database', // Always prioritize database data
        lastUpdated: new Date().toISOString()
      };

      // Cache the response
      cache.set(cacheKey, { data: response, timestamp: Date.now() });
      return NextResponse.json(response);
    }

    // If no database stats and external API is requested, fall back to external API
    if (useExternalAPI) {
      const externalUrl = new URL(request.url);
      externalUrl.pathname = `/api/stats/${playerId}`;
      externalUrl.searchParams.set('external', 'true');
      
      return NextResponse.redirect(externalUrl);
    }

    // If no stats available, return empty response
    return NextResponse.json({
      player: {
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position
      },
      games: [],
      seasonStats: null,
      source: 'database',
      message: 'No stats available in database. Use ?external=true to fetch from external API.',
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in database stats API:', error);
    
    // Log the full error object for debugging
    console.error('Full error object:', {
      message: (error as any)?.message || 'Unknown error',
      name: (error as any)?.name || 'Unknown error type',
      stack: (error as any)?.stack || 'No stack trace',
      details: (error as any)?.details || 'No additional details',
      hint: (error as any)?.hint || 'No hint provided',
      code: (error as any)?.code || 'No error code'
    });
    
    // Handle specific pattern matching errors
    if (error instanceof Error && error.message.includes('string did not match the expected pattern')) {
      console.error('Pattern matching error detected:', error.message);
      return NextResponse.json({ 
        error: 'Data processing error - invalid format detected',
        details: 'The requested data contains unexpected formatting that cannot be processed.',
        fallback: true
      }, { status: 422 });
    }
    
    // Handle Supabase constraint violations
    if (error instanceof Error && (
      error.message.includes('new row violates row-level security policy') ||
      error.message.includes('duplicate key value violates unique constraint') ||
      error.message.includes('violates check constraint') ||
      error.message.includes('violates not-null constraint')
    )) {
      console.error('Database constraint violation detected:', error.message);
      return NextResponse.json({ 
        error: 'Database constraint violation',
        details: error.message,
        fallback: true
      }, { status: 422 });
    }
    
    // Handle other specific errors
    if (error instanceof Error && error.message.includes('invalid')) {
      console.error('Validation error detected:', error.message);
      return NextResponse.json({ 
        error: 'Data validation error',
        details: error.message,
        fallback: true
      }, { status: 422 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 