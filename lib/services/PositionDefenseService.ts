import { createClient } from '@supabase/supabase-js';

/**
 * Service for handling position-specific defensive calculations
 * Applies defensive adjustments based on opponent's position defense
 */
export class PositionDefenseService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get opponent's position-specific defensive stats
   * Returns defensive rating for the specific position
   */
  async getOpponentPositionSpecificDefense(
    opponent: string,
    season: string,
    playerName: string
  ): Promise<number | null> {
    try {
      const playerPosition = this.determinePlayerPosition(playerName);
      console.log(`  🛡️  ${playerName} identified as ${playerPosition} position`);

      // Map position to stat type for defensive lookup
      const statTypeMap: { [key: string]: string } = {
        'G': 'guard_defense',
        'F': 'forward_defense',
        'C': 'center_defense'
      };

      const statType = statTypeMap[playerPosition];
      if (!statType) {
        console.log(`  ⚠️  Unknown position: ${playerPosition}`);
        return null;
      }

      console.log(`  🔍 Looking for ${statType} stats for ${opponent}`);

      // Get position-specific defensive stats
      const { data: defenseStats, error } = await this.supabase
        .from('team_defensive_stats')
        .select('overall_avg_allowed')
        .eq('team', opponent)
        .eq('stat_type', statType)
        .eq('season', season)
        .limit(1);

      if (error) {
        console.log(`  ⚠️  Error getting ${statType} stats: ${error.message}`);
        return null;
      }

      if (!defenseStats || defenseStats.length === 0) {
        console.log(`  ⚠️  No ${statType} stats found for ${opponent}`);
        return null;
      }

      const defensiveRating = defenseStats[0].overall_avg_allowed;
      console.log(`  📊 ${opponent} ${statType}: ${defensiveRating} allowed`);

      return defensiveRating;

    } catch (error) {
      console.error(`  ❌ Error in getOpponentPositionSpecificDefense:`, error);
      return null;
    }
  }

  /**
   * Determine player position based on name
   * Uses known player mappings and name patterns
   */
  private determinePlayerPosition(playerName: string): 'G' | 'F' | 'C' {
    const name = playerName.toLowerCase();

    // Known guards
    if (name.includes('sabrina') || name.includes('ionescu') ||
        name.includes('courtney') || name.includes('vandersloot') ||
        name.includes('skylar') || name.includes('diggins-smith') ||
        name.includes('diana') || name.includes('taurasi') ||
        name.includes('jewell') || name.includes('loyd') ||
        name.includes('kelsey') || name.includes('plum') ||
        name.includes('jackie') || name.includes('young') ||
        name.includes('marina') || name.includes('mabrey') ||
        name.includes('alysha') || name.includes('clark') ||
        name.includes('lexie') || name.includes('brown') ||
        name.includes('eri') || name.includes('wheeler') ||
        name.includes('natasha') || name.includes('cloud') ||
        name.includes('chelsea') || name.includes('gray') ||
        name.includes('sami') || name.includes('whitcomb') ||
        name.includes('kitija') || name.includes('laksa') ||
        name.includes('zia') || name.includes('cooke') ||
        name.includes('dominique') || name.includes('malonga') ||
        name.includes('li') || name.includes('yueru')) {
      return 'G';
    }

    // Known forwards
    if (name.includes('breanna') || name.includes('stewart') ||
        name.includes('napheesa') || name.includes('collier') ||
        name.includes('deborah') || name.includes('carrington') ||
        name.includes('satou') || name.includes('sabally') ||
        name.includes('rhyne') || name.includes('howard') ||
        name.includes('betnijah') || name.includes('laney') ||
        name.includes('jonquel') || name.includes('jones') ||
        name.includes('dewa') || name.includes('bonner') ||
        name.includes('brionna') || name.includes('jones') ||
        name.includes('natasha') || name.includes('howard') ||
        name.includes('tamika') || name.includes('catchings') ||
        name.includes('angel') || name.includes('mccoughtry') ||
        name.includes('candace') || name.includes('parker')) {
      return 'F';
    }

    // Known centers
    if (name.includes('brittney') || name.includes('griner') ||
        name.includes('sylvia') || name.includes('fowles') ||
        name.includes('elizabeth') || name.includes('cambage') ||
        name.includes('teaira') || name.includes('mccowan') ||
        name.includes('a\'ja') || name.includes('aja') ||
        name.includes('wilson') ||
        name.includes('ezi') || name.includes('magbegor') ||
        name.includes('steven') || name.includes('austen') ||
        name.includes('alanna') || name.includes('smith') ||
        name.includes('kalani') || name.includes('brown') ||
        name.includes('monique') || name.includes('billings') ||
        name.includes('azura') || name.includes('stevens') ||
        name.includes('mercedes') || name.includes('russell') ||
        name.includes('kiah') || name.includes('stokes') ||
        name.includes('brittany') || name.includes('griner')) {
      return 'C';
    }

    // Default to forward if position can't be determined
    console.log(`  ⚠️  Could not determine position for ${playerName}, defaulting to Forward`);
    return 'F';
  }

  /**
   * Get position-specific defensive thresholds
   * Returns thresholds for elite, strong, and average defense
   */
  private getPositionSpecificThresholds(playerName: string): {
    elite: number;
    strong: number;
    average: number;
    weak: number;
  } {
    const position = this.determinePlayerPosition(playerName);

    // Thresholds based on position (points allowed per game)
    const thresholds = {
      'G': { elite: 12.0, strong: 13.5, average: 15.0, weak: 16.5 }, // Guards
      'F': { elite: 13.5, strong: 15.0, average: 16.5, weak: 18.0 }, // Forwards
      'C': { elite: 15.0, strong: 16.5, average: 18.0, weak: 19.5 }  // Centers
    };

    return thresholds[position];
  }

  /**
   * Calculate defensive adjustment factor
   * Applies position-specific defensive adjustments to projections
   */
  async calculateDefensiveAdjustment(
    opponent: string,
    season: string,
    playerName: string,
    statType: string
  ): Promise<number> {
    try {
      if (statType !== 'points') {
        console.log(`  ⚠️  Skipping defensive adjustment - not points projection`);
        return 1.0;
      }

      const positionDefense = await this.getOpponentPositionSpecificDefense(opponent, season, playerName);
      if (!positionDefense) {
        console.log(`  ⚠️  No position-specific defense data, using default adjustment`);
        return 1.0;
      }

      const thresholds = this.getPositionSpecificThresholds(playerName);
      const playerPosition = this.determinePlayerPosition(playerName);

      console.log(`  🛡️  ${opponent} ${playerPosition} defense: ${positionDefense} allowed`);
      console.log(`  📊 Thresholds: Elite <${thresholds.elite}, Strong <${thresholds.strong}, Average <${thresholds.average}, Weak <${thresholds.weak}`);

      let defensiveAdjustment = 1.0;

      if (positionDefense < thresholds.elite) {
        // Elite defense = significant reduction
        defensiveAdjustment = 0.88; // -12%
        console.log(`  🏆 Elite ${playerPosition} defense detected: -12% adjustment`);
      } else if (positionDefense < thresholds.strong) {
        // Strong defense = moderate reduction
        defensiveAdjustment = 0.92; // -8%
        console.log(`  🥇 Strong ${playerPosition} defense detected: -8% adjustment`);
      } else if (positionDefense < thresholds.average) {
        // Average defense = slight reduction
        defensiveAdjustment = 0.96; // -4%
        console.log(`  🥈 Average ${playerPosition} defense detected: -4% adjustment`);
      } else if (positionDefense < thresholds.weak) {
        // Weak defense = slight boost
        defensiveAdjustment = 1.04; // +4%
        console.log(`  🥉 Weak ${playerPosition} defense detected: +4% adjustment`);
      } else {
        // Very weak defense = moderate boost
        defensiveAdjustment = 1.08; // +8%
        console.log(`  💀 Very weak ${playerPosition} defense detected: +8% adjustment`);
      }

      console.log(`  🎯 Defensive adjustment: ×${defensiveAdjustment.toFixed(3)}`);
      return defensiveAdjustment;

    } catch (error) {
      console.error(`  ❌ Error in calculateDefensiveAdjustment:`, error);
      return 1.0; // Default to no adjustment
    }
  }

  /**
   * Get defensive matchup analysis for a player
   * Returns detailed analysis of defensive matchup
   */
  async getDefensiveMatchupAnalysis(
    opponent: string,
    season: string,
    playerName: string
  ): Promise<{
    playerPosition: string;
    opponentDefense: number;
    defenseRating: 'Elite' | 'Strong' | 'Average' | 'Weak' | 'Very Weak';
    adjustmentFactor: number;
    matchupDescription: string;
  }> {
    try {
      const positionDefense = await this.getOpponentPositionSpecificDefense(opponent, season, playerName);
      if (!positionDefense) {
        return {
          playerPosition: 'Unknown',
          opponentDefense: 0,
          defenseRating: 'Average',
          adjustmentFactor: 1.0,
          matchupDescription: 'No defensive data available'
        };
      }

      const playerPosition = this.determinePlayerPosition(playerName);
      const thresholds = this.getPositionSpecificThresholds(playerName);
      const adjustmentFactor = await this.calculateDefensiveAdjustment(opponent, season, playerName, 'points');

      let defenseRating: 'Elite' | 'Strong' | 'Average' | 'Weak' | 'Very Weak';
      if (positionDefense < thresholds.elite) defenseRating = 'Elite';
      else if (positionDefense < thresholds.strong) defenseRating = 'Strong';
      else if (positionDefense < thresholds.average) defenseRating = 'Average';
      else if (positionDefense < thresholds.weak) defenseRating = 'Weak';
      else defenseRating = 'Very Weak';

      let matchupDescription = '';
      if (adjustmentFactor < 1.0) {
        matchupDescription = `Unfavorable vs ${defenseRating} ${playerPosition} defense`;
      } else if (adjustmentFactor > 1.0) {
        matchupDescription = `Favorable vs ${defenseRating} ${playerPosition} defense`;
      } else {
        matchupDescription = `Neutral vs ${defenseRating} ${playerPosition} defense`;
      }

      return {
        playerPosition,
        opponentDefense: positionDefense,
        defenseRating,
        adjustmentFactor,
        matchupDescription
      };

    } catch (error) {
      console.error('Error in getDefensiveMatchupAnalysis:', error);
      return {
        playerPosition: 'Unknown',
        opponentDefense: 0,
        defenseRating: 'Average',
        adjustmentFactor: 1.0,
        matchupDescription: 'Error analyzing'
      };
    }
  }
}
