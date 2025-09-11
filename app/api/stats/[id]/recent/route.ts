import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';
import { espnApi } from '../../../../../lib/api/espn';

// Performance logging interface
interface PerformanceLog {
  timestamp: string;
  endpoint: string;
  cacheHit: boolean;
  responseTime: number;
  cacheSize?: number;
  error?: string;
}

function logPerformance(log: PerformanceLog) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'performance.json');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Read existing logs or create new array
    let logs: PerformanceLog[] = [];
    if (fs.existsSync(logFile)) {
      try {
        const existingData = fs.readFileSync(logFile, 'utf8');
        logs = JSON.parse(existingData);
      } catch (error) {
        console.error('Error reading existing performance log file:', error);
        logs = [];
      }
    }
    
    // Add new log
    logs.push(log);
    
    // Keep only last 1000 entries to prevent file from growing too large
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    // Write back to file
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    
  } catch (error) {
    console.error('Error logging performance:', error);
  }
}

// Singleton Redis connection to avoid creating new connections for each request
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }
  return redis;
}

/**
 * Get player's team information from the database
 */
async function getPlayerTeam(playerId: string): Promise<string | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/players/${playerId}`);
    if (!response.ok) {
      console.error(`Failed to fetch player data for ${playerId}:`, response.status);
      return null;
    }
    
    const playerData = await response.json();
    return playerData.team || null;
  } catch (error) {
    console.error('Error fetching player team:', error);
    return null;
  }
}

/**
 * Correct opponent data using ESPN API
 */
async function correctOpponentData(games: any[], playerTeam: string): Promise<any[]> {
  if (!playerTeam) {
    console.log('No player team found, skipping opponent correction');
    return games;
  }

  try {
    // Get ESPN schedule to cross-reference games
    const espnSchedule = await espnApi.getSchedule(2025);
    console.log(`📊 Fetched ESPN schedule with ${espnSchedule.length} games for opponent correction`);

    return games.map(game => {
      // Try to find the correct opponent using game ID and player's team
      if (game.gameId) {
        const correctOpponent = espnApi.getGameOpponent(game.gameId, playerTeam, espnSchedule);
        if (correctOpponent) {
          console.log(`📊 Corrected opponent for game ${game.gameId}: ${game.opponent} → ${correctOpponent}`);
          return {
            ...game,
            opponent: correctOpponent
          };
        }
      }

      // If no game ID or couldn't find opponent, try to match by date
      const gameDate = new Date(game.date);
      const matchingGame = espnSchedule.find(espnGame => {
        const espnDate = new Date(espnGame.date);
        const dateDiff = Math.abs(gameDate.getTime() - espnDate.getTime());
        const isSameDay = dateDiff < 24 * 60 * 60 * 1000; // Within 24 hours
        
        if (isSameDay) {
          // Check if player's team is in this game
          const isPlayerTeamInGame = espnGame.homeTeam.abbreviation === playerTeam || espnGame.awayTeam.abbreviation === playerTeam;
          return isPlayerTeamInGame;
        }
        return false;
      });

      if (matchingGame) {
        const correctOpponent = espnApi.getGameOpponent(matchingGame.id, playerTeam, [matchingGame]);
        if (correctOpponent) {
          console.log(`📊 Corrected opponent for game on ${game.date}: ${game.opponent} → ${correctOpponent}`);
          return {
            ...game,
            opponent: correctOpponent,
            gameId: matchingGame.id // Update game ID if we found a match
          };
        }
      }

      // Fallback: Check if the opponent is the same as the player's team (incorrect data)
      if (game.opponent === playerTeam) {
        console.log(`📊 Detected incorrect opponent data: ${game.opponent} (same as player team ${playerTeam})`);
        // Try to find the correct opponent using known game dates and teams
        const correctedOpponent = getKnownOpponent(game.date, playerTeam);
        if (correctedOpponent) {
          console.log(`📊 Applied fallback correction for game on ${game.date}: ${game.opponent} → ${correctedOpponent}`);
          return {
            ...game,
            opponent: correctedOpponent
          };
        }
      }

      // If we couldn't correct the opponent, log it and return original
      console.log(`📊 Could not correct opponent for game on ${game.date}: ${game.opponent} (player team: ${playerTeam})`);
      return game;
    });
  } catch (error) {
    console.error('Error correcting opponent data:', error);
    return games;
  }
}

/**
 * Fallback function to get known opponents for specific dates
 * This can be expanded with more known game data
 */
function getKnownOpponent(gameDate: string, playerTeam: string): string | null {
  const date = new Date(gameDate);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Known game data for 2025 season
  const knownGames: { [key: string]: { [team: string]: string } } = {
    '7/22': { 'MIN': 'CONN', 'CONN': 'MIN' },
    '7/25': { 'MIN': 'NY', 'NY': 'MIN' },
    '7/27': { 'MIN': 'SEA', 'SEA': 'MIN' },
    // Add more known games as needed
  };
  
  const dateKey = `${month}/${day}`;
  const knownOpponents = knownGames[dateKey];
  
  if (knownOpponents && knownOpponents[playerTeam]) {
    return knownOpponents[playerTeam];
  }
  
  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now();
  const endpoint = '/api/stats/[id]/recent';
  
  try {
    const { id } = await params;
    
    // Check Redis cache first
    const recentGamesCacheKey = `wnba:recentgames:${id}`;
    let usedCache = false;
    const cachedRecentGames = await getRedis().get(recentGamesCacheKey);
    
    if (cachedRecentGames) {
      usedCache = true;
      console.log('Using Redis cached recent games for', recentGamesCacheKey);
      console.log(`[RecentGamesAPI] playerId=${id} | source=cache | TTL=43200s (12 hours)`);
      const responseTime = Date.now() - startTime;
      
      // Log performance - cache hit
      logPerformance({
        timestamp: new Date().toISOString(),
        endpoint: '/api/stats/[id]/recent',
        cacheHit: true,
        responseTime,
        cacheSize: await getRedis().dbsize()
      });
      
      return NextResponse.json(JSON.parse(cachedRecentGames));
    }
    
    // Fetch player game log from RapidAPI
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return NextResponse.json({ error: 'Missing RapidAPI key' }, { status: 500 });
    }

    console.log(`📊 Fetching recent games for playerId=${id}`);
    
    // Use the correct endpoint for player game log
    const apiUrl = `https://wnba-api.p.rapidapi.com/player-gamelog?playerId=${id}`;
    console.log(`Recent Games URL: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'wnba-api.p.rapidapi.com',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch recent games: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error response: ${errorText}`);
      
      // Return empty recent games instead of failing
      const emptyResponse = {
        recentGames: [],
        message: 'No recent games data available for this player'
      };
      
      // Cache empty response for a shorter time
      await getRedis().set(recentGamesCacheKey, JSON.stringify(emptyResponse), 'EX', 1800); // 30 minutes
      
      logPerformance({
        timestamp: new Date().toISOString(),
        endpoint: '/api/stats/[id]/recent',
        cacheHit: false,
        responseTime: Date.now() - startTime,
        error: `API Error: ${response.status}`
      });
      
      return NextResponse.json(emptyResponse);
    }

    const data = await response.json();
    console.log(`📊 Recent games data received successfully`);
    console.log(`📊 Data structure:`, Object.keys(data));
    
    // Process the game log data
    let recentGames: any[] = [];
    
    if (data.games && Array.isArray(data.games)) {
      console.log(`📊 Found ${data.games.length} games in game log`);
      
      // Transform game log data into our format
      recentGames = data.games.map((game: any) => ({
        minutes: game.minutes || 0,
        points: game.points || 0,
        rebounds: game.rebounds || 0,
        assists: game.assists || 0,
        steals: game.steals || 0,
        blocks: game.blocks || 0,
        turnovers: game.turnovers || 0,
        fieldGoals: game.field_goals || '0-0',
        fieldGoalPct: game.field_goal_pct || 0,
        threePointers: game.three_pointers || '0-0',
        threePointPct: game.three_point_pct || 0,
        freeThrows: game.free_throws || '0-0',
        freeThrowPct: game.free_throw_pct || 0,
        fouls: game.fouls || 0,
        gameId: game.game_id || game.id,
        date: game.date,
        opponent: game.opponent || 'TBD',
        homeAway: game.home_away || 'away'
      }));
      
      // Sort by date (most recent first)
      recentGames.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Take only the 5 most recent games
      recentGames = recentGames.slice(0, 5);
      
      console.log(`📊 Processed ${recentGames.length} recent games`);
      
      // Get player's team and correct opponent data
      const playerTeam = await getPlayerTeam(id);
      if (playerTeam) {
        console.log(`📊 Player team: ${playerTeam}`);
        recentGames = await correctOpponentData(recentGames, playerTeam);
      } else {
        console.log(`📊 Could not determine player team for ${id}`);
      }
    } else {
      console.log(`📊 No games found in game log data`);
    }
    
    // Create response
    const responseData = {
      recentGames,
      lastUpdated: new Date().toISOString(),
      message: recentGames.length > 0 ? 'Recent games data retrieved successfully' : 'No recent games data available'
    };
    
    // Cache the response for 12 hours
    await getRedis().set(recentGamesCacheKey, JSON.stringify(responseData), 'EX', 43200);
    
    console.log(`[RecentGamesAPI] playerId=${id} | source=api | TTL=43200s (12 hours) | games=${recentGames.length}`);
    
    const responseTime = Date.now() - startTime;
    logPerformance({
      timestamp: new Date().toISOString(),
      endpoint: '/api/stats/[id]/recent',
      cacheHit: false,
      responseTime,
      cacheSize: await getRedis().dbsize()
    });
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Error in recent games API:', error);
    
    const responseTime = Date.now() - startTime;
    logPerformance({
      timestamp: new Date().toISOString(),
      endpoint: '/api/stats/[id]/recent',
      cacheHit: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch recent games',
        recentGames: [],
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 