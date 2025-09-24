'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerSearch } from '../../hooks/usePlayerSearch';
import { PlayerPhoto } from '../player/PlayerPhoto';
import { TEAMS } from '../../lib/constants/team-data';
import { getTeamData, getTeamName, getTeamColors } from '../../lib/utils/team-mapping';
import { GradientCard } from '../ui/GradientCard';
import { AnimatedStats } from '../stats/AnimatedStats';
import { PlayerStatsGraph } from '../stats/PlayerStatsGraph';
import { getPlayerImageUrl } from '../../lib/utils/playerImage';
import { LeagueSideBanner } from '../ui/LeagueSideBanner';
// Removed unused polished import
import { createClient } from '@supabase/supabase-js';
import { useSession } from 'next-auth/react';
import ErrorBoundary from '../ErrorBoundary';

// Star animation component
function StarAnimation({ isVisible, onComplete, starPosition, homeLinkPosition }: { 
  isVisible: boolean; 
  onComplete: () => void;
  starPosition: { x: number; y: number } | null;
  homeLinkPosition: { x: number; y: number } | null;
}) {
  return (
    <AnimatePresence>
      {isVisible && starPosition && (
        <motion.div
          initial={{ 
            position: 'fixed',
            top: starPosition.y,
            left: starPosition.x,
            transform: 'translate(-50%, -50%)',
            zIndex: 9999
          }}
          animate={{
            position: 'fixed',
            top: homeLinkPosition?.y || '2.5rem',
            left: homeLinkPosition?.x || '80px',
            transform: 'translate(-50%, -50%)',
            scale: [1, 1.2, 0.8, 0.3],
            opacity: [1, 1, 0.8, 0]
          }}
          transition={{
            duration: 1.2,
            ease: "easeInOut"
          }}
          onAnimationComplete={onComplete}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFD700" style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Component to handle async player image loading with caching
function PlayerImageComponent({ playerName, onLoadingChange }: { playerName: string; onLoadingChange?: (loading: boolean) => void }) {
  const [imageUrl, setImageUrl] = useState<string>('/default-player.png');
  const [isLoading, setIsLoading] = useState(false); // Start with false since we check cache first

  // Notify parent component when loading state changes
  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  useEffect(() => {
    async function loadPlayerImage() {
      // Check cache first
      const cacheKey = `player_image_${playerName}`;
      const cachedUrl = sessionStorage.getItem(cacheKey);
      
      if (cachedUrl) {
        setImageUrl(cachedUrl);
        setIsLoading(false);
        return;
      }

      // Check if image is already preloaded in the browser cache
      const preloadCheck = new Image();
      preloadCheck.onload = () => {
        // Image is already cached by browser, use it directly
        const directUrl = `/api/images/player/${encodeURIComponent(playerName)}`;
        setImageUrl(directUrl);
        sessionStorage.setItem(cacheKey, directUrl);
        setIsLoading(false);
      };
      
      preloadCheck.onerror = async () => {
        // Image not preloaded, fetch it normally
        setIsLoading(true);
        try {
          const url = await getPlayerImageUrl(playerName);
          setImageUrl(url);
          // Cache the successful URL
          sessionStorage.setItem(cacheKey, url);
        } catch (error) {
          console.error('Error loading player image:', error);
          setImageUrl('/default-player.png');
        } finally {
          setIsLoading(false);
        }
      };
      
      // Try to load the preloaded image
      preloadCheck.src = `/api/images/player/${encodeURIComponent(playerName)}`;
    }

    loadPlayerImage();
  }, [playerName]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }} // Reduced duration for faster feel
      key={`player-image-${playerName}`}
    >
      <img
        src={imageUrl}
        alt={playerName}
        loading="eager"
        decoding="async"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          marginLeft: '-100px',
          width: '700px',
          height: '470px',
          objectFit: 'contain',
          opacity: isLoading ? 0.5 : 1,
          filter: 'drop-shadow(0 0 24px #000)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src = '/default-player.png';
        }}
      />
    </motion.div>
  );
}

interface Player {
  id: string;
  playerId: string;
  name: string;
  team: string;
  photo_url: string;
}

export function PlayerSearch() {
  return (
    <ErrorBoundary>
      <PlayerSearchContent />
    </ErrorBoundary>
  );
}

function PlayerSearchContent() {
  const inputRef = useRef<HTMLInputElement>(null);
  const blurInput = () => { inputRef.current?.blur(); };
  const [selectedLeague, setSelectedLeague] = useState<'WNBA' | 'NBA'>('WNBA');
  
  const {
    query,
    results,
    stats,
    loading,
    notFound,
    hasSearched,
    setQuery,
    handleSearch,
    handleSelectPlayer,
    clearResults,
  } = usePlayerSearch(blurInput, selectedLeague);
  
  const [l5AvgPoints, setL5AvgPoints] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Unified loading states for player stats page
  const [statsGraphLoading, setStatsGraphLoading] = useState(false);
  const [animatedStatsLoading, setAnimatedStatsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  
  // Overall loading state - true until all components are ready
  const isFullyLoaded = !loading && !insightsLoading && !statsGraphLoading && !animatedStatsLoading && !imageLoading;

  // Preload images for search results
  useEffect(() => {
    if (results.length > 0) {
      results.forEach(player => {
        try {
          const img = new Image();
          img.src = `/api/images/player/${encodeURIComponent(player.name)}`;
          img.onerror = () => {
            console.warn(`Failed to preload image for ${player.name}`);
          };
        } catch (error) {
          console.warn(`Error preloading image for ${player.name}:`, error);
        }
      });
    }
  }, [results]);
  const [isSearching, setIsSearching] = useState(false);
  const [playerGameLog, setPlayerGameLog] = useState<any[]>([]);
  const [showStarAnimation, setShowStarAnimation] = useState(false);
  const [starPosition, setStarPosition] = useState<{ x: number; y: number } | null>(null);
  const [homeLinkPosition, setHomeLinkPosition] = useState<{ x: number; y: number } | null>(null);
  const [playerPointsLog, setPlayerPointsLog] = useState<any[]>([]);
  const [bookLine, setBookLine] = useState<number | null>(null);
  const [seasonStats, setSeasonStats] = useState<any>(null);
  const [upcomingOpponent, setUpcomingOpponent] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { data: session } = useSession();
  const [isInjured, setIsInjured] = useState<boolean>(false);
  // Removed isComponentMounted state and effect

  // Load user's favorites on component mount
  useEffect(() => {
    if (session?.user?.id) {
      loadFavorites();
    }
  }, [session]);

  // Reload favorites when search results change to ensure star states are correct
  useEffect(() => {
    if (session?.user?.id && results && results.length > 0) {
      console.log('Search results changed:', results);
      console.log('First result:', results[0]);
      loadFavorites();
    }
  }, [session, results]);

  const loadFavorites = async () => {
    if (!session?.user?.id) return;
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data, error } = await supabase
        .from('user_favorites')
        .select('player_name')
        .eq('user_id', session.user.id);
      
      if (!error && data) {
        console.log('Loaded favorites:', data);
        const favoriteNames = data.map(fav => fav.player_name);
        console.log('Favorite names:', favoriteNames);
        console.log('Current results:', results);
        if (results && results.length > 0) {
          console.log('Current player name:', results[0].name);
          console.log('Is current player favorited?', favoriteNames.includes(results[0].name));
        }
        setFavorites(new Set(favoriteNames));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = async (player: Player, event?: React.MouseEvent) => {
    console.log('toggleFavorite called for player:', player.name);
    console.log('Player object:', player);
    console.log('Player ID:', player.playerId);
    console.log('Player ID (alt):', player.id);
    if (!session?.user?.id) {
      console.log('No session or user ID');
      return;
    }

    // Capture the star position for animation
    if (event) {
      const rect = event.currentTarget.getBoundingClientRect();
      setStarPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
      
      // Get the home/dashboard link position
      const homeLink = document.querySelector('a[href="/"]') || document.querySelector('a[href="/dashboard"]');
      if (homeLink) {
        const homeRect = homeLink.getBoundingClientRect();
        setHomeLinkPosition({
          x: homeRect.left + homeRect.width / 2,
          y: homeRect.top + homeRect.height / 2
        });
      }
    }
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const isFavorited = favorites.has(player.name);
      console.log('Is currently favorited:', isFavorited);
      
      if (isFavorited) {
        // Remove from favorites
        console.log('Removing from favorites...');
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', session.user.id)
          .eq('player_name', player.name);
        
        if (!error) {
          setFavorites(prev => {
            const newFavorites = new Set(prev);
            newFavorites.delete(player.name);
            console.log('Updated favorites:', newFavorites);
            return newFavorites;
          });
          // Dispatch custom event to refresh dashboard
          window.dispatchEvent(new CustomEvent('favorites-updated'));
        } else {
          console.error('Error removing favorite:', error);
        }
      } else {
        // Check if user already has 5 favorites
        if (favorites.size >= 5) {
          alert('You are only allowed to have a max of five favorite players at once, please unfavorite someone and try again.');
          return;
        }
        
        // Add to favorites
        console.log('Adding to favorites...');
        console.log('User ID:', session.user.id);
        console.log('Player name:', player.name);
        console.log('Team:', player.team);
        
        const insertData = {
          user_id: session.user.id,
          player_id: player.playerId || player.id,
          player_name: player.name,
          team: player.team || ''
        };
        console.log('Insert data:', insertData);
        
        const { error } = await supabase
          .from('user_favorites')
          .insert(insertData);
        
        if (!error) {
          setFavorites(prev => {
            const newFavorites = new Set([...prev, player.name]);
            console.log('Updated favorites:', newFavorites);
            return newFavorites;
          });
          // Trigger star animation
          setShowStarAnimation(true);
          // Dispatch custom event to refresh dashboard
          window.dispatchEvent(new CustomEvent('favorites-updated'));
        } else if (error.code === '23505') {
          // Duplicate key error - the favorite already exists
          console.log('Favorite already exists, updating state');
          setFavorites(prev => {
            const newFavorites = new Set([...prev, player.name]);
            console.log('Updated favorites:', newFavorites);
            return newFavorites;
          });
          // Trigger star animation even for existing favorites
          setShowStarAnimation(true);
          // Dispatch custom event to refresh dashboard
          window.dispatchEvent(new CustomEvent('favorites-updated'));
        } else {
          console.error('Error adding favorite:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Fetch season stats when results change
  useEffect(() => {
    async function fetchSeasonStats() {
      if (!results || results.length === 0) {
        setSeasonStats(null);
        return;
      }
      
      try {
        const playerId = results[0].playerId || results[0].id;
        
        if (!playerId) {
          setSeasonStats(null);
          return;
        }

        console.log('🔍 Fetching season stats for player ID:', playerId);
        const res = await fetch(`/api/stats/database/${playerId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (!res.ok) {
          console.error('Failed to fetch season stats:', res.status);
          setSeasonStats(null);
          return;
        }

        const data = await res.json();

        if (data.seasonStats) {
          // Format the season stats for AnimatedStats component
          const formattedStats = {
            points: data.seasonStats.avgPoints,
            rebounds: data.seasonStats.avgRebounds,
            assists: data.seasonStats.avgAssists,
            turnovers: data.seasonStats.avgTurnovers,
            steals: data.seasonStats.avgSteals,
            blocks: data.seasonStats.avgBlocks,
            minutes: data.seasonStats.avgMinutes
          };
          
          // Only set stats if we have valid data
          const hasValidStats = Object.values(formattedStats).some(value => value !== null && value !== undefined && value !== 0);
          
          if (hasValidStats) {
            setSeasonStats(formattedStats);
          } else {
            setSeasonStats(null);
          }
        } else {
          setSeasonStats(null);
        }
      } catch (error: any) {
        console.error('❌ Error fetching season stats:', error);
        console.error('🔍 Full error details:', {
          message: error?.message || 'Unknown error',
          stack: error?.stack || 'No stack trace',
          name: error?.name || 'Unknown error type',
          cause: error?.cause || 'No cause'
        });
        console.error('📊 Player ID that caused error:', results[0]?.id);
        setSeasonStats(null);
      }
    }

    fetchSeasonStats();
  }, [results]);

  // Fetch L5 average points and full game log when results[0] changes
  useEffect(() => {
    async function fetchGameLog() {
      if (!results || results.length === 0) return;
      setInsightsLoading(true);
      try {
        console.log('=== FETCHING GAME LOG ===');
        console.log('Fetching game log for player:', results[0]);
        
        // Use the playerId from the results
        const playerId = results[0].playerId || results[0].id;
        console.log('Using player ID:', playerId);
        console.log('Results[0]:', results[0]);
        console.log('Results[0].playerId:', results[0].playerId);
        console.log('Results[0].id:', results[0].id);
        
        if (!playerId) {
          console.error('No player ID available');
          setPlayerPointsLog([]);
          setL5AvgPoints('--');
          return;
        }

        // Use database stats API first, fallback to external API if needed
        const timestamp = Date.now(); // Add cache-busting
        const randomId = Math.random().toString(36).substring(7);
        console.log('Making API call to:', `/api/stats/database/${playerId}?t=${timestamp}&r=${randomId}`);
        const res = await fetch(`/api/stats/database/${playerId}?t=${timestamp}&r=${randomId}`, {
          cache: 'no-store', // Force fresh data
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        console.log('Player game log response status:', res.status);
        console.log('Player game log response ok:', res.ok);
        
        if (!res.ok) {
          console.error('API returned error status:', res.status);
          const errorText = await res.text();
          console.error('API error text:', errorText);
          setPlayerPointsLog([]);
          setL5AvgPoints('--');
          return;
        }
        
        const data = await res.json();
        console.log('Player game log response:', data);
        console.log('📊 Games data from API:', data.games);
        console.log('📊 First game from API:', data.games?.[0]);
        console.log('Player game log response type:', typeof data);
        console.log('Player game log response keys:', Object.keys(data));
        
        if (data.error) {
          console.error('API returned error:', data.error);
          setPlayerPointsLog([]);
          setL5AvgPoints('--');
          return;
        }

        // Parse the game log data from our API response
        try {
          if (data.games && Array.isArray(data.games) && data.games.length > 0) {
            const games = data.games;
            
            // Convert the games data to the format expected by PlayerStatsGraph
            const pointsLog = games.map((game: any, index: number) => {
              try {
                return {
                  date: game.date || game.gameDate,
                  points: Number(game.points || 0),
                  assists: Number(game.assists || 0),
                  rebounds: Number(game.rebounds || 0),
                  steals: Number(game.steals || 0),
                  blocks: Number(game.blocks || 0),
                  fieldGoalsAttempted: Number(game.fieldGoalsAttempted || 0),
                  threePointersAttempted: Number(game.threePointersAttempted || 0),
                  freeThrowsAttempted: Number(game.freeThrowsAttempted || 0),
                  opp: game.opponent || game.opponent_abbr || game.opp || 'Unknown',
                  homeAway: game.homeAway || game.home_away || 'home',
                  eventId: game.gameId || game.eventId || `game_${index}`,
                };
              } catch (parseError: any) {
                console.error('❌ Error parsing individual game data:', parseError);
                console.error('🔍 Game data that caused error:', game);
                console.error('🔍 Game index:', index);
                // Return a safe fallback
                return {
                  date: 'Unknown Date',
                  points: 0,
                  assists: 0,
                  rebounds: 0,
                  steals: 0,
                  blocks: 0,
                  opp: 'Unknown',
                  homeAway: 'home',
                  eventId: `game_${index}_error`,
                };
              }
            });
            
            console.log('Processed game log:', pointsLog);
            console.log('Sample game with rebounds:', pointsLog[0]);
            console.log('Rebounds data check:', pointsLog.map(g => ({ date: g.date, rebounds: g.rebounds })));
            console.log('FGA data check:', pointsLog.map(g => ({ date: g.date, fga: g.fieldGoalsAttempted })));
            console.log('3PA data check:', pointsLog.map(g => ({ date: g.date, threePA: g.threePointersAttempted })));
            console.log('FTA data check:', pointsLog.map(g => ({ date: g.date, fta: g.freeThrowsAttempted })));
            console.log('Raw API response games data:', games);
            console.log('First raw game data:', games[0]);
            setPlayerPointsLog(pointsLog);
          } else {
            console.log('No games found in API response');
            setPlayerPointsLog([]);
          }
        } catch (processingError: any) {
          console.error('❌ Error processing game log data:', processingError);
          console.error('🔍 Full error details:', {
            message: processingError?.message || 'Unknown error',
            stack: processingError?.stack || 'No stack trace',
            name: processingError?.name || 'Unknown error type'
          });
          console.error('🔍 Raw API response data:', data);
          setPlayerPointsLog([]);
        }
        
        // Extract book line from API response
        if (data.nextGamePointsLine !== undefined && data.nextGamePointsLine !== null) {
          setBookLine(data.nextGamePointsLine);
          console.log('Set book line to:', data.nextGamePointsLine);
        } else {
          setBookLine(null);
          console.log('No book line found in API response');
        }

      } catch (e: any) {
        console.error('❌ Error fetching game log:', e);
        console.error('🔍 Full error details:', {
          message: e?.message || 'Unknown error',
          stack: e?.stack || 'No stack trace',
          name: e?.name || 'Unknown error type',
          cause: e?.cause || 'No cause'
        });
        console.error('📊 Player ID that caused error:', results[0]?.id);
        setPlayerPointsLog([]);
        setL5AvgPoints('--');
        setBookLine(null);
      } finally {
        setInsightsLoading(false);
      }
    }
    fetchGameLog();
  }, [results]);

  // Determine if current player is injured using cached injury list
  useEffect(() => {
    try {
      const cache = typeof window !== 'undefined' ? window.localStorage.getItem('injury_cache_latest') : null;
      if (!results || results.length === 0 || !cache) {
        setIsInjured(false);
        return;
      }
      const parsed = JSON.parse(cache);
      if (!parsed || !Array.isArray(parsed)) {
        setIsInjured(false);
        return;
      }
      const name = (results[0]?.name || '').toLowerCase();
      const inj = parsed.some((inj: any) => (inj.playerName || '').toLowerCase() === name);
      setIsInjured(inj);
    } catch {
      setIsInjured(false);
    }
  }, [results]);

  // Fetch upcoming opponent when a player is selected
  useEffect(() => {
    async function fetchUpcomingOpponent() {
      if (!results || results.length === 0) {
        setUpcomingOpponent(null);
        return;
      }

      try {
        const playerId = results[0].playerId || results[0].id;
        if (!playerId) {
          setUpcomingOpponent(null);
          return;
        }

        console.log('Fetching upcoming opponent for player:', results[0].name);
        const res = await fetch(`/api/players/${playerId}/upcoming-opponent`);
        
        if (res.ok) {
          const data = await res.json();
          if (data.opponent) {
            console.log('Upcoming opponent:', data.opponent);
            setUpcomingOpponent(data.opponent);
          } else {
            console.log('No upcoming opponent found:', data.message);
            setUpcomingOpponent(null);
          }
        } else {
          console.error('Error fetching upcoming opponent:', res.status);
          setUpcomingOpponent(null);
        }
      } catch (error) {
        console.error('Error fetching upcoming opponent:', error);
        setUpcomingOpponent(null);
      }
    }

    fetchUpcomingOpponent();
  }, [results]);

  // Trigger shake animation when no players found
  useEffect(() => {
    if (notFound && hasSearched) {
      setIsShaking(true);
      setIsSuccess(false);
      const timer = setTimeout(() => {
        setIsShaking(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [notFound, hasSearched]);

  // Trigger success effect when players are found
  useEffect(() => {
    if (results.length > 0 && hasSearched && !notFound) {
      setIsSuccess(true);
      setIsShaking(false);
    }
  }, [results, hasSearched, notFound]);

  const memoizedGameLog = useMemo(() => playerPointsLog, [playerPointsLog]);

  // Helper to get team color pair for gradient
  function getTeamGradient(teamName: string) {
    return getTeamColors(teamName);
  }

  return (
    <>
      {/* League Side Banner */}
      <LeagueSideBanner 
        selectedLeague={selectedLeague}
        onLeagueChange={(league) => {
          setSelectedLeague(league);
          // Clear current results when switching leagues
          clearResults();
          setQuery('');
        }}
        hasPlayerResults={results.length > 0}
      />
      
      {/* Star Animation */}
      <StarAnimation 
        isVisible={showStarAnimation} 
        onComplete={() => setShowStarAnimation(false)}
        starPosition={starPosition}
        homeLinkPosition={homeLinkPosition}
      />
      
      {/* Dynamic left-side gradient background */}
      {results.length > 0 && (
        (() => {
          const [primary, secondary, accent] = getTeamGradient(results[0].team);
          // Add keyframes for smooth animated gradient with natural blending
          const gradientAnimation = `@keyframes teamGradientMove {
            0% { background-position: 0% 0%; }
            25% { background-position: 100% 0%; }
            50% { background-position: 100% 100%; }
            75% { background-position: 0% 100%; }
            100% { background-position: 0% 0%; }
          }`;
          // Inject keyframes into the document head if not already present
          if (typeof window !== 'undefined' && !document.getElementById('team-gradient-anim')) {
            const style = document.createElement('style');
            style.id = 'team-gradient-anim';
            style.innerHTML = gradientAnimation;
            document.head.appendChild(style);
          }
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }}
            >
              <div
                style={{
                  position: 'fixed',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '100vw',
                  zIndex: 0,
                  background: `radial-gradient(ellipse at 30% 50%, ${primary} 0%, ${secondary} 40%, ${accent} 100%)`,
                  backgroundSize: '200% 200%',
                  animation: 'teamGradientMove 12s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  transition: 'background 0.5s',
                  pointerEvents: 'none',
                  filter: 'blur(32px)',
                  WebkitMaskImage: 'linear-gradient(to right, black 5%, #888 15%, rgba(136, 136, 136, 0.6) 30%, rgba(136, 136, 136, 0.3) 50%, transparent 70%)',
                  maskImage: 'linear-gradient(to right, black 5%, #888 15%, rgba(136, 136, 136, 0.6) 30%, rgba(136, 136, 136, 0.3) 50%, transparent 70%)',
                }}
              />
            </motion.div>
          );
        })()
      )}
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center w-full" style={{paddingTop: '1px'}}>
        {/* Team name above player image */}
        {results.length > 0 && (
          (() => {
            // Map abbreviation or short name to full team name
            let team = results[0].team || '';
            const teamObj = getTeamData(team);
            if (teamObj) team = teamObj.name;
            const teamWords = team.split(' ');
            const city = teamWords.slice(0, -1).join(' ');
            const teamName = teamWords.slice(-1).join('');
            // Get team colors for text coloring
            let teamColors: string[] = getTeamColors(results[0].team);
            // Special color logic for team names
            let teamTextColor: string = teamColors[2]; // Default to third color (usually white/light)
            if (teamObj) {
              if (teamObj.name === 'Chicago Sky') {
                teamTextColor = teamColors[0]; // yellow
              } else if (teamObj.name === 'Phoenix Mercury') {
                teamTextColor = teamColors[0]; // orange
              } else if (teamObj.name === 'Seattle Storm') {
                teamTextColor = '#000'; // black
              } else if (teamObj.name === 'New York Liberty') {
                teamTextColor = teamColors[0]; // seafoam
              } else if (teamObj.name === 'Connecticut Sun') {
                teamTextColor = teamColors[0]; // orange
              } else if (teamObj.name === 'Las Vegas Aces') {
                teamTextColor = teamColors[1]; // red
              } else if (teamObj.name === 'Los Angeles Sparks') {
                teamTextColor = teamColors[2]; // blue/teal
              } else if (teamObj.name === 'Minnesota Lynx') {
                teamTextColor = teamColors[1]; // green
              } else if (teamObj.name === 'Dallas Wings') {
                teamTextColor = teamColors[0]; // blue
              } else if (teamObj.name === 'Indiana Fever') {
                teamTextColor = teamColors[0]; // red
              } else if (teamObj.name === 'Washington Mystics') {
                teamTextColor = teamColors[1]; // red
              } else if (teamObj.name === 'Atlanta Dream') {
                teamTextColor = teamColors[0]; // red
              }
            }
            return (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  left: '28px',
                  top: '38px',
                  width: '520px',
                  textAlign: 'left',
                  fontFamily: 'Highrise Demo, Oswald, Bebas Neue, Arial, sans-serif',
                  color: '#f3f3f3',
                  letterSpacing: '2.5px',
                  textShadow: '0 4px 24px #181C24, 0 2px 8px #181C24',
                  zIndex: 10,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                <div
                  style={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1.05, fontFamily: 'Highrise Demo, Oswald, Bebas Neue, Arial, sans-serif', letterSpacing: '2.5px', textShadow: '0 4px 24px #181C24, 0 2px 8px #181C24', color: '#f3f3f3' }}
                >{city.toUpperCase()}</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 600, lineHeight: 1.05, fontFamily: 'Highrise Demo, Oswald, Bebas Neue, Arial, sans-serif', letterSpacing: '2.5px', textShadow: '0 4px 24px #181C24, 0 2px 8px #181C24', color: teamTextColor || '#f3f3f3' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <span>{teamName.toUpperCase()}</span>
                    {/* Favorite star button - only show for signed-in users */}
                    {session?.user && (
                      <button
                        onClick={(e) => toggleFavorite(results[0], e)}
                        className="inline-block ml-3 transition-all duration-200 focus:outline-none hover:scale-110 cursor-pointer"
                        style={{
                          verticalAlign: 'top',
                          background: 'transparent',
                          padding: 0,
                          pointerEvents: 'auto',
                          border: 'none',
                          outline: 'none',
                          boxShadow: 'none'
                        }}
                      >
                        {(() => {
                          const currentPlayerName = results[0].name;
                          const isFavorited = favorites.has(currentPlayerName);
                          console.log('Star check - Player name:', currentPlayerName, 'Is favorited:', isFavorited, 'All favorites:', Array.from(favorites));
                          console.log('Player object for star check:', results[0]);
                          return isFavorited;
                        })() ? (
                          // Filled star
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFD700" style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }}>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        ) : (
                          // Hollow star
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }}>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {isInjured && (
                    <div style={{ fontSize: '1.6rem', marginTop: '2px', color: '#f3f3f3' }}>🩼</div>
                  )}
                </div>
              </motion.div>
            );
          })()
        )}
        {/* Player Search text centered under header */}
        <div 
          className="z-20 text-center"
          style={{ 
            color: '#e5e5e5',
            fontSize: '1.5rem',
            fontWeight: 600,
            zIndex: 20,
            textShadow: '0 0 12px #000, 0 0 24px #000',
            marginTop: '40px', // Adjusted for new page structure - moved up 3px
            marginBottom: '18px', // was 10px
            position: 'relative',
            left: '3px',
          }}
        >
          Player Search
        </div>
        

        {/* Search bar centered under the text */}
        <div 
          className="z-20 w-[253px]"
          style={{ zIndex: 20, marginBottom: '80px' }} // increased for more gap
        >
          <div className="relative w-full">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setIsSuccess(false);
              }}
              onKeyDown={e => { 
                if (e.key === 'Enter') {
                  setIsSearching(true);
                  setTimeout(() => setIsSearching(false), 300);
                  handleSearch();
                }
              }}
              onFocus={() => setIsSuccess(false)}
              className="search-input w-full px-4 py-3 rounded-2xl font-medium font-['Lexend'] border-2 transition-all duration-300 focus:outline-none text-center pr-10"
              style={{
                borderRadius: '16px',
                paddingTop: '12px',
                paddingBottom: '12px',
                height: '15px',
                backgroundColor: '#14171F',
                borderColor: notFound ? '#ef4444' : '#71FD08',
                boxShadow: isSuccess 
                  ? '0 4px 20px rgba(113, 253, 8, 0.4), 0 4px 12px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.9)'
                  : '0 4px 12px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.9)',
                animation: isShaking ? 'shake 0.5s ease-in-out' : 'none',
                transform: isSearching ? 'scale(0.85)' : (isSuccess ? 'scale(1.02)' : 'scale(1)'),
                caretColor: '#71FD08',
                color: '#71FD08 !important',
                fontSize: '0.75rem'
              }}
              placeholder="Start typing..."
            />
            {/* Error message */}
            {notFound && hasSearched && (
              <div 
                className="absolute text-sm font-medium left-1/2"
                style={{
                  top: '100%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  textShadow: '0 0 4px #000, 0 0 8px #000, 0 0 12px #000',
                  color: '#ef4444',
                  marginTop: '10px',
                }}
              >
                No players found.
              </div>
            )}
            {/* Arrow icon - clickable, smaller and dark arrow */}
            <div
              className="absolute flex items-center justify-center rounded-full shadow-md cursor-pointer"
              style={{ 
                right: isSearching ? '20px' : '7px', 
                top: '50%', 
                transform: isSearching ? 'translateY(-50%) scale(0.75)' : 'translateY(-50%)', 
                width: '20px', 
                height: '20px', 
                background: notFound && hasSearched ? '#ef4444' : '#71FD08', 
                zIndex: 10,
                boxShadow: '0 2px 8px #000',
                transition: 'transform 0.2s, box-shadow 0.2s, background 0.2s, right 0.2s',
              }}
              onClick={() => {
                setIsSearching(true);
                setTimeout(() => setIsSearching(false), 300);
                handleSearch();
              }}
              title="Search"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.15)';
                if (notFound && hasSearched) {
                  e.currentTarget.style.boxShadow = '0 2px 12px #ef4444, 0 2px 8px #000';
                } else {
                  e.currentTarget.style.boxShadow = '0 2px 12px #71FD08, 0 2px 8px #000';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px #000';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(0.9)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.15)';
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="12" fill={notFound && hasSearched ? '#ef4444' : '#71FD08'}/>
                <path d="M12 7V17" stroke="#14171F" strokeWidth="2" strokeLinecap="round"/>
                <path d="M7 12L12 7L17 12" stroke="#14171F" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>
        {/* Loading Overlay for Player Stats Page */}
        {!loading && results.length > 0 && !isFullyLoaded && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, #111827 0%, #000000 50%, #111827 100%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px'
          }}>
            {/* Loading Spinner */}
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid rgba(113, 253, 8, 0.2)',
              borderTop: '4px solid #71FD08',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            
            {/* Loading Text */}
            <div style={{
              color: '#71FD08',
              fontSize: '24px',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              textAlign: 'center'
            }}>
              Loading Player Stats...
            </div>
            
            {/* Loading Progress */}
            <div style={{
              color: '#d1d5db',
              fontSize: '16px',
              textAlign: 'center',
              opacity: 0.8
            }}>
              {insightsLoading && "Loading game data..."}
              {!insightsLoading && statsGraphLoading && "Loading stats graph..."}
              {!insightsLoading && !statsGraphLoading && animatedStatsLoading && "Loading season stats..."}
              {!insightsLoading && !statsGraphLoading && !animatedStatsLoading && imageLoading && "Loading player image..."}
            </div>
          </div>
        )}
        
        {/* Add CSS for spinner animation and search input styling */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* Search input styling - force font size with high specificity */
          div input[type="text"] {
            font-size: 0.75rem !important;
            color: #71FD08 !important;
          }
          
          /* More specific selector for search input */
          .search-input {
            font-size: 0.75rem !important;
            color: #71FD08 !important;
          }
          
          /* Even more specific with class and type */
          .search-input[type="text"] {
            font-size: 0.75rem !important;
            color: #71FD08 !important;
          }
          
          /* Search input placeholder styling */
          input::placeholder {
            color: rgba(243, 243, 243, 0.6) !important;
            font-size: 0.75rem !important;
          }
        `}</style>

        {/* Main content area centered below search bar */}
        {loading && <LoadingSkeleton height="2rem" />}
        {!loading && results.length > 0 && (
          <React.Fragment>
            <div className="h-12" />
          </React.Fragment>
        )}
        {/* Animated Stats */}
        {(() => {
          if (results.length > 0 && seasonStats) {
            return (
              <React.Fragment key={`animated-stats-${results[0]?.playerId}`}>
                <AnimatedStats 
                  stats={seasonStats} 
                  playerName={results[0]?.name || ''} 
                  playerId={results[0]?.playerId || results[0]?.id || ''}
                  onLoadingChange={setAnimatedStatsLoading}
                />
              </React.Fragment>
            );
          }
          return null;
        })()}
        {/* Spacer to guarantee 3 inches of blank space at bottom */}
        <div className="h-32" />
      </div>
      {/* Background images container */}
      {results.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1 }}>
          {/* Team logo - behind player image */}
          {results[0].team && (() => {
            const team = getTeamData(results[0].team);
            
            if (!team) {
              return null;
            }
            
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                key={`team-logo-${results[0].id}`}
              >
                <img
                  src={team.logo}
                  alt={team.name + ' logo'}
                  style={{
                    position: 'absolute',
                    left: '-80px',
                    bottom: '25px',
                    width: '340px',
                    height: '340px',
                    opacity: 0.3,
                    filter: 'drop-shadow(0 0 16px #000)',
                    pointerEvents: 'none',
                    transition: 'opacity 0.3s',
                    zIndex: 0,
                  }}
                />
              </motion.div>
            );
          })()}
          
          {/* Player image - on top */}
          {results.length > 0 && (
            <div className="relative">
              <PlayerImageComponent playerName={results[0].name} onLoadingChange={setImageLoading} />
            </div>
          )}
        </div>
      )}
      {/* Player Stats Graph - fixed and centered at top, aligned with Player Search */}
      {(() => {
        if (results.length > 0) {
          const teamColors = getTeamGradient(results[0].team);
          return (
            <>
              <div
                className="fixed z-30"
                style={{ right: 20, top: 173, pointerEvents: 'auto' }}
              >
                <PlayerStatsGraph
                  gameLog={memoizedGameLog}
                  playerName={results[0]?.name || ''}
                  playerId={results[0]?.playerId || results[0]?.id || ''}
                  bookLine={bookLine}
                  teamColors={teamColors}
                  upcomingOpponent={upcomingOpponent || undefined}
                  onLoadingChange={setStatsGraphLoading}
                  isInjured={(() => {
                    try {
                      const cache = typeof window !== 'undefined' ? window.localStorage.getItem('injury_cache_latest') : null;
                      if (!cache) return false;
                      const parsed = JSON.parse(cache);
                      if (!parsed || !Array.isArray(parsed)) return false;
                      const name = (results[0]?.name || '').toLowerCase();
                      return parsed.some((inj: any) => (inj.playerName || '').toLowerCase() === name);
                    } catch {
                      return false;
                    }
                  })()}
                />
              </div>
            </>
          );
        }
        return null;
      })()}
    </>
  );
}
