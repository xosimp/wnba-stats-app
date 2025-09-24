import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePlayerPointsLine } from '../../hooks/useOddsData';
import {
  GameLogEntry,
  PlayerStatsGraphProps,
  formatGameDate,
  getOrderedGames,
  calculateOverPercentage,
  getBarStyles,
  getBookLinePosition,
  periodButtonBaseStyle
} from './PlayerStatsGraph.helpers';
import { PeriodSelector } from './PeriodSelector';
import { BarChart } from './BarChart';
import { StatTypeWheel, StatType } from './StatTypeWheel';
import { getPlayerName } from '../../lib/player-mapping';
import { isSameTeam } from '../../lib/utils/opponent-normalization';

// Safe number conversion utility to prevent SyntaxError
function safeNumberConversion(value: any, fallback: number = 0): number {
  try {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    if (typeof value === 'number') {
      return isNaN(value) ? fallback : value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return fallback;
      const converted = Number(trimmed);
      return isNaN(converted) ? fallback : converted;
    }
    const converted = Number(value);
    return isNaN(converted) ? fallback : converted;
  } catch (error) {
    console.warn('❌ Number conversion failed for value:', value, 'using fallback:', fallback, 'error:', error);
    return fallback;
  }
}

// Empty array for fallback when no data is available
const emptyGames: GameLogEntry[] = [];

const THRESHOLD = 38.5;

export function PlayerStatsGraph({ gameLog, bookLine, playerName: propPlayerName, playerId: propPlayerId, loading = false, upcomingOpponent, teamColors = [], isInjured = false, onLoadingChange }: PlayerStatsGraphProps) {
  // Add state to track which heading is selected
  type Period = 'H2H' | 'L5' | 'L10' | 'Season';
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('L5'); // Force L5 to show data
  
  // Add state to track which stat type is selected
  const [selectedStatType, setSelectedStatType] = useState<StatType>('PTS');
  
  // State for season data
  const [seasonGameLog, setSeasonGameLog] = useState<GameLogEntry[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [databaseSeasonStats, setDatabaseSeasonStats] = useState<any[]>([]);
  
  // State for current period data
  const [currentPeriodData, setCurrentPeriodData] = useState<GameLogEntry[]>([]);
  const [currentPeriodLoading, setCurrentPeriodLoading] = useState(false);
  
  // Track if this is initial load or stat switching
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Add a force refresh timestamp to ensure calculations always recalculate
  const [forceRefreshTimestamp, setForceRefreshTimestamp] = useState(Date.now());
  
  // Add a state to track when percentages are ready
  const [percentagesReady, setPercentagesReady] = useState(false);

  // Clear database season stats and reset initial load when player changes
  useEffect(() => {
    console.log('🔄 PlayerStatsGraph: Player changed, clearing all state and caches');
    
    setDatabaseSeasonStats([]);
    setSeasonGameLog([]);
    setCurrentPeriodData([]);
    setOddsLine(null);
    setOddsLineError(null);
    setIsInitialLoad(true);
    
    // Clear all caches when player changes
    oddsCache.current = {};
    periodCache.current = {};
    
    // Reset selected period and stat type to defaults to ensure fresh calculations
    setSelectedPeriod('L5');
    setSelectedStatType('PTS');
    
    // Force refresh timestamp to ensure all calculations recalculate
    setForceRefreshTimestamp(Date.now());
    setPercentagesReady(false);
    
    // Force a small delay to ensure state is fully reset before proceeding
    setTimeout(() => {
      console.log('✅ PlayerStatsGraph: State reset complete, ready for fresh data');
    }, 100);
  }, [propPlayerId]);

  // Additional effect to ensure fresh calculations when component mounts
  useEffect(() => {
    console.log('🚀 PlayerStatsGraph: Component mounting, clearing all caches');
    
    // Force recalculation of percentages by clearing caches on mount
    const clearCachesOnMount = () => {
      oddsCache.current = {};
      periodCache.current = {};
      setIsInitialLoad(true);
      setForceRefreshTimestamp(Date.now());
      setPercentagesReady(false);
    };
    
    clearCachesOnMount();
    
    // Cleanup function to clear caches when component unmounts
    return () => {
      console.log('🧹 PlayerStatsGraph: Component unmounting, cleaning up caches');
      oddsCache.current = {};
      periodCache.current = {};
    };
  }, []); // Empty dependency array means this runs only on mount

  // Fetch season stats from database API
  useEffect(() => {
    if (propPlayerId) {
      const fetchSeasonStats = async () => {
        try {
          const response = await fetch(`/api/stats/database/${propPlayerId}?statType=${selectedStatType}&period=Season`);
          const data = await response.json();
          if (data.seasonStats) {
            setDatabaseSeasonStats([data.seasonStats]);
          }
        } catch (error) {
          console.error('Error fetching season stats:', error);
        }
      };
      fetchSeasonStats();
    }
  }, [propPlayerId, selectedStatType]);

  // Notify parent component when loading state changes (only during initial load)
  useEffect(() => {
    if (isInitialLoad) {
      onLoadingChange?.(loading || seasonLoading || currentPeriodLoading);
    }
  }, [loading, seasonLoading, currentPeriodLoading, onLoadingChange, isInitialLoad]);

  // Set initial load to false after component mounts and data is ready
  useEffect(() => {
    if (gameLog && gameLog.length > 0 && !loading && !seasonLoading && !currentPeriodLoading) {
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
        // Notify parent that initial loading is complete
        onLoadingChange?.(false);
      }, 100); // Small delay to ensure everything is ready
      return () => clearTimeout(timer);
    }
  }, [gameLog, loading, seasonLoading, currentPeriodLoading, onLoadingChange]);

  // Add state for the current odds line
  const [oddsLine, setOddsLine] = useState<number | null>(null);
  const [oddsLineLoading, setOddsLineLoading] = useState(false);
  const [oddsLineError, setOddsLineError] = useState<string | null>(null);

  // Add a cache for odds lines per player and stat type, with expiration
  const oddsCache = useRef<{ [key: string]: { value: number | null, timestamp: number } }>({});
  const ODDS_CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours in ms

  // Add a cache for period selector data per player/period/opponent, with expiration
  const periodCache = useRef<{ [key: string]: { value: GameLogEntry[], timestamp: number } }>({});
  const PERIOD_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

  // Get player name from props or from the first game if available (for odds lookup)
  const playerName = propPlayerName || gameLog?.[0]?.playerName || '';
  
  // Fetch book line from API if not provided
  const { data: apiBookLine, loading: bookLineLoading, error: bookLineError } = usePlayerPointsLine(playerName, !bookLine);

  // Initialize odds line with bookLine for PTS
  useEffect(() => {
    if (selectedStatType === 'PTS' && typeof bookLine === 'number') {
      setOddsLine(bookLine);
    }
  }, [selectedStatType, bookLine]);
  
  // Function to fetch data for a specific period
  const fetchPeriodData = async (playerId: string, period: Period) => {
    if (!playerId) return;
    setCurrentPeriodLoading(true);
    // Cache per player, period, stat type, and opponent (for H2H)
    const cacheKey = `${playerId}|${period}|${selectedStatType}|${period === 'H2H' ? (upcomingOpponent || '') : ''}`;
    const now = Date.now();
    
    // Skip cache during initial load to ensure fresh data
    if (isInitialLoad) {
      console.log('🔄 Skipping cache during initial load for fresh data');
    } else {
      // Check cache first only if not in initial load
      const cached = periodCache.current[cacheKey];
      if (cached && (now - cached.timestamp) < PERIOD_CACHE_TTL) {
        setCurrentPeriodData(cached.value);
        setCurrentPeriodLoading(false);
        return;
      }
    }
    try {
      const timestamp = Date.now();
      const params = new URLSearchParams({
        period: period,
        statType: selectedStatType,
        t: timestamp.toString()
      });
      if (period === 'H2H' && upcomingOpponent) {
        params.append('opponent', upcomingOpponent);
      }
      const res = await fetch(`/api/stats/database/${playerId}?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) {
        setCurrentPeriodData([]);
        return;
      }
      const data = await res.json();
      if (data.games && Array.isArray(data.games) && data.games.length > 0) {
        const periodGames = data.games.map((game: any, index: number) => {
          try {
            return {
              date: game.date || game.gameDate,
              points: safeNumberConversion(game.points, 0),
              assists: safeNumberConversion(game.assists, 0),
              rebounds: safeNumberConversion(game.rebounds || game.totalRebounds || game.avgRebounds, 0),
              offensiveRebounds: safeNumberConversion(game.offensiveRebounds, 0),
              defensiveRebounds: safeNumberConversion(game.defensiveRebounds, 0),
              fieldGoalsAttempted: safeNumberConversion(game.fieldGoalsAttempted, 0),
              threePointersAttempted: safeNumberConversion(game.threePointersAttempted, 0),
              freeThrowsAttempted: safeNumberConversion(game.freeThrowsAttempted, 0),
              opp: game.opponent || game.opp || 'Unknown',
              homeAway: game.homeAway || 'home',
              eventId: game.eventId || game.gameId || `game_${index}`,
              statValue: typeof game.statValue === 'number' ? game.statValue : undefined,
            };
          } catch (conversionError) {
            console.error('❌ Error converting game data:', conversionError, 'for game:', game);
            // Return safe fallback data
            return {
              date: game.date || game.gameDate || 'Unknown',
              points: 0,
              assists: 0,
              rebounds: 0,
              offensiveRebounds: 0,
              defensiveRebounds: 0,
              fieldGoalsAttempted: 0,
              threePointersAttempted: 0,
              freeThrowsAttempted: 0,
              opp: game.opponent || game.opp || 'Unknown',
              homeAway: game.homeAway || 'home',
              eventId: game.eventId || game.gameId || `game_${index}`,
              statValue: 0,
            };
          }
        });
        periodCache.current[cacheKey] = { value: periodGames, timestamp: Date.now() };
        setCurrentPeriodData(periodGames);
      } else {
        setCurrentPeriodData([]);
      }
    } catch (error) {
      setCurrentPeriodData([]);
    } finally {
      setCurrentPeriodLoading(false);
    }
  };

  // Function to fetch season data (for backward compatibility)
  const fetchSeasonData = async (playerId: string) => {
    if (!playerId) return;
    setSeasonLoading(true);
    // Cache per player and stat type
    const cacheKey = `${playerId}|Season|${selectedStatType}`;
    const now = Date.now();
    
    // Skip cache during initial load to ensure fresh data
    if (isInitialLoad) {
      console.log('🔄 Skipping season cache during initial load for fresh data');
    } else {
      // Check cache first only if not in initial load
      const cached = periodCache.current[cacheKey];
      if (cached && (now - cached.timestamp) < PERIOD_CACHE_TTL) {
        setSeasonGameLog(cached.value);
        setSeasonLoading(false);
        return;
      }
    }
    try {
      const timestamp = Date.now();
      const params = new URLSearchParams({
        statType: selectedStatType,
        t: timestamp.toString()
      });
      const res = await fetch(`/api/stats/database/${playerId}?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) {
        setSeasonGameLog([]);
        return;
      }
      const data = await res.json();
      if (data.games && Array.isArray(data.games) && data.games.length > 0) {
        const seasonGames = data.games.map((game: any, index: number) => {
          const points = typeof game['1'] === 'number' ? game['1'] : 
                        typeof game.points === 'number' ? game.points : 
                        typeof game.pts === 'number' ? game.pts : 0;
          const assists = typeof game['2'] === 'number' ? game['2'] : 
                         typeof game.assists === 'number' ? game.assists : 
                         typeof game.ast === 'number' ? game.ast : 0;
          const rebounds = typeof game['3'] === 'number' ? game['3'] :
                           typeof game.rebounds === 'number' ? game.rebounds :
                           typeof game.reb === 'number' ? game.reb : 0;
          return {
            date: game['13'] || game.date || game.gameDate,
            points: points,
            assists: assists,
            rebounds: rebounds,
            offensiveRebounds: safeNumberConversion(game.offensiveRebounds || game.oreb, 0),
            defensiveRebounds: safeNumberConversion(game.defensiveRebounds || game.dreb, 0),
            fieldGoalsAttempted: safeNumberConversion(game.fieldGoalsAttempted, 0),
            threePointersAttempted: safeNumberConversion(game.threePointersAttempted, 0),
            freeThrowsAttempted: safeNumberConversion(game.freeThrowsAttempted, 0),
            opp: game.opponent || game['14'] || game.opponent_abbr || game.opp,
            homeAway: game['15'] || game.homeAway || 'home',
            eventId: game['16'] || game.gameId || game.eventId || `game_${index}`,
            statValue: typeof game.statValue === 'number' ? game.statValue : undefined,
          };
        });
        periodCache.current[cacheKey] = { value: seasonGames, timestamp: Date.now() };
        setSeasonGameLog(seasonGames);
      } else {
        setSeasonGameLog([]);
      }
    } catch (error) {
      setSeasonGameLog([]);
    } finally {
      setSeasonLoading(false);
    }
  };
  
  // seasonAverageLine will be computed after statGamesFull is defined (below)
  
  // Effect to fetch data when period changes or when we have a player
  useEffect(() => {
    // Always fetch data when period changes, regardless of gameLog prop
    // This ensures period switching works properly
    
    // Use the playerId prop if available, otherwise search for it
    let playerId = propPlayerId;
    
    if (!playerId && playerName) {
      // Search for player ID if not provided
      fetch(`/api/players/search?q=${encodeURIComponent(playerName)}`)
        .then(res => res.json())
        .then(data => {
          if (data.results && data.results.length > 0) {
            const foundPlayer = data.results[0];
            const foundPlayerId = foundPlayer.playerId || foundPlayer.id;
            if (foundPlayerId) {
              console.log('Found player ID from search:', foundPlayerId);
              playerId = foundPlayerId;
              
              // Fetch data for the selected period
              if (selectedPeriod === 'Season') {
                fetchSeasonData(foundPlayerId);
              } else {
                fetchPeriodData(foundPlayerId, selectedPeriod);
              }
            } else {
              console.log('No player ID found in search results');
            }
          } else {
            console.log('No player found in search');
          }
        })
        .catch(error => {
          console.error('Error searching for player:', error);
        });
    } else if (playerId) {
      // Use the provided playerId
      console.log('Using provided player ID:', playerId);
      
      // Fetch data for the selected period
      if (selectedPeriod === 'Season') {
        fetchSeasonData(playerId);
      } else {
        fetchPeriodData(playerId, selectedPeriod);
      }
    }
  }, [selectedPeriod, gameLog, playerName, propPlayerId, upcomingOpponent]);

  // Ensure Season data is fetched at least once so percentages for all selectors are always accurate
  useEffect(() => {
    if (propPlayerId && seasonGameLog.length === 0) {
      fetchSeasonData(propPlayerId);
    }
  }, [propPlayerId]);

  // Effect to fetch data when stat type changes
  useEffect(() => {
    // Only fetch if we have a playerId and the stat type is not PTS (which is default)
    if (!propPlayerId || selectedStatType === 'PTS') return;
    
    console.log(`Fetching data for stat type: ${selectedStatType}`);
    
    // Fetch data for the current period with the new stat type
    if (selectedPeriod === 'Season') {
      fetchSeasonData(propPlayerId);
    } else {
      fetchPeriodData(propPlayerId, selectedPeriod);
    }
  }, [selectedStatType, propPlayerId, selectedPeriod]);

  // Fetch odds line when stat type or playerId changes
  useEffect(() => {
    if (!propPlayerId || !selectedStatType) return;
    setOddsLineLoading(true);
    setOddsLineError(null);
    
    // Map stat types to market types
    const marketTypeMap: { [key: string]: string } = {
      'PTS': 'player_points',
      'REB': 'player_rebounds',
      'AST': 'player_assists',
      'PA': 'player_points_assists',
      'PRA': 'player_points_rebounds_assists',
      'PR': 'player_points_rebounds',
      'TO': 'player_turnovers',
      'STL': 'player_steals',
      'STL+BLK': 'player_blocks_steals',
      'FTA': 'player_frees_attempts',
    };
    
    const marketType = marketTypeMap[selectedStatType];
    if (!marketType) {
      setOddsLine(null);
      setOddsLineLoading(false);
      return;
    }
    
    // Use player name instead of player ID for the odds API
    const playerName = propPlayerName || getPlayerName(propPlayerId);
    const cacheKey = `${playerName}|${marketType}`;
    const now = Date.now();
    
    // Skip cache during initial load to ensure fresh data
    if (isInitialLoad) {
      console.log('🔄 Skipping odds cache during initial load for fresh data');
    } else {
      // Check cache first only if not in initial load
      const cached = oddsCache.current[cacheKey];
      if (cached && (now - cached.timestamp) < ODDS_CACHE_TTL) {
        setOddsLine(cached.value);
        setOddsLineLoading(false);
        return;
      }
    }
    
    // Use the real odds API for all stat types
    fetch(`/api/odds?action=player-line&player=${encodeURIComponent(playerName)}&market=${marketType}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        // Extract the line based on market type
        let line: number | null = null;
        switch (marketType) {
          case 'player_points':
            line = typeof data.pointsLine === 'number' ? data.pointsLine : (typeof data.line === 'number' ? data.line : null);
            break;
          case 'player_rebounds':
            line = typeof data.reboundsLine === 'number' ? data.reboundsLine : (typeof data.line === 'number' ? data.line : null);
            break;
          case 'player_assists':
            line = typeof data.assistsLine === 'number' ? data.assistsLine : (typeof data.line === 'number' ? data.line : null);
            break;
          case 'player_frees_attempts':
            line = typeof data.ftaLine === 'number' ? data.ftaLine : (typeof data.line === 'number' ? data.line : null);
            break;
          default:
            line = typeof data.line === 'number' ? data.line : null;
        }
        
        oddsCache.current[cacheKey] = { value: typeof line === 'number' ? line : null, timestamp: Date.now() };
        if (typeof line === 'number') { 
          setOddsLine(line); 
        } else if (selectedStatType === 'PTS' && typeof bookLine === 'number') { 
          setOddsLine(bookLine); // Fallback for PTS
        } else { 
          setOddsLine(null); 
        }
        setOddsLineLoading(false);
      })
      .catch(err => {
        oddsCache.current[cacheKey] = { value: null, timestamp: Date.now() };
        if (selectedStatType === 'PTS' && typeof bookLine === 'number') { 
          setOddsLine(bookLine); // Fallback on error
        } else { 
          setOddsLine(null); 
        }
        setOddsLineLoading(false);
        setOddsLineError(null); // Don't show error to user
      });
  }, [propPlayerId, propPlayerName, selectedStatType, bookLine]);

  // Function to get games based on selected period
  const getGamesForPeriod = () => {
    // ALWAYS prioritize internal API data over prop data to ensure fresh calculations
    if (selectedPeriod === 'Season' && seasonGameLog.length > 0) {
      console.log('✅ Using fresh season API data with', seasonGameLog.length, 'games');
      return seasonGameLog;
    }
    
    if (selectedPeriod !== 'Season' && currentPeriodData.length > 0) {
      console.log(`✅ Using fresh ${selectedPeriod} API data with`, currentPeriodData.length, 'games');
      return currentPeriodData;
    }
    
    // Only use gameLog prop as absolute last resort when no API data is available
    if (Array.isArray(gameLog) && gameLog.length > 0) {
      console.log('⚠️ Falling back to gameLog prop with', gameLog.length, 'games (this may cause stale calculations)');
      
      // Filter based on selected period
      if (selectedPeriod === 'L5') {
        const orderedGames = getOrderedGames(gameLog);
        return orderedGames.slice(0, 5);
      } else if (selectedPeriod === 'L10') {
        const orderedGames = getOrderedGames(gameLog);
        return orderedGames.slice(0, 10);
      } else if (selectedPeriod === 'H2H' && upcomingOpponent) {
        return gameLog.filter(game => {
          const gameOpponent = game.opp || game.opponent || game.opponent_abbr;
          return gameOpponent && isSameTeam(gameOpponent, upcomingOpponent);
        });
      } else {
        // Season or no period specified - return all games
        return getOrderedGames(gameLog);
      }
    }
    
    // Return empty array if no data available
    console.log('❌ No data available for period:', selectedPeriod);
    return emptyGames;
  };

  // Get the games to display - prioritize internal API data over prop data
  const games = getGamesForPeriod();
  console.log('🎯 PlayerStatsGraph - selectedPeriod:', selectedPeriod, 'games.length:', games.length, 'seasonGameLog.length:', seasonGameLog.length, 'currentPeriodData.length:', currentPeriodData.length);
  
  // Add error boundary for games data
  if (!Array.isArray(games)) {
    console.error('Games is not an array:', games);
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: Invalid games data</div>
      </div>
    );
  }
  
  // Calculate season stats when Season is selected
  const seasonStats = selectedPeriod === 'Season' && games.length > 0 ? {
    totalPoints: games.reduce((sum, game) => sum + safeNumberConversion(game.points, 0), 0),
    totalGames: games.length,
    averagePoints: games.reduce((sum, game) => sum + safeNumberConversion(game.points, 0), 0) / games.length,
    highestGame: Math.max(...games.map(game => safeNumberConversion(game.points, 0))),
    lowestGame: Math.min(...games.map(game => safeNumberConversion(game.points, 0)))
  } : null;
  
  // safeFinalBookLine will be computed after finalBookLine is set

  // Helper to get stat value for a game based on stat type
  function getStatValue(game: GameLogEntry, statType: StatType): number {
    const pts = safeNumberConversion(game.points, 0);
    const ast = safeNumberConversion(game.assists, 0);
    const reb = safeNumberConversion(
      (game as any).rebounds ?? (game as any).totalRebounds ?? (game as any).avgRebounds ?? (game as any).reb, 0
    );
    const oreb = safeNumberConversion(game.offensiveRebounds, 0);
    const dreb = safeNumberConversion(game.defensiveRebounds, 0);
    const stl = safeNumberConversion(game.steals, 0);
    const blk = safeNumberConversion(game.blocks, 0);
    const to = safeNumberConversion(game.turnovers, 0);
    
      // Debug logs removed for cleaner console
    
    switch (statType) {
      case 'PTS': return pts;
      case 'REB': return reb || (oreb + dreb);
      case 'AST': return ast;
      case 'PA': return pts + ast;
      case 'PRA': return pts + ast + reb;
      case 'PR': return pts + reb;
      case 'FGA': 
        return safeNumberConversion(game.fieldGoalsAttempted, 0);
      case '3PA': 
        return safeNumberConversion(game.threePointersAttempted, 0);
      case 'FTA': 
        return safeNumberConversion(game.freeThrowsAttempted, 0);
      default: return 0;
    }
  }

  // Filter out future games and map to stat value
  const today = new Date();
  const filteredGames = games.filter(game => {
    try {
      if (!game.date || typeof game.date !== 'string') {
        console.warn('Invalid date value:', game.date, game);
        return false;
      }
      const d = new Date(game.date);
      const valid = !isNaN(d.getTime());
      if (!valid) console.warn('Invalid date format:', game.date, game);
      return valid && d <= today;
    } catch (dateError) {
      console.error('Date parsing error:', dateError, 'for date:', game.date, game);
      return false;
    }
  });
  const statGames = filteredGames.map(game => {
    // Always recalculate statValue based on current selectedStatType to ensure correct values when switching stats
    const statValue = getStatValue(game, selectedStatType);
    return { ...game, statValue };
  });
  
  

  // Build a full-season statGames array independent of the selected period for accurate selector percentages
  // ALWAYS prioritize internal API data for percentage calculations
  const fullSeasonGamesBase = seasonGameLog.length > 0
    ? seasonGameLog
    : (Array.isArray(gameLog) && gameLog.length > 0 ? getOrderedGames(gameLog) : currentPeriodData);
    
  console.log('📊 Full season games base:', {
    seasonGameLogLength: seasonGameLog.length,
    gameLogLength: Array.isArray(gameLog) ? gameLog.length : 0,
    currentPeriodDataLength: currentPeriodData.length,
    usingSeasonData: seasonGameLog.length > 0
  });
  const fullSeasonFiltered = (fullSeasonGamesBase || []).filter(game => {
    try {
      if (!game.date || typeof game.date !== 'string') {
        console.warn('Invalid date value in full season filter:', game.date, game);
        return false;
      }
      const d = new Date(game.date);
      const valid = !isNaN(d.getTime());
      return valid && d <= today;
    } catch (dateError) {
      console.error('Date parsing error in full season filter:', dateError, 'for date:', game.date, game);
      return false;
    }
  })
  // Sort by most recent first to ensure L5/L10 are truly the latest games
  .sort((a, b) => {
    try {
      if (!a.date || !b.date || typeof a.date !== 'string' || typeof b.date !== 'string') {
        console.warn('Invalid date values for sorting:', { a: a.date, b: b.date });
        return 0;
      }
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (isNaN(da) || isNaN(db)) {
        console.warn('Invalid date timestamps for sorting:', { a: da, b: db });
        return 0;
      }
      return db - da;
    } catch (sortError) {
      console.error('Date sorting error:', sortError, 'for dates:', { a: a.date, b: b.date });
      return 0;
    }
  });
  const statGamesFull = fullSeasonFiltered.map(game => ({ 
    ...game, 
    statValue: getStatValue(game, selectedStatType) 
  }));
  
  // Use season stats from database for basic stats, calculate combined stats from game logs
  const seasonAverageLine = (() => {
    const stats = databaseSeasonStats && databaseSeasonStats.length > 0 ? databaseSeasonStats[0] : null;
    
    // Only use database stats - don't fall back to game log calculation to avoid stale data
    // This ensures the fallback line is null when we don't have fresh database data
    let result;
    switch (selectedStatType) {
      case 'PTS': 
        result = stats?.avgPoints || null;
        break;
      case 'REB': 
        result = stats?.avgRebounds || null;
        break;
      case 'AST': 
        result = stats?.avgAssists || null;
        break;
      case 'PA': 
        result = stats ? (stats.avgPoints || 0) + (stats.avgAssists || 0) : null;
        break;
      case 'PRA': 
        result = stats ? (stats.avgPoints || 0) + (stats.avgAssists || 0) + (stats.avgRebounds || 0) : null;
        break;
      case 'PR': 
        result = stats ? (stats.avgPoints || 0) + (stats.avgRebounds || 0) : null;
        break;
      case 'FGA': 
        result = stats?.fieldGoalsAttempted || null;
        break;
      case '3PA': 
        result = stats?.threePointersAttempted || null;
        break;
      case 'FTA': 
        result = stats?.freeThrowsAttempted || null;
        break;
      default: 
        result = null;
    }
    
    return result;
  })();
  
  // Helper function to calculate average from games
  function calculateAverageFromGames(statType: StatType): number | null {
    if (fullSeasonFiltered.length === 0) return null;
    const values = fullSeasonFiltered.map(game => getStatValue(game, statType));
    if (values.length === 0) return null;
    const sum = values.reduce((acc, v) => acc + v, 0);
    return Math.round((sum / values.length) * 10) / 10;
  }
  
  // Book line priority: 1) Real odds line, 2) season-average for selected stat (when no odds line), 3) provided bookLine (PTS only), 4) fallback API PTS line
  // Hide book lines for FGA, 3PA, and FTA since these markets are not commonly available
  const shouldShowBookLine = !['FGA', '3PA', 'FTA'].includes(selectedStatType);
  const finalBookLine = shouldShowBookLine ? (oddsLine !== null ? oddsLine : (seasonAverageLine || bookLine || (apiBookLine !== null ? apiBookLine : 0))) : null;
  const safeFinalBookLine = shouldShowBookLine && typeof finalBookLine === 'number' ? finalBookLine : 0;
  
  // Debug logs removed for cleaner console

  // Calculate percentages for all selectors from the full-season dataset so they are always correct
  // Force recalculation by including forceRefreshTimestamp to ensure fresh calculations
  const l5Percentage = calculateOverPercentage(statGamesFull.slice(0, 5), 5, safeFinalBookLine);
  const l10Percentage = calculateOverPercentage(statGamesFull.slice(0, 10), 10, safeFinalBookLine);
  const seasonPercentage = calculateOverPercentage(statGamesFull, statGamesFull.length, safeFinalBookLine);
  const h2hGamesFull = upcomingOpponent
    ? statGamesFull.filter(game => {
        try {
          const gameOpponent = game.opp || game.opponent_abbr || game.opponent;
          const isAgainstUpcomingOpponent = gameOpponent && isSameTeam(gameOpponent, upcomingOpponent);
          
          if (!game.date || typeof game.date !== 'string') {
            console.warn('Invalid date value in H2H filter:', game.date, game);
            return false;
          }
          const gameDate = new Date(game.date);
          if (isNaN(gameDate.getTime())) {
            console.warn('Invalid date format in H2H filter:', game.date, game);
            return false;
          }
          const is2025season = gameDate.getFullYear() === 2025;
          return isAgainstUpcomingOpponent && is2025season;
        } catch (h2hError) {
          console.error('H2H filtering error:', h2hError, 'for game:', game);
          return false;
        }
      })
    : statGamesFull;
  const h2hPercentage = calculateOverPercentage(h2hGamesFull, h2hGamesFull.length, safeFinalBookLine);

  // Debug log to track percentage calculations
  console.log('🎯 Percentage calculations (timestamp:', forceRefreshTimestamp, '):', {
    l5Percentage,
    l10Percentage,
    seasonPercentage,
    h2hPercentage,
    isInitialLoad,
    statGamesFullLength: statGamesFull.length,
    safeFinalBookLine,
    forceRefreshTimestamp,
    statGamesFullData: statGamesFull.slice(0, 3).map(g => ({ date: g.date, statValue: g.statValue }))
  });

  // Force percentage recalculation when data changes
  useEffect(() => {
    console.log('🔄 Data changed, forcing percentage recalculation:', {
      statGamesFullLength: statGamesFull.length,
      currentPeriodDataLength: currentPeriodData.length,
      seasonGameLogLength: seasonGameLog.length,
      selectedPeriod,
      selectedStatType
    });
    
    // Mark percentages as ready when we have data
    if (statGamesFull.length > 0) {
      setPercentagesReady(true);
      console.log('✅ Percentages ready with', statGamesFull.length, 'games');
    }
  }, [statGamesFull.length, currentPeriodData.length, seasonGameLog.length, selectedPeriod, selectedStatType]);

  // Determine maxVisibleValue for the chart
  let maxVisibleValue = 50;
  if (selectedStatType === 'REB') maxVisibleValue = 20;
  else if (selectedStatType === 'AST') maxVisibleValue = 15;
  else if (['FTA', '3PA'].includes(selectedStatType)) maxVisibleValue = 15;
  else if (selectedStatType === 'FGA') maxVisibleValue = 25;

  // Handle period selection
  const handlePeriodSelect = (period: string) => {
    setSelectedPeriod(period as Period);
  };

  // Handle stat type selection
  const handleStatTypeSelect = (statType: StatType) => {
    setSelectedStatType(statType);
  };

  if (loading || bookLineLoading) {
            return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
            );
  }
              
              return (
    <div>
      <div className="p-12 max-w-xl mx-auto mt-6" style={{ background: '#181B23', border: '3px solid black', borderRadius: '12px', boxShadow: '0 0 20px rgba(0,0,0,0.7)', padding: '15px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="fixed z-30"
          style={{ right: 55, top: 135, width: 420, textAlign: 'center', pointerEvents: 'none' }}
        >
          <span
            style={{
              color: '#e5e5e5',
              fontWeight: 600,
              fontSize: '1.5rem',
              textShadow: '0 0 12px #000, 0 0 24px #000',
              pointerEvents: 'auto',
            }}
          >
            Performance Breakdown
          </span>
        </motion.div>
        <div style={{ background: '#181B23', border: '1px solid #232323', borderRadius: '8px', boxShadow: '0 0 16px rgba(0,0,0,0.8)', padding: '15px 15px 65px 15px', height: 'calc(100% + 30px)', position: 'relative' }}>
          {/* Fallback message overlays chart, does not affect layout */}
          {oddsLine === null && seasonAverageLine && (
            <div style={{
              position: 'absolute',
              top: 53,
              left: 47.5,
              width: 'calc(100% - 85px)',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 30
            }}>
              <span style={{
                display: 'inline-block',
                background: 'rgba(24, 27, 35, 0.3)',
                color: '#ffb300',
                fontWeight: 600,
                fontSize: '1.05rem',
                textShadow: '0 0 8px #000',
                padding: '6px 12px 8px 12px',
                borderRadius: 8
              }}>
                {['FGA', '3PA', 'FTA'].includes(selectedStatType) 
                  ? `No sportsbook lines available for ${selectedStatType}`
                  : `No sportsbook line available yet, showing season average for ${selectedStatType}`
                }
              </span>
            </div>
          )}
          {/* Move PeriodSelector up by 10px without affecting the rest of the graph */}
      <div style={{ position: 'relative', top: '-10px', zIndex: 20 }}>
            <PeriodSelector
              key={`${propPlayerId}-${selectedStatType}-${isInitialLoad}-${forceRefreshTimestamp}-${percentagesReady}-${statGamesFull.length}`}
              selectedPeriod={selectedPeriod}
              onSelect={handlePeriodSelect}
              h2hPercentage={h2hPercentage}
              l5Percentage={l5Percentage}
              l10Percentage={l10Percentage}
              seasonPercentage={seasonPercentage}
              selectedStatType={selectedStatType}
              h2hGamesCount={h2hGamesFull.length}
            />
          </div>
          <BarChart
            key={`${propPlayerId || ''}`}
            games={statGames}
            selectedPeriod={selectedPeriod}
            selectedStatType={selectedStatType}
            finalBookLine={finalBookLine}
            fallbackBookLine={shouldShowBookLine ? (seasonAverageLine || 0) : null}
            bookLineLoading={isInitialLoad ? false : oddsLineLoading}
            periodLoading={isInitialLoad ? false : currentPeriodLoading}
            formatGameDate={formatGameDate}
            getBarStyles={getBarStyles}
            getBookLinePosition={getBookLinePosition}
            maxVisibleValue={maxVisibleValue}
          />
        </div>
      </div>
      {/* Move StatTypeWheel down by 4px for fine-tuned positioning */}
      <div style={{ position: 'relative', top: '-6px', zIndex: 10 }}>
        <StatTypeWheel
          selectedStatType={selectedStatType}
          onStatTypeSelect={handleStatTypeSelect}
        />
      </div>
    </div>
  );
}