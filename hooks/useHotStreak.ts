import { useState, useEffect } from 'react';

interface GameLog {
  date: string;
  points: number;
  assists: number;
  opp: string;
  homeAway: string;
  eventId: string;
}

interface HotStreakData {
  isOnHotStreak: boolean;
  last5Games: GameLog[];
  bookLine: number | null;
}

export function useHotStreak(playerName: string) {
  const [hotStreakData, setHotStreakData] = useState<HotStreakData>({
    isOnHotStreak: false,
    last5Games: [],
    bookLine: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerName) {
      setLoading(false);
      return;
    }

    const checkHotStreak = async () => {
      try {
        setLoading(true);
        
        // First, get the player ID by searching for the player
        const searchRes = await fetch(`/api/players/search?q=${encodeURIComponent(playerName)}&detailed=true`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!searchRes.ok) {
          console.error('Failed to search for player:', searchRes.status);
          setLoading(false);
          return;
        }
        
        const searchData = await searchRes.json();
        
        if (!searchData.results || searchData.results.length === 0) {
          console.log('Player not found:', playerName);
          setLoading(false);
          return;
        }
        
        const playerId = searchData.results[0].playerId || searchData.results[0].id;
        
        if (!playerId) {
          console.error('No player ID found for:', playerName);
          setLoading(false);
          return;
        }

        // Get player stats and game log
        const statsRes = await fetch(`/api/stats/database/${playerId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!statsRes.ok) {
          console.error('Failed to fetch player stats:', statsRes.status);
          setLoading(false);
          return;
        }
        
        const statsData = await statsRes.json();
        
        if (!statsData.games || !Array.isArray(statsData.games)) {
          console.log('No game data found for:', playerName);
          setLoading(false);
          return;
        }
        
        // Get the last 5 games
        const last5Games = statsData.games.slice(0, 5).map((game: any) => ({
          date: game.date || game.gameDate,
          points: Number(game.points || 0),
          assists: Number(game.assists || 0),
          opp: game.opponent || game.opponent_abbr || game.opp,
          homeAway: game.homeAway || game.home_away || 'home',
          eventId: game.gameId || game.eventId || `game_${Date.now()}`
        }));
        
        const bookLine = statsData.nextGamePointsLine || null;
        
        // Check if player is on a hot streak (all last 5 games above book line)
        let isOnHotStreak = false;
        
        if (bookLine && last5Games.length === 5) {
          isOnHotStreak = last5Games.every((game: any) => game.points > bookLine);
        }
        
        setHotStreakData({
          isOnHotStreak,
          last5Games,
          bookLine
        });
        
      } catch (error) {
        console.error('Error checking hot streak for', playerName, ':', error);
      } finally {
        setLoading(false);
      }
    };

    checkHotStreak();
  }, [playerName]);

  return { ...hotStreakData, loading };
} 