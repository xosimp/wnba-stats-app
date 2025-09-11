"use client";
import { useState, useEffect } from 'react';

interface UseOddsDataOptions {
  playerName?: string;
  action?: 'player-line' | 'player-lines' | 'games' | 'upcoming';
  enabled?: boolean;
}

interface OddsDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useOddsData<T>(options: UseOddsDataOptions = {}) {
  const { playerName, action = 'games', enabled = true } = options;
  const [state, setState] = useState<OddsDataState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;

    const fetchData = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const params = new URLSearchParams();
        params.append('action', action);
        
        if (playerName) {
          params.append('player', playerName);
        }

        const response = await fetch(`/api/odds?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }

        // Extract the appropriate data based on action
        let data: T;
        switch (action) {
          case 'player-line':
            data = result.pointsLine as T;
            break;
          case 'player-lines':
            data = result.lines as T;
            break;
          case 'games':
          case 'upcoming':
            data = result.games as T;
            break;
          default:
            data = result as T;
        }

        setState({ data, loading: false, error: null });
      } catch (error) {
        console.error('Failed to fetch odds data:', error);
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch odds data',
        });
      }
    };

    fetchData();
  }, [playerName, action, enabled]);

  const refetch = () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    // This will trigger the useEffect again
  };

  return {
    ...state,
    refetch,
  };
}

// Specific hooks for common use cases
export function usePlayerPointsLine(playerName: string, enabled = true) {
  return useOddsData<number | null>({
    playerName,
    action: 'player-line',
    enabled: enabled && !!playerName,
  });
}

export function useAllPlayerLines(playerName?: string, enabled = true) {
  return useOddsData<Array<{
    playerName: string;
    pointsLine: number;
    bookmaker: string;
    price: number;
  }>>({
    playerName,
    action: 'player-lines',
    enabled,
  });
}

export function useWNBAGames(enabled = true) {
  return useOddsData<Array<{
    id: string;
    sport_key: string;
    sport_title: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers: Array<{
      key: string;
      title: string;
      markets: Array<{
        key: string;
        outcomes: Array<{
          name: string;
          price: number;
          point?: number;
        }>;
      }>;
    }>;
  }>>({
    action: 'games',
    enabled,
  });
} 