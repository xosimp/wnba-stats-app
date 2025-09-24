"use client";

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { TEAMS } from '../../lib/constants/team-data';
import UpcomingSchedule from '../../components/schedule/UpcomingSchedule';
import { HotStreakIndicator } from '../../components/dashboard/HotStreakIndicator';
import { usePlayerImagePreloader } from '../../hooks/usePlayerImagePreloader';

interface FavoritePlayer {
  id: string;
  player_id: string;
  player_name: string;
  team: string;
  created_at: string;
}

export default function DashboardHome() {
  const { data: session } = useSession();
  const router = useRouter();
  const [favoritePlayers, setFavoritePlayers] = useState<FavoritePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [hotStreakData, setHotStreakData] = useState<Record<string, { isOnHotStreak: boolean; loading: boolean; hotStreakStat?: string; lastUpdated?: number }>>({});
  const [scheduleLoading, setScheduleLoading] = useState(true);
  
  // Player image preloader - runs when dashboard loads
  const { status: preloadStatus, progress, isPreloading } = usePlayerImagePreloader();
  
  // Overall loading state - true until all components are ready
  const isFullyLoaded = !loading && !scheduleLoading && !isPreloading;

  // Helper function to find team with all abbreviation variations
  const findTeamWithAbbreviations = (playerTeam: string) => {
    const WNBA_TEAMS = TEAMS.slice(0, 12);
    const playerTeamLower = playerTeam.toLowerCase();
    
    return WNBA_TEAMS.find(t => {
      const abbrMatch = t.abbreviation?.toLowerCase() === playerTeamLower;
      const nameMatch = t.name.toLowerCase() === playerTeamLower;
      
      // Specific team abbreviation matches with variations
      if (playerTeamLower === 'la' && t.abbreviation?.toLowerCase() === 'las') return true;
      if (playerTeamLower === 'las' && t.abbreviation?.toLowerCase() === 'las') return true; // LAS -> LAS (Los Angeles Sparks)
      if (playerTeamLower === 'lv' && t.abbreviation?.toLowerCase() === 'lva') return true;
      if (playerTeamLower === 'lva' && t.abbreviation?.toLowerCase() === 'lva') return true; // LVA -> LVA (Las Vegas Aces)
      if (playerTeamLower === 'ny' && t.abbreviation?.toLowerCase() === 'nyl') return true;
      if (playerTeamLower === 'nyl' && t.abbreviation?.toLowerCase() === 'nyl') return true;
      if (playerTeamLower === 'min' && t.abbreviation?.toLowerCase() === 'min') return true;
      if (playerTeamLower === 'conn' && t.abbreviation?.toLowerCase() === 'con') return true;
      if (playerTeamLower === 'con' && t.abbreviation?.toLowerCase() === 'con') return true;
      if (playerTeamLower === 'chi' && t.abbreviation?.toLowerCase() === 'chi') return true;
      if (playerTeamLower === 'dal' && t.abbreviation?.toLowerCase() === 'dal') return true;
      if (playerTeamLower === 'ind' && t.abbreviation?.toLowerCase() === 'ind') return true;
      if (playerTeamLower === 'phx' && t.abbreviation?.toLowerCase() === 'phx') return true;
      if (playerTeamLower === 'sea' && t.abbreviation?.toLowerCase() === 'sea') return true;
      if (playerTeamLower === 'was' && t.abbreviation?.toLowerCase() === 'was') return true;
      if (playerTeamLower === 'wsh' && t.abbreviation?.toLowerCase() === 'was') return true;
      if (playerTeamLower === 'atl' && t.abbreviation?.toLowerCase() === 'atl') return true;
      if (playerTeamLower === 'gs' && t.abbreviation?.toLowerCase() === 'gsv') return true;
      if (playerTeamLower === 'gsv' && t.abbreviation?.toLowerCase() === 'gsv') return true;
      
      return abbrMatch || nameMatch;
    });
  };

  const handlePlayerCardClick = (playerName: string) => {
    console.log('Card clicked for player:', playerName);
    // Navigate to player search page with the player's name
    router.push(`/players?search=${encodeURIComponent(playerName)}`);
  };

  const fetchFavoritePlayers = async () => {
    if (session?.user?.id) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data, error } = await supabase
          .from('user_favorites')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) {
          console.error('Error fetching favorite players:', error);
        } else {
          setFavoritePlayers(data || []);
                      // Initialize hot streak data for new players
            if (data) {
              const initialHotStreakData: Record<string, { isOnHotStreak: boolean; loading: boolean; hotStreakStat?: string; lastUpdated?: number }> = {};
              data.forEach((player: FavoritePlayer) => {
                initialHotStreakData[player.player_name] = { isOnHotStreak: false, loading: true };
              });
              setHotStreakData(initialHotStreakData);
              
              // Check hot streaks for all players
              console.log(`🔥 Starting hot streak checks for ${data.length} players`);
              data.forEach((player: FavoritePlayer) => {
                checkHotStreak(player.player_name);
              });
            }
        }
      } catch (error) {
        console.error('Error fetching favorite players:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours cache duration
  
  const checkHotStreak = async (playerName: string) => {
    const checkId = Date.now() + Math.random(); // Unique ID for this check
    console.log(`🔥 [${checkId}] Starting hot streak check for: "${playerName}"`);
    
    // Set a timeout to ensure loading state doesn't get stuck
    const timeout = setTimeout(() => {
      console.log(`🔥 [${checkId}] ⏰ TIMEOUT: Hot streak check for "${playerName}" took too long, setting loading to false`);
      setHotStreakData(prev => ({
        ...prev,
        [playerName]: { isOnHotStreak: false, loading: false, hotStreakStat: '', lastUpdated: Date.now() }
      }));
    }, 30000); // 30 second timeout
    
    // Check if we have cached data that's still valid
    const cachedData = hotStreakData[playerName];
    console.log(`🔥 [${checkId}] Cache check for "${playerName}":`, {
      hasCachedData: !!cachedData,
      hasLastUpdated: !!(cachedData && cachedData.lastUpdated),
      cacheAge: cachedData && cachedData.lastUpdated ? Math.round((Date.now() - cachedData.lastUpdated) / 1000 / 60) : 'N/A',
      isExpired: cachedData && cachedData.lastUpdated ? (Date.now() - cachedData.lastUpdated) >= CACHE_DURATION : true
    });
    
    if (cachedData && cachedData.lastUpdated && (Date.now() - cachedData.lastUpdated) < CACHE_DURATION) {
      console.log(`🔥 [${checkId}] ✅ CACHE HIT: Using cached hot streak data for "${playerName}" (cached ${Math.round((Date.now() - cachedData.lastUpdated) / 1000 / 60)} minutes ago)`);
      return;
    } else {
      console.log(`🔥 [${checkId}] ❌ CACHE MISS: Fetching fresh hot streak data for "${playerName}"`);
    }
    try {
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
        setHotStreakData(prev => ({
          ...prev,
          [playerName]: { isOnHotStreak: false, loading: false }
        }));
        return;
      }
      
      const searchData = await searchRes.json();
      
      if (!searchData.results || searchData.results.length === 0) {
        console.log('Player not found:', playerName);
        setHotStreakData(prev => ({
          ...prev,
          [playerName]: { isOnHotStreak: false, loading: false }
        }));
        return;
      }
      
      console.log(`🔥 [${checkId}] Found player data for "${playerName}":`, searchData.results[0]);
      const playerId = searchData.results[0].playerId || searchData.results[0].id;
      
      if (!playerId) {
        console.error(`🔥 [${checkId}] No player ID found for:`, playerName);
        setHotStreakData(prev => ({
          ...prev,
          [playerName]: { isOnHotStreak: false, loading: false }
        }));
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
        setHotStreakData(prev => ({
          ...prev,
          [playerName]: { isOnHotStreak: false, loading: false }
        }));
        return;
      }
      
      const statsData = await statsRes.json();
      
      if (!statsData.games || !Array.isArray(statsData.games)) {
        console.log('No game data found for:', playerName);
        setHotStreakData(prev => ({
          ...prev,
          [playerName]: { isOnHotStreak: false, loading: false }
        }));
        return;
      }
      
      // Get the last 5 games with all stats (most recent first)
      const last5Games = statsData.games.slice(-5).map((game: { 
        date?: string; 
        gameDate?: string; 
        points?: number; 
        assists?: number; 
        rebounds?: number;
        steals?: number;
        blocks?: number;
        opponent?: string; 
        opponent_abbr?: string; 
        opp?: string; 
        homeAway?: string; 
        home_away?: string; 
        gameId?: string; 
        eventId?: string 
      }) => ({
        date: game.date || game.gameDate,
        points: Number(game.points || 0),
        assists: Number(game.assists || 0),
        rebounds: Number(game.rebounds || 0),
        steals: Number(game.steals || 0),
        blocks: Number(game.blocks || 0),
        opp: game.opponent || game.opponent_abbr || game.opp,
        homeAway: game.homeAway || game.home_away || 'home',
        eventId: game.gameId || game.eventId || `game_${Date.now()}`
      }));
      
      // Get actual book lines from Odds API
      let pointsLine = null;
      let assistsLine = null;
      let reboundsLine = null;
      let paLine = null; // Points + Assists
      let prLine = null; // Points + Rebounds  
      let praLine = null; // Points + Rebounds + Assists
      
      // Simple in-memory cache for book lines
      const bookLinesCacheKey = `${playerName}_booklines`;
      const cachedBookLines = sessionStorage.getItem(bookLinesCacheKey);
      const bookLinesCacheDuration = 3 * 60 * 60 * 1000; // 3 hours
      
      console.log(`🔥 🔍 CHECKING BOOK LINES CACHE for ${playerName}:`, {
        cacheKey: bookLinesCacheKey,
        hasCachedData: !!cachedBookLines,
        cacheDuration: bookLinesCacheDuration
      });
      
      if (cachedBookLines) {
        const parsed = JSON.parse(cachedBookLines);
        const ageMinutes = Math.round((Date.now() - parsed.timestamp) / 1000 / 60);
        console.log(`🔥 📊 CACHE DETAILS for ${playerName}:`, {
          ageMinutes,
          isExpired: Date.now() - parsed.timestamp >= bookLinesCacheDuration,
          cachedPoints: parsed.pointsLine,
          cachedAssists: parsed.assistsLine,
          cachedRebounds: parsed.reboundsLine,
          cachedPA: parsed.paLine,
          cachedPR: parsed.prLine,
          cachedPRA: parsed.praLine
        });
        
        if (Date.now() - parsed.timestamp < bookLinesCacheDuration) {
          pointsLine = parsed.pointsLine;
          assistsLine = parsed.assistsLine;
          reboundsLine = parsed.reboundsLine;
          paLine = parsed.paLine;
          prLine = parsed.prLine;
          praLine = parsed.praLine;
          console.log(`🔥 ✅ BOOK LINES CACHE HIT: Using cached book lines for ${playerName} (cached ${ageMinutes} minutes ago)`);
        } else {
          console.log(`🔥 ❌ BOOK LINES CACHE EXPIRED: Fetching fresh book lines for ${playerName} (cached ${ageMinutes} minutes ago)`);
        }
      } else {
        console.log(`🔥 ❌ BOOK LINES CACHE MISS: No cached book lines for ${playerName}`);
      }
      
      if (!pointsLine || !assistsLine || !reboundsLine || !paLine || !prLine || !praLine) {
        try {
          // Fetch points line
          const pointsRes = await fetch(`/api/odds?action=player-line&player=${encodeURIComponent(playerName)}&market=player_points`);
          if (pointsRes.ok) {
            const pointsData = await pointsRes.json();
            pointsLine = pointsData.pointsLine;
            console.log(`🔥 📊 Fetched points line for ${playerName}: ${pointsLine}`);
          }
          
          // Fetch assists line
          const assistsRes = await fetch(`/api/odds?action=player-line&player=${encodeURIComponent(playerName)}&market=player_assists`);
          if (assistsRes.ok) {
            const assistsData = await assistsRes.json();
            assistsLine = assistsData.assistsLine;
            if (playerName === 'Kelsey Plum') {
              console.log(`🔍 DEBUG Kelsey Plum assists API response:`, assistsData);
              console.log(`🔍 DEBUG Kelsey Plum assists line extracted:`, assistsLine);
            }
          } else if (playerName === 'Kelsey Plum') {
            console.log(`🔍 DEBUG Kelsey Plum assists API failed:`, assistsRes.status);
            const errorText = await assistsRes.text();
            console.log(`🔍 DEBUG Kelsey Plum assists API error text:`, errorText);
          }
          
          // Fetch rebounds line
          const reboundsRes = await fetch(`/api/odds?action=player-line&player=${encodeURIComponent(playerName)}&market=player_rebounds`);
          if (reboundsRes.ok) {
            const reboundsData = await reboundsRes.json();
            reboundsLine = reboundsData.reboundsLine;
          }
          
          // Fetch PA line (Points + Assists)
          const paRes = await fetch(`/api/odds?action=player-line&player=${encodeURIComponent(playerName)}&market=player_points_assists`);
          if (paRes.ok) {
            const paData = await paRes.json();
            paLine = paData.line;
            console.log(`🔥 📊 Fetched PA line for ${playerName}: ${paLine}`);
          }
          
          // Fetch PR line (Points + Rebounds)
          const prRes = await fetch(`/api/odds?action=player-line&player=${encodeURIComponent(playerName)}&market=player_points_rebounds`);
          if (prRes.ok) {
            const prData = await prRes.json();
            prLine = prData.line;
            console.log(`🔥 📊 Fetched PR line for ${playerName}: ${prLine}`);
          }
          
          // Fetch PRA line (Points + Rebounds + Assists)
          const praRes = await fetch(`/api/odds?action=player-line&player=${encodeURIComponent(playerName)}&market=player_points_rebounds_assists`);
          if (praRes.ok) {
            const praData = await praRes.json();
            praLine = praData.line;
            console.log(`🔥 📊 Fetched PRA line for ${playerName}: ${praLine}`);
          }
          
          // Cache the book lines
          sessionStorage.setItem(bookLinesCacheKey, JSON.stringify({
            pointsLine,
            assistsLine,
            reboundsLine,
            paLine,
            prLine,
            praLine,
            timestamp: Date.now()
          }));
          console.log(`🔥 💾 CACHED: Book lines for ${playerName} (points: ${pointsLine}, assists: ${assistsLine}, rebounds: ${reboundsLine}, PA: ${paLine}, PR: ${prLine}, PRA: ${praLine})`);
        } catch (error) {
          console.error('Error fetching book lines for', playerName, ':', error);
        }
      }
      
      
      // Check if player is on a hot streak (ANY stat has all last 5 games above book line)
      let isOnHotStreak = false;
      let hotStreakStat = '';
      
      if (last5Games.length === 5) {
        console.log(`🔥 Hot streak check for ${playerName}:`, {
          last5Games: last5Games.map((g: { points: number; assists: number; rebounds: number }) => ({ 
            points: g.points, 
            assists: g.assists, 
            rebounds: g.rebounds,
            pa: g.points + g.assists,
            pr: g.points + g.rebounds,
            pra: g.points + g.rebounds + g.assists
          })),
          bookLines: { 
            points: pointsLine, 
            assists: assistsLine, 
            rebounds: reboundsLine, 
            pa: paLine,
            pr: prLine,
            pra: praLine
          },
          seasonStats: statsData.seasonStats,
          bookLineSource: {
            points: pointsLine ? 'Odds API' : 'null',
            assists: assistsLine ? 'Odds API' : 'null', 
            rebounds: reboundsLine ? 'Odds API' : 'null',
            pa: paLine ? 'Odds API' : 'null',
            pr: prLine ? 'Odds API' : 'null',
            pra: praLine ? 'Odds API' : 'null'
          }
        });
        
        // Check points streak
        if (pointsLine && last5Games.every((game: { points: number }) => game.points > pointsLine)) {
          console.log(`✅ ${playerName} has POINTS hot streak!`);
          isOnHotStreak = true;
          hotStreakStat = 'PTS';
        }
        
                      // Check assists streak
        if (!isOnHotStreak && assistsLine && last5Games.every((game: { assists: number }) => game.assists > assistsLine)) {
          console.log(`✅ ${playerName} has ASSISTS hot streak!`);
          isOnHotStreak = true;
          hotStreakStat = 'AST';
        } else if (playerName === 'Kelsey Plum') {
        console.log(`🔍 DEBUG Kelsey Plum assists check:`);
        console.log(`   Assists line: ${assistsLine}`);
        console.log(`   Last 5 assists:`, last5Games.map((g: { assists: number }) => g.assists));
        if (assistsLine) {
          const allAboveLine = last5Games.every((game: { assists: number }) => game.assists > assistsLine);
          console.log(`   All 5 games above line? ${allAboveLine}`);
          last5Games.forEach((game: { assists: number }, index: number) => {
            console.log(`   Game ${index + 1}: ${game.assists} ${game.assists > assistsLine ? '>' : '<='} ${assistsLine}`);
          });
        } else {
          console.log(`   No assists line available`);
        }
      }
        
        // Check rebounds streak
        if (!isOnHotStreak && reboundsLine && last5Games.every((game: { rebounds: number }) => game.rebounds > reboundsLine)) {
          console.log(`✅ ${playerName} has REBOUNDS hot streak!`);
          isOnHotStreak = true;
          hotStreakStat = 'REB';
        }
        
        // Check PA streak (Points + Assists)
        if (!isOnHotStreak && paLine && last5Games.every((game: { points: number; assists: number }) => (game.points + game.assists) > paLine)) {
          console.log(`✅ ${playerName} has PA hot streak!`);
          isOnHotStreak = true;
          hotStreakStat = 'PA';
        }
        
        // Check PR streak (Points + Rebounds)
        if (!isOnHotStreak && prLine && last5Games.every((game: { points: number; rebounds: number }) => (game.points + game.rebounds) > prLine)) {
          console.log(`✅ ${playerName} has PR hot streak!`);
          isOnHotStreak = true;
          hotStreakStat = 'PR';
        }
        
        // Check PRA streak (Points + Rebounds + Assists)
        if (!isOnHotStreak && praLine && last5Games.every((game: { points: number; rebounds: number; assists: number }) => (game.points + game.rebounds + game.assists) > praLine)) {
          console.log(`✅ ${playerName} has PRA hot streak!`);
          isOnHotStreak = true;
          hotStreakStat = 'PRA';
        }
        
        
        console.log(`🔥 [${checkId}] Final result for ${playerName}: isOnHotStreak = ${isOnHotStreak}`);
      }
      
      console.log(`🔥 [${checkId}] Setting hot streak data for "${playerName}":`, { isOnHotStreak, loading: false, hotStreakStat });
      console.log(`🔥 [${checkId}] Current hot streak data:`, hotStreakData);
      
      setHotStreakData(prev => {
        const newData = {
          ...prev,
          [playerName]: { isOnHotStreak, loading: false, hotStreakStat, lastUpdated: Date.now() }
        };
        console.log(`🔥 💾 CACHED: Hot streak data for ${playerName} (isOnHotStreak: ${isOnHotStreak}, stat: ${hotStreakStat})`);
        clearTimeout(timeout); // Clear the timeout since we completed successfully
        return newData;
      });
      
    } catch (error) {
      console.error('Error checking hot streak for', playerName, ':', error);
      clearTimeout(timeout); // Clear the timeout since we're handling the error
      setHotStreakData(prev => ({
        ...prev,
        [playerName]: { isOnHotStreak: false, loading: false, hotStreakStat: '', lastUpdated: Date.now() }
      }));
    }
  };

  useEffect(() => {
    fetchFavoritePlayers();
    
    // Listen for custom events to refresh favorites
    const handleFavoritesUpdate = () => {
      fetchFavoritePlayers();
    };
    
    window.addEventListener('favorites-updated', handleFavoritesUpdate);
    
    return () => {
      window.removeEventListener('favorites-updated', handleFavoritesUpdate);
    };
  }, [session?.user?.id]);

  return (
    <div className="dashboard-page min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900" style={{ 
      margin: 0, 
      paddingTop: 'clamp(80px, 10vh, 120px)',
      paddingBottom: 'clamp(2rem, 4vh, 4rem)',
      paddingLeft: 'clamp(1rem, 3vw, 2rem)',
      paddingRight: 'clamp(1rem, 3vw, 2rem)',
      background: 'linear-gradient(135deg, #111827 0%, #000000 50%, #111827 100%) !important',
      position: 'relative',
      zIndex: 1,
      minHeight: '100vh',
      height: '100%',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      
      {/* Loading Overlay */}
      {!isFullyLoaded && (
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
            width: 'clamp(50px, 6vw, 80px)',
            height: 'clamp(50px, 6vw, 80px)',
            border: 'clamp(3px, 0.5vw, 4px) solid rgba(113, 253, 8, 0.2)',
            borderTop: 'clamp(3px, 0.5vw, 4px) solid #71FD08',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          
          {/* Loading Text */}
          <div style={{
            color: '#71FD08',
            fontSize: 'clamp(1.25rem, 2.5vw, 2rem)',
            fontWeight: 'bold',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            textAlign: 'center'
          }}>
            Loading Dashboard...
          </div>
          
          {/* Loading Progress */}
          <div style={{
            color: '#d1d5db',
            fontSize: 'clamp(0.875rem, 1.5vw, 1.125rem)',
            textAlign: 'center',
            opacity: 0.8
          }}>
            {loading && "Loading favorite players..."}
            {!loading && scheduleLoading && "Loading schedule..."}
          </div>
        </div>
      )}
      
      {/* Add CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      {/* Player Image Preloading Indicator - Subtle and non-intrusive */}
      {isPreloading && preloadStatus.total > 0 && (
        <div style={{
          position: 'fixed',
          top: 'clamp(8px, 1vh, 12px)',
          right: 'clamp(8px, 1vw, 12px)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#71FD08',
          padding: 'clamp(6px, 1vw, 10px) clamp(8px, 1.5vw, 12px)',
          borderRadius: 'clamp(4px, 0.5vw, 6px)',
          fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
          fontWeight: 'bold',
          zIndex: 9999,
          border: '1px solid #71FD08',
          opacity: 0.9
        }}>
          <div style={{ marginBottom: '4px' }}>Preloading Images</div>
          <div style={{ 
            width: 'clamp(80px, 10vw, 120px)', 
            height: 'clamp(3px, 0.4vw, 4px)', 
            background: 'rgba(113, 253, 8, 0.3)', 
            borderRadius: 'clamp(1px, 0.2vw, 2px)',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: '#71FD08',
              transition: 'width 0.3s ease',
              borderRadius: 'clamp(1px, 0.2vw, 2px)'
            }} />
          </div>
          <div style={{ fontSize: 'clamp(0.625rem, 0.8vw, 0.75rem)', marginTop: 'clamp(1px, 0.2vh, 2px)', opacity: 0.8 }}>
            {preloadStatus.loaded}/{preloadStatus.total}
          </div>
        </div>
      )}

      {/* Favorite Players Section */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center" style={{ 
          gap: 'clamp(1rem, 3vw, 2rem)',
          marginBottom: 'clamp(2rem, 4vh, 4rem)'
        }}>
          <div style={{
            flex: '1.3',
            height: 'clamp(3px, 0.4vw, 4px)',
            backgroundColor: '#71FD08',
            borderRadius: 'clamp(1px, 0.2vw, 2px)',
            marginLeft: 'clamp(1rem, 2vw, 2rem)'
          }}></div>
          <h1 className="font-bold dashboard-heading flex-shrink-0" style={{
            fontSize: 'clamp(1.75rem, 3.5vw, 3rem)',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.8), 2px -2px 4px rgba(0,0,0,0.8), -2px 2px 4px rgba(0,0,0,0.8)'
          }}>
            Favorite Players
          </h1>
          <div style={{
            flex: '1.3',
            height: 'clamp(3px, 0.4vw, 4px)',
            backgroundColor: '#71FD08',
            borderRadius: 'clamp(1px, 0.2vw, 2px)',
            marginRight: 'clamp(1rem, 2vw, 2rem)'
          }}></div>
        </div>
        
        {/* User instruction note */}
        <div className="text-center" style={{ 
          marginTop: 'clamp(-1.5rem, -2vh, -1rem)',
          marginBottom: 'clamp(1rem, 2vh, 1.5rem)'
        }}>
          <p className="text-gray-300 font-medium" style={{
            fontSize: 'clamp(0.875rem, 1.5vw, 1.125rem)',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            color: '#71FD08'
          }}>
            💡 Note: Clicking a favorite player will take you to their stats page
          </p>
        </div>
        
        {loading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full border-b-2 border-green-500" style={{
              height: 'clamp(3rem, 4vw, 4rem)',
              width: 'clamp(3rem, 4vw, 4rem)'
            }}></div>
          </div>
        ) : (
          <div className="grid justify-items-center" style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(160px, 16vw, 200px), 1fr))',
            gap: 'clamp(1rem, 2vw, 1.5rem)'
          }}>
            {favoritePlayers.map((player, index) => {
              const playerHotStreakData = hotStreakData[player.player_name] || { isOnHotStreak: false, loading: false };
              
              console.log(`🔥 Rendering card for "${player.player_name}":`, playerHotStreakData);
              
              return (
                <div
                  key={player.id}
                  className="rounded-2xl shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer group hover:ring-2 hover:ring-white/20 relative team-glow-hover"
                  onClick={() => handlePlayerCardClick(player.player_name)}
                style={{
                  width: 'clamp(160px, 16vw, 200px)',
                  height: 'clamp(200px, 20vh, 260px)',
                  ...(() => {
                    const team = findTeamWithAbbreviations(player.team);
                    
                    if (team && team.colors && team.colors.length >= 2) {
                      return {
                        '--team-glow-color': `${team.colors[0]}40`,
                        '--team-glow-color-secondary': `${team.colors[1]}30`,
                        '--team-glow-color-tertiary': `${team.colors[0]}20`
                      };
                    }
                    return {
                      '--team-glow-color': 'rgba(102, 126, 234, 0.4)',
                      '--team-glow-color-secondary': 'rgba(118, 75, 162, 0.3)',
                      '--team-glow-color-tertiary': 'rgba(102, 126, 234, 0.2)'
                    };
                  })(),
                  background: (() => {
                    const team = findTeamWithAbbreviations(player.team);
                    
                    if (team && team.colors && team.colors.length >= 2) {
                      return `linear-gradient(135deg, ${team.colors[0]} 0%, ${team.colors[1]} 100%)`;
                    }
                    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                  })(),
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: (() => {
                    const team = findTeamWithAbbreviations(player.team);
                    
                    const baseShadow = '2px 2px 8px rgba(0, 0, 0, 0.8), -2px -2px 8px rgba(0, 0, 0, 0.8), 2px -2px 8px rgba(0, 0, 0, 0.8), -2px 2px 8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.3)';
                    
                    if (team && team.colors && team.colors.length >= 2) {
                      return `${baseShadow}, 0 0 20px ${team.colors[0]}40, 0 0 40px ${team.colors[1]}20`;
                    }
                    return `${baseShadow}, 0 0 20px rgba(102, 126, 234, 0.4), 0 0 40px rgba(118, 75, 162, 0.2)`;
                  })(),
                  transform: 'translateZ(0)',
                  borderRadius: '16px',
                  position: 'relative',
                  overflow: 'hidden',
                  outline: '2px solid rgba(255, 255, 255, 0.3)',
                  outlineOffset: '-10px'
                }}
              >
                {/* Team Color Glow Effect */}
                <div 
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: (() => {
                      const team = findTeamWithAbbreviations(player.team);
                      
                      if (team && team.colors && team.colors.length >= 2) {
                        return `linear-gradient(45deg, ${team.colors[0]}40, ${team.colors[1]}40)`;
                      }
                      return 'linear-gradient(45deg, rgba(102, 126, 234, 0.4), rgba(118, 75, 162, 0.4))';
                    })(),
                    zIndex: 1,
                    pointerEvents: 'none'
                  }}
                />
                
                {/* Remove Button - X Icon */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (session?.user?.id) {
                      try {
                        const supabase = createClient(
                          process.env.NEXT_PUBLIC_SUPABASE_URL!,
                          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                        );
                        
                        const { error } = await supabase
                          .from('user_favorites')
                          .delete()
                          .eq('user_id', session.user.id)
                          .eq('player_name', player.player_name);
                        
                        if (!error) {
                          // Refresh the favorites list
                          fetchFavoritePlayers();
                          // Dispatch event to update search page
                          window.dispatchEvent(new CustomEvent('favorites-updated'));
                        } else {
                          console.error('Error removing favorite:', error);
                        }
                      } catch (error) {
                        console.error('Error removing favorite:', error);
                      }
                    }
                  }}
                  className="absolute z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white font-bold hover:text-red-400 transform hover:scale-110 transition-all duration-200 cursor-pointer"
                  style={{
                    right: 'clamp(8px, 1vw, 12px)',
                    top: 'clamp(6px, 0.8vh, 8px)',
                    fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
                    textShadow: '0 0 8px rgba(0, 0, 0, 0.8)'
                  }}
                >
                  ×
                </button>
                
                <div className="w-full h-full flex flex-col items-center justify-center text-center relative">
                  {/* Team Logo - behind player image */}
                  {(() => {
                    const team = findTeamWithAbbreviations(player.team);
                    
                    if (!team) return null;
                    
                    return (
                      <img
                        src={team.logo}
                        alt={team.name + ' logo'}
                        style={{
                          position: 'absolute',
                          left: 'clamp(-25px, -3vw, -35px)',
                          top: 'calc(50% - clamp(50px, 6vh, 70px))',
                          transform: 'translateY(-50%)',
                          width: 'clamp(100px, 12vw, 140px)',
                          height: 'clamp(100px, 12vw, 140px)',
                          opacity: 1,
                          filter: 'drop-shadow(0 0 16px #000)',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      />
                    );
                  })()}
                  
                  {/* Player Image */}
                  <div style={{ 
                    marginTop: 'clamp(-25px, -2.5vh, -35px)',
                    width: 'clamp(140px, 14vw, 170px)',
                    height: 'clamp(130px, 13vh, 160px)',
                    position: 'relative',
                    zIndex: 10
                  }}>
                    <img
                      src={`/api/images/player/${encodeURIComponent(player.player_name)}`}
                      alt={player.player_name}
                      className="w-full h-full object-cover"
                      style={{
                        filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 20px rgba(0, 0, 0, 0.6))'
                      }}
                      onError={(e) => {
                        e.currentTarget.src = '/player_images/jewell_loyd_2987869.png';
                      }}
                    />
                  </div>
                  
                  {/* Player Text - Separated from image */}
                  <div className="rounded-2xl" style={{ 
                    marginTop: 'clamp(-4px, -0.5vh, -6px)',
                    padding: 'clamp(6px, 0.8vw, 10px) clamp(12px, 1.5vw, 20px)',
                    background: '#14171F',
                    border: '2px solid #3a3f4a',
                    borderRadius: 'clamp(10px, 1.2vw, 14px)',
                    position: 'relative',
                    zIndex: 20,
                    width: 'clamp(110px, 12vw, 135px)',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.6), 0 -4px 8px rgba(0, 0, 0, 0.6)'
                  }}>
                    <div className="font-bold leading-tight text-center" style={{
                      fontSize: 'clamp(0.875rem, 1.2vw, 1rem)',
                      lineHeight: '1.2',
                      color: '#d1d5db'
                    }}>
                      {(() => {
                        const nameParts = player.player_name.split(' ');
                        const firstName = nameParts[0];
                        const lastName = nameParts.slice(1).join(' ');
                        return (
                          <>
                            <div style={{ fontSize: 'clamp(0.75rem, 1vw, 0.875rem)' }}>{firstName}</div>
                            <div style={{ fontSize: 'clamp(0.875rem, 1.2vw, 1rem)', fontWeight: 'bold' }}>{lastName}</div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {/* Hot Streak Indicator */}
                  <HotStreakIndicator 
                    isOnHotStreak={playerHotStreakData.isOnHotStreak} 
                    loading={playerHotStreakData.loading}
                    hotStreakStat={playerHotStreakData.hotStreakStat}
                  />
                </div>
              </div>
            )})}
            
            {/* Fill remaining slots with placeholder cards */}
            {Array.from({ length: Math.max(0, 5 - favoritePlayers.length) }).map((_, index) => (
              <div
                key={`placeholder-${index}`}
                className="rounded-2xl shadow-lg overflow-hidden opacity-50"
                style={{
                  width: 'clamp(160px, 16vw, 200px)',
                  height: 'clamp(200px, 20vh, 260px)',
                  background: 'linear-gradient(135deg, #2d3748 0%, #4a5568 100%)',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '2px 2px 8px rgba(0, 0, 0, 0.8), -2px -2px 8px rgba(0, 0, 0, 0.8), 2px -2px 8px rgba(0, 0, 0, 0.8), -2px 2px 8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.3)',
                  borderRadius: 'clamp(12px, 1.5vw, 16px)',
                  outline: '2px solid rgba(255, 255, 255, 0.3)',
                  outlineOffset: 'clamp(-8px, -1vw, -10px)'
                }}
              >
                <div className="w-full h-full flex flex-col items-center justify-center text-center" style={{
                  padding: 'clamp(1rem, 2vw, 1.5rem)'
                }}>
                  <div className="text-white/60 font-bold" style={{
                    fontSize: 'clamp(0.875rem, 1.3vw, 1.125rem)'
                  }}>
                    Empty
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Schedule Section */}
      <div style={{ marginTop: 'clamp(2rem, 4vh, 4rem)' }}>
        <UpcomingSchedule onLoadingChange={setScheduleLoading} />
      </div>
    </div>
  );
} 