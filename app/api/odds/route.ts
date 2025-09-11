import { NextRequest, NextResponse } from 'next/server';
import { OddsApiService, getCachedOddsData } from '../../../lib/odds-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerName = searchParams.get('player');
    const action = searchParams.get('action') || 'games';
    const marketType = searchParams.get('market') || 'player_points';

    switch (action) {
      case 'player-line':
        if (!playerName) {
          return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
        }
        
        console.log(`API: Looking for player line for: ${playerName} in ${marketType}`);
        
        const playerLine = await getCachedOddsData(
          `player-line-${playerName}-${marketType}`,
          () => OddsApiService.getPlayerLine(playerName, marketType)
        );
        
        console.log(`API: Found ${marketType} line:`, playerLine);
        
        // Return different property names based on market type for backward compatibility
        switch (marketType) {
          case 'player_points':
            return NextResponse.json({ pointsLine: playerLine });
          case 'player_rebounds':
            return NextResponse.json({ reboundsLine: playerLine });
          case 'player_assists':
            return NextResponse.json({ assistsLine: playerLine });
          case 'player_frees_attempts':
            return NextResponse.json({ ftaLine: playerLine });
          default:
            return NextResponse.json({ line: playerLine, marketType });
        }

      case 'player-lines': {
        const cacheKey = `odds:player-lines:${playerName || 'all'}:${marketType}`;
        const now = Date.now();
        // @ts-ignore
        globalThis.__oddsCache = globalThis.__oddsCache || new Map();
        // @ts-ignore
        const cache = globalThis.__oddsCache as Map<string, { data: any; timestamp: number }>;
        const cached = cache.get(cacheKey);
        const TTL = 10 * 60 * 1000; // 10 minutes
        if (cached && (now - cached.timestamp) < TTL) {
          return NextResponse.json({ lines: cached.data });
        }
        const allLines = await OddsApiService.getPlayerLines(playerName || undefined, marketType);
        cache.set(cacheKey, { data: allLines, timestamp: now });
        return NextResponse.json({ lines: allLines });
      }

      case 'games':
      default: {
        const games = await getCachedOddsData(
          'wnba-games',
          () => OddsApiService.getWNBAGames()
        );
        return NextResponse.json({ games });
      }

      case 'upcoming':
        const upcomingGames = await getCachedOddsData(
          'upcoming-games',
          () => OddsApiService.getUpcomingGames()
        );
        
        return NextResponse.json({ games: upcomingGames });
    }
  } catch (error) {
    console.error('Odds API route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch odds data' },
      { status: 500 }
    );
  }
} 