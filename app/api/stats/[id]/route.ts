import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '../../../../lib/utils/rate-limiter';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';
import { OddsApiService } from '../../../../lib/odds-api';
import { createClient } from '@supabase/supabase-js';

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
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, 'performance.json');
    
    // Read existing logs or create new array
    let logs: PerformanceLog[] = [];
    if (fs.existsSync(logFile)) {
      const existingData = fs.readFileSync(logFile, 'utf-8');
      try {
        logs = JSON.parse(existingData);
      } catch (e) {
        console.error('Error parsing existing logs:', e);
      }
    }
    
    // Add new log
    logs.push(log);
    
    // Keep only last 1000 logs
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    // Write back to file
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error logging performance:', error);
  }
}

// Database connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Load player mappings for RapidAPI IDs
function loadPlayerMappings() {
  try {
    const playerIdsFile = path.join(process.cwd(), 'player-ids.json');
    if (fs.existsSync(playerIdsFile)) {
      const data = fs.readFileSync(playerIdsFile, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading player mappings:', error);
  }
  return {};
}

// Get player info from database
async function getPlayerFromDatabase(rapidApiId: string) {
  try {
    // Load player mappings to get the player name from RapidAPI ID
    const playerMappings = loadPlayerMappings();
    let playerName = null;
    
    // Find the player name from the mappings
    for (const [key, player] of Object.entries(playerMappings)) {
      if ((player as any).id === rapidApiId) {
        playerName = (player as any).name;
        break;
      }
    }
    
    if (!playerName) {
      console.log(`Player not found in mappings for RapidAPI ID: ${rapidApiId}`);
      return null;
    }
    
    console.log(`Looking up player in database: ${playerName} (RapidAPI ID: ${rapidApiId})`);
    
    // Search database by name
    const { data: playerByName, error: nameError } = await supabase
      .from('players')
      .select('*')
      .ilike('name', `%${playerName}%`)
      .single();

    if (playerByName) {
      console.log(`Found player in database: ${playerByName.name} (${playerByName.team})`);
      return {
        id: rapidApiId,
        name: playerByName.name,
        team: playerByName.team,
        position: playerByName.position,
        databaseId: playerByName.id
      };
    } else {
      console.log(`Player not found in database: ${playerName}`);
      // Return basic info from mappings as fallback
      for (const [key, player] of Object.entries(playerMappings)) {
        if ((player as any).id === rapidApiId) {
          return {
            id: rapidApiId,
            name: (player as any).name,
            team: (player as any).team,
            position: 'Unknown',
            databaseId: null
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting player from database:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  try {
    // Rate limiting
    const identifier = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimitResult = rateLimit(identifier, 10, 60000); // 10 requests per minute
    
    if (!rateLimitResult) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Get player info from database
    const playerInfo = await getPlayerFromDatabase(id);

    // Redis cache setup with error handling
    let redis = null;
    let cachedData = null;
    
    try {
      redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        retryDelayOnFailover: 0,
        enableReadyCheck: false,
        connectTimeout: 1000,
        commandTimeout: 1000,
      });
      
      // Handle connection errors silently
      redis.on('error', (err) => {
        if (err.message.includes('ECONNREFUSED')) {
          redis = null;
        }
      });
      
      const cacheKey = `player_stats_${id}`;
      cachedData = await redis.get(cacheKey);
    } catch (error) {
      // Redis not available, continue without cache
      redis = null;
    }
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);
      parsedData.player = playerInfo || { name: 'Unknown Player', team: 'TBD', id };
      
      logPerformance({
        timestamp: new Date().toISOString(),
        endpoint: `/api/stats/${id}`,
        cacheHit: true,
        responseTime: Date.now() - startTime
      });
      
      return NextResponse.json(parsedData);
    }

    // Fetch from RapidAPI
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return NextResponse.json(
        { error: 'RapidAPI key not configured' },
        { status: 500 }
      );
    }

    // Fetch season statistics
    const seasonStatsUrl = `https://wnba-api.p.rapidapi.com/player-statistic?playerId=${id}`;
    const seasonStatsResponse = await fetch(seasonStatsUrl, {
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'wnba-api.p.rapidapi.com'
      }
    });

    if (!seasonStatsResponse.ok) {
      console.error(`Season stats API error: ${seasonStatsResponse.status}`);
      return NextResponse.json(
        { error: 'Failed to fetch season statistics' },
        { status: seasonStatsResponse.status }
      );
    }

    const seasonStats = await seasonStatsResponse.json();

    // Try to fetch game-by-game stats (may not be available for all players)
    let gameStats = [];
    try {
      const gameStatsUrl = `https://wnba-api.p.rapidapi.com/player-gamelog?playerId=${id}`;
      const gameStatsResponse = await fetch(gameStatsUrl, {
        headers: {
          'x-rapidapi-key': rapidApiKey,
          'x-rapidapi-host': 'wnba-api.p.rapidapi.com'
        }
      });

      if (gameStatsResponse.ok) {
        const gameStatsData = await gameStatsResponse.json();
        if (gameStatsData && Array.isArray(gameStatsData)) {
          gameStats = gameStatsData;
        }
      }
    } catch (error) {
      console.log('Game-by-game stats not available for this player');
    }

    // Prepare response
    const responseData = {
      player: playerInfo || { name: 'Unknown Player', team: 'TBD', id },
      stats: gameStats,
      seasonStats: seasonStats,
      lastUpdated: new Date().toISOString(),
      message: gameStats.length > 0 ? 'Complete player statistics' : 'Season statistics available, but game-by-game data not available'
    };

    // Cache the response (5 minutes) if Redis is available
    if (redis) {
      try {
        await redis.setex(cacheKey, 300, JSON.stringify(responseData));
      } catch (error) {
        // Redis error, continue without caching
        console.log('Redis cache error, continuing without cache');
      }
    }

    logPerformance({
      timestamp: new Date().toISOString(),
      endpoint: `/api/stats/${id}`,
      cacheHit: false,
      responseTime: Date.now() - startTime,
      cacheSize: JSON.stringify(responseData).length
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching player stats:', error);
    
    logPerformance({
      timestamp: new Date().toISOString(),
      endpoint: `/api/stats/${id}`,
      cacheHit: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Utility functions
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWNBASportEventIdsByDate(dateStr: string, apiKey: string) {
  const url = `https://wnba-api.p.rapidapi.com/schedule?date=${dateStr}`;
  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'wnba-api.p.rapidapi.com',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch schedule: ${response.status}`);
  }
  
  const data = await response.json();
  return data.events || [];
}

async function isPopularPlayer(playerId: string): Promise<boolean> {
  // Define popular players for performance optimization
  const popularPlayers = [
    'caitlin-clark',
    'angel-reese', 
    'breanna-stewart',
    'diana-taurasi',
    'skylar-diggins-smith'
  ];
  
  return popularPlayers.includes(playerId.toLowerCase());
} 

 