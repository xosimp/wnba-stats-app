import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

// Singleton Redis connection
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!redis) {
    try {
      redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      });
    } catch (error) {
      console.error('Failed to create Redis connection:', error);
      return null;
    }
  }
  return redis;
}

export async function GET(request: NextRequest) {
  try {
    const rapidApiKey = 'b9fef5cbcbmsh3ae24f367e6e0acp12f58ejsn3c7ad2cc0f9f';
    if (!rapidApiKey) {
      return NextResponse.json({ error: 'Missing RapidAPI key' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2025';
    const month = searchParams.get('month') || '';
    const day = searchParams.get('day') || '';

    // Check cache first (only if Redis is available)
    let cachedSchedule = null;
    let fallbackSchedule = null;
    
    try {
      const redis = getRedis();
      if (redis) {
        const cacheKey = `wnba:schedule:lightweight:${year}:${month}:${day}`;
        cachedSchedule = await redis.get(cacheKey);
        
        if (cachedSchedule) {
          console.log('Using cached lightweight schedule data');
          return NextResponse.json(JSON.parse(cachedSchedule));
        }
        
        // Also check for any cached data for this year as fallback
        const fallbackCacheKey = `wnba:schedule:lightweight:${year}`;
        fallbackSchedule = await redis.get(fallbackCacheKey);
      }
    } catch (redisError) {
      console.log('Redis not available, proceeding without cache:', redisError);
    }

    // Build the URL with optional month/day parameters
    let url = `https://wnba-api.p.rapidapi.com/wnbaschedule?year=${year}`;
    if (month) url += `&month=${month}`;
    if (day) url += `&day=${day}`;
    
    console.log('Fetching lightweight WNBA schedule for:', `${year}-${month}-${day}`);
    
    const apiRes = await fetch(url, {
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'wnba-api.p.rapidapi.com',
      },
    });

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      console.log('Schedule API error:', errorText);
      console.log('Schedule API URL:', url);
      console.log('Parameters:', { year, month, day });
      
      // Handle specific API errors with better user messages
      let userMessage = 'Failed to fetch schedule';
      let statusCode = 502;
      
      if (errorText.includes('Too many requests')) {
        userMessage = 'Schedule temporarily unavailable due to high demand. Please try again later.';
        statusCode = 429;
      } else if (errorText.includes('not subscribed')) {
        userMessage = 'Schedule service temporarily unavailable. Please try again later.';
        statusCode = 503;
      } else if (errorText.includes('rate limit')) {
        userMessage = 'Schedule temporarily unavailable due to rate limiting. Please try again later.';
        statusCode = 429;
      }
      
      // If we have fallback cached data, return it with a warning
      if (fallbackSchedule) {
        console.log('API failed, using fallback cached data');
        const fallbackData = JSON.parse(fallbackSchedule);
        return NextResponse.json({
          ...fallbackData,
          warning: 'Using cached data due to API issues. Data may be outdated.',
          error: userMessage
        });
      }
      
      return NextResponse.json({ 
        error: userMessage, 
        details: errorText,
        url: url,
        parameters: { year, month, day }
      }, { status: statusCode });
    }

    const apiData = await apiRes.json();
    
    // Handle empty or invalid responses
    if (!apiData || (typeof apiData === 'object' && Object.keys(apiData).length === 0)) {
      console.log('Empty or invalid schedule API response for:', `${year}-${month}-${day}`);
      return NextResponse.json({ 
        error: 'No schedule data available for this date. Please try a different date.',
        parameters: { year, month, day }
      }, { status: 404 });
    }

    // Process and filter the schedule data to only include essential information
    const lightweightSchedule: Record<string, any[]> = {};
    
    if (apiData && typeof apiData === 'object') {
      Object.keys(apiData).forEach(date => {
        const gamesForDate = apiData[date];
        if (Array.isArray(gamesForDate)) {
          const filteredGames = gamesForDate.map((game: any) => ({
            id: game.id,
            date: game.date,
            completed: game.completed,
            status: {
              state: game.status?.state,
              detail: game.status?.detail
            },
            teams: game.competitors?.map((team: any) => ({
              id: team.id,
              abbrev: team.abbrev,
              name: team.name,
              shortName: team.shortName,
              isHome: team.isHome,
              score: team.score,
              winner: team.winner
            })) || [],
            venue: {
              fullName: game.venue?.fullName
            }
          }));
          
          if (filteredGames.length > 0) {
            lightweightSchedule[date] = filteredGames;
          }
        }
      });
    }

    console.log('Lightweight schedule processed:', Object.keys(lightweightSchedule).length, 'dates');

    const response = {
      schedule: lightweightSchedule,
      totalDates: Object.keys(lightweightSchedule).length,
      totalGames: Object.values(lightweightSchedule).reduce((sum, games) => sum + games.length, 0)
    };

    // Cache the response for 1 hour (only if Redis is available)
    try {
      const redis = getRedis();
      if (redis) {
        const cacheKey = `wnba:schedule:lightweight:${year}:${month}:${day}`;
        await redis.set(cacheKey, JSON.stringify(response), 'EX', 3600);
        console.log('Cached lightweight schedule data for 1 hour');
      }
    } catch (redisError) {
      console.log('Could not cache data, Redis not available:', redisError);
    }

    return NextResponse.json(response);

  } catch (e) {
    console.log('Server error in lightweight schedule route:', e);
    return NextResponse.json({ 
      error: 'Failed to fetch or process schedule',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 });
  }
} 