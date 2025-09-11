'use client';

import React from 'react';
import {
  LEAGUE_AVERAGES,
  TOP_1_PERCENT_THRESHOLDS,
  BOTTOM_1_PERCENT_THRESHOLDS,
  PlayerStats,
  StatComparison,
  getPercentile,
  computeDynamicThresholds,
  StatAlgorithms,
  formatPercentageDifference
} from './Algorithms';

// Only export React-related code (e.g., useStatComparison)
export function useStatComparison(statKey: keyof PlayerStats, playerValue: number) {
  const comparison = StatAlgorithms.compareToLeagueAverage(statKey, playerValue);
  
  return {
    color: comparison.color,
    isAboveAverage: comparison.isAboveAverage,
    isTop1Percent: comparison.isTop1Percent,
    percentageDifference: comparison.percentageDifference,
    leagueAverage: StatAlgorithms.getLeagueAverage(statKey),
    performanceIndicator: StatAlgorithms.getPerformanceIndicator(statKey, playerValue),
    performanceLabel: comparison.performanceLabel
  };
} 