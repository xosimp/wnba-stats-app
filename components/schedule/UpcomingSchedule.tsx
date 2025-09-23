"use client";

import { useState, useEffect } from 'react';
import { TEAMS } from '../../lib/constants/team-data';
import TeamInjuryReport from '../dashboard/TeamInjuryReport';
import InjuryReportModal from '../dashboard/InjuryReportModal';

interface Game {
  id: string;
  date: string;
  completed: boolean;
  status: {
    state: string;
    detail: string;
  };
  teams: Array<{
    id: string;
    abbrev: string;
    name: string;
    shortName: string;
    isHome: boolean;
    score?: number;
    winner?: boolean;
  }>;
  venue: {
    fullName: string;
  };
}

interface ScheduleData {
  schedule: Record<string, Game[]>;
  totalDates: number;
  totalGames: number;
}

interface UpcomingScheduleProps {
  onLoadingChange?: (loading: boolean) => void;
}

export default function UpcomingSchedule({ onLoadingChange }: UpcomingScheduleProps) {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [tomorrow, setTomorrow] = useState<Date | null>(null);
  
  // Initialize dates on client side to avoid hydration mismatch
  useEffect(() => {
    const now = new Date();
    setToday(now);
    
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    setTomorrow(tomorrowDate);
  }, []);
  
  // Injury report modal state
  const [injuryModalOpen, setInjuryModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<{
    team1Abbrev: string;
    team2Abbrev: string;
    team1Name: string;
    team2Name: string;
    gameDate: string;
  } | null>(null);

  // Notify parent component when loading state changes
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  // Add CSS animation for pulse effect and team gradient backgrounds
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
      
      .team-gradient-outline {
        position: relative;
        overflow: visible;
        border-radius: 16px;
      }
      
      .game-card-hover {
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
      }
      
      .game-card-hover:hover {
        transform: scale(1.12) translateY(-20px);
        z-index: 50;
        border: 2px solid rgba(0, 0, 0, 1) !important;
        background-image: linear-gradient(135deg, var(--away-team-color, rgba(113, 253, 8, 1)) 0%, var(--home-team-color, rgba(113, 253, 8, 1)) 100%) !important;
        background-origin: padding-box !important;
        background-clip: padding-box !important;
        box-shadow: 
          0 6px 15px rgba(0, 0, 0, 0.2), 
          0 0 0 1px rgba(255, 255, 255, 0.15),
          0 0 6px var(--away-team-color, rgba(113, 253, 8, 0.1)),
          0 0 12px var(--home-team-color, rgba(113, 253, 8, 0.08)),
          0 0 18px var(--away-team-color, rgba(113, 253, 8, 0.05));
      }
      
      .injury-report-link {
        position: absolute !important;
        right: -100px !important;
        top: 50% !important;
        transform: translateY(calc(-50% - 35px)) !important;
        color: #71FD08 !important;
        font-size: 0.8125rem !important;
        font-weight: bold !important;
        text-decoration: none !important;
        opacity: 0 !important;
        transition: all 0.3s ease !important;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8) !important;
        cursor: pointer !important;
        z-index: 99999 !important;
        pointer-events: none !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1.2 !important;
        gap: 4px !important;
        overflow: visible !important;
        white-space: nowrap !important;
        width: auto !important;
        height: auto !important;
      }
      
      .injury-report-link > div {
        display: block !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1 !important;
      }
      
      
      .game-card-hover:hover ~ .injury-report-link {
        opacity: 1 !important;
        transform: translateY(calc(-50% - 20px)) scale(1.05) !important;
        pointer-events: auto !important;
      }
      
      .injury-report-link:hover {
        color: #71FD08 !important;
        transform: translateY(calc(-50% - 20px)) scale(1.1) !important;
      }
      
      .stacked-games {
        display: flex !important;
        flex-direction: column !important;
        gap: 0 !important;
      }
      
      .stacked-games > * {
        margin-bottom: -25px !important;
        position: relative !important;
        z-index: 1 !important;
        border-radius: 16px !important;
        border: 1px solid rgba(0, 0, 0, 1) !important;
        box-shadow: 0 -8px 16px rgba(0, 0, 0, 0.8) !important;
      }
      
      .stacked-games > *:nth-child(2) {
        z-index: 2 !important;
      }
      
      .stacked-games > *:nth-child(3) {
        z-index: 3 !important;
      }
      
      .stacked-games > *:nth-child(4) {
        z-index: 4 !important;
      }
      
      .stacked-games > *:nth-child(5) {
        z-index: 5 !important;
      }
      
      .stacked-games > *:last-child {
        margin-bottom: 0 !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Calculate the date range for upcoming games (2 days starting from tomorrow)
  const twoDaysAfterTomorrow = today ? new Date(today) : null;
  if (twoDaysAfterTomorrow) {
    twoDaysAfterTomorrow.setDate(today!.getDate() + 2); // 2 days from today = 8/6
  }
  const threeDaysAfterToday = today ? new Date(today) : null;
  if (threeDaysAfterToday) {
    threeDaysAfterToday.setDate(today!.getDate() + 3); // 3 days from today = 8/7
  }

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching schedule...');
      
      // Get current date and next week's date
      const currentDate = new Date();
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      
      // Build URL with date parameters to get future games
      const params = new URLSearchParams({
        year: currentDate.getFullYear().toString(),
        month: (currentDate.getMonth() + 1).toString().padStart(2, '0'),
        day: currentDate.getDate().toString().padStart(2, '0')
      });
      
      const response = await fetch(`/api/schedule/lightweight?${params}`);
      console.log('🔍 Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🔍 API Error Details:', errorData);
        throw new Error(`Failed to fetch schedule: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const data: ScheduleData = await response.json();
      
      // Filter schedule to only include games from today to next week
      const allGames: Game[] = [];
      Object.values(data.schedule).forEach(gamesForDate => {
        allGames.push(...gamesForDate);
      });
      
      // Filter games by their individual dates (today's games and future games)
      if (!today) {
        console.log('🔍 Today not initialized yet, skipping filtering');
        return;
      }
      
      console.log('🔍 Today state:', today);
      console.log('🔍 Today timezone offset:', today.getTimezoneOffset());
      console.log('🔍 Today ISO string:', today.toISOString());
      console.log('🔍 Total games before filtering:', allGames.length);
      
      const filteredGames = allGames.filter(game => {
        const gameDate = new Date(game.date);
        
        // Normalize dates to compare only the date part (ignore time)
        const gameDateOnly = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate());
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        // Include today's games AND future games
        const isTodayOrFuture = gameDateOnly >= todayOnly;
        
        if (isTodayOrFuture) {
          console.log('🔍 Today/Future game:', game.date, 'Game date object:', gameDate, 'Game timezone offset:', gameDate.getTimezoneOffset(), game.teams?.map(t => t.abbrev).join(' vs '));
        }
        
        // Include today's games and future games
        if (!isTodayOrFuture) {
          console.log('🔍 Filtered out past game:', game.date, 'Game date object:', gameDate, 'Game timezone offset:', gameDate.getTimezoneOffset(), game.teams?.map(t => t.abbrev).join(' vs '));
        }
        return isTodayOrFuture;
      });
      
      console.log('🔍 Filtered games count:', filteredGames.length);
      
      // Group filtered games by date
      const groupedGames: Record<string, Game[]> = {};
      filteredGames.forEach(game => {
        const gameDate = new Date(game.date);
        const dateKey = gameDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        if (!groupedGames[dateKey]) {
          groupedGames[dateKey] = [];
        }
        groupedGames[dateKey].push(game);
      });

      setScheduleData({
        schedule: groupedGames,
        totalDates: Object.keys(groupedGames).length,
        totalGames: Object.values(groupedGames).reduce((sum, games) => sum + games.length, 0)
      });

    } catch (err) {
      console.error('Error fetching schedule:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch schedule';
      
      // Show a more helpful error message for common API issues
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        setError('Schedule temporarily unavailable due to high demand. Please try again in a few minutes.');
      } else if (errorMessage.includes('503') || errorMessage.includes('not subscribed')) {
        setError('Schedule service temporarily unavailable. Please try again later.');
      } else if (errorMessage.includes('502')) {
        setError('Schedule API is currently unavailable. Please try again later.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  // Update dates at midnight
  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // If it's between 12:00 AM and 12:01 AM, update the dates
      if (currentHour === 0 && currentMinute <= 1) {
        setToday(now);
        const newTomorrow = new Date();
        newTomorrow.setDate(now.getDate() + 1);
        setTomorrow(newTomorrow);
      }
    };

    // Check every minute
    const interval = setInterval(checkMidnight, 60000);
    
    // Initial check
    checkMidnight();

    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString: string) => {
    // Extract just the date part (YYYY-MM-DD) to avoid timezone issues
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    
    // Create date using local timezone to avoid day shift
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getTeamInfo = (teamAbbrev: string) => {
    // Handle different abbreviation variations
    const normalizedAbbrev = teamAbbrev.toLowerCase();
    let team = TEAMS.find(t => t.abbreviation?.toLowerCase() === normalizedAbbrev);
    
    // Handle specific variations
    if (!team) {
      if (normalizedAbbrev === 'conn') {
        team = TEAMS.find(t => t.abbreviation === 'CON');
      } else if (normalizedAbbrev === 'gsv') {
        team = TEAMS.find(t => t.abbreviation === 'GSV');
      } else if (normalizedAbbrev === 'val') {
        team = TEAMS.find(t => t.abbreviation === 'GSV');
      } else if (normalizedAbbrev === 'gsw') {
        team = TEAMS.find(t => t.abbreviation === 'GSV');
      } else if (normalizedAbbrev === 'gs') {
        team = TEAMS.find(t => t.abbreviation === 'GSV');
      } else if (normalizedAbbrev === 'wsh') {
        team = TEAMS.find(t => t.abbreviation === 'WAS');
      } else if (normalizedAbbrev === 'las' || normalizedAbbrev === 'la') {
        team = TEAMS.find(t => t.abbreviation === 'LAS');
      } else if (normalizedAbbrev === 'lva' || normalizedAbbrev === 'lv') {
        team = TEAMS.find(t => t.abbreviation === 'LVA');
      } else if (normalizedAbbrev === 'nyl' || normalizedAbbrev === 'ny') {
        team = TEAMS.find(t => t.abbreviation === 'NYL');
      }
    }
    
    return team || null;
  };

  const getGameStatus = (game: Game) => {
    if (game.completed) {
      return 'Final';
    }
    
    const gameDate = new Date(game.date);
    const now = new Date();
    
    if (gameDate < now) {
      return 'Live';
    }
    
    return 'Upcoming';
  };

  const handleInjuryReportClick = (game: Game) => {
    const homeTeam = game.teams.find(team => team.isHome);
    const awayTeam = game.teams.find(team => !team.isHome);
    
    if (homeTeam && awayTeam) {
      setSelectedGame({
        team1Abbrev: awayTeam.abbrev,
        team2Abbrev: homeTeam.abbrev,
        team1Name: awayTeam.name,
        team2Name: homeTeam.name,
        gameDate: game.date
      });
      setInjuryModalOpen(true);
    }
  };


  const renderLiveIndicator = () => {
    return (
      <div style={{ marginTop: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div 
          style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#ef4444',
            borderRadius: '50%',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        ></div>
        <span 
          className="text-xs font-bold"
          style={{
            color: '#ef4444',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        >
          Live
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-400 text-lg mb-4">Failed to load schedule</div>
        <button 
          onClick={fetchSchedule}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Always render the three sections, even if there are no games
  // This allows individual "no games" messages to be shown for each section

  // Sort dates and get all games
  const sortedDates = scheduleData ? Object.keys(scheduleData.schedule).sort() : [];
  const allGames = scheduleData ? sortedDates.flatMap(date => 
    scheduleData.schedule[date].map(game => ({ ...game, displayDate: date }))
  ) : [];

  // Filter games to include today and future games (only if today is initialized)
  const filteredGames = today ? allGames.filter(game => {
    const gameDate = new Date(game.date);
    
    // Normalize dates to compare only the date part (ignore time)
    const gameDateOnly = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const isTodayOrFuture = gameDateOnly >= todayOnly;
    
    if (isTodayOrFuture) {
      console.log('🔍 Today or future game:', game.date, game.teams?.map(t => t.abbrev).join(' vs '));
    }
    
    // Include today's games and future games
    return isTodayOrFuture;
  }) : allGames;

  return (
    <div className="max-w-7xl mx-auto" style={{ paddingBottom: '50px' }}>
      <div className="flex items-center mb-8" style={{ gap: '32px', marginTop: '5px' }}>
        <div style={{
          flex: '1.3',
          height: '4px',
          backgroundColor: '#71FD08',
          borderRadius: '2px',
          marginLeft: '32px'
        }}></div>
        <h1 className="text-7xl dashboard-heading flex-shrink-0" style={{
          textShadow: '2px 2px 4px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.8), 2px -2px 4px rgba(0,0,0,0.8), -2px 2px 4px rgba(0,0,0,0.8)',
          fontWeight: '700 !important'
        }}>
          Upcoming Schedule
        </h1>
        <div style={{
          flex: '1.3',
          height: '4px',
          backgroundColor: '#71FD08',
          borderRadius: '2px',
          marginRight: '32px'
        }}></div>
      </div>

      <div className="grid grid-cols-3 gap-8 upcoming-schedule-section">
        {/* Today's Games - Left */}
        <div>
          {(() => {
            const todayGames = today ? allGames.filter(game => {
              const gameDate = new Date(game.date);
              return gameDate.toDateString() === today.toDateString();
            }) : [];
            
            if (todayGames.length > 0) {
              return (
                <div>
                  <div className="text-3xl font-bold text-white mb-4" style={{ color: '#d1d5db', paddingLeft: '20px' }}>
                    Today
                  </div>
                  <div className="stacked-games" style={{ paddingLeft: '30px' }}>
                    {todayGames.map((game) => {
                      const homeTeam = game.teams.find(team => team.isHome);
                      const awayTeam = game.teams.find(team => !team.isHome);
                      const gameStatus = getGameStatus(game);
                      
                        return (
                          <div key={game.id} style={{ position: 'relative' }}>
                            <div
                              className="flex items-center space-x-3 px-3 py-3 rounded-xl today-game-row h-full team-gradient-outline game-card-hover cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleInjuryReportClick(game);
                              }}
                              style={{
                                paddingLeft: '30px',
                                position: 'relative',
                                height: '120px',
                                background: (() => {
                                  const awayTeamInfo = getTeamInfo(awayTeam?.abbrev || '');
                                  const homeTeamInfo = getTeamInfo(homeTeam?.abbrev || '');
                                  const awayColor1 = awayTeamInfo?.colors?.[0] || '#71FD08';
                                  const awayColor2 = awayTeamInfo?.colors?.[1] || '#71FD08';
                                  const homeColor1 = homeTeamInfo?.colors?.[0] || '#71FD08';
                                  const homeColor2 = homeTeamInfo?.colors?.[1] || '#71FD08';
                                  
                                  return `linear-gradient(45deg, ${awayColor1}, ${awayColor2}, ${homeColor1}, ${homeColor2})`;
                                })(),
                                '--away-team-color': (() => {
                                  const color = `${getTeamInfo(awayTeam?.abbrev || '')?.colors?.[0] || '#71FD08'}`;
                                  return color;
                                })(),
                                '--home-team-color': (() => {
                                  const color = `${getTeamInfo(homeTeam?.abbrev || '')?.colors?.[0] || '#71FD08'}`;
                                  return color;
                                })()
                              } as React.CSSProperties}
                            >
                              {/* Time */}
                              <div className="absolute top-2 left-4">
                                <div className="text-sm font-bold" style={{ color: '#d1d5db', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                                  {formatTime(game.date)}
                                </div>
                                {gameStatus === 'Live' && renderLiveIndicator()}
                              </div>

                              {/* Teams */}
                              <div className="flex items-center justify-between w-full" style={{ paddingLeft: '80px' }}>
                                <div className="flex flex-col items-center">
                                  {awayTeam && getTeamInfo(awayTeam.abbrev)?.logo && (
                                    <div className="team-logo-container">
                                      <img 
                                        src={getTeamInfo(awayTeam.abbrev)?.logo} 
                                        alt={`${awayTeam.abbrev} logo`}
                                      />
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs font-bold" style={{ color: '#d1d5db', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>VS</span>
                                <div className="flex flex-col items-center">
                                  {homeTeam && getTeamInfo(homeTeam.abbrev)?.logo && (
                                    <div className="team-logo-container">
                                      <img 
                                        src={getTeamInfo(homeTeam.abbrev)?.logo} 
                                        alt={`${homeTeam.abbrev} logo`}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Status */}
                              <div className="ml-auto">
                                <span 
                                  className="px-2 py-1 rounded-full text-xs font-bold"
                                  style={{
                                    backgroundColor: gameStatus === 'Final' ? '#4b5563' : '#22c55e',
                                    color: gameStatus === 'Final' ? '#d1d5db' : '#ffffff'
                                  }}
                                >
                                  {gameStatus === 'Final' ? 'Final' : ''}
                                </span>
                              </div>
                            </div>
                            
                            {/* Injury Report Link - Outside the game card */}
                            <div 
                              className="injury-report-link"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleInjuryReportClick(game);
                              }}
                            >
                              <div>INJURY</div>
                              <div>REPORT</div>
                              <div>→</div>
                            </div>
                          </div>
                        );
                    })}
                  </div>
                </div>
              );
            }
            
            // Check if there were games today but they've all been completed
            const hadGamesToday = scheduleData && today && scheduleData.schedule[today.toISOString().split('T')[0]];
            
            if (hadGamesToday && hadGamesToday.length > 0) {
              // All games today have been completed
              return (
                <div>
                  <div className="text-3xl font-bold text-white mb-4" style={{ color: '#d1d5db', paddingLeft: '20px' }}>
                    Today
                  </div>
                  <div className="space-y-3" style={{ paddingLeft: '35px', textAlign: 'center' }}>
                    <div className="text-lg font-bold" style={{ color: '#FFD700' }}>All games have ended</div>
                  </div>
                </div>
              );
            }
            
            // No games scheduled for today
            return (
              <div>
                <div className="text-3xl font-bold text-white mb-4" style={{ color: '#d1d5db', paddingLeft: '20px' }}>
                  Today
                </div>
                <div className="space-y-3" style={{ paddingLeft: '35px', textAlign: 'center' }}>
                  <div className="text-lg font-bold" style={{ color: '#FFD700' }}>No games today</div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Tomorrow's Games - Center */}
        <div className="flex justify-center">
          {(() => {
            const tomorrowGames = tomorrow ? filteredGames.filter(game => {
              const gameDate = new Date(game.date);
              return gameDate.toDateString() === tomorrow.toDateString();
            }) : [];
            
            
            if (tomorrowGames.length > 0) {
              return (
                <div>
                  <div className="text-3xl font-bold text-white mb-4" style={{ color: '#d1d5db', paddingLeft: '20px', paddingBottom: '20px' }}>
                    Tomorrow
                  </div>
                  <div className="stacked-games" style={{ paddingLeft: '20px' }}>
                    {tomorrowGames.map((game) => {
                      const homeTeam = game.teams.find(team => team.isHome);
                      const awayTeam = game.teams.find(team => !team.isHome);
                      const gameStatus = getGameStatus(game);

                      return (
                        <div key={game.id} style={{ position: 'relative' }}>
                          <div
                            className="flex items-center space-x-3 px-3 py-3 rounded-xl tomorrow-game-row h-full team-gradient-outline game-card-hover cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleInjuryReportClick(game);
                              }}
                            style={{
                              paddingLeft: '20px',
                              position: 'relative',
                              height: '120px',
                              background: (() => {
                                const awayTeamInfo = getTeamInfo(awayTeam?.abbrev || '');
                                const homeTeamInfo = getTeamInfo(homeTeam?.abbrev || '');
                                const awayColor1 = awayTeamInfo?.colors?.[0] || '#71FD08';
                                const awayColor2 = awayTeamInfo?.colors?.[1] || '#71FD08';
                                const homeColor1 = homeTeamInfo?.colors?.[0] || '#71FD08';
                                const homeColor2 = homeTeamInfo?.colors?.[1] || '#71FD08';
                                
                                return `linear-gradient(45deg, ${awayColor1}, ${awayColor2}, ${homeColor1}, ${homeColor2})`;
                              })(),
                              '--away-team-color': (() => {
                                const color = `${getTeamInfo(awayTeam?.abbrev || '')?.colors?.[0] || '#71FD08'}`;
                                return color;
                              })(),
                              '--home-team-color': (() => {
                                const color = `${getTeamInfo(homeTeam?.abbrev || '')?.colors?.[0] || '#71FD08'}`;
                                return color;
                              })()
                            } as React.CSSProperties}
                          >
                            {/* Time */}
                            <div className="absolute top-2 left-4">
                              <div className="text-sm font-bold" style={{ color: '#d1d5db', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                                {formatTime(game.date)}
                              </div>
                              {gameStatus === 'Live' && renderLiveIndicator()}
                            </div>

                            {/* Teams */}
                            <div className="flex items-center justify-between w-full" style={{ paddingLeft: '80px' }}>
                              <div className="flex flex-col items-center">
                                {awayTeam && getTeamInfo(awayTeam.abbrev)?.logo && (
                                  <div className="team-logo-container">
                                    <img 
                                      src={getTeamInfo(awayTeam.abbrev)?.logo} 
                                      alt={`${awayTeam.abbrev} logo`}
                                    />
                                  </div>
                                )}
                              </div>
                              <span className="text-xs font-bold" style={{ color: '#d1d5db', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>VS</span>
                              <div className="flex flex-col items-center">
                                {homeTeam && getTeamInfo(homeTeam.abbrev)?.logo && (
                                  <div className="team-logo-container">
                                    <img 
                                      src={getTeamInfo(homeTeam.abbrev)?.logo} 
                                      alt={`${homeTeam.abbrev} logo`}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Status */}
                            <div className="ml-auto">
                              <span 
                                className="px-2 py-1 rounded-full text-xs font-bold"
                                style={{
                                  backgroundColor: gameStatus === 'Final' ? '#4b5563' : '#22c55e',
                                  color: gameStatus === 'Final' ? '#d1d5db' : '#ffffff'
                                }}
                              >
                                {gameStatus === 'Final' ? 'Final' : ''}
                              </span>
                            </div>
                          </div>
                          
                          {/* Injury Report Link - Outside the game card */}
                          <div 
                            className="injury-report-link"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleInjuryReportClick(game);
                              }}
                          >
                            <div>INJURY</div>
                            <div>REPORT</div>
                            <div>→</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return (
              <div>
                <div className="text-3xl font-bold text-white mb-4" style={{ color: '#d1d5db', paddingLeft: '20px', paddingBottom: '20px' }}>
                  Tomorrow
                </div>
                <div className="space-y-3" style={{ paddingLeft: '20px', textAlign: 'center' }}>
                  <div className="text-lg font-bold" style={{ color: '#FFD700' }}>No games tomorrow</div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Upcoming Games - Right */}
        <div className="flex justify-end">
          {(() => {
            const otherGames = twoDaysAfterTomorrow ? filteredGames.filter(game => {
              const gameDate = new Date(game.date);
              // Show games from 2 days after today onwards (expanded range)
              return gameDate >= twoDaysAfterTomorrow;
            }) : [];
            
            console.log('🔍 Upcoming games debug:');
            console.log('🔍 Total allGames:', allGames.length);
            if (today) {
              console.log('🔍 Today:', today.toDateString());
              console.log('🔍 Four days from today:', new Date(today.getTime() + (4 * 24 * 60 * 60 * 1000)).toDateString());
            }
            if (twoDaysAfterTomorrow) {
              console.log('🔍 Two days after tomorrow:', twoDaysAfterTomorrow.toDateString());
            }
            console.log('🔍 Filtered upcoming games:', otherGames.length);
            console.log('🔍 Upcoming games:', otherGames.map(g => ({ date: g.date, teams: g.teams?.map(t => t.abbrev).join(' vs ') })));
            
            if (otherGames.length > 0) {
              return (
                <div>
                  <div className="text-3xl font-bold text-white mb-4" style={{ color: '#d1d5db', paddingLeft: '20px', paddingBottom: '20px' }}>
                    Upcoming
                  </div>
                  <div className="stacked-games" style={{ paddingLeft: '20px' }}>
                    {otherGames.map((game) => {
                      const homeTeam = game.teams.find(team => team.isHome);
                      const awayTeam = game.teams.find(team => !team.isHome);
                      const gameStatus = getGameStatus(game);

                      return (
                        <div key={game.id} style={{ position: 'relative' }}>
                          <div
                            className="flex items-center space-x-3 px-3 py-3 rounded-xl upcoming-game-row h-full team-gradient-outline"
                            style={{
                              paddingLeft: '20px',
                              position: 'relative',
                              width: '280px',
                              height: '120px',
                              marginLeft: '2px',
                              background: (() => {
                                const awayTeamInfo = getTeamInfo(awayTeam?.abbrev || '');
                                const homeTeamInfo = getTeamInfo(homeTeam?.abbrev || '');
                                const awayColor1 = awayTeamInfo?.colors?.[0] || '#71FD08';
                                const awayColor2 = awayTeamInfo?.colors?.[1] || '#71FD08';
                                const homeColor1 = homeTeamInfo?.colors?.[0] || '#71FD08';
                                const homeColor2 = homeTeamInfo?.colors?.[1] || '#71FD08';
                                
                                return `linear-gradient(45deg, ${awayColor1}, ${awayColor2}, ${homeColor1}, ${homeColor2})`;
                              })(),
                              '--away-team-color': (() => {
                                const color = `${getTeamInfo(awayTeam?.abbrev || '')?.colors?.[0] || '#71FD08'}`;
                                return color;
                              })(),
                              '--home-team-color': (() => {
                                const color = `${getTeamInfo(homeTeam?.abbrev || '')?.colors?.[0] || '#71FD08'}`;
                                return color;
                              })()
                            } as React.CSSProperties}
                          >
                            {/* Date and Time */}
                            <div className="absolute top-2 left-4">
                              <div className="text-sm font-bold" style={{ color: '#d1d5db', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                                {formatDate(game.date)}
                              </div>
                              <div className="text-xs font-bold" style={{ color: '#d1d5db', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                                {formatTime(game.date)}
                              </div>
                              {gameStatus === 'Live' && renderLiveIndicator()}
                            </div>

                            {/* Teams */}
                            <div className="flex items-center justify-between w-full" style={{ paddingLeft: '80px' }}>
                              <div className="flex flex-col items-center">
                                {awayTeam && getTeamInfo(awayTeam.abbrev)?.logo && (
                                  <div className="team-logo-container">
                                    <img 
                                      src={getTeamInfo(awayTeam.abbrev)?.logo} 
                                      alt={`${awayTeam.abbrev} logo`}
                                    />
                                  </div>
                                )}
                              </div>
                              <span className="text-xs font-bold" style={{ color: '#d1d5db', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>VS</span>
                              <div className="flex flex-col items-center">
                                {homeTeam && getTeamInfo(homeTeam.abbrev)?.logo && (
                                  <div className="team-logo-container">
                                    <img 
                                      src={getTeamInfo(homeTeam.abbrev)?.logo} 
                                      alt={`${homeTeam.abbrev} logo`}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Status */}
                            <div className="ml-auto">
                              <span 
                                className="px-2 py-1 rounded-full text-xs font-bold"
                                style={{
                                  backgroundColor: gameStatus === 'Final' ? '#4b5563' : '#22c55e',
                                  color: gameStatus === 'Final' ? '#d1d5db' : '#ffffff'
                                }}
                              >
                                {gameStatus === 'Final' ? 'Final' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return (
              <div>
                <div className="text-3xl font-bold text-white mb-4" style={{ color: '#d1d5db', paddingLeft: '20px', paddingBottom: '20px' }}>
                  Upcoming
                </div>
                <div className="space-y-3" style={{ paddingLeft: '20px', textAlign: 'center' }}>
                  <div className="text-lg font-bold" style={{ color: '#FFD700' }}>No upcoming games</div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      
      {/* Injury Report Modal */}
      {selectedGame && (
        <InjuryReportModal
          isOpen={injuryModalOpen}
          onClose={() => {
            setInjuryModalOpen(false);
            setSelectedGame(null);
          }}
          team1Abbrev={selectedGame.team1Abbrev}
          team2Abbrev={selectedGame.team2Abbrev}
          team1Name={selectedGame.team1Name}
          team2Name={selectedGame.team2Name}
          gameDate={selectedGame.gameDate}
        />
      )}
    </div>
  );
} 