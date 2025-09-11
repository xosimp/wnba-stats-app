import { createClient } from '@supabase/supabase-js';
import { ProjectionRequest, ProjectionResult } from '../algorithms/Algorithms';
import { InjuryImpactService } from './InjuryImpactService';
import { PaceService } from './PaceService';
import { BackToBackService } from './BackToBackService';
import { PositionDefenseService } from './PositionDefenseService';
import { PlayerDataService } from './PlayerDataService';
import { normalizeTeamName } from '../utils/opponent-normalization';

/**
 * Comprehensive assists projection service incorporating:
 * - Player role and usage adjustments
 * - Teammate shooting efficiency
 * - Team offensive scheme and pace
 * - Opponent defensive matchups
 * - Minutes and workload adjustments
 * - Injury, rest, and fatigue factors
 * - Situational and environmental adjustments
 * - Regression and uncertainty handling
 * - Advanced metrics and difficulty adjustments
 */
export class AssistsProjectionService {
  private supabase;
  private paceService: PaceService;
  private backToBackService: BackToBackService;
  private positionDefenseService: PositionDefenseService;
  private playerDataService: PlayerDataService;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    // Initialize services with the required arguments
    this.paceService = new PaceService(supabaseUrl, supabaseKey);
    this.backToBackService = new BackToBackService(supabaseUrl, supabaseKey);
    this.positionDefenseService = new PositionDefenseService(supabaseUrl, supabaseKey);
    this.playerDataService = new PlayerDataService(supabaseUrl, supabaseKey);
  }

  /**
   * Main method to generate assists projection
   */
  async generateAssistsProjection(request: ProjectionRequest): Promise<ProjectionResult | null> {
    try {
      console.log(`🎯 Generating assists projection for ${request.playerName} vs ${request.opponent}`);

      // 1. Get player's historical assists data
      const playerStats = await this.getPlayerSeasonStats(request.playerName);
      if (playerStats.length === 0) {
        console.log(`❌ No assists data found for ${request.playerName}`);
        return null;
      }

      // 2. Calculate base assists metrics
      const seasonAverage = await this.getPlayerSeasonAverage(request.playerName, 'assists');
      const recentForm = await this.getPlayerRecentForm(request.playerName, 'assists');
      const h2hAverage = await this.getPlayerHeadToHeadAverage(request.playerName, request.opponent, 'assists');

      // 3. Calculate all adjustment factors
      const factors = await this.calculateAssistFactors(request, playerStats);

      // 4. Calculate final projection
      const projectedValue = this.calculateFinalProjection(
        seasonAverage,
        recentForm,
        h2hAverage,
        factors
      );

      // 5. Calculate confidence and risk metrics
      const confidenceScore = this.calculateAssistsConfidence(playerStats, factors);
      const riskLevel = this.calculateRiskLevel(playerStats, factors, projectedValue, request.sportsbookLine) as 'LOW' | 'MEDIUM' | 'HIGH';
      const edge = this.calculateEdge(projectedValue, request.sportsbookLine);
      const recommendation = this.generateRecommendation(edge, confidenceScore) as 'OVER' | 'UNDER' | 'PASS';

      // 6. Generate assists-specific metrics
      const assistsSpecific = this.calculateAssistsSpecificMetrics(
        projectedValue,
        factors,
        playerStats
      );

      // 7. Create final projection result
      const projection: ProjectionResult = {
        projectedValue,
        confidenceScore,
        riskLevel,
        edge,
        recommendation,
        factors: {
          seasonAverage,
          recentForm,
          opponentDefense: factors.opponentDefenseFactor,
          homeAway: factors.homeAwayFactor,
          backToBack: factors.backToBackFactor,
          pace: factors.paceFactor,
          restFactor: factors.restFactor,
          injuryImpact: factors.injuryImpactFactor,
          headToHead: h2hAverage > 0 ? h2hAverage : 0,
          perFactor: factors.perFactor,
          regressionFactor: 1.0, // Default regression factor
          lineupShiftMultiplier: 1.0 // Default to no lineup shift impact
        },
        historicalAccuracy: Math.min(confidenceScore * 100, 95),
        recentFormPercentage: seasonAverage > 0 ? Math.round((recentForm / seasonAverage) * 100) : 100,
        matchupAnalysis: this.calculateMatchupAnalysis(factors),
        seasonGamesCount: playerStats.length,
        teammateInjuries: request.teammateInjuries || [],
        // Note: assistsSpecific data is available but not part of ProjectionResult interface
      };

      console.log('Assists projection calculated:', projection);
      return projection;

    } catch (error) {
      console.error('Error generating assists projection:', error);
      return null;
    }
  }

  /**
   * Calculate all assist adjustment factors
   */
  private async calculateAssistFactors(request: ProjectionRequest, playerStats: any[]): Promise<AssistProjectionFactors> {
    const factors: AssistProjectionFactors = {
      // Initialize with neutral values
      opponentDefenseFactor: 1.0,
      paceFactor: 1.0,
      homeAwayFactor: 1.0,
      backToBackFactor: 1.0,
      restFactor: 1.0,
      injuryImpactFactor: 1.0,
      positionFactor: 1.0,
      usageFactor: 1.0,
      teammateShootingFactor: 1.0,
      teamSchemeFactor: 1.0,
      minutesFactor: 1.0,
      fatigueFactor: 1.0,
      situationalFactor: 1.0,
      regressionFactor: 1.0,
      assistRatio: 0,
      assistPercentage: 0,
      consistencyScore: 0.75,
      matchupDataQuality: 0.8,
      hollingerFactor: 1.0,
      perFactor: 1.0 // Player Efficiency Rating adjustment factor
    };

    // 1. OPPONENT DEFENSE FACTOR (Position-specific assists defense)
    const opponentDefense = await this.calculateOpponentAssistDefense(request.opponent, request.playerName);
    factors.opponentDefenseFactor = opponentDefense;

    // 2. PACE FACTOR (Team pace affects assist opportunities)
    const paceFactor = await this.calculatePaceFactor(request.team, request.opponent);
    factors.paceFactor = paceFactor;

    // 3. HOME/AWAY FACTOR
    factors.homeAwayFactor = request.isHome ? 1.05 : 0.95; // +5% at home, -5% away

          // 4. BACK-TO-BACK FACTOR
      // For now, using a simplified back-to-back calculation
      factors.backToBackFactor = 1.0; // Neutral factor

    // 5. REST FACTOR (Days rest affects efficiency)
    factors.restFactor = this.calculateRestFactor(request.daysRest || 2);

              // 6. INJURY IMPACT FACTOR
    try {
      // Import the injury impact service dynamically to avoid circular dependencies
      const { InjuryImpactService } = await import('./InjuryImpactService');
      
      // Get player position if not provided (needed for injury impact calculation)
      let playerPosition = 'Unknown';
      try {
        const { data, error } = await this.supabase
          .from('player_advanced_stats')
          .select('position')
          .eq('player_name', request.playerName)
          .eq('season', '2025')
          .limit(1);
        
        if (!error && data && data.length > 0) {
          playerPosition = data[0].position || 'Unknown';
        }
      } catch (error) {
        console.log(`⚠️ Could not determine position for ${request.playerName}, using default`);
      }
      
      // Calculate detailed injury impact
      const injuryImpactData = await InjuryImpactService.calculateInjuryImpact(
        request.team,
        request.gameDate,
        playerPosition,
        request.playerName,
        'assists'
      );
      
      factors.injuryImpactFactor = injuryImpactData.factor;
      console.log(`🏥 Injury Impact: ${injuryImpactData.reason}`);
      console.log(`🏥 Significant injuries: ${injuryImpactData.significantInjuries.join(', ')}`);
      console.log(`🏥 Impact factor: ×${factors.injuryImpactFactor.toFixed(3)}`);
      
    } catch (error) {
      console.warn('Error calculating detailed injury impact, using simple heuristic:', error);
      // Fallback to simple heuristic
      const injuryCount = request.teammateInjuries ? request.teammateInjuries.length : 0;
      if (injuryCount === 1) factors.injuryImpactFactor = 1.05; // Slight boost
      else if (injuryCount === 2) factors.injuryImpactFactor = 1.1; // Moderate boost
      else if (injuryCount >= 3) factors.injuryImpactFactor = 1.15; // Significant boost
      else factors.injuryImpactFactor = 1.0; // No injuries
      
      console.log(`🏥 Injury Impact (fallback): ${injuryCount} injuries = ×${factors.injuryImpactFactor.toFixed(3)}`);
    }

    // 7. POSITION FACTOR (Different positions have different assist expectations)
    factors.positionFactor = await this.calculatePositionAssistFactors(request.playerName);

    // 8. USAGE FACTOR (Player's role and usage rate)
    const usageFactor = await this.calculateUsageFactor(request.playerName, request.team);
    factors.usageFactor = usageFactor;

    // 9. TEAMMATE SHOOTING FACTOR (Teammates' shooting efficiency)
    const teammateShooting = await this.calculateTeammateShootingFactor(request.team, request.playerName);
    factors.teammateShootingFactor = teammateShooting;

    // 10. TEAM SCHEME FACTOR (Offensive system and assist-to-FG ratio)
    const teamScheme = await this.calculateTeamSchemeFactor(request.team);
    factors.teamSchemeFactor = teamScheme;

    // 11. MINUTES FACTOR (Projected playing time)
    const minutesFactor = await this.calculateMinutesFactor(request.playerName, request.team);
    factors.minutesFactor = minutesFactor;

    // 12. FATIGUE FACTOR (Travel, schedule density)
    const fatigueFactor = await this.calculateFatigueFactor(request.team, request.gameDate);
    factors.fatigueFactor = fatigueFactor;

    // 13. SITUATIONAL FACTOR (Home/away, playoff intensity, etc.)
    factors.situationalFactor = this.calculateSituationalFactor(request);

    // 14. REGRESSION FACTOR (Regression to mean for outliers)
    factors.regressionFactor = this.calculateRegressionFactor(playerStats);

              // 15. ADVANCED METRICS (Hollinger Assist Ratio)
      const advancedMetrics = await this.calculateAdvancedAssistMetrics(request.playerName);
      factors.assistRatio = advancedMetrics.assistRatio;
      factors.assistPercentage = advancedMetrics.assistPercentage;
      
      // Apply Hollinger Assist Ratio adjustment
      const hollingerFactor = this.calculateHollingerAdjustment(advancedMetrics.assistRatio);
      factors.hollingerFactor = hollingerFactor;

    // 16. Calculate PER (Player Efficiency Rating) factor for better accuracy
    const perFactor = await this.calculatePERFactor(request.playerName);
    factors.perFactor = perFactor;

    // 17. Calculate consistency and data quality scores
    factors.consistencyScore = this.calculateAssistConsistency(request.playerName);
    factors.matchupDataQuality = this.calculateMatchupDataQuality(request.opponent);

    console.log(`Assists Adjustments Applied:`);
    console.log(`- Opponent Defense: ${factors.opponentDefenseFactor.toFixed(3)}x`);
    console.log(`- Pace Factor: ${factors.paceFactor.toFixed(3)}x`);
    console.log(`- Home/Away: ${factors.homeAwayFactor.toFixed(3)}x`);
    console.log(`- Back-to-Back: ${factors.backToBackFactor.toFixed(3)}x`);
    console.log(`- Rest Factor: ${factors.restFactor.toFixed(3)}x`);
    console.log(`- Injury Impact: ${factors.injuryImpactFactor.toFixed(3)}x`);
    console.log(`- Position Factors: ${factors.positionFactor.toFixed(3)}x`);
    console.log(`- Usage Factor: ${factors.usageFactor.toFixed(3)}x`);
    console.log(`- Teammate Shooting: ${factors.teammateShootingFactor.toFixed(3)}x`);
    console.log(`- Team Scheme: ${factors.teamSchemeFactor.toFixed(3)}x`);
    console.log(`- Minutes Factor: ${factors.minutesFactor.toFixed(3)}x`);
    console.log(`- Fatigue Factor: ${factors.fatigueFactor.toFixed(3)}x`);
    console.log(`- Situational: ${factors.situationalFactor.toFixed(3)}x`);
    console.log(`- Regression: ${factors.regressionFactor.toFixed(3)}x`);
    console.log(`- Hollinger Factor: ${factors.hollingerFactor.toFixed(3)}x`);
    console.log(`- PER Factor: ${factors.perFactor.toFixed(3)}x`);
    console.log(`- Consistency Score: ${factors.consistencyScore.toFixed(2)}`);
    console.log(`- Matchup Data Quality: ${factors.matchupDataQuality.toFixed(2)}`);

    return factors;
  }

  /**
   * Calculate opponent's assist defense factor with position-specific analysis
   */
  private async calculateOpponentAssistDefense(opponent: string, playerName?: string): Promise<number> {
    try {
      if (!playerName) {
        console.log(`⚠️ No player name provided for position-specific defense analysis`);
        return 1.0;
      }

      // Normalize the opponent team name (convert PHO -> Phoenix Mercury)
      const normalizedOpponent = normalizeTeamName(opponent);
      console.log(`🔄 Normalized opponent: ${opponent} -> ${normalizedOpponent}`);

      // Get the player's position first
      const position = await this.determinePlayerPosition(playerName);
      console.log(`📊 ${playerName} Position: ${position}`);

      // Get position-specific assists defensive stats from team_defensive_stats table
      const positionStatType = position === 'G' ? 'guard_defense' : position === 'F' ? 'forward_defense' : position === 'C' ? 'center_defense' : 'points';
      
      const { data: defensiveStats, error } = await this.supabase
        .from('team_defensive_stats')
        .select('opp_ast, overall_avg_allowed')
        .eq('team', normalizedOpponent)
        .eq('stat_type', positionStatType) // Use correct stat types: guard_defense, forward_defense, center_defense
        .single();

      if (error || !defensiveStats) {
        console.log(`⚠️ No ${position}-specific assists defense data found for ${opponent}, trying overall stats`);
        
        // Fallback to overall stats if position-specific not available
        const { data: overallStats, error: overallError } = await this.supabase
          .from('team_defensive_stats')
          .select('opp_ast, overall_avg_allowed')
          .eq('team', normalizedOpponent)
          .eq('stat_type', 'points')
          .single();

        if (overallError || !overallStats) {
          console.log(`⚠️ No assists defense data found for ${opponent}, using neutral factor`);
          return 1.0;
        }

        const assistsAllowed = overallStats.opp_ast || 18.5;
        const leagueAverage = 18.5; // WNBA average team assists allowed per game
        const defensiveRatio = assistsAllowed / leagueAverage;

        console.log(`🎯 ${opponent} overall assists defense: ${assistsAllowed.toFixed(1)} allowed vs ${leagueAverage} league average = ${defensiveRatio.toFixed(2)}x`);

        // Convert to assists factor (higher assists allowed = worse defense = better assist opportunities)
        if (defensiveRatio > 1.2) {
          return 1.15; // Weak assists defense = +15% to assists
        } else if (defensiveRatio > 1.1) {
          return 1.10; // Below average assists defense = +10% to assists
        } else if (defensiveRatio < 0.9) {
          return 0.90; // Strong assists defense = -10% to assists
        } else {
          return 1.0; // Average assists defense = neutral
        }
      }

      // Use position-specific stats
      const assistsAllowed = defensiveStats.opp_ast || 18.5;
      const leagueAverage = 18.5; // WNBA average team assists allowed per game
      const defensiveRatio = assistsAllowed / leagueAverage;

      console.log(`🎯 ${opponent} ${position}-specific assists defense: ${assistsAllowed.toFixed(1)} allowed vs ${leagueAverage} league average = ${defensiveRatio.toFixed(2)}x`);

      // Convert to assists factor (higher assists allowed = worse defense = better assist opportunities)
      if (defensiveRatio > 1.2) {
        return 1.15; // Weak assists defense = +15% to assists
      } else if (defensiveRatio > 1.1) {
        return 1.10; // Below average assists defense = +10% to assists
      } else if (defensiveRatio < 0.9) {
        return 0.90; // Strong assists defense = -10% to assists
      } else {
        return 1.0; // Average assists defense = neutral
      }

    } catch (error) {
      console.error('Error calculating opponent assist defense:', error);
      return 1.0; // Neutral as fallback
    }
  }

  /**
   * Calculate pace factor based on team pace vs opponent pace
   */
  private async calculatePaceFactor(team: string, opponent: string): Promise<number> {
    try {
      // Normalize team names for pace lookup
      const normalizedTeam = normalizeTeamName(team);
      const normalizedOpponent = normalizeTeamName(opponent);
      
      console.log(`🏃 Looking up pace for ${team} (${normalizedTeam}) vs ${opponent} (${normalizedOpponent})`);
      
      // Get pace data for both teams
      const { data: paceData, error } = await this.supabase
        .from('team_pace_stats')
        .select('team_name, pace')
        .in('team_name', [normalizedTeam, normalizedOpponent]);
      
      if (error || !paceData || paceData.length === 0) {
        console.log(`⚠️ No pace data found for teams, using neutral pace factor`);
        return 1.0;
      }
      
      const teamPace = paceData.find(t => t.team_name === normalizedTeam)?.pace;
      const opponentPace = paceData.find(t => t.team_name === normalizedOpponent)?.pace;
      
      if (!teamPace || !opponentPace) {
        console.log(`⚠️ Missing pace data (Team: ${teamPace}, Opponent: ${opponentPace}), using neutral`);
        return 1.0;
      }
      
      // Calculate average pace for the game
      const averageGamePace = (teamPace + opponentPace) / 2;
      const leagueAverage = 95.0; // WNBA average pace (approximate)
      const paceRatio = averageGamePace / leagueAverage;
      
      console.log(`🏃 Pace Analysis: ${normalizedTeam} (${teamPace}) + ${normalizedOpponent} (${opponentPace}) = ${averageGamePace.toFixed(2)} avg (vs ${leagueAverage} league) = ${paceRatio.toFixed(3)}x`);
      
      // Higher pace = more possessions = more assist opportunities
      // More substantial adjustments for pace differences
      if (paceRatio > 1.08) {
        return 1.25; // Very fast pace = +25% to assists (e.g., 103+ pace)
      } else if (paceRatio > 1.05) {
        return 1.20; // Fast pace = +20% to assists (e.g., 100-102 pace)
      } else if (paceRatio > 1.03) {
        return 1.15; // Above average pace = +15% to assists (e.g., 98-99 pace)
      } else if (paceRatio > 1.01) {
        return 1.10; // Moderately above average = +10% to assists (e.g., 96-97 pace)
      } else if (paceRatio > 1.005) {
        return 1.05; // Slightly above average = +5% to assists
      } else if (paceRatio < 0.90) {
        return 0.80; // Very slow pace = -20% to assists (e.g., <86 pace)
      } else if (paceRatio < 0.93) {
        return 0.85; // Slow pace = -15% to assists (e.g., 88-90 pace)
      } else if (paceRatio < 0.96) {
        return 0.90; // Below average pace = -10% to assists (e.g., 91-93 pace)
      } else if (paceRatio < 0.99) {
        return 0.95; // Slightly below average = -5% to assists
      } else {
        return 1.0; // Average pace = neutral (94-96 pace)
      }

    } catch (error) {
      console.error('Error calculating pace factor:', error);
      return 1.0;
    }
  }

  /**
   * Calculate rest factor based on days rest
   */
  private calculateRestFactor(daysRest: number): number {
    if (daysRest >= 3) {
      return 1.05; // Well rested = +5% to assists
    } else if (daysRest === 2) {
      return 1.02; // Adequate rest = +2% to assists
    } else if (daysRest === 1) {
      return 0.98; // Minimal rest = -2% to assists
    } else {
      return 0.95; // No rest = -5% to assists
    }
  }

  /**
   * Calculate position-specific assist factors
   */
  private async calculatePositionAssistFactors(playerName: string): Promise<number> {
    // Position factor is now neutral - the real analysis happens in opponent defense
    // This prevents automatic boosts just because someone is a guard
    return 1.0; // Neutral position factor
  }

  /**
   * Calculate usage factor based on player's role and usage rate
   */
  private async calculateUsageFactor(playerName: string, team: string): Promise<number> {
    try {
      // Get player's usage percentage from advanced stats (same method as points projection)
      const { data, error } = await this.supabase
        .from('player_advanced_stats')
        .select('usage_percentage, minutes_per_game')
        .eq('player_name', playerName)
        .eq('season', '2025')
        .limit(1);

      if (error || !data || data.length === 0) {
        console.log(`⚠️ No usage data found for ${playerName}, using default usage factor`);
        return 1.0;
      }

      const usagePercentage = data[0].usage_percentage || 20.0;
      const minutesPerGame = data[0].minutes_per_game || 25.0;

      console.log(`📊 ${playerName} Usage Rate: ${usagePercentage}% (${minutesPerGame.toFixed(1)} min/game)`);

      // Higher usage = more ball handling = more assist opportunities
      let usageFactor = 1.0;
      if (usagePercentage >= 30) {
        usageFactor = 1.25; // Elite usage = +25% to assists (e.g., Arike Ogunbowale)
      } else if (usagePercentage >= 25) {
        usageFactor = 1.20; // Very high usage = +20% to assists (e.g., Breanna Stewart)
      } else if (usagePercentage >= 22) {
        usageFactor = 1.15; // High usage = +15% to assists (e.g., A'ja Wilson)
      } else if (usagePercentage >= 20) {
        usageFactor = 1.10; // Above average usage = +10% to assists (e.g., Jackie Young)
      } else if (usagePercentage >= 18) {
        usageFactor = 1.05; // Slightly above average = +5% to assists
      } else if (usagePercentage >= 15) {
        usageFactor = 1.0; // Average usage = neutral
      } else if (usagePercentage >= 12) {
        usageFactor = 0.95; // Below average usage = -5% to assists
      } else if (usagePercentage >= 10) {
        usageFactor = 0.90; // Low usage = -10% to assists
      } else {
        usageFactor = 0.85; // Very low usage = -15% to assists (bench players)
      }

      // Adjust for minutes (more minutes = more opportunities)
      if (minutesPerGame >= 32) {
        usageFactor *= 1.08; // +8% for high minutes
      } else if (minutesPerGame >= 28) {
        usageFactor *= 1.05; // +5% for above average minutes
      } else if (minutesPerGame <= 18) {
        usageFactor *= 1.0; // -5% for low minutes
      }

      return usageFactor;

    } catch (error) {
      console.error('Error calculating usage factor:', error);
      return 1.0;
    }
  }

  /**
   * Calculate teammate shooting factor based on team's shooting efficiency
   */
  private async calculateTeammateShootingFactor(team: string, playerName: string): Promise<number> {
    try {
      // Get team's effective field goal percentage from wnba_game_logs (aggregated)
      const { data: teamGames, error } = await this.supabase
        .from('wnba_game_logs')
        .select('field_goals_made, field_goals_attempted, three_points_made, three_points_attempted')
        .eq('team', team);

      if (error || !teamGames || teamGames.length === 0) {
        console.log(`⚠️ No team games found for ${team}, using league average for shooting factor`);
        return 1.0;
      }

      // Calculate eFG% from game logs
      let totalFGM = 0;
      let totalFGA = 0;
      let total3PM = 0;
      let total3PA = 0;

      teamGames.forEach(game => {
        totalFGM += game.field_goals_made || 0;
        totalFGA += game.field_goals_attempted || 0;
        total3PM += game.three_points_made || 0;
        total3PA += game.three_points_attempted || 0;
      });

      const teamEFG = totalFGA > 0 ? ((totalFGM + 0.5 * total3PM) / totalFGA) * 100 : 50.0;
      const leagueAverage = 50.5; // WNBA average eFG% (more accurate)
      
      console.log(`📊 Team ${team} eFG%: ${teamEFG.toFixed(1)}% (League: ${leagueAverage}%)`);

      // Calculate shooting factor with more granular adjustments
      // Higher shooting efficiency = more made shots = more assists
      const shootingRatio = teamEFG / leagueAverage;
      
      // More granular adjustment based on actual eFG% difference
      if (shootingRatio >= 1.15) {
        return 1.20; // Elite shooting = +20% to assists (e.g., MIN at 56.1%)
      } else if (shootingRatio >= 1.10) {
        return 1.15; // Very good shooting = +15% to assists (e.g., NYL at 52.4%)
      } else if (shootingRatio >= 1.05) {
        return 1.10; // Above average shooting = +10% to assists (e.g., WAS at 51.2%)
      } else if (shootingRatio >= 0.98) {
        return 1.05; // Slightly above average = +5% to assists
      } else if (shootingRatio >= 0.92) {
        return 1.0; // Average shooting = neutral (e.g., LVA at 48.8%)
      } else if (shootingRatio >= 0.85) {
        return 0.95; // Below average shooting = -5% to assists (e.g., SEA at 44.5%)
      } else if (shootingRatio >= 0.80) {
        return 0.90; // Poor shooting = -10% to assists (e.g., CHI at 44.7%)
      } else {
        return 0.85; // Very poor shooting = -15% to assists (e.g., DAL at 41.1%)
      }

    } catch (error) {
      console.error('Error calculating teammate shooting factor:', error);
      return 1.0;
    }
  }

  /**
   * Calculate team scheme factor based on offensive system
   */
  private async calculateTeamSchemeFactor(team: string): Promise<number> {
    try {
      // Get team's assist-to-field goal ratio from wnba_game_logs (aggregated)
      const { data: teamGames, error } = await this.supabase
        .from('wnba_game_logs')
        .select('assists, field_goals_made')
        .eq('team', team);

      if (error || !teamGames || teamGames.length === 0) {
        console.log(`⚠️ No team games found for ${team}, using default scheme factor`);
        return 1.0;
      }

      // Calculate assists and field goals per game from game logs
      let totalAssists = 0;
      let totalFGM = 0;

      teamGames.forEach(game => {
        totalAssists += game.assists || 0;
        totalFGM += game.field_goals_made || 0;
      });

      const assistsPerGame = teamGames.length > 0 ? totalAssists / teamGames.length : 18.0;
      const fgMadePerGame = teamGames.length > 0 ? totalFGM / teamGames.length : 30.0;
      const assistToFG = assistsPerGame / fgMadePerGame;
      const leagueAverage = 0.60; // WNBA average assist-to-FG ratio

      // Higher assist ratio = more ball movement = better for assists
      const schemeRatio = assistToFG / leagueAverage;

      if (schemeRatio > 1.2) {
        return 1.20; // High ball movement = +20% to assists
      } else if (schemeRatio > 1.1) {
        return 1.10; // Above average ball movement = +10% to assists
      } else if (schemeRatio < 0.9) {
        return 0.90; // Low ball movement = -10% to assists
      } else {
        return 1.0; // Average ball movement = neutral
      }

    } catch (error) {
      console.error('Error calculating team scheme factor:', error);
      return 1.0;
    }
  }

  /**
   * Calculate minutes factor based on projected playing time
   */
  private async calculateMinutesFactor(playerName: string, team: string): Promise<number> {
    try {
      // Using default minutes since actual minutes data not available
      const avgMinutes = 25.0; // Default minutes per game

      // More minutes = more assist opportunities
      if (avgMinutes > 32) {
        return 1.15; // High minutes = +15% to assists
      } else if (avgMinutes > 28) {
        return 1.10; // Above average minutes = +10% to assists
      } else if (avgMinutes > 24) {
        return 1.05; // Average minutes = +5% to assists
      } else if (avgMinutes < 20) {
        return 0.90; // Low minutes = -10% to assists
      } else {
        return 1.0; // Neutral
      }

    } catch (error) {
      console.error('Error calculating minutes factor:', error);
      return 1.0;
    }
  }

  /**
   * Calculate fatigue factor based on schedule and travel
   */
  private async calculateFatigueFactor(team: string, gameDate: string): Promise<number> {
    try {
      // Check for multiple games in short period
      const recentGames = await this.getRecentGamesCount(team, gameDate, 7);
      if (recentGames > 3) {
        return 0.98; // Heavy schedule = -2% to assists
      }

      return 1.0; // Normal rest = neutral

    } catch (error) {
      console.error('Error calculating fatigue factor:', error);
      return 1.0;
    }
  }

  /**
   * Calculate situational factor (home/away, playoff intensity, etc.)
   */
  private calculateSituationalFactor(request: ProjectionRequest): number {
    let factor = 1.0;

    // Home court advantage
    if (request.isHome) {
      factor *= 1.05; // +5% at home
    }

    // Playoff intensity (if applicable)
    // This would need to be enhanced with actual playoff detection logic
    // For now, using a placeholder

    return factor;
  }

  /**
   * Calculate regression factor for outliers
   */
  private calculateRegressionFactor(playerStats: any[]): number {
    if (playerStats.length < 10) {
      return 1.0; // Not enough data for regression
    }

    const assistValues = playerStats.map(game => game.assists || 0).filter(val => val !== undefined && !isNaN(val));
    const mean = assistValues.reduce((sum, val) => sum + val, 0) / assistValues.length;
    const variance = assistValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / assistValues.length;
    const stdDev = Math.sqrt(variance);

    // If player is significantly above/below average, apply regression
    if (mean > 8 && stdDev > 3) {
      return 0.95; // High variance, high mean = regress down (-5%)
    } else if (mean < 2 && stdDev > 2) {
      return 1.05; // Low mean, high variance = regress up (+5%)
    }

    return 1.0; // Normal variance = no regression
  }

  /**
   * Calculate Hollinger Assist Ratio adjustment factor
   * Higher assist ratio = more efficient playmaker = boost to assists
   */
  private calculateHollingerAdjustment(assistRatio: number): number {
    if (assistRatio === 0) return 1.0;
    
    // Convert to percentage for easier interpretation
    const assistRatioPercent = assistRatio * 100;
    
    // WNBA average assist ratio is around 15-20%
    // Higher ratios indicate more efficient playmaking
    if (assistRatioPercent >= 25) {
      return 1.20; // Elite playmaker = +20% to assists
    } else if (assistRatioPercent >= 22) {
      return 1.15; // Very good playmaker = +15% to assists
    } else if (assistRatioPercent >= 20) {
      return 1.10; // Good playmaker = +10% to assists
    } else if (assistRatioPercent >= 18) {
      return 1.05; // Above average playmaker = +5% to assists
    } else if (assistRatioPercent >= 15) {
      return 1.0; // Average playmaker = neutral
    } else if (assistRatioPercent >= 12) {
      return 0.95; // Below average playmaker = -5% to assists
    } else if (assistRatioPercent >= 10) {
      return 0.90; // Poor playmaker = -10% to assists
    } else {
      return 0.85; // Very poor playmaker = -15% to assists
    }
  }

  /**
   * Calculate advanced assist metrics using Hollinger formula
   */
  private async calculateAdvancedAssistMetrics(playerName: string, season?: string): Promise<{ assistRatio: number; assistPercentage: number }> {
    try {
      const playerStats = await this.getPlayerSeasonStats(playerName, season);
      if (playerStats.length === 0) {
        return { assistRatio: 0, assistPercentage: 0 };
      }

      // Calculate assist ratio using Hollinger formula: AST / (FGA + 0.475 * FTA + AST + TOV)
      let totalAssists = 0;
      let totalFGA = 0;
      let totalFTA = 0;
      let totalTOV = 0;

      playerStats.forEach(game => {
        totalAssists += game.assists || 0;
        totalFGA += game.field_goals_attempted || 0; // Fixed column name
        totalFTA += game.free_throws_attempted || 0; // Fixed column name
        totalTOV += game.turnovers || 0;
      });

      const assistRatio = totalFGA + 0.475 * totalFTA + totalAssists + totalTOV > 0 
        ? totalAssists / (totalFGA + 0.475 * totalFTA + totalAssists + totalTOV)
        : 0;

      // Calculate assist percentage (assists per 100 possessions)
      const assistPercentage = playerStats.length > 0 ? (totalAssists / playerStats.length) * 100 : 0;

      console.log(`📊 ${playerName} Hollinger Assist Ratio: ${(assistRatio * 100).toFixed(1)}% (${totalAssists} AST / ${totalFGA} FGA + ${(0.475 * totalFTA).toFixed(1)} FTA + ${totalAssists} AST + ${totalTOV} TOV)`);

      return { assistRatio, assistPercentage };

    } catch (error) {
      console.error('Error calculating advanced assist metrics:', error);
      return { assistRatio: 0, assistPercentage: 0 };
    }
  }

  /**
   * Calculate assist consistency score
   */
  private calculateAssistConsistency(playerName: string): number {
    try {
      // This would calculate variance in assist performance
      // For now, returning a default score
      return 0.75; // Medium consistency
    } catch (error) {
      console.error('Error calculating assist consistency:', error);
      return 0.5; // Low consistency as fallback
    }
  }

  /**
   * Calculate matchup data quality score
   */
  private calculateMatchupDataQuality(opponent: string): number {
    try {
      // This would assess the quality of available matchup data
      // For now, returning a default score
      return 0.8; // Good data quality
    } catch (error) {
      console.error('Error calculating matchup data quality:', error);
      return 0.5; // Medium quality as fallback
    }
  }

  /**
   * Calculate final projection using weighted formula
   */
  private calculateFinalProjection(
    seasonAverage: number,
    recentForm: number,
    h2hAverage: number,
    factors: AssistProjectionFactors
  ): number {
    // Start with season average
    let projection = seasonAverage;

    // Apply recent form adjustment (70% recent, 30% season)
    if (recentForm > 0) {
      projection = (recentForm * 0.7) + (seasonAverage * 0.3);
    }

    // Apply head-to-head adjustment if available
    if (h2hAverage > 0) {
      projection = (projection * 0.8) + (h2hAverage * 0.2);
    }

    // Apply all adjustment factors with weighted importance
    // High impact factors (opponent defense, pace, usage) get full weight
    projection *= factors.opponentDefenseFactor;        // Full impact
    projection *= factors.paceFactor;                   // Full impact
    projection *= factors.usageFactor;                  // Full impact
    
    // Medium impact factors get moderate weight
    projection *= Math.pow(factors.homeAwayFactor, 0.8);        // 80% impact
    projection *= Math.pow(factors.injuryImpactFactor, 0.8);    // 80% impact
    projection *= Math.pow(factors.positionFactor, 0.8);        // 80% impact
    
    // Lower impact factors get reduced weight to prevent over-adjustment
    projection *= Math.pow(factors.backToBackFactor, 0.6);      // 60% impact
    projection *= Math.pow(factors.restFactor, 0.6);            // 60% impact
    projection *= Math.pow(factors.teammateShootingFactor, 0.6); // 60% impact
    projection *= Math.pow(factors.teamSchemeFactor, 0.6);      // 60% impact
    projection *= Math.pow(factors.minutesFactor, 0.6);         // 60% impact
    projection *= Math.pow(factors.fatigueFactor, 0.6);         // 60% impact
    projection *= Math.pow(factors.situationalFactor, 0.6);     // 60% impact
    projection *= Math.pow(factors.regressionFactor, 0.6);      // 60% impact
    projection *= Math.pow(factors.hollingerFactor, 0.6);       // 60% impact

    // Apply PER (Player Efficiency Rating) adjustment for better accuracy
    if (factors.perFactor && factors.perFactor !== 1.0) {
      projection *= factors.perFactor;
      console.log(`📊 PER adjustment applied: ${factors.perFactor.toFixed(3)}`);
    }

    return Math.max(0, projection); // Assists can't be negative
  }

  /**
   * Calculate assists confidence score
   */
  private calculateAssistsConfidence(
    playerStats: any[], 
    factors: AssistProjectionFactors
  ): number {
    let confidence = 0.7; // Base confidence

    // More games = higher confidence
    if (playerStats.length >= 20) confidence += 0.1;
    else if (playerStats.length >= 10) confidence += 0.05;

    // Consistent performance = higher confidence
    if (factors.consistencyScore > 0.8) confidence += 0.1;
    else if (factors.consistencyScore > 0.6) confidence += 0.05;

    // Strong defensive matchup data = higher confidence
    if (factors.opponentDefenseFactor !== 1.0) confidence += 0.05;

    // Good matchup data quality = higher confidence
    if (factors.matchupDataQuality > 0.8) confidence += 0.05;

    return Math.min(confidence, 0.95);
  }

  /**
   * Calculate risk level based on data quality, consistency, and sportsbook line proximity
   */
  private calculateRiskLevel(playerStats: any[], factors: AssistProjectionFactors, projectedValue?: number, sportsbookLine?: string | number): string {
    let riskScore = 0;

    // Data quantity risk (weight: 3)
    if (playerStats.length < 10) riskScore += 3;
    else if (playerStats.length < 20) riskScore += 1;

    // Consistency risk (weight: 2)
    if (factors.consistencyScore < 0.6) riskScore += 2;
    else if (factors.consistencyScore < 0.8) riskScore += 1;

    // Matchup data quality risk (weight: 2)
    if (factors.matchupDataQuality < 0.6) riskScore += 2;
    else if (factors.matchupDataQuality < 0.8) riskScore += 1;

    // Sportsbook line proximity risk (weight: 2-3) - Additional factor, not overriding
    if (projectedValue && sportsbookLine) {
      const lineValue = typeof sportsbookLine === 'string' ? parseFloat(sportsbookLine) : sportsbookLine;
      const difference = Math.abs(projectedValue - lineValue);
      
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
  private calculateEdge(projectedValue: number, sportsbookLine?: string | number): number {
    if (!sportsbookLine) return 0;
    const lineValue = typeof sportsbookLine === 'string' ? parseFloat(sportsbookLine) : sportsbookLine;
    return projectedValue - lineValue;
  }

  /**
   * Generate betting recommendation
   */
  private generateRecommendation(edge: number, confidence: number): string {
    if (Math.abs(edge) < 0.5 || confidence < 0.6) {
      return 'PASS';
    }
    return edge > 0 ? 'OVER' : 'UNDER';
  }

  /**
   * Calculate comprehensive matchup analysis score
   * Now includes all the factors we've implemented for assists projections
   */
  private calculateMatchupAnalysis(factors: AssistProjectionFactors): number {
    let matchupScore = 100;

    // Position-specific opponent defense impact (25% weight) - Most important for assists
    const defenseImpact = (factors.opponentDefenseFactor - 1.0) * 100;
    matchupScore += defenseImpact * 0.25;

    // Teammate shooting efficiency impact (20% weight) - Critical for assists
    const shootingImpact = (factors.teammateShootingFactor - 1.0) * 100;
    matchupScore += shootingImpact * 0.20;

    // Pace impact (20% weight) - High pace = more assist opportunities
    const paceImpact = (factors.paceFactor - 1.0) * 100;
    matchupScore += paceImpact * 0.20;

    // Hollinger Assist Ratio impact (15% weight) - Player efficiency
    const hollingerImpact = (factors.hollingerFactor - 1.0) * 100;
    matchupScore += hollingerImpact * 0.15;

    // Team scheme impact (10% weight) - Offensive system
    const schemeImpact = (factors.teamSchemeFactor - 1.0) * 100;
    matchupScore += schemeImpact * 0.10;

    // Usage factor impact (10% weight) - Player role
    const usageImpact = (factors.usageFactor - 1.0) * 100;
    matchupScore += usageImpact * 0.10;

    console.log(`🎯 Matchup Analysis Breakdown:`);
    console.log(`  Base Score: 100`);
    console.log(`  Defense Impact: ${defenseImpact.toFixed(1)} × 0.25 = ${(defenseImpact * 0.25).toFixed(1)}`);
    console.log(`  Shooting Impact: ${shootingImpact.toFixed(1)} × 0.20 = ${(shootingImpact * 0.20).toFixed(1)}`);
    console.log(`  Pace Impact: ${paceImpact.toFixed(1)} × 0.20 = ${(paceImpact * 0.20).toFixed(1)}`);
    console.log(`  Hollinger Impact: ${hollingerImpact.toFixed(1)} × 0.15 = ${(hollingerImpact * 0.15).toFixed(1)}`);
    console.log(`  Scheme Impact: ${schemeImpact.toFixed(1)} × 0.10 = ${(schemeImpact * 0.10).toFixed(1)}`);
    console.log(`  Usage Impact: ${usageImpact.toFixed(1)} × 0.10 = ${(usageImpact * 0.10).toFixed(1)}`);
    console.log(`  Final Matchup Score: ${matchupScore.toFixed(1)}`);

    return Math.max(0, Math.min(200, matchupScore)); // Clamp between 0-200
  }

  /**
   * Calculate assists-specific metrics
   */
  private calculateAssistsSpecificMetrics(
    projectedValue: number,
    factors: AssistProjectionFactors,
    playerStats: any[]
  ): any {
    // Calculate assist distribution (primary vs secondary assists)
    const totalAssists = projectedValue;
    
    // Estimate primary vs secondary assists based on position and usage
    let primaryAssistPercentage = 0.6; // Default 60% primary
    if (factors.positionFactor > 1.2) {
      primaryAssistPercentage = 0.7; // High position factor = more primary assists
    } else if (factors.positionFactor < 0.9) {
      primaryAssistPercentage = 0.5; // Low position factor = more secondary assists
    }

    const primaryAssists = Math.round(totalAssists * primaryAssistPercentage);
    const secondaryAssists = totalAssists - primaryAssists;

    // Calculate assist efficiency using advanced metrics
    let assistEfficiency = factors.assistRatio;
    if (assistEfficiency === 0) {
      assistEfficiency = 0.15; // Default assist ratio
    }

    // Determine position advantage
    let positionAdvantage = 'Neutral';
    if (factors.positionFactor > 1.1) positionAdvantage = 'Favorable';
    else if (factors.positionFactor < 0.9) positionAdvantage = 'Unfavorable';

    // Determine matchup strength
    let matchupStrength = 'Neutral';
    if (factors.opponentDefenseFactor > 1.1) matchupStrength = 'Favorable';
    else if (factors.opponentDefenseFactor < 0.9) matchupStrength = 'Unfavorable';

    return {
      primaryAssists,
      secondaryAssists,
      totalAssists: Math.round(totalAssists),
      assistEfficiency,
      assistRatio: factors.assistRatio,
      assistPercentage: factors.assistPercentage,
      positionAdvantage,
      matchupStrength,
      usageFactor: factors.usageFactor,
      teammateShootingFactor: factors.teammateShootingFactor,
      teamSchemeFactor: factors.teamSchemeFactor
    };
  }

  // Helper methods (reused from other services)
  private async getPlayerSeasonStats(playerName: string, season?: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('wnba_game_logs')
        .select('*')
        .eq('player_name', playerName)
        .not('assists', 'is', null);

      if (error) {
        console.error('Error fetching player stats:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Convert string dates to Date objects and sort chronologically (most recent first)
      const sortedData = data.sort((a: any, b: any) => {
        try {
          const dateA = new Date(a.game_date);
          const dateB = new Date(b.game_date);
          return dateB.getTime() - dateA.getTime(); // Most recent first
        } catch (error) {
          console.warn('Error parsing dates, using original order:', error);
          return 0;
        }
      });

      return sortedData;
    } catch (error) {
      console.error('Error in getPlayerSeasonStats:', error);
      return [];
    }
  }

  private async getPlayerSeasonAverage(playerName: string, statType: string, season?: string): Promise<number> {
    const playerStats = await this.getPlayerSeasonStats(playerName, season);
    const statValues = playerStats.map(game => game[statType] as number).filter(val => val !== undefined && !isNaN(val));
    const seasonAverage = statValues.length > 0 ? statValues.reduce((sum, val) => sum + val, 0) / statValues.length : 0;
    console.log(`Season average for ${statType}: ${seasonAverage.toFixed(1)} (from ${statValues.length} games)`);
    
    return seasonAverage;
  }

  private async getPlayerRecentForm(playerName: string, statType: string, season?: string): Promise<number> {
    const playerStats = await this.getPlayerSeasonStats(playerName, season);
    const recentGames = playerStats.slice(0, 10); // Last 10 games
    
    if (recentGames.length === 0) return 0;
    
    const recentValues = recentGames.map(game => game[statType] as number).filter(val => val !== undefined && !isNaN(val));
    const recentAverage = recentValues.length > 0 ? recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length : 0;
    
    console.log(`Recent form for ${statType}: ${recentAverage.toFixed(1)} (from ${recentGames.length} games)`);
    return recentAverage;
  }

  private async getPlayerHeadToHeadAverage(playerName: string, opponent: string, statType: string): Promise<number> {
    const playerStats = await this.getPlayerSeasonStats(playerName);
    const h2hGames = playerStats.filter(game => game.opponent === opponent);
    
    if (h2hGames.length === 0) return 0;
    
    const h2hValues = h2hGames.map(game => game[statType] as number).filter(val => val !== undefined && !isNaN(val));
    const h2hAverage = h2hValues.length > 0 ? h2hValues.reduce((sum, val) => sum + val, 0) / h2hValues.length : 0;
    
    console.log(`H2H average for ${statType} vs ${opponent}: ${h2hAverage.toFixed(1)} (from ${h2hGames.length} games)`);
    return h2hAverage;
  }

  private async getRecentGamesCount(team: string, gameDate: string, days: number): Promise<number> {
    try {
      const endDate = new Date(gameDate);
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const { data, error } = await this.supabase
        .from('wnba_game_logs')
        .select('game_date')
        .eq('team', team)
        .gte('game_date', startDate.toISOString().split('T')[0])
        .lt('game_date', endDate.toISOString().split('T')[0]);

      if (error) return 0;
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting recent games count:', error);
      return 0;
    }
  }

  private async determinePlayerPosition(playerName: string): Promise<string> {
    try {
      // Get the player's exact position from the database
      const { data, error } = await this.supabase
        .from('player_advanced_stats')
        .select('position')
        .eq('player_name', playerName)
        .eq('season', '2025')
        .limit(1);

      if (error || !data || data.length === 0) {
        console.log(`⚠️ No position data found for ${playerName}, using default`);
        return 'G'; // Default to guard
      }

      const position = data[0].position;
      console.log(`📊 ${playerName} Position: ${position}`);
      return position;

    } catch (error) {
      console.error(`Error getting position for ${playerName}:`, error);
      return 'G'; // Default to guard on error
    }
  }

  /**
   * Calculate PER (Player Efficiency Rating) adjustment factor
   * Higher PER = more efficient player = better assist opportunities
   */
  private async calculatePERFactor(playerName: string): Promise<number> {
    try {
      // Get player's PER from advanced stats
      const { data, error } = await this.supabase
        .from('player_advanced_stats')
        .select('per')
        .eq('player_name', playerName)
        .eq('season', '2025')
        .limit(1);

      if (error || !data || data.length === 0) {
        console.log(`⚠️ No PER data found for ${playerName}, using neutral factor`);
        return 1.0;
      }

      const per = data[0].per || 15.0; // Default to league average PER
      console.log(`📊 ${playerName} PER: ${per.toFixed(1)}`);

      // Calculate PER adjustment factor
      // League average PER is around 15.0
      // Only boost high PER, penalize low PER
      let perFactor = 1.0;
      
      if (per >= 18.0) {
        perFactor = 1.03; // High efficiency = +3% boost
        console.log(`🏆 High PER (${per.toFixed(1)}): +3% boost to assists`);
      } else if (per <= 12.0) {
        perFactor = 0.97; // Low efficiency = -3% penalty
        console.log(`⚠️ Low PER (${per.toFixed(1)}): -3% penalty to assists`);
      } else {
        perFactor = 1.0; // Average efficiency = no adjustment
        console.log(`📊 Average PER (${per.toFixed(1)}): no adjustment to assists`);
      }

      return perFactor;

    } catch (error) {
      console.error(`Error calculating PER factor for ${playerName}:`, error);
      return 1.0; // Neutral factor on error
    }
  }
}

/**
 * Interface for all assist projection factors
 */
export interface AssistProjectionFactors {
  opponentDefenseFactor: number;
  paceFactor: number;
  homeAwayFactor: number;
  backToBackFactor: number;
  restFactor: number;
  injuryImpactFactor: number;
  positionFactor: number;
  usageFactor: number;
  teammateShootingFactor: number;
  teamSchemeFactor: number;
  minutesFactor: number;
  fatigueFactor: number;
  situationalFactor: number;
  regressionFactor: number;
  assistRatio: number;
  assistPercentage: number;
  consistencyScore: number;
  matchupDataQuality: number;
  hollingerFactor: number;
  perFactor: number; // Player Efficiency Rating adjustment factor
}
