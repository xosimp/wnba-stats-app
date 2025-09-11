// ESPN API client for WNBA data
export interface ESPNGame {
  id: string;
  date: string;
  homeTeam: {
    id: string;
    name: string;
    abbreviation: string;
    score?: number;
  };
  awayTeam: {
    id: string;
    name: string;
    abbreviation: string;
    score?: number;
  };
  status: {
    type: {
      id: string;
      name: string;
      state: string;
    };
  };
  completed: boolean;
}

export interface ESPNSchedule {
  games: ESPNGame[];
  season: {
    year: number;
    type: number;
  };
}

// WNBA team mapping for ESPN
export const WNBA_TEAM_MAPPING = {
  'CONN': { espnId: '386', name: 'Connecticut Sun' },
  'NYL': { espnId: '387', name: 'New York Liberty' },
  'SEA': { espnId: '388', name: 'Seattle Storm' },
  'LV': { espnId: '389', name: 'Las Vegas Aces' },
  'PHO': { espnId: '390', name: 'Phoenix Mercury' },
  'MIN': { espnId: '391', name: 'Minnesota Lynx' },
  'DAL': { espnId: '392', name: 'Dallas Wings' },
  'ATL': { espnId: '393', name: 'Atlanta Dream' },
  'WAS': { espnId: '394', name: 'Washington Mystics' },
  'CHI': { espnId: '395', name: 'Chicago Sky' },
  'IND': { espnId: '396', name: 'Indiana Fever' },
  'LA': { espnId: '397', name: 'Los Angeles Sparks' }
};

export class ESPNApiService {
  private baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';

  /**
   * Fetch WNBA schedule for a specific season
   */
  async getSchedule(season: number = 2025): Promise<ESPNGame[]> {
    try {
      const url = `${this.baseUrl}/scoreboard?dates=${season}`;
      console.log('Fetching ESPN schedule from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NextGenHoops/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('ESPN API response received');

      if (!data.events) {
        console.log('No events found in ESPN response');
        return [];
      }

      const games: ESPNGame[] = data.events.map((event: any) => {
        const homeTeam = event.competitions[0]?.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = event.competitions[0]?.competitors?.find((c: any) => c.homeAway === 'away');

        return {
          id: event.id,
          date: event.date,
          homeTeam: {
            id: homeTeam?.team?.id || '',
            name: homeTeam?.team?.name || '',
            abbreviation: homeTeam?.team?.abbreviation || '',
            score: homeTeam?.score ? parseInt(homeTeam.score) : undefined
          },
          awayTeam: {
            id: awayTeam?.team?.id || '',
            name: awayTeam?.team?.name || '',
            abbreviation: awayTeam?.team?.abbreviation || '',
            score: awayTeam?.score ? parseInt(awayTeam.score) : undefined
          },
          status: event.status,
          completed: event.status?.type?.state === 'post'
        };
      });

      console.log(`Processed ${games.length} games from ESPN API`);
      return games;
    } catch (error) {
      console.error('Error fetching ESPN schedule:', error);
      return [];
    }
  }

  /**
   * Get completed games for a specific team
   */
  async getTeamCompletedGames(teamAbbr: string, season: number = 2025): Promise<ESPNGame[]> {
    const allGames = await this.getSchedule(season);
    const teamMapping = WNBA_TEAM_MAPPING[teamAbbr as keyof typeof WNBA_TEAM_MAPPING];
    
    if (!teamMapping) {
      console.error(`Unknown team abbreviation: ${teamAbbr}`);
      return [];
    }

    return allGames.filter(game => 
      game.completed && 
      (game.homeTeam.abbreviation === teamAbbr || game.awayTeam.abbreviation === teamAbbr)
    );
  }

  /**
   * Get upcoming games for a specific team
   */
  async getTeamUpcomingGames(teamAbbr: string, season: number = 2025): Promise<ESPNGame[]> {
    const allGames = await this.getSchedule(season);
    const teamMapping = WNBA_TEAM_MAPPING[teamAbbr as keyof typeof WNBA_TEAM_MAPPING];
    
    if (!teamMapping) {
      console.error(`Unknown team abbreviation: ${teamAbbr}`);
      return [];
    }

    return allGames.filter(game => 
      !game.completed && 
      (game.homeTeam.abbreviation === teamAbbr || game.awayTeam.abbreviation === teamAbbr)
    );
  }

  /**
   * Check if a game is completed based on ESPN data
   */
  isGameCompleted(gameId: string, schedule: ESPNGame[]): boolean {
    const game = schedule.find(g => g.id === gameId);
    return game?.completed || false;
  }

  /**
   * Get opponent for a specific game
   */
  getGameOpponent(gameId: string, teamAbbr: string, schedule: ESPNGame[]): string | null {
    const game = schedule.find(g => g.id === gameId);
    if (!game) return null;

    if (game.homeTeam.abbreviation === teamAbbr) {
      return game.awayTeam.abbreviation;
    } else if (game.awayTeam.abbreviation === teamAbbr) {
      return game.homeTeam.abbreviation;
    }

    return null;
  }
}

// Export singleton instance
export const espnApi = new ESPNApiService(); 