// Import the dynamic league averages service
import { PlayerLeagueAveragesService } from '../services/PlayerLeagueAveragesService';

// Legacy constants - now replaced by dynamic calculations
// These are kept as fallbacks only
export const LEAGUE_AVERAGES = {
  points: 13.2,
  rebounds: 5.4,
  assists: 3.3,
  turnovers: 2.3,
  steals: 1.3,
  blocks: 0.9,
  minutes: 29.1
};

export const TOP_1_PERCENT_THRESHOLDS = {
  points: 21.0, 
  rebounds: 9.0, 
  assists: 5.5, 
  turnovers: 3.8, 
  steals: 2.5, 
  blocks: 1.8,
  minutes: 34.0 
};

export const BOTTOM_1_PERCENT_THRESHOLDS = {
  points: 4.2,
  rebounds: 1.8,
  assists: 0.8,
  turnovers: 0.5,
  steals: 0.2,
  blocks: 0.1,
  minutes: 12.5
};

// Projection system constants and weights
export const PROJECTION_WEIGHTS = {
  seasonAverage: 0.24,        // 24% - Base performance
  recentForm: 0.20,           // 20% - Recent momentum
  opponentDefense: 0.18,      // 18% - Matchup strength
  homeAway: 0.12,             // 12% - Venue advantage
  restFactor: 0.08,           // 8% - Fatigue/rest
  injuryImpact: 0.07,         // 7% - Team availability
  headToHead: 0.05,           // 5% - Historical matchup
  perFactor: 0.06             // 6% - PER efficiency boost (increased from 1%)
};

export interface PlayerStats {
  points?: number;
  rebounds?: number;
  assists?: number;
  turnovers?: number;
  steals?: number;
  blocks?: number;
  minutes?: number;
}

export interface StatComparison {
  value: number;
  isAboveAverage: boolean;
  isTop1Percent: boolean;
  color: string;
  percentageDifference: number;
  performanceLabel?: string;
}

// New projection system interfaces
export interface ProjectionFactors {
  seasonAverage: number;
  recentForm: number;
  opponentDefense: number;
  homeAway: number;
  backToBack: number; // Back-to-back fatigue factor (1.0 = no fatigue, <1.0 = fatigue penalty)
  pace: number; // PACE factor (1.0 = average, >1.0 = high PACE boost, <1.0 = low PACE reduction)
  restFactor: number;
  injuryImpact: number;
  headToHead: number;
  perFactor: number; // PER efficiency factor (1.0 = no boost, >1.0 = efficiency boost)
  regressionFactor: number; // Regression to mean for outliers (1.0 = no regression, <1.0 = regress down, >1.0 = regress up)
  lineupShiftMultiplier: number; // Lineup shift multiplier when key teammates are injured (1.0 = no change, >1.0 = usage boost)
}

export interface ProjectionResult {
  projectedValue: number;
  confidenceScore: number;
  factors: ProjectionFactors;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  edge: number; // Expected value vs sportsbook line
  recommendation: 'OVER' | 'UNDER' | 'PASS';
  // Additional calculated values for UI display
  historicalAccuracy?: number;
  recentFormPercentage?: number;
  matchupAnalysis?: number;
  seasonGamesCount?: number; // Actual number of season games available
  teammateInjuries?: string[]; // List of significant injured teammates
  // Enhanced model quality indicators
  modelQuality?: string; // 'Excellent', 'Good', 'Fair', 'Poor', 'Worthless'
}

export interface TeamDefensiveStats {
  team: string;
  season: string;
  stat_type: string;
  home_avg_allowed: number;
  away_avg_allowed: number;
  overall_avg_allowed: number;
  last_updated: Date;
}

export interface PlayerGameLog {
  playerName: string;
  team: string;
  gameId: string;
  gameDate: string;
  opponent: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  minutes: number;
  isHome: boolean;
}

export interface ProjectionRequest {
  playerName: string;
  team: string;
  opponent: string;
  statType: keyof PlayerStats;
  isHome: boolean;
  gameDate: string;
  gameId: string;
  sportsbookLine?: number;
  daysRest?: number;
  teammateInjuries?: string[];
  playerPosition?: string;
}

export function getPercentile(values: number[], percentile: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(percentile * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export function computeDynamicThresholds(allPlayerStats: PlayerStats[]): {
  top1: Record<string, number>;
  bottom1: Record<string, number>;
  leagueAvg: Record<string, number>;
} {
  const statKeys: (keyof PlayerStats)[] = ['points', 'rebounds', 'assists', 'turnovers', 'steals', 'blocks', 'minutes'];
  const top1: Record<string, number> = {};
  const bottom1: Record<string, number> = {};
  const leagueAvg: Record<string, number> = {};
  for (const key of statKeys) {
    const values = allPlayerStats.map(s => s[key] ?? 0).filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length) {
      top1[key] = getPercentile(values, 0.99);
      bottom1[key] = getPercentile(values, 0.01);
      leagueAvg[key] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }
  return { top1, bottom1, leagueAvg };
}

export class StatAlgorithms {
  static compareToLeagueAverage(
    statKey: keyof PlayerStats,
    playerValue: number,
    dynamicThresholds?: {
      top1?: Record<string, number>;
      bottom1?: Record<string, number>;
      leagueAvg?: Record<string, number>;
    }
  ): StatComparison {
    // Try to get dynamic thresholds first, then fall back to service, then to hardcoded values
    let leagueAverage = dynamicThresholds?.leagueAvg?.[statKey];
    let top1PercentThreshold = dynamicThresholds?.top1?.[statKey];
    let bottom1PercentThreshold = dynamicThresholds?.bottom1?.[statKey];

    // If no dynamic thresholds provided, try to get from service
    if (!leagueAverage || !top1PercentThreshold || !bottom1PercentThreshold) {
      try {
        const service = PlayerLeagueAveragesService.getInstance();
        leagueAverage = leagueAverage ?? service.getLeagueAverage(statKey);
        top1PercentThreshold = top1PercentThreshold ?? service.getTop1PercentThreshold(statKey);
        bottom1PercentThreshold = bottom1PercentThreshold ?? service.getBottom1PercentThreshold(statKey);
      } catch (error) {
        console.warn('⚠️ Could not get dynamic thresholds, using fallback values:', error);
      }
    }

    // Final fallback to hardcoded values
    leagueAverage = leagueAverage ?? LEAGUE_AVERAGES[statKey];
    top1PercentThreshold = top1PercentThreshold ?? TOP_1_PERCENT_THRESHOLDS[statKey];
    bottom1PercentThreshold = bottom1PercentThreshold ?? BOTTOM_1_PERCENT_THRESHOLDS[statKey];
    if (!leagueAverage || playerValue === undefined || playerValue === null) {
      return {
        value: playerValue,
        isAboveAverage: false,
        isTop1Percent: false,
        color: '#D1D5DB',
        percentageDifference: 0
      };
    }
    const isAboveAverage = playerValue > leagueAverage;
    const percentageDifference = ((playerValue - leagueAverage) / leagueAverage) * 100;
    let isTop1Percent = false;
    let isBottom1Percent = false;
    if (statKey === 'turnovers') {
      isTop1Percent = playerValue <= top1PercentThreshold;
      isBottom1Percent = playerValue >= bottom1PercentThreshold;
    } else {
      isTop1Percent = playerValue >= top1PercentThreshold;
      isBottom1Percent = playerValue <= bottom1PercentThreshold;
    }
    let color: string;
    let performanceLabel: string | undefined;
    if (isTop1Percent) {
      color = '#FFD700';
      performanceLabel = 'Top 1%';
    } else if (isBottom1Percent) {
      color = '#FF6B6B';
      performanceLabel = 'Bottom 1%';
    } else if (isAboveAverage) {
      color = '#71FD08';
    } else {
      color = '#D1D5DB';
    }
    return {
      value: playerValue,
      isAboveAverage,
      isTop1Percent,
      color,
      percentageDifference,
      performanceLabel
    };
  }
  static getStatColor(statKey: keyof PlayerStats, playerValue: number, dynamicThresholds?: {
    top1?: Record<string, number>;
    bottom1?: Record<string, number>;
    leagueAvg?: Record<string, number>;
  }): string {
    const comparison = this.compareToLeagueAverage(statKey, playerValue, dynamicThresholds);
    return comparison.color;
  }
  static isTop1Percent(statKey: keyof PlayerStats, playerValue: number): boolean {
    const comparison = this.compareToLeagueAverage(statKey, playerValue);
    return comparison.isTop1Percent;
  }
  static isBottom1Percent(statKey: keyof PlayerStats, playerValue: number): boolean {
    const bottom1PercentThreshold = BOTTOM_1_PERCENT_THRESHOLDS[statKey];
    if (statKey === 'turnovers') {
      return playerValue >= bottom1PercentThreshold;
    } else {
      return playerValue <= bottom1PercentThreshold;
    }
  }
  static getPerformanceLabel(statKey: keyof PlayerStats, playerValue: number): string | undefined {
    const comparison = this.compareToLeagueAverage(statKey, playerValue);
    return comparison.performanceLabel;
  }
  static isAboveAverage(statKey: keyof PlayerStats, playerValue: number): boolean {
    const comparison = this.compareToLeagueAverage(statKey, playerValue);
    return comparison.isAboveAverage;
  }
  static getPercentageDifference(statKey: keyof PlayerStats, playerValue: number): number {
    const comparison = this.compareToLeagueAverage(statKey, playerValue);
    return comparison.percentageDifference;
  }
  static getLeagueAverage(statKey: keyof PlayerStats): number {
    try {
      const service = PlayerLeagueAveragesService.getInstance();
      return service.getLeagueAverage(statKey) || LEAGUE_AVERAGES[statKey] || 0;
    } catch (error) {
      console.warn('⚠️ Could not get dynamic league average, using fallback:', error);
      return LEAGUE_AVERAGES[statKey] || 0;
    }
  }
  static compareAllStats(playerStats: PlayerStats): Record<string, StatComparison> {
    const comparisons: Record<string, StatComparison> = {};
    Object.keys(playerStats).forEach((statKey) => {
      const key = statKey as keyof PlayerStats;
      const value = playerStats[key];
      if (value !== undefined && value !== null) {
        comparisons[statKey] = this.compareToLeagueAverage(key, value);
      }
    });
    return comparisons;
  }
  static getPerformanceIndicator(statKey: keyof PlayerStats, playerValue: number): string {
    const comparison = this.compareToLeagueAverage(statKey, playerValue);
    if (comparison.percentageDifference > 20) {
      return 'Excellent';
    } else if (comparison.percentageDifference > 10) {
      return 'Good';
    } else if (comparison.percentageDifference > 0) {
      return 'Above Average';
    } else if (comparison.percentageDifference > -10) {
      return 'Below Average';
    } else if (comparison.percentageDifference > -20) {
      return 'Poor';
    } else {
      return 'Very Poor';
    }
  }
}

export function formatPercentageDifference(percentage: number): string {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
}

// Projection Engine - Core projection calculation system
export class ProjectionEngine {
  
  /**
   * Calculate projected value for a player stat
   */
  static async calculateProjection(
    request: ProjectionRequest,
    playerStats: PlayerGameLog[],
    teamDefensiveStats: TeamDefensiveStats[],
    recentFormGames: number = 10
  ): Promise<ProjectionResult> {
    
    // Calculate all factors
    const factors = await this.calculateAllFactors(request, playerStats, teamDefensiveStats, recentFormGames);
    
    // Calculate weighted projection
    const projectedValue = this.calculateWeightedProjection(factors);
    
    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(factors, playerStats.length);
    
    // Determine risk level
    const riskLevel = this.calculateRiskLevel(factors, confidenceScore, projectedValue, request.sportsbookLine);
    
    // Calculate edge vs sportsbook line
    const edge = request.sportsbookLine ? this.calculateEdge(projectedValue, request.sportsbookLine) : 0;
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(edge, confidenceScore);
    
    return {
      projectedValue,
      confidenceScore,
      factors,
      riskLevel,
      edge,
      recommendation,
      teammateInjuries: request.teammateInjuries || []
    };
  }
  
  /**
   * Calculate all projection factors
   */
  private static async calculateAllFactors(
    request: ProjectionRequest,
    playerStats: PlayerGameLog[],
    teamDefensiveStats: TeamDefensiveStats[],
    recentFormGames: number
  ): Promise<ProjectionFactors> {
    
    const seasonAverage = this.calculateSeasonAverage(playerStats, request.statType);
    const recentForm = this.calculateRecentForm(playerStats, request.statType, recentFormGames);
    const opponentDefense = this.calculateOpponentDefense(teamDefensiveStats, request.opponent, request.statType);
    const homeAway = this.calculateHomeAwayFactor(playerStats, request.isHome, request.statType);
    const restFactor = this.calculateRestFactor(request.daysRest || 1);
    const injuryImpact = await this.calculateInjuryImpact(
      request.teammateInjuries || [], 
      request.team, 
      request.playerPosition || 'Unknown', 
      request.gameDate
    );
    const headToHead = this.calculateHeadToHeadFactor(playerStats, request.opponent, request.statType);
    // Only calculate PER factor for points projections (efficiency matters most for scoring)
    const perFactor = request.statType === 'points' 
      ? await this.calculatePERFactor(request.playerName, request.team)
      : 1.0;
    
    return {
      seasonAverage,
      recentForm,
      opponentDefense,
      homeAway,
      backToBack: 1.0, // Default to no back-to-back fatigue
      pace: 1.0, // Default to average PACE
      restFactor,
      injuryImpact,
      headToHead,
      perFactor,
      regressionFactor: 1.0, // Default regression factor
      lineupShiftMultiplier: 1.0 // Default to no lineup shift impact
    };
  }
  
  /**
   * Calculate season average for a specific stat
   */
  private static calculateSeasonAverage(playerStats: PlayerGameLog[], statType: keyof PlayerStats): number {
    if (!playerStats.length) return 0;
    
    const values = playerStats.map(game => game[statType] as number).filter(val => val !== undefined && !isNaN(val));
    if (!values.length) return 0;
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Calculate recent form (weighted average of last N games)
   */
  private static calculateRecentForm(playerStats: PlayerGameLog[], statType: keyof PlayerStats, games: number): number {
    if (!playerStats.length) return 0;
    
    // Sort by date descending and take last N games
    const recentGames = playerStats
      .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
      .slice(0, games);
    
    if (!recentGames.length) return 0;
    
    // Weight recent games more heavily (exponential decay)
    let weightedSum = 0;
    let totalWeight = 0;
    
    recentGames.forEach((game, index) => {
      const weight = Math.exp(-index * 0.3); // Exponential decay factor
      const value = game[statType] as number;
      if (value !== undefined && !isNaN(value) && value >= 0) {
        weightedSum += value * weight;
        totalWeight += weight;
      }
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Calculate opponent defensive factor
   */
  private static calculateOpponentDefense(
    teamDefensiveStats: TeamDefensiveStats[], 
    opponent: string, 
    statType: keyof PlayerStats
  ): number {
    // Convert statType to database format (e.g., 'points' -> 'points')
    const dbStatType = statType;
    
    const opponentStats = teamDefensiveStats.find(
      stats => stats.team === opponent && stats.stat_type === dbStatType
    );
    
    if (!opponentStats) {
      console.log(`⚠️ No defensive stats found for ${opponent} vs ${statType}`);
      return 1.0; // Neutral factor if no data
    }
    
    // Convert to factor (higher allowed = better for offensive player)
    let leagueAverage = LEAGUE_AVERAGES[statType];
    try {
      const service = PlayerLeagueAveragesService.getInstance();
      leagueAverage = service.getLeagueAverage(statType) || leagueAverage;
    } catch (error) {
      console.warn('⚠️ Could not get dynamic league average for opponent defense calculation:', error);
    }
    const opponentAllowed = opponentStats.overall_avg_allowed;
    
    const factor = opponentAllowed / leagueAverage;
    console.log(`🎯 ${opponent} defense factor for ${statType}: ${opponentAllowed} allowed / ${leagueAverage} avg = ${factor.toFixed(2)}`);
    
    // Factor > 1 means opponent allows more than average (good for player)
    // Factor < 1 means opponent allows less than average (bad for player)
    return factor;
  }
  
  /**
   * Calculate home/away performance factor
   */
  private static calculateHomeAwayFactor(
    playerStats: PlayerGameLog[], 
    isHome: boolean, 
    statType: keyof PlayerStats
  ): number {
    if (!playerStats.length) return 1.0;
    
    const homeGames = playerStats.filter(game => game.isHome);
    const awayGames = playerStats.filter(game => !game.isHome);
    
    if (!homeGames.length || !awayGames.length) return 1.0;
    
    const homeAvg = this.calculateSeasonAverage(homeGames, statType);
    const awayAvg = this.calculateSeasonAverage(awayGames, statType);
    
    if (awayAvg === 0) return 1.0;
    
    const homeAwayRatio = homeAvg / awayAvg;
    
    // Return factor based on whether player is home or away
    return isHome ? homeAwayRatio : 1.0 / homeAwayRatio;
  }
  
  /**
   * Calculate rest factor (fatigue/rest impact)
   */
  private static calculateRestFactor(daysRest: number): number {
    if (daysRest <= 0) return 0.8; // Back-to-back game
    if (daysRest === 1) return 0.9; // 1 day rest
    if (daysRest === 2) return 1.0; // 2 days rest (baseline)
    if (daysRest === 3) return 1.05; // 3 days rest (slight boost)
    if (daysRest >= 4) return 1.1; // 4+ days rest (good rest)
    
    return 1.0;
  }
  
  /**
   * Calculate injury impact factor
   */
  private static async calculateInjuryImpact(
    teammateInjuries: string[], 
    playerTeam: string, 
    playerPosition: string,
    gameDate: string
  ): Promise<number> {
    if (!teammateInjuries.length) return 1.0;
    
    try {
      // Import the injury impact service dynamically to avoid circular dependencies
      const { InjuryImpactService } = await import('../services/InjuryImpactService');
      
      // Calculate detailed injury impact
      const injuryImpact = await InjuryImpactService.calculateInjuryImpact(
        playerTeam, 
        gameDate, 
        playerPosition
      );
      
      return injuryImpact.factor;
      
    } catch (error) {
      console.error('Error calculating detailed injury impact, falling back to simple heuristic:', error);
      
      // Fallback to simple heuristic
      const injuryCount = teammateInjuries.length;
      
      if (injuryCount === 1) return 1.05; // Slight boost
      if (injuryCount === 2) return 1.1; // Moderate boost
      if (injuryCount >= 3) return 1.15; // Significant boost
      
      return 1.0;
    }
  }
  
  /**
   * Calculate head-to-head performance factor
   */
  private static calculateHeadToHeadFactor(
    playerStats: PlayerGameLog[], 
    opponent: string, 
    statType: keyof PlayerStats
  ): number {
    if (!playerStats.length) return 1.0;
    
    const headToHeadGames = playerStats.filter(game => game.opponent === opponent);
    
    if (headToHeadGames.length < 2) return 1.0; // Need multiple games for reliable data
    
    const headToHeadAvg = this.calculateSeasonAverage(headToHeadGames, statType);
    const overallAvg = this.calculateSeasonAverage(playerStats, statType);
    
    if (overallAvg === 0) return 1.0;
    
    return headToHeadAvg / overallAvg;
  }
  

  
  /**
   * Calculate weighted projection from all factors
   */
  private static calculateWeightedProjection(factors: ProjectionFactors): number {
    const baseValue = factors.seasonAverage;
    
    // Handle edge case where base value is 0
    if (baseValue === 0) {
      return 0;
    }
    
    let weightedProjection = baseValue;
    
    // Apply each factor with its weight, handling division by zero
    if (factors.recentForm > 0) {
      weightedProjection *= Math.pow(factors.recentForm / baseValue, PROJECTION_WEIGHTS.recentForm);
    }
    weightedProjection *= Math.pow(factors.opponentDefense, PROJECTION_WEIGHTS.opponentDefense);
    weightedProjection *= Math.pow(factors.homeAway, PROJECTION_WEIGHTS.homeAway);
    weightedProjection *= Math.pow(factors.restFactor, PROJECTION_WEIGHTS.restFactor);
    weightedProjection *= Math.pow(factors.injuryImpact, PROJECTION_WEIGHTS.injuryImpact);
    weightedProjection *= Math.pow(factors.headToHead, PROJECTION_WEIGHTS.headToHead);
    weightedProjection *= Math.pow(factors.perFactor, PROJECTION_WEIGHTS.perFactor);
    
    return Math.round(weightedProjection * 100) / 100; // Round to 2 decimal places
  }
  
  /**
   * Calculate confidence score (0-1)
   */
  private static calculateConfidenceScore(factors: ProjectionFactors, dataPoints: number): number {
    let confidence = 0.5; // Base confidence
    
    // Data quality factor
    if (dataPoints >= 20) confidence += 0.2;
    else if (dataPoints >= 10) confidence += 0.1;
    else if (dataPoints < 5) confidence -= 0.2;
    
    // Factor consistency (how close factors are to 1.0)
    const factorValues = Object.values(factors);
    const factorVariance = factorValues.reduce((sum, val) => sum + Math.abs(val - 1.0), 0) / factorValues.length;
    
    if (factorVariance < 0.1) confidence += 0.15; // Very consistent factors
    else if (factorVariance < 0.2) confidence += 0.1; // Consistent factors
    else if (factorVariance > 0.4) confidence -= 0.1; // High variance factors
    
    // Recent form stability
    if (factors.recentForm > 0 && factors.seasonAverage > 0) {
      const formRatio = factors.recentForm / factors.seasonAverage;
      if (formRatio > 0.8 && formRatio < 1.2) confidence += 0.1; // Stable recent form
      else if (formRatio < 0.6 || formRatio > 1.4) confidence -= 0.1; // Volatile recent form
    }
    
    return Math.max(0, Math.min(1, confidence)); // Clamp between 0 and 1
  }
  
  /**
   * Calculate risk level based on confidence and sportsbook line proximity
   */
  private static calculateRiskLevel(factors: ProjectionFactors, confidenceScore: number, projectedValue?: number, sportsbookLine?: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    let riskScore = 0;
    
    // Base risk from confidence score (weight: 4) - Primary factor
    if (confidenceScore >= 0.8) riskScore = 0;
    else if (confidenceScore >= 0.6) riskScore = 2;
    else riskScore = 4;
    
    // Sportsbook line proximity risk (weight: 1-2) - Additional factor, not overriding
    if (projectedValue && sportsbookLine) {
      const difference = Math.abs(projectedValue - sportsbookLine);
      
      // If projection is within 0.5 of the line, add moderate risk
      if (difference <= 0.5) {
        riskScore += 2; // Moderate risk boost
      }
      // If projection is within 1.0 of the line, add small risk
      else if (difference <= 1.0) {
        riskScore += 1; // Small risk boost
      }
      // If projection is within 1.5 of the line, add minimal risk
      else if (difference <= 1.5) {
        riskScore += 0.5; // Minimal risk boost
      }
    }
    
    if (riskScore >= 5) return 'HIGH';
    else if (riskScore >= 3) return 'MEDIUM';
    else return 'LOW';
  }
  
  /**
   * Calculate edge vs sportsbook line
   */
  private static calculateEdge(projectedValue: number, sportsbookLine: number): number {
    return projectedValue - sportsbookLine;
  }
  
  /**
   * Generate betting recommendation
   */
  private static generateRecommendation(edge: number, confidenceScore: number): 'OVER' | 'UNDER' | 'PASS' {
    if (confidenceScore < 0.5) return 'PASS'; // Not confident enough
    
    const edgeThreshold = 1.0; // Minimum edge to make recommendation - more conservative
    
    if (edge > edgeThreshold) return 'OVER';
    if (edge < -edgeThreshold) return 'UNDER';
    
    return 'PASS'; // Edge too small
  }

  // Advanced Analytics Methods
  
  /**
   * Calculate linear regression trend for recent performance
   */
  static calculateTrendAnalysis(
    playerStats: PlayerGameLog[], 
    statType: keyof PlayerStats, 
    games: number = 10
  ): { slope: number; rSquared: number; trend: 'INCREASING' | 'DECREASING' | 'STABLE' } {
    if (playerStats.length < 3) {
      return { slope: 0, rSquared: 0, trend: 'STABLE' };
    }

    // Sort by date and take last N games
    const recentGames = playerStats
      .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())
      .slice(-games);

    const values = recentGames.map(game => game[statType] as number).filter(val => val !== undefined && !isNaN(val));
    if (values.length < 3) {
      return { slope: 0, rSquared: 0, trend: 'STABLE' };
    }

    // Simple linear regression
    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    
    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = values.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssRes = values.reduce((sum, y, i) => {
      const predicted = slope * xValues[i] + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const ssTot = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
    
    // Determine trend
    let trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    if (Math.abs(slope) < 0.1) {
      trend = 'STABLE';
    } else if (slope > 0) {
      trend = 'INCREASING';
    } else {
      trend = 'DECREASING';
    }
    
    return { slope, rSquared, trend };
  }
  
  /**
   * Calculate moving averages with different windows
   */
  static calculateMovingAverages(
    playerStats: PlayerGameLog[], 
    statType: keyof PlayerStats
  ): { 
    threeGame: number; 
    fiveGame: number; 
    tenGame: number; 
    twentyGame: number 
  } {
    if (!playerStats.length) {
      return { threeGame: 0, fiveGame: 0, tenGame: 0, twentyGame: 0 };
    }

    // Sort by date descending (most recent first)
    const sortedStats = playerStats
      .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime());

    const values = sortedStats.map(game => game[statType] as number).filter(val => val !== undefined && !isNaN(val));
    
    const calculateMA = (window: number) => {
      if (values.length < window) return 0;
      const windowValues = values.slice(0, window);
      return windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length;
    };

    return {
      threeGame: calculateMA(3),
      fiveGame: calculateMA(5),
      tenGame: calculateMA(10),
      twentyGame: calculateMA(20)
    };
  }
  
  /**
   * Calculate performance volatility (standard deviation)
   */
  static calculateVolatility(
    playerStats: PlayerGameLog[], 
    statType: keyof PlayerStats
  ): number {
    if (playerStats.length < 2) return 0;
    
    const values = playerStats.map(game => game[statType] as number).filter(val => val !== undefined && !isNaN(val));
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Calculate consistency score (0-1, higher = more consistent)
   */
  static calculateConsistencyScore(
    playerStats: PlayerGameLog[], 
    statType: keyof PlayerStats
  ): number {
    if (playerStats.length < 5) return 0.5; // Not enough data
    
    const volatility = this.calculateVolatility(playerStats, statType);
    const mean = this.calculateSeasonAverage(playerStats, statType);
    
    if (mean === 0) return 0.5;
    
    // Coefficient of variation (lower = more consistent)
    const cv = volatility / mean;
    
    // Convert to 0-1 scale where 1 = most consistent
    // CV of 0.1 = very consistent, CV of 0.5 = inconsistent
    const consistency = Math.max(0, 1 - (cv * 2));
    
    return Math.min(1, consistency);
  }
  
  /**
   * Calculate momentum score based on recent vs overall performance
   */
  static calculateMomentumScore(
    playerStats: PlayerGameLog[], 
    statType: keyof PlayerStats,
    recentGames: number = 5
  ): number {
    if (playerStats.length < recentGames + 5) return 0.5; // Need more data
    
    const recentAvg = this.calculateRecentForm(playerStats, statType, recentGames);
    const overallAvg = this.calculateSeasonAverage(playerStats, statType);
    
    if (overallAvg === 0) return 0.5;
    
    const ratio = recentAvg / overallAvg;
    
    // Convert to 0-1 scale where 0.5 = no momentum
    if (ratio >= 1.2) return 0.9; // Strong positive momentum
    if (ratio >= 1.1) return 0.8; // Positive momentum
    if (ratio >= 1.0) return 0.6; // Slight positive momentum
    if (ratio >= 0.9) return 0.4; // Slight negative momentum
    if (ratio >= 0.8) return 0.2; // Negative momentum
    return 0.1; // Strong negative momentum
  }
  
  /**
   * Calculate matchup strength score
   */
  static calculateMatchupStrength(
    playerStats: PlayerGameLog[],
    opponent: string,
    statType: keyof PlayerStats
  ): number {
    const headToHeadGames = playerStats.filter(game => game.opponent === opponent);
    
    if (headToHeadGames.length < 2) return 0.5; // Not enough head-to-head data
    
    const headToHeadAvg = this.calculateSeasonAverage(headToHeadGames, statType);
    const overallAvg = this.calculateSeasonAverage(playerStats, statType);
    
    if (overallAvg === 0) return 0.5;
    
    const ratio = headToHeadAvg / overallAvg;
    
    // Convert to 0-1 scale where 0.5 = neutral matchup
    if (ratio >= 1.3) return 0.9; // Very favorable matchup
    if (ratio >= 1.15) return 0.8; // Favorable matchup
    if (ratio >= 1.05) return 0.7; // Slightly favorable
    if (ratio >= 0.95) return 0.5; // Neutral matchup
    if (ratio >= 0.85) return 0.3; // Slightly unfavorable
    if (ratio >= 0.7) return 0.2; // Unfavorable matchup
    return 0.1; // Very unfavorable matchup
  }
  
  /**
   * Enhanced confidence scoring with advanced metrics
   */
  static calculateEnhancedConfidence(
    factors: ProjectionFactors,
    playerStats: PlayerGameLog[],
    statType: keyof PlayerStats
  ): number {
    let confidence = this.calculateConfidenceScore(factors, playerStats.length);
    
    // Add consistency factor
    const consistency = this.calculateConsistencyScore(playerStats, statType);
    confidence += (consistency - 0.5) * 0.1; // ±0.05 impact
    
    // Add momentum factor
    const momentum = this.calculateMomentumScore(playerStats, statType);
    confidence += (momentum - 0.5) * 0.08; // ±0.04 impact
    
    // Add trend analysis
    const trend = this.calculateTrendAnalysis(playerStats, statType);
    if (trend.rSquared > 0.7) {
      confidence += 0.05; // Strong trend
    } else if (trend.rSquared < 0.3) {
      confidence -= 0.05; // Weak trend
    }
    
    // Add volatility factor
    const volatility = this.calculateVolatility(playerStats, statType);
    const mean = this.calculateSeasonAverage(playerStats, statType);
    if (mean > 0) {
      const cv = volatility / mean;
      if (cv < 0.2) confidence += 0.05; // Low volatility
      else if (cv > 0.5) confidence -= 0.05; // High volatility
    }
    
    return Math.max(0, Math.min(1, confidence)); // Clamp between 0 and 1
  }

  /**
   * Calculate PER factor for points projections only
   * Only gives a slight boost for very high PER players (tough to achieve)
   * PER measures scoring efficiency, so only relevant for points projections
   */
  private static async calculatePERFactor(playerName: string, team: string): Promise<number> {
    try {
      // Import Supabase client dynamically to avoid circular dependencies
      const { createClient } = await import('@supabase/supabase-js');
      
      // Get environment variables
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.warn('⚠️ Missing Supabase credentials for PER factor calculation');
        return 1.0; // No boost if we can't access database
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Query player's advanced stats for PER
      const { data, error } = await supabase
        .from('player_advanced_stats')
        .select('per')
        .eq('player_name', playerName)
        .eq('team', team)
        .eq('season', '2025')
        .single();
      
      if (error || !data || !data.per) {
        console.log(`📊 No PER data found for ${playerName} (${team})`);
        return 1.0; // No boost if no PER data
      }
      
      const per = data.per;
      console.log(`📊 ${playerName} PER: ${per}`);
      
      // PER thresholds based on real 2025 season data (max PER: 32.4, min PER: -18.3)
      // Only give boosts, no penalties - keep it simple and tough to achieve
      
      if (per >= 32.0) {
        // Superstar level - very rare (only top 1-2 players)
        console.log(`🌟 ${playerName} has SUPERSTAR PER (${per}) - applying 1.5% boost`);
        return 1.015;
      } else if (per >= 28.0) {
        // Elite level - rare (top 5-10 players)
        console.log(`⭐ ${playerName} has ELITE PER (${per}) - applying 1.2% boost`);
        return 1.012;
      } else if (per >= 22.0) {
        // Above average - uncommon (top 20-30 players)
        console.log(`✨ ${playerName} has ABOVE AVERAGE PER (${per}) - applying 0.8% boost`);
        return 1.008;
      } else {
        // Good or below - no boost (most players)
        console.log(`📊 ${playerName} has PER ${per} - no boost applied`);
        return 1.0;
      }
      
    } catch (error) {
      console.warn(`⚠️ Error calculating PER factor for ${playerName}:`, error);
      return 1.0; // No boost on error
    }
  }
} 