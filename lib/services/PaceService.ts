import { createClient } from '@supabase/supabase-js';

/**
 * Service for handling team PACE data and scoring adjustments
 * PACE = Possessions per 48 minutes (higher = more scoring opportunities)
 */
export class PaceService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Check opponent's PACE rating and apply scoring adjustment
   * Higher PACE = more possessions = more scoring opportunities
   */
  async checkOpponentPace(opponent: string): Promise<number> {
    try {
      console.log(`  🏃‍♀️ Checking opponent PACE: ${opponent}`);

      // Get opponent's PACE data from team_pace_stats
      const { data: paceData, error } = await this.supabase
        .from('team_pace_stats')
        .select('pace, team_name')
        .eq('season', '2025')
        .ilike('team_name', `%${opponent}%`)
        .limit(1);

      if (error) {
        console.log(`  ⚠️  Error checking opponent PACE: ${error.message}`);
        return 1.0;
      }

      if (!paceData || paceData.length === 0) {
        console.log(`  ⚠️  No PACE data found for ${opponent}`);
        return 1.0;
      }

      const opponentPace = paceData[0].pace;
      console.log(`  📊 ${opponent} PACE: ${opponentPace}`);

      // Get league average PACE for comparison
      const { data: allPaceData, error: avgError } = await this.supabase
        .from('team_pace_stats')
        .select('pace')
        .eq('season', '2025')
        .not('pace', 'is', null);

      if (avgError || !allPaceData) {
        console.log(`  ⚠️  Error getting league average PACE: ${avgError?.message}`);
        return 1.0;
      }

      const leagueAvgPace = allPaceData.reduce((sum: number, team: any) => sum + team.pace, 0) / allPaceData.length;
      const paceRatio = opponentPace / leagueAvgPace;

      console.log(`  📊 League average PACE: ${leagueAvgPace.toFixed(2)}`);
      console.log(`  📊 PACE ratio: ${paceRatio.toFixed(3)}`);

      // Apply PACE adjustment based on new 2025 data analysis
      // Using absolute PACE thresholds instead of ratios for more accurate projections
      let paceAdjustment = 1.0;

      if (opponentPace > 97.39) {
        // Very high PACE (>97.39) = +4% scoring boost
        paceAdjustment = 1.04;
        console.log(`  🚀 Very high PACE detected (${opponentPace}): +4% scoring boost`);
      } else if (opponentPace > 96.74) {
        // High PACE (>96.74) = +3% scoring boost
        paceAdjustment = 1.03;
        console.log(`  🏃‍♀️ High PACE detected (${opponentPace}): +3% scoring boost`);
      } else if (opponentPace > 96.09) {
        // Above average PACE (>96.09) = +2% scoring boost
        paceAdjustment = 1.02;
        console.log(`  📈 Above average PACE detected (${opponentPace}): +2% scoring boost`);
      } else if (opponentPace < 94.15) {
        // Low PACE (<94.15) = -2% scoring reduction
        paceAdjustment = 0.98;
        console.log(`  🐌 Low PACE detected (${opponentPace}): -2% scoring reduction`);
      } else if (opponentPace < 94.79) {
        // Below average PACE (<94.79) = -1% scoring reduction
        paceAdjustment = 0.99;
        console.log(`  📉 Below average PACE detected (${opponentPace}): -1% scoring reduction`);
      } else {
        // Average PACE (94.79-96.09) = no adjustment
        console.log(`  ✅ Average PACE detected (${opponentPace}): no adjustment needed`);
      }

      console.log(`  🎯 PACE adjustment: ×${paceAdjustment.toFixed(3)}`);
      return paceAdjustment;

    } catch (error) {
      console.error(`  ❌ Error in checkOpponentPace:`, error);
      return 1.0; // Default to no adjustment if error occurs
    }
  }

  /**
   * Get PACE statistics for all teams
   * Useful for analysis and reporting
   */
  async getAllTeamPaceStats(): Promise<Array<{
    team_name: string;
    pace: number;
    rank: number;
    pace_category: 'Very High' | 'High' | 'Above Average' | 'Average' | 'Below Average' | 'Low';
  }>> {
    try {
      const { data: paceData, error } = await this.supabase
        .from('team_pace_stats')
        .select('team_name, pace, rank')
        .eq('season', '2025')
        .order('pace', { ascending: false });

      if (error || !paceData) {
        throw new Error(`Failed to fetch PACE data: ${error?.message}`);
      }

      // Get league average for categorization
      const leagueAvgPace = paceData.reduce((sum, team) => sum + team.pace, 0) / paceData.length;

      return paceData.map(team => {
        // Use absolute PACE thresholds for consistent categorization
        let paceCategory: 'Very High' | 'High' | 'Above Average' | 'Average' | 'Below Average' | 'Low';

        if (team.pace > 97.39) paceCategory = 'Very High';
        else if (team.pace > 96.74) paceCategory = 'High';
        else if (team.pace > 96.09) paceCategory = 'Above Average';
        else if (team.pace < 94.15) paceCategory = 'Low';
        else if (team.pace < 94.79) paceCategory = 'Below Average';
        else paceCategory = 'Average';

        return {
          team_name: team.team_name,
          pace: team.pace,
          rank: team.rank,
          pace_category: paceCategory
        };
      });

    } catch (error) {
      console.error('Error getting all team PACE stats:', error);
      return [];
    }
  }

  /**
   * Get PACE impact analysis for a specific team
   */
  async getPaceImpactAnalysis(teamName: string): Promise<{
    teamPace: number;
    leagueAverage: number;
    paceRatio: number;
    scoringImpact: string;
    adjustmentFactor: number;
  }> {
    try {
      const { data: teamData, error } = await this.supabase
        .from('team_pace_stats')
        .select('pace')
        .eq('season', '2025')
        .ilike('team_name', `%${teamName}%`)
        .single();

      if (error || !teamData) {
        throw new Error(`No PACE data found for ${teamName}`);
      }

      const { data: allPaceData } = await this.supabase
        .from('team_pace_stats')
        .select('pace')
        .eq('season', '2025');

      const leagueAverage = allPaceData?.reduce((sum, team) => sum + team.pace, 0) / (allPaceData?.length || 1);
      const paceRatio = teamData.pace / leagueAverage;
      const adjustmentFactor = await this.checkOpponentPace(teamName);

      let scoringImpact = 'No adjustment';
      if (adjustmentFactor > 1.0) {
        scoringImpact = `+${((adjustmentFactor - 1) * 100).toFixed(1)}% scoring boost`;
      } else if (adjustmentFactor < 1.0) {
        scoringImpact = `${((adjustmentFactor - 1) * 100).toFixed(1)}% scoring reduction`;
      }

      return {
        teamPace: teamData.pace,
        leagueAverage,
        paceRatio,
        scoringImpact,
        adjustmentFactor
      };

    } catch (error) {
      console.error(`Error getting PACE impact analysis for ${teamName}:`, error);
      return {
        teamPace: 0,
        leagueAverage: 0,
        paceRatio: 0,
        scoringImpact: 'Error',
        adjustmentFactor: 1.0
      };
    }
  }
}
