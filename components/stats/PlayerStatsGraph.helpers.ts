// PlayerStatsGraph.helpers.ts
import { Dispatch, SetStateAction } from 'react';

export interface GameLogEntry {
  date: string;
  points: number | string;
  assists?: number | string;
  rebounds?: number | string;
  steals?: number | string;
  blocks?: number | string;
  fieldGoalsAttempted?: number | string;
  threePointersAttempted?: number | string;
  freeThrowsAttempted?: number | string;
  opp?: string;
  opponent_abbr?: string;
  opponent?: string;
  homeAway?: string;
  eventId?: string;
  [key: string]: any;
}

export interface PlayerStatsGraphProps {
  gameLog?: GameLogEntry[];
  bookLine?: number | null;
  playerName?: string;
  playerId?: string;
  loading?: boolean;
  upcomingOpponent?: string;
  teamColors?: string[];
  isInjured?: boolean;
  onLoadingChange?: (loading: boolean) => void;
}

// Version: 2.1 - Fixed timezone issues and added support for formatted date strings
export function formatGameDate(eventId?: string, date?: string): string {
  if (date) {
    try {
      if (!date || typeof date !== 'string') {
        console.warn('Invalid date value in formatGameDate:', date);
        return 'N/A';
      }
      
      // Parse YYYY-MM-DD format directly to avoid timezone issues
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = date.split('-');
        return `${parseInt(month)}/${parseInt(day)}`;
      }
      
      // Handle formatted date strings like "Tue, Aug 19, 2025"
      if (date.includes(',') && date.includes(' ')) {
        const dateObj = new Date(date);
        if (!isNaN(dateObj.getTime())) {
          return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
        }
      }
      
      // Fallback to Date constructor for other formats
      // Extract just the date part to avoid timezone issues
      const datePart = date.split('T')[0];
      const [year, month, day] = datePart.split('-');
      
      // Create date using local timezone to avoid day shift
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date format in formatGameDate:', date);
        return 'N/A';
      }
      return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    } catch (dateError) {
      console.error('Date parsing error in formatGameDate:', dateError, 'for date:', date);
      return 'N/A';
    }
  }
  if (eventId) {
    try {
      if (!eventId || typeof eventId !== 'string') {
        console.warn('Invalid eventId in formatGameDate:', eventId);
        return 'N/A';
      }
      const gameNumber = eventId.slice(-3);
      return `G${gameNumber}`;
    } catch (eventError) {
      console.error('EventId processing error in formatGameDate:', eventError, 'for eventId:', eventId);
      return 'N/A';
    }
  }
  return 'N/A';
}

export function getOrderedGames(arr: GameLogEntry[]): GameLogEntry[] {
  if (!arr || arr.length === 0) return [];
  // Return newest first consistently; L5/L10 logic slices from start
  return [...arr].sort((a, b) => {
    try {
      if (!a.date || !b.date || typeof a.date !== 'string' || typeof b.date !== 'string') {
        console.warn('Invalid date values for sorting in getOrderedGames:', { a: a.date, b: b.date });
        return 0;
      }
      
      // For YYYY-MM-DD format, sort directly as strings to avoid timezone issues
      if (a.date.match(/^\d{4}-\d{2}-\d{2}$/) && b.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return b.date.localeCompare(a.date);
      }
      
      // Fallback to Date constructor for other formats
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (isNaN(da) || isNaN(db)) {
        console.warn('Invalid date timestamps for sorting in getOrderedGames:', { a: da, b: db });
        return 0;
      }
      return db - da;
    } catch (sortError) {
      console.error('Date sorting error in getOrderedGames:', sortError, 'for dates:', { a: a.date, b: b.date });
      return 0;
    }
  });
}

export function calculateOverPercentage(arr: GameLogEntry[], count: number, finalBookLine: number): number {
  if (!arr || arr.length === 0) return 0;
  // Only use games with a valid statValue (number)
  const validGames = arr.filter(game => typeof game.statValue === 'number' && !isNaN(game.statValue));
  // Use the most recent N games
  const recentGames = validGames.slice(0, count);
  if (recentGames.length === 0) return 0;
  const overCount = recentGames.filter((game: GameLogEntry) => game.statValue > finalBookLine).length;
  return Math.round((overCount / recentGames.length) * 100);
}

export function getBarStyles(index: number, games: GameLogEntry[], selectedPeriod: string) {
  const totalBars = games.length;
  let barWidth = 32;
  // Make H2H bars wider (max 4 games per opponent per season)
  if (selectedPeriod === 'H2H') {
    if (games.length <= 2) {
      barWidth = 72;
    } else if (games.length <= 4) {
      barWidth = 60;
    } else {
      barWidth = 48;
    }
    return {
      width: barWidth,
      marginLeft: 0,
      marginRight: 0,
    };
  }
  if (selectedPeriod === 'Season') {
    // Narrower bars for Season to accommodate many games without crowding
    if (games.length > 40) {
      barWidth = 8;
    } else if (games.length > 30) {
      barWidth = 10;
    } else if (games.length > 20) {
      barWidth = 12;
    } else if (games.length > 15) {
      barWidth = 16;
    } else {
      barWidth = 18;
    }
  } else if (selectedPeriod === 'L10' || games.length === 10) {
    barWidth = 30;
  } else if (games.length === 5) {
    barWidth = 48;
  } else if (games.length > 15) {
    barWidth = 16;
  } else if (games.length > 10) {
    barWidth = 12;
  }
  return {
    width: barWidth,
    marginLeft: 0,
    marginRight: 0,
  };
}

export function getBookLinePosition(value: number, selectedPeriod: string) {
  const offsets = { 0: 50, 10: 50, 20: 46, 30: 44, 40: 41, 50: 39 };
  const lower = Math.floor(value / 10) * 10;
  const upper = Math.min(lower + 10, 50);
  const lowerOffset = offsets[lower as keyof typeof offsets];
  const upperOffset = offsets[upper as keyof typeof offsets];
  const ratio = (value - lower) / 10;
  const interpolatedOffset = lowerOffset + (upperOffset - lowerOffset) * ratio;
  let position;
  if (selectedPeriod === 'Season') {
    // Match bar height formula for Season
    position = (value / 50) * (302 - 48) + interpolatedOffset;
  } else if (selectedPeriod === 'L5' || selectedPeriod === 'L10') {
    // Match bar height formula for L5/L10
    position = (value / 50) * 302 + interpolatedOffset - 70;
  } else {
    // Default bar height formula
    position = (value / 50) * 302;
  }
  return `${position}px`;
}

export const periodButtonBaseStyle = {
  background: '#1A1E28',
  borderRadius: 8,
  padding: '2px 10px',
  marginRight: 8,
  minWidth: 56,
  justifyContent: 'center',
  color: '#D1D5DB',
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.6, 1)',
  zIndex: 10,
}; 