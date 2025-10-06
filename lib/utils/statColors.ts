// Stat color calculation utilities
// This module provides stat color calculations without dependencies on Algorithms.ts

export interface PlayerStats {
  points?: number;
  rebounds?: number;
  assists?: number;
  turnovers?: number;
  steals?: number;
  blocks?: number;
  minutes?: number;
}

// Hardcoded league averages (same as in Algorithms.ts)
export const LEAGUE_AVERAGES = {
  points: 13.2,
  rebounds: 5.4,
  assists: 3.3,
  turnovers: 2.3,
  steals: 1.3,
  blocks: 0.9,
  minutes: 29.1
};

// Top 1% thresholds
export const TOP_1_PERCENT_THRESHOLDS = {
  points: 21.0, 
  rebounds: 9.0, 
  assists: 5.5, 
  turnovers: 3.8, 
  steals: 2.5, 
  blocks: 1.8,
  minutes: 34.0 
};

// Bottom 1% thresholds
export const BOTTOM_1_PERCENT_THRESHOLDS = {
  points: 4.2,
  rebounds: 1.8,
  assists: 0.8,
  turnovers: 0.8,
  steals: 0.3,
  blocks: 0.1,
  minutes: 15.0
};

export interface StatComparison {
  color: string;
  isAboveAverage: boolean;
  isTop1Percent: boolean;
  percentageDifference: number;
  performanceLabel: string;
}

/**
 * Compare a player's stat to league average and return color/styling info
 */
export function compareToLeagueAverage(
  statKey: keyof PlayerStats, 
  playerValue: number,
  dynamicThresholds?: {
    top1?: Record<string, number>;
    bottom1?: Record<string, number>;
    leagueAvg?: Record<string, number>;
  }
): StatComparison {
  // Use dynamic thresholds if provided, otherwise fall back to hardcoded values
  const leagueAverage = dynamicThresholds?.leagueAvg?.[statKey] ?? LEAGUE_AVERAGES[statKey];
  const top1PercentThreshold = dynamicThresholds?.top1?.[statKey] ?? TOP_1_PERCENT_THRESHOLDS[statKey];
  const bottom1PercentThreshold = dynamicThresholds?.bottom1?.[statKey] ?? BOTTOM_1_PERCENT_THRESHOLDS[statKey];

  const percentageDifference = ((playerValue - leagueAverage) / leagueAverage) * 100;
  const isAboveAverage = playerValue > leagueAverage;
  const isTop1Percent = playerValue >= top1PercentThreshold;
  const isBottom1Percent = playerValue <= bottom1PercentThreshold;

  // Determine color based on performance
  let color: string;
  let performanceLabel: string;

  if (isTop1Percent) {
    color = '#fbbf24'; // Mustard - top 1%
    performanceLabel = 'Elite';
  } else if (isAboveAverage) {
    color = '#71FD08'; // App green - above average
    performanceLabel = 'Above Average';
  } else if (isBottom1Percent) {
    color = '#ef4444'; // App red - bottom 1%
    performanceLabel = 'Below Average';
  } else {
    color = '#fbbf24'; // Mustard - average
    performanceLabel = 'Average';
  }

  return {
    color,
    isAboveAverage,
    isTop1Percent,
    percentageDifference,
    performanceLabel
  };
}

/**
 * Get stat color for a given stat and value
 */
export function getStatColor(
  statKey: keyof PlayerStats, 
  playerValue: number, 
  dynamicThresholds?: {
    top1?: Record<string, number>;
    bottom1?: Record<string, number>;
    leagueAvg?: Record<string, number>;
  }
): string {
  const comparison = compareToLeagueAverage(statKey, playerValue, dynamicThresholds);
  return comparison.color;
}

/**
 * Get league average for a stat
 */
export function getLeagueAverage(statKey: keyof PlayerStats): number {
  return LEAGUE_AVERAGES[statKey] || 0;
}
