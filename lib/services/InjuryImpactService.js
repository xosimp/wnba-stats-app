const { injuryAPI } = require('../api/injury-api');

class InjuryImpactService {
  static SIGNIFICANT_USAGE_THRESHOLD = 18; // Players with >18% usage are significant (was 20)
  static STARTER_MINUTES_THRESHOLD = 24; // Players averaging >24 minutes are starters (was 25)
  static HIGH_IMPACT_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']; // All positions can be high impact

  /**
   * Calculate injury impact factor for a player's projection
   */
  static async calculateInjuryImpact(
    playerTeam,
    gameDate,
    playerPosition
  ) {
    try {
      // Fetch current injuries for the team
      const allInjuries = await injuryAPI.fetchInjuries();
      
      // Map team abbreviations to handle variations (e.g., GV, GS, GSV for Golden State)
      const teamAbbrevMap = {
        'GV': ['GV', 'GS', 'GSV'], // Golden State Valkyries
        'GS': ['GV', 'GS', 'GSV'], // Golden State Valkyries
        'GSV': ['GV', 'GS', 'GSV'], // Golden State Valkyries
        'ATL': ['ATL'], // Atlanta Dream
        'DAL': ['DAL'], // Dallas Wings
        'NYL': ['NYL'], // New York Liberty
        'LVA': ['LVA'], // Las Vegas Aces
        'PHX': ['PHX'], // Phoenix Mercury
        'CONN': ['CONN'], // Connecticut Sun
        'WAS': ['WAS'], // Washington Mystics
        'MIN': ['MIN'], // Minnesota Lynx
        'CHI': ['CHI'], // Chicago Sky
        'IND': ['IND'], // Indiana Fever
        'SEA': ['SEA'] // Seattle Storm
      };
      
      const teamAbbrevs = teamAbbrevMap[playerTeam] || [playerTeam];
      const teamInjuries = allInjuries.filter(
        injury => teamAbbrevs.includes(injury.teamAbbrev) && injury.status === 'Out'
      );

      if (teamInjuries.length === 0) {
        return {
          factor: 1.0,
          reason: 'No significant injuries on team',
          significantInjuries: [],
          totalImpact: 'None'
        };
      }

      // Filter for significant injuries only
      const significantInjuries = await this.filterSignificantInjuries(teamInjuries, playerTeam);
      
      if (significantInjuries.length === 0) {
        return {
          factor: 1.0,
          reason: 'Injuries present but not significant enough to impact projections',
          significantInjuries: [],
          totalImpact: 'Minimal'
        };
      }

      // Calculate impact factor based on significance
      const impactFactor = this.calculateImpactFactor(significantInjuries, playerPosition);
      const reason = this.generateImpactReason(significantInjuries, impactFactor);
      const totalImpact = this.getImpactDescription(impactFactor);

      return {
        factor: impactFactor,
        reason,
        significantInjuries: significantInjuries.map(injury => injury.playerName),
        totalImpact
      };

    } catch (error) {
      console.error('Error calculating injury impact:', error);
      return {
        factor: 1.0,
        reason: 'Unable to calculate injury impact due to error',
        significantInjuries: [],
        totalImpact: 'Unknown'
      };
    }
  }

  /**
   * Filter injuries to only include significant ones
   */
  static async filterSignificantInjuries(injuries, team) {
    const significantInjuries = [];

    for (const injury of injuries) {
      // Check if this is a significant player based on position and team role
      const isSignificant = await this.isSignificantPlayer(injury.playerName, team, injury.position);
      
      if (isSignificant) {
        significantInjuries.push(injury);
      }
    }

    return significantInjuries;
  }

  /**
   * Determine if an injured player is significant enough to impact projections
   */
  static async isSignificantPlayer(playerName, team, position) {
    try {
      // Try to get real usage data from the database first
      try {
        const { createClient } = require('@supabase/supabase-js');
        
        // Initialize Supabase client
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        // Query the player_advanced_stats table for usage percentage
        const { data: playerStats, error } = await supabase
          .from('player_advanced_stats')
          .select('usage_percentage, avg_minutes, games_played')
          .eq('player_name', playerName)
          .eq('team', team)
          .eq('season', 2025)
          .single();
        
        if (!error && playerStats) {
          // Use real usage data to determine significance
          const usagePercentage = playerStats.usage_percentage || 0;
          const avgMinutes = playerStats.avg_minutes || 0;
          const gamesPlayed = playerStats.games_played || 0;
          
          // Player is significant if:
          // 1. High usage (>18% of team plays when on court)
          // 2. High minutes (>24 minutes per game)
          // 3. Regular player (played in most games)
          const isHighUsage = usagePercentage > 18;
          const isHighMinutes = avgMinutes > 24;
          const isRegularPlayer = gamesPlayed >= 20; // Played in most games
          
          if (isHighUsage || (isHighMinutes && isRegularPlayer)) {
            console.log(`📊 ${playerName} significance: ${usagePercentage}% usage, ${avgMinutes} avg minutes, ${gamesPlayed} games`);
            return true;
          }
          
          console.log(`📊 ${playerName} not significant: ${usagePercentage}% usage, ${avgMinutes} avg minutes, ${gamesPlayed} games`);
          return false;
        }
      } catch (dbError) {
        console.warn(`Could not fetch usage data for ${playerName}, falling back to hardcoded logic:`, dbError);
      }
      
      // Fallback to hardcoded logic if database query fails
      // High-impact positions are always considered significant if injured
      const highImpactPositions = ['PG', 'SG', 'SF', 'PF', 'C'];
      
      // Check if this is a known high-usage player (we can expand this list)
      const highUsagePlayers = [
        'Napheesa Collier', 'Arike Ogunbowale', 'Breanna Stewart', 'A\'ja Wilson',
        'Kelsey Plum', 'Jackie Young', 'Sabrina Ionescu', 'Jonquel Jones',
        'Shakira Austin', 'Cecilia Zandalasini', 'Tiffany Hayes', 'Veronica Burton',
        'Paige Bueckers', 'Caitlin Clark', 'Satou Sabally', 'Alyssa Thomas',
        'Angel Reese', 'Kamilla Cardoso', 'Nneka Ogwumike'
      ];

      // Check if this is a known starter or high-minute player
      const knownStarters = [
        'Napheesa Collier', 'Kayla McBride', 'Courtney Williams',
        'Arike Ogunbowale', 'Teaira McCowan', 'Paige Bueckers', 'DiJonai Carrington',
        'Breanna Stewart', 'Sabrina Ionescu', 'Jonquel Jones', 'Emma Meesseman',
        'A\'ja Wilson', 'Jackie Young', 'Jewell Loyd', 'Chelsea Gray',
        'Cecilia Zandalasini', 'Tiffany Hayes', 'Veronica Burton', 'Kayla Thornton',
        'Angel Reese', 'Kamilla Cardoso', 'Nneka Ogwumike'
      ];

      // Position-based significance (only if position is provided)
      const positionSignificance = position ? highImpactPositions.includes(position) : false;
      
      // Player-based significance
      const playerSignificance = highUsagePlayers.includes(playerName) || knownStarters.includes(playerName);
      
      // Team-specific significance (e.g., Collier is crucial for Minnesota)
      const teamSpecificSignificance = this.isTeamSpecificSignificant(playerName, team);

      return positionSignificance || playerSignificance || teamSpecificSignificance;

    } catch (error) {
      console.error('Error checking player significance:', error);
      // Default to considering all injuries as potentially significant
      return true;
    }
  }

  /**
   * Check if a player is specifically significant for their team
   */
  static isTeamSpecificSignificant(playerName, team) {
    const teamSignificanceMap = {
      'MIN': ['Napheesa Collier', 'Kayla McBride', 'Courtney Williams'], // Minnesota key players
      'DAL': ['Arike Ogunbowale', 'Teaira McCowan', 'Paige Bueckers', 'DiJonai Carrington'], // Dallas key players
      'NYL': ['Breanna Stewart', 'Sabrina Ionescu', 'Jonquel Jones', 'Emma Meesseman'], // New York key players
      'LVA': ['A\'ja Wilson', 'Jackie Young', 'Jewell Loyd', 'Chelsea Gray'], // Las Vegas key players
      'PHO': ['Alyssa Thomas', 'Satou Sabally', 'Diana Taurasi'], // Phoenix key players
      'CONN': ['DeWanna Bonner'], // Connecticut key players (most moved to other teams)
      'WAS': ['Shakira Austin', 'Brittney Sykes', 'Kiki Iriafen', 'Sonia Citron'], // Washington key players
      'GSV': ['Cecilia Zandalasini', 'Tiffany Hayes', 'Veronica Burton', 'Kayla Thornton', 'Carla Leite'], // Golden State key players
      'GV': ['Cecilia Zandalasini', 'Tiffany Hayes', 'Veronica Burton', 'Kayla Thornton', 'Carla Leite'], // Golden State key players
      'GS': ['Cecilia Zandalasini', 'Tiffany Hayes', 'Veronica Burton', 'Kayla Thornton', 'Carla Leite'], // Golden State key players
      'ATL': ['Brittney Griner', 'Rhyne Howard', 'Allisha Gray'], // Atlanta key players
      'CHI': ['Ariel Atkins', 'Angel Reese', 'Kamilla Cardoso'], // Chicago key players
      'IND': ['Caitlin Clark', 'Aliyah Boston', 'Kelsey Mitchell'], // Indiana key players
      'SEA': ['Jewell Loyd', 'Ezi Magbegor', 'Nneka Ogwumike'], // Seattle key players
      'LAS': ['Kelsey Plum', 'Dearica Hamby'] // Los Angeles key players
    };

    return teamSignificanceMap[team]?.includes(playerName) || false;
  }

  /**
   * Calculate the actual impact factor based on significant injuries
   */
  static calculateImpactFactor(significantInjuries, playerPosition) {
    if (significantInjuries.length === 0) return 1.0;

    let baseFactor = 1.0;
    
    // Base boost for each significant injury
    const injuryCount = significantInjuries.length;
    baseFactor += (injuryCount * 0.05); // 5% boost per significant injury

    // Position-specific adjustments
    const positionMultiplier = this.getPositionMultiplier(playerPosition, significantInjuries);
    baseFactor *= positionMultiplier;

    // Cap the factor to reasonable bounds (0.8 to 1.4)
    return Math.max(0.8, Math.min(1.4, baseFactor));
  }

  /**
   * Get position-specific multiplier based on injury patterns
   */
  static getPositionMultiplier(playerPosition, injuries) {
    // If injured players are in the same position group, higher impact
    const samePositionInjuries = injuries.filter(injury => 
      this.arePositionsRelated(playerPosition, injury.position)
    );

    if (samePositionInjuries.length > 0) {
      return 1.15; // 15% additional boost for same position injuries
    }

    return 1.0; // No additional position-specific boost
  }

  /**
   * Check if two positions are related (same position group)
   */
  static arePositionsRelated(pos1, pos2) {
    const positionGroups = {
      'PG': ['PG', 'SG'], // Point guards and shooting guards
      'SG': ['PG', 'SG', 'SF'], // Shooting guards, point guards, and small forwards
      'SF': ['SG', 'SF', 'PF'], // Small forwards, shooting guards, and power forwards
      'PF': ['SF', 'PF', 'C'], // Power forwards, small forwards, and centers
      'C': ['PF', 'C'] // Centers and power forwards
    };

    return positionGroups[pos1]?.includes(pos2) || positionGroups[pos2]?.includes(pos1) || false;
  }

  /**
   * Generate human-readable reason for the impact
   */
  static generateImpactReason(injuries, impactFactor) {
    if (injuries.length === 0) return 'No significant injuries';

    const playerNames = injuries.map(injury => injury.playerName).join(', ');
    
    if (impactFactor >= 1.3) {
      return `High impact: ${playerNames} out - significant boost expected`;
    } else if (impactFactor >= 1.15) {
      return `Moderate impact: ${playerNames} out - moderate boost expected`;
    } else if (impactFactor >= 1.05) {
      return `Low impact: ${playerNames} out - slight boost expected`;
    } else {
      return `Minimal impact: ${playerNames} out - minimal effect expected`;
    }
  }

  /**
   * Get impact description for display
   */
  static getImpactDescription(impactFactor) {
    if (impactFactor >= 1.3) return 'High';
    if (impactFactor >= 1.15) return 'Moderate';
    if (impactFactor >= 1.05) return 'Low';
    if (impactFactor >= 0.95) return 'Minimal';
    return 'Negative';
  }

  /**
   * Get detailed injury information for a team
   */
  static async getTeamInjurySummary(team) {
    try {
      const allInjuries = await injuryAPI.fetchInjuries();
      
      // Map team abbreviations to handle variations (e.g., GV, GS, GSV for Golden State)
      const teamAbbrevMap = {
        'GV': ['GV', 'GS', 'GSV'], // Golden State Valkyries
        'GS': ['GV', 'GS', 'GSV'], // Golden State Valkyries
        'GSV': ['GV', 'GS', 'GSV'], // Golden State Valkyries
        'ATL': ['ATL'], // Atlanta Dream
        'DAL': ['DAL'], // Dallas Wings
        'NYL': ['NYL'], // New York Liberty
        'LVA': ['LVA'], // Las Vegas Aces
        'PHX': ['PHX'], // Phoenix Mercury
        'CONN': ['CONN'], // Connecticut Sun
        'WAS': ['WAS'], // Washington Mystics
        'MIN': ['MIN'], // Minnesota Lynx
        'CHI': ['CHI'], // Chicago Sky
        'IND': ['IND'], // Indiana Fever
        'SEA': ['SEA'] // Seattle Storm
      };
      
      const teamAbbrevs = teamAbbrevMap[team] || [team];
      const teamInjuries = allInjuries.filter(
        injury => teamAbbrevs.includes(injury.teamAbbrev) && injury.status === 'Out'
      );
      
      const significantInjuries = await this.filterSignificantInjuries(teamInjuries, team);
      
      let impactLevel = 'None';
      if (significantInjuries.length >= 2) impactLevel = 'High';
      else if (significantInjuries.length === 1) impactLevel = 'Moderate';
      else if (teamInjuries.length > 0) impactLevel = 'Low';

      return {
        totalInjuries: teamInjuries.length,
        significantInjuries,
        impactLevel
      };

    } catch (error) {
      console.error('Error getting team injury summary:', error);
      return {
        totalInjuries: 0,
        significantInjuries: [],
        impactLevel: 'Unknown'
      };
      }
  }
}

module.exports = { InjuryImpactService };
