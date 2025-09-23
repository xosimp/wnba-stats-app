const ODDS_API_KEY = 'd5d24c02b387d3128b68efea627057cb';
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';

import Redis from 'ioredis';

export interface OddsApiResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export interface Bookmaker {
  key: string;
  title: string;
  markets: Market[];
}

export interface Market {
  key: string;
  outcomes: Outcome[];
}

export interface Outcome {
  name: string;
  price: number;
  point?: number;
}

export interface PlayerPointsLine {
  playerName: string;
  pointsLine: number;
  bookmaker: string;
  price: number;
}

export interface PlayerLine {
  playerName: string;
  line: number;
  bookmaker: string;
  price: number;
  marketType: string;
}

export class OddsApiService {
  private static async makeRequest(endpoint: string, params: Record<string, string> = {}) {
    const url = new URL(`${ODDS_API_BASE_URL}${endpoint}`);
    url.searchParams.append('apiKey', ODDS_API_KEY);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    try {
      console.log('Odds API: Making request to:', url.toString());
      const response = await fetch(url.toString());
      
      console.log('Odds API: Response status:', response.status);
      console.log('Odds API: Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Odds API: Error response:', errorText);
        throw new Error(`Odds API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Odds API: Response data length:', Array.isArray(data) ? data.length : 'not array');
      return data;
    } catch (error) {
      console.error('Odds API request failed:', error);
      throw error;
    }
  }

  static async getWNBAGames(): Promise<OddsApiResponse[]> {
    return this.makeRequest('/sports/basketball_wnba/odds', {
      regions: 'us',
      markets: 'h2h',
      oddsFormat: 'decimal'
    });
  }

  static async getEventPlayerProps(eventId: string, marketType: string = 'player_points'): Promise<PlayerLine[]> {
    try {
      const response = await this.makeRequest(`/sports/basketball_wnba/events/${eventId}/odds`, {
        regions: 'us',
        markets: marketType,
        oddsFormat: 'decimal'
      });
      
      const playerLines: PlayerLine[] = [];
      
      if (Array.isArray(response)) {
        response.forEach((bookmaker: any) => {
          if (bookmaker.markets) {
            bookmaker.markets.forEach((market: any) => {
              if (market.key === marketType) {
                market.outcomes.forEach((outcome: any) => {
                  const playerName = outcome.description || outcome.name;
                  if (playerName) {
                    playerLines.push({
                      playerName: playerName,
                      line: typeof outcome.point === 'number' ? outcome.point : (Number(outcome.point) || 0),
                      bookmaker: bookmaker.title,
                      price: outcome.price,
                      marketType: marketType
                    });
                  }
                });
              }
            });
          }
        });
      }
      
      return playerLines;
    } catch (error) {
      console.error('Failed to get event player props:', error);
      return [];
    }
  }

  static async getAllPlayerLinesCached(marketType: string = 'player_points'): Promise<PlayerLine[]> {
    const redisClient = getRedis();
    const cacheKey = `wnba:odds:${marketType}:latest`;
    const cacheTTL = 3 * 60 * 60; // 3 hours in seconds
    try {
      const testVal = await redisClient?.get('test_key_wnba');
      console.log('Test key value from Redis:', testVal);
      const cached = await redisClient?.get(cacheKey);
      if (cached) {
        const arr = JSON.parse(cached);
        console.log(`Odds API: Using Redis cached ${marketType} lines (count: ${arr.length})`);
        return arr;
      } else {
        console.log(`Odds API: Redis cache miss for ${marketType}`);
      }
    } catch (err) {
      console.error('Odds API: Redis error (get):', err);
    }
    // If not cached, fetch from API
    const allLines: PlayerLine[] = [];
    try {
      // 1. Fetch all current WNBA events (games)
      console.log(`[EXTERNAL API CALL] Fetching all events and odds for market: ${marketType}`);
      const events = await this.makeRequest('/sports/basketball_wnba/events', {
        regions: 'us',
      });
      if (!Array.isArray(events)) {
        console.error('Odds API: No events found');
        return [];
      }
      for (const event of events) {
        try {
          console.log(`[EXTERNAL API CALL] Fetching odds for event ${event.id} and market: ${marketType}`);
          const response = await this.makeRequest(`/sports/basketball_wnba/events/${event.id}/odds`, {
            regions: 'us',
            markets: marketType,
            oddsFormat: 'decimal',
          });
          if (!response.bookmakers) continue;
          for (const bookmaker of response.bookmakers) {
            if (!bookmaker.markets) continue;
           for (const market of bookmaker.markets) {
             if (market.key === marketType) {
               for (const outcome of market.outcomes) {
                 const player = outcome.description || outcome.name;
                 if (!player) continue;
                 const point = typeof outcome.point === 'number' ? outcome.point : (Number(outcome.point) || 0);
                 allLines.push({
                   playerName: player,
                   line: point,
                   bookmaker: bookmaker.title,
                   price: outcome.price,
                   marketType: marketType
                 });
               }
             }
           }
          }
        } catch (error) {
          console.error('Odds API: Error getting player props for event', event.id, ':', error);
          continue;
        }
      }
      // Cache the result in Redis
      try {
        await redisClient?.set(cacheKey, JSON.stringify(allLines), 'EX', cacheTTL);
        const testValAfter = await redisClient?.get('test_key_wnba');
        console.log('Test key value from Redis after set:', testValAfter);
        console.log(`Odds API: Cached all ${marketType} lines in Redis (count: ${allLines.length})`);
      } catch (err) {
        console.error('Odds API: Redis error (set):', err);
      }
      return allLines;
    } catch (error) {
      console.error(`Failed to get all ${marketType} lines:`, error);
      return [];
    }
  }

  static async getPlayerLines(playerName?: string, marketType: string = 'player_points'): Promise<PlayerLine[]> {
    // Use Redis-cached all player lines
    const allLines = await this.getAllPlayerLinesCached(marketType);
    if (!playerName) return allLines;
    
    console.log(`Odds API: Searching for player: ${playerName} in ${marketType}`);
    console.log(`Odds API: Available ${marketType} lines count:`, allLines.length);
    
    // More precise matching with priority order
    const matches = allLines.filter(line => {
      const lineName = line.playerName.toLowerCase();
      const searchName = playerName.toLowerCase();
      
      // 1. Exact match (highest priority)
      if (lineName === searchName) {
        console.log(`Odds API: Exact match found: ${line.playerName} -> ${line.line}`);
        return true;
      }
      
      // 2. Exact match without special characters
      const cleanLineName = lineName.replace(/[^a-z0-9]/g, '');
      const cleanSearchName = searchName.replace(/[^a-z0-9]/g, '');
      if (cleanLineName === cleanSearchName) {
        console.log(`Odds API: Clean exact match found: ${line.playerName} -> ${line.line}`);
        return true;
      }
      
      // 3. First name exact match (for cases like "Arike" vs "Arike Ogunbowale")
      // Only match if the search name is just a first name (no last name provided)
      const searchFirstName = searchName.split(' ')[0];
      const lineFirstName = lineName.split(' ')[0];
      const searchParts = searchName.split(' ').length;
      const lineParts = lineName.split(' ').length;
      
      // Only match first name if search is single word AND line has multiple words
      // This prevents "Courtney Vandersloot" from matching "Courtney Williams"
      if (searchFirstName === lineFirstName && searchFirstName.length > 2 && 
          searchParts === 1 && lineParts > 1) {
        console.log(`Odds API: First name match found: ${line.playerName} -> ${line.line}`);
        return true;
      }
      
      // 4. Last name exact match (only if first name is also similar)
      const searchLastName = searchName.split(' ').pop();
      const lineLastName = lineName.split(' ').pop();
      if (searchLastName === lineLastName && searchLastName && searchLastName.length > 2) {
        // Only match if first names are also similar (to avoid "Allisha Gray" matching "Chelsea Gray")
        const firstNameSimilarity = searchFirstName.length > 2 && lineFirstName.length > 2 && 
          (searchFirstName === lineFirstName || 
           searchFirstName.startsWith(lineFirstName.substring(0, 3)) || 
           lineFirstName.startsWith(searchFirstName.substring(0, 3)));
        
        if (firstNameSimilarity) {
          console.log(`Odds API: Last name match with similar first name found: ${line.playerName} -> ${line.line}`);
          return true;
        }
      }
      
      return false;
    });
    
    console.log(`Odds API: Found ${matches.length} matches for ${playerName} in ${marketType}`);
    matches.forEach(match => {
      console.log(`  - ${match.playerName} : ${match.line} ( ${match.bookmaker} )`);
    });
    
    return matches;
  }

  static async getPlayerLine(playerName: string, marketType: string = 'player_points'): Promise<number | null> {
    try {
      console.log(`Odds API: Looking for player: ${playerName} in ${marketType}`);
      
      // Get matching lines with improved matching logic
      const lines = await this.getPlayerLines(playerName, marketType);
      
      console.log(`Odds API: Found ${lines.length} matching lines for ${playerName} in ${marketType}`);
      
      if (lines.length === 0) {
        console.log(`Odds API: No matches found for ${playerName} in ${marketType}`);
        return null;
      }

      // Prefer certain bookmakers if available
      const preferredBookmakers = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars'];
      let selectedLine = lines[0]; // Default to first line
      
      // Try to find a line from preferred bookmakers
      for (const bookmaker of preferredBookmakers) {
        const preferredLine = lines.find(line => 
          line.bookmaker.toLowerCase().includes(bookmaker.toLowerCase())
        );
        if (preferredLine) {
          selectedLine = preferredLine;
          console.log(`Odds API: Selected preferred bookmaker line: ${selectedLine.bookmaker} -> ${selectedLine.line}`);
          break;
        }
      }
      
      console.log(`Odds API: Final selected line for ${playerName} in ${marketType}: ${selectedLine.playerName} -> ${selectedLine.line} ( ${selectedLine.bookmaker} )`);
      return selectedLine.line;
    } catch (error) {
      console.error(`Failed to get ${marketType} line for ${playerName}:`, error);
      return null;
    }
  }

  // Legacy methods for backward compatibility
  static async getPlayerPointsLines(playerName?: string): Promise<PlayerPointsLine[]> {
    const lines = await this.getPlayerLines(playerName, 'player_points');
    return lines.map(line => ({
      playerName: line.playerName,
      pointsLine: line.line,
      bookmaker: line.bookmaker,
      price: line.price
    }));
  }

  static async getPlayerPointsLine(playerName: string): Promise<number | null> {
    return this.getPlayerLine(playerName, 'player_points');
  }

  static async getUpcomingGames(): Promise<OddsApiResponse[]> {
    return this.makeRequest('/sports/basketball_wnba/odds', {
      regions: 'us',
      markets: 'h2h,spreads,totals',
      oddsFormat: 'decimal'
    });
  }
}

// Utility function to normalize player names for matching
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Singleton Redis connection for odds caching
let redis: Redis | null = null;
function getRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  if (!redis) {
    try {
      console.log('Connecting to Redis at:', redisUrl);
      redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 0, // Don't retry on connection failure
        retryDelayOnFailover: 0,
        enableReadyCheck: false,
        connectTimeout: 1000, // 1 second timeout
        commandTimeout: 1000,
      });
      
      // Handle connection errors silently
      redis.on('error', (err) => {
        if (err.message.includes('ECONNREFUSED')) {
          redis = null;
        }
      });
    } catch (error) {
      console.error('Failed to create Redis connection:', error);
      return null;
    }
  }
  return redis;
}

// Cache for API responses to avoid hitting rate limits
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getCachedOddsData<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  const data = await fetcher();
  cache.set(key, { data, timestamp: now });
  return data;
} 