import { createClient } from '@supabase/supabase-js';
import { 
  TeamDefensiveStats, 
  PlayerGameLog, 
  ProjectionRequest,
  ProjectionResult,
  ProjectionEngine
} from '../algorithms/Algorithms';
import { TEAMS } from '../constants/team-data';
import { BackToBackService } from './BackToBackService';
import { PaceService } from './PaceService';
import { GameOutcomeService } from './GameOutcomeService';
import { PositionDefenseService } from './PositionDefenseService';
import { PlayerDataService } from './PlayerDataService';
import { LeagueAveragesService } from './LeagueAveragesService';
import { ProjectionStorageService } from './ProjectionStorageService';
import { GameDataService } from './GameDataService';



export class ProjectionDataService {
  private supabase: any;
  private static instance: ProjectionDataService;
  private backToBackService: BackToBackService;
  private paceService: PaceService;
  private gameOutcomeService: GameOutcomeService;
  private positionDefenseService: PositionDefenseService;
  private playerDataService: PlayerDataService;
  private leagueAveragesService: LeagueAveragesService;
  private projectionStorageService: ProjectionStorageService;
  private gameDataService: GameDataService;



  /**
   * Update WNBA league averages (should be called daily after new games)
   * This method calculates league averages from all game logs and updates the constants
   */
  async updateLeagueAverages(season: string = '2025'): Promise<void> {
    try {
      console.log('Updating WNBA league averages...');
      
      // Delegate to the league averages service
      await this.leagueAveragesService.updateLeagueAverages(season);
      
    } catch (error) {
      console.error('Error updating league averages:', error);
    }
  }

  /**
   * Save league averages to database for persistence
   */
  private async saveLeagueAveragesToDatabase(averages: Record<string, number>, season: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('league_averages')
        .upsert({
          season,
          updated_at: new Date().toISOString(),
          points: averages.points,
          rebounds: averages.rebounds,
          assists: averages.assists,
          turnovers: averages.turnovers,
          steals: averages.steals
        });

      if (error) {
        console.error('Error saving league averages to database:', error);
      } else {
        console.log('League averages saved to database');
      }
    } catch (error) {
      console.error('Error in saveLeagueAveragesToDatabase:', error);
    }
  }

  /**
   * Test method to verify defensive calculations are working
   */
  async testDefensiveCalculations(opponent: string, statType: string = 'points', season: string = '2025'): Promise<void> {
    console.log(`\n🧪 TESTING DEFENSIVE CALCULATIONS`);
    console.log(`Opponent: ${opponent}`);
    console.log(`Stat Type: ${statType}`);
    console.log(`Season: ${season}`);
          console.log(`Current League Averages:`, this.leagueAveragesService.getLeagueAverage('points'));
    
    // Test individual defensive stats
    console.log(`\n📊 Testing Individual Defensive Stats...`);
    const { data: teamDefensiveStats } = await this.supabase
      .from('team_defensive_stats')
      .select('*')
      .eq('stat_type', statType)
      .eq('season', season);
    
    if (teamDefensiveStats && teamDefensiveStats.length > 0) {
      const opponentStats = teamDefensiveStats.find((stat: any) => stat.team === opponent);
      if (opponentStats) {
        console.log(`✅ Individual defensive stats found:`, opponentStats);
      } else {
        console.log(`❌ No individual defensive stats found for ${opponent}`);
      }
    } else {
      console.log(`❌ No team defensive stats available for ${statType}`);
    }
    
    // Test team defensive stats (for points)
    if (statType === 'points') {
      console.log(`\n📊 Testing Team Defensive Stats...`);
      const teamDefensiveStats = await this.getOpponentTeamDefensiveStats(opponent, season);
      if (teamDefensiveStats) {
        console.log(`✅ Team defensive stats calculated: ${teamDefensiveStats.toFixed(1)} points allowed per game`);
      } else {
        console.log(`❌ Could not calculate team defensive stats for ${opponent}`);
      }
    }
    
    console.log(`\n🧪 TEST COMPLETE`);
  }

  /**
   * Load league averages from database on service initialization
   */
  async loadLeagueAveragesFromDatabase(season: string = '2025'): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('league_averages')
        .select('*')
        .eq('season', season)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error loading league averages from database:', error);
        return;
      }

      if (data && data.length > 0) {
        const latest = data[0];
        const averages = {
          points: latest.points || 82.5,
          rebounds: latest.rebounds || 35.2,
          assists: latest.assists || 18.7,
          turnovers: latest.turnovers || 14.3,
          steals: latest.steals || 7.8
        };
        
        console.log('Loaded league averages from database');
      }
    } catch (error) {
      console.error('Error loading league averages from database:', error);
    }
  }

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Initialize specialized services
    this.backToBackService = new BackToBackService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    this.paceService = new PaceService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    this.gameOutcomeService = new GameOutcomeService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    this.positionDefenseService = new PositionDefenseService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Initialize additional specialized services
    this.playerDataService = new PlayerDataService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    this.leagueAveragesService = new LeagueAveragesService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    this.projectionStorageService = new ProjectionStorageService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    this.gameDataService = new GameDataService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  public static getInstance(): ProjectionDataService {
    if (!ProjectionDataService.instance) {
      ProjectionDataService.instance = new ProjectionDataService();
    }
    return ProjectionDataService.instance;
  }

    /**
   * Get all available players from the database
   */
  async getAvailablePlayers(): Promise<string[]> {
    return this.playerDataService.getAvailablePlayers();
  }

  /**
   * Get all available teams from the database
   */
  async getAvailableTeams(): Promise<string[]> {
    return this.playerDataService.getAvailableTeams();
  }

  /**
   * Get player's team from the players table
   */
  async getPlayerTeam(playerName: string): Promise<string | null> {
    return this.playerDataService.getPlayerTeam(playerName);
  }

  /**
   * Get team defensive stats for a specific stat type
   */
  async getTeamDefensiveStats(statType: string, season: string = '2025'): Promise<TeamDefensiveStats[]> {
    return this.gameDataService.getTeamDefensiveStats(statType, season);
  }

  /**
   * Get player game logs for projections
   */
  async getPlayerGameLogs(
    playerName: string, 
    season: string = '2025',
    limit: number = 50
  ): Promise<PlayerGameLog[]> {
    return this.playerDataService.getPlayerGameLogs(playerName, limit);
  }

  /**
   * Get official WNBA team defensive stats from database
   * Source: https://stats.wnba.com/teams/opponent/?sort=W&dir=-1
   */
  async getOfficialTeamDefensiveStats(season: string = '2025'): Promise<Map<string, number>> {
    try {
      console.log(`🏀 Fetching WNBA team defensive stats from database for ${season} season...`);
      
      // Try to get data from database first
      const { data, error } = await this.supabase
        .from('team_defensive_stats')
        .select('team, overall_avg_allowed')
        .eq('season', season)
        .eq('stat_type', 'points');

      if (error) {
        console.error('❌ Error fetching team defensive stats from database:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const teamStats = new Map<string, number>();
        data.forEach((stat: { team: string; overall_avg_allowed: number }) => {
          teamStats.set(stat.team, stat.overall_avg_allowed);
        });
        
        console.log(`✅ Found ${teamStats.size} teams with defensive stats in database`);
        return teamStats;
      }
      
      console.log('⚠️  No team defensive stats found in database, using fallback values');
      throw new Error('No data in database');
      
    } catch (error) {
      console.error('❌ Error loading official team defensive stats:', error);
      
      // Fallback to hardcoded values
      return new Map<string, number>([
        ['New York Liberty', 80.9],      // Best defense
        ['Las Vegas Aces', 82.9],        // Updated from 81.2 to 82.9
        ['Washington Mystics', 82.1],    // Good defense
        ['Minnesota Lynx', 82.3],        // Good defense
        ['Seattle Storm', 82.8],         // Average defense
        ['Indiana Fever', 83.1],         // Average defense
        ['Phoenix Mercury', 83.4],       // Average defense
        ['Dallas Wings', 83.7],          // Average defense
        ['Chicago Sky', 84.2],           // Below average defense
        ['Atlanta Dream', 84.8],         // Below average defense
        ['Los Angeles Sparks', 85.1],    // Weak defense
        ['Connecticut Sun', 86.7]        // Worst defense
      ]);
    }
  }

  /**
   * Get fallback team defense value when position-specific data is unavailable
   */
  private getFallbackTeamDefense(team: string): number {
    const fallbackValues = new Map<string, number>([
      ['New York Liberty', 80.9],      // Best defense
      ['Las Vegas Aces', 82.9],        // Updated from 81.2 to 82.9
      ['Washington Mystics', 82.1],    // Good defense
      ['Minnesota Lynx', 82.3],        // Good defense
      ['Seattle Storm', 82.8],         // Average defense
      ['Indiana Fever', 83.1],         // Average defense
      ['Phoenix Mercury', 83.4],       // Average defense
      ['Dallas Wings', 83.7],          // Average defense
      ['Chicago Sky', 84.2],           // Below average defense
      ['Atlanta Dream', 84.8],         // Below average defense
      ['Los Angeles Sparks', 85.1],    // Weak defense
      ['Connecticut Sun', 86.7]        // Worst defense
    ]);
    
    return fallbackValues.get(team) || 83.0; // Default to average if team not found
  }

  /**
   * Get upcoming games for projections
   */
  async getUpcomingGames(limit: number = 10): Promise<any[]> {
    return this.gameDataService.getUpcomingGames(limit);
  }

  /**
   * Get upcoming opponent for a player by name
   */
  async getPlayerUpcomingOpponent(playerName: string): Promise<string | null> {
    try {
      // First get the player's team
      const playerTeam = await this.getPlayerTeam(playerName);
      if (!playerTeam) {
        console.log(`No team found for player: ${playerName}`);
        return null;
      }

      // Get upcoming games
      const upcomingGames = await this.getUpcomingGames(50);
      if (!upcomingGames || upcomingGames.length === 0) {
        console.log('No upcoming games found');
        return null;
      }

      const now = new Date();
      
      // Find the next game for the player's team
      const nextGame = upcomingGames
        .filter(game => new Date(game.commence_time || game.date) > now)
        .sort((a, b) => new Date(a.commence_time || a.date).getTime() - new Date(b.commence_time || b.date).getTime())
        .find(game => {
          const homeTeam = game.home_team || game.home;
          const awayTeam = game.away_team || game.away;
          return homeTeam === playerTeam || awayTeam === playerTeam;
        });

      if (nextGame) {
        const homeTeam = nextGame.home_team || nextGame.home;
        const awayTeam = nextGame.away_team || nextGame.away;
        const opponent = homeTeam === playerTeam ? awayTeam : homeTeam;
        console.log(`Found upcoming opponent for ${playerName}: ${opponent}`);
        return opponent;
      }

      console.log(`No upcoming games found for ${playerName}'s team (${playerTeam})`);
      return null;
    } catch (error) {
      console.error('Error getting player upcoming opponent:', error);
      return null;
    }
  }

  /**
   * Calculate days rest for a player
   */
  async calculateDaysRest(playerName: string, gameDate: string): Promise<number> {
    return this.playerDataService.calculateDaysRest(playerName, gameDate);
  }

  /**
   * Get teammate injuries for a team
   */
  async getTeammateInjuries(team: string, gameDate: string): Promise<string[]> {
    console.log(`🏥 PROJECTION SERVICE: getTeammateInjuries called for team: ${team}, gameDate: ${gameDate}`);
    const result = await this.playerDataService.getTeammateInjuries(team, gameDate);
    console.log(`🏥 PROJECTION SERVICE: getTeammateInjuries result:`, result);
    return result;
  }

  /**
   * Generate projection for a player
   */
  async generateProjection(request: ProjectionRequest): Promise<ProjectionResult | null> {
    console.log(`🏥 GENERATE PROJECTION: Starting with request:`, request);
    console.log(`🏥 GENERATE PROJECTION: Teammate injuries at start:`, request.teammateInjuries);
    
    try {
      // FIRST: Try to use PACE-enhanced regression models via API route
      console.log('🧠 Attempting regression model projection via API...');
      
      try {
        // Call the API route for regression projection
        const apiResponse = await fetch('/api/projections', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });
        
        if (apiResponse.ok) {
          const apiResult = await apiResponse.json();
          
          if (apiResult.success && apiResult.method === 'regression') {
            console.log('🎉 API regression model projection successful! Using as primary result.');
            console.log(`   ${request.playerName}: ${apiResult.result.projectedValue.toFixed(1)} ${request.statType}`);
            console.log(`   Method: ${apiResult.method}`);
            console.log(`   PACE Features: ${apiResult.result.modelMetrics?.hasPaceFeatures ? '✅' : '❌'}`);
            console.log(`🔍 ProjectionDataService: Received data:`);
            console.log(`   recentFormPercentage: ${apiResult.result.recentFormPercentage}%`);
            console.log(`   matchupAnalysis: ${apiResult.result.matchupAnalysis}`);
            console.log(`   matchupAnalysisText: ${apiResult.result.matchupAnalysisText}`);
            
            return apiResult.result;
          } else {
            console.log(`⚠️ API regression failed: ${apiResult.message}`);
          }
        } else {
          console.log(`❌ API call failed with status: ${apiResponse.status}`);
        }
      } catch (error) {
        console.error('❌ Error with API regression service, falling back to legacy method:', error);
        console.log('   Error details:', error instanceof Error ? error.message : String(error));
      }
      
      // FALLBACK: Use legacy projection calculation
      console.log('🔄 Falling back to legacy projection calculation...');
      
      // Get required data - fetch more games to ensure we get the truly most recent 10
      const [playerStats, teamDefensiveStats] = await Promise.all([
        this.getPlayerGameLogs(request.playerName, '2025', 50), // Increased from default 20 to 50
        this.getTeamDefensiveStats(request.statType)
      ]);

      if (playerStats.length === 0) {
        console.warn(`No game logs found for player: ${request.playerName}`);
        return null;
      }

      // Calculate days rest if not provided
      if (!request.daysRest) {
        request.daysRest = await this.calculateDaysRest(request.playerName, request.gameDate);
      }

      // Get teammate injuries if not provided
      if (!request.teammateInjuries) {
        request.teammateInjuries = await this.getTeammateInjuries(request.team, request.gameDate);
      }

      // Route to specialized projection services for different stat types
      // Note: ReboundsProjectionService removed - using unified projection logic

      // Calculate projection manually since ProjectionEngine import is not working
      console.log('Calculating projection manually...');
      
      // Try to get season average from season_averages table first
      let seasonAverage = 0;
      try {
        const { data: seasonData, error: seasonError } = await this.supabase
          .from('season_averages')
          .select('*')
          .eq('player_name', request.playerName)
          .eq('season', '2025')
          .single();
        
        if (!seasonError && seasonData) {
          // Map stat type to the correct column in season_averages
          const statColumnMap: Record<string, string> = {
            'points': 'points_per_game',
            'rebounds': 'rebounds_per_game',
            'assists': 'assists_per_game',
            'steals': 'steals_per_game',
            'blocks': 'blocks_per_game',
            'turnovers': 'turnovers_per_game'
          };
          
          const statColumn = statColumnMap[request.statType];
          if (statColumn && seasonData[statColumn]) {
            seasonAverage = seasonData[statColumn];
            console.log(`✅ Season average for ${request.statType}: ${seasonAverage.toFixed(1)} (from season_averages table)`);
          } else {
            throw new Error(`Stat column ${statColumn} not found in season data`);
          }
        } else {
          throw new Error('No season data found, falling back to game log calculation');
        }
      } catch (error) {
        // Fallback to calculating from game logs
        console.log(`⚠️  Season average lookup failed, calculating from game logs: ${error instanceof Error ? error.message : String(error)}`);
        const statValues = playerStats.map(game => game[request.statType] as number).filter(val => val !== undefined && !isNaN(val));
        seasonAverage = statValues.length > 0 ? statValues.reduce((sum, val) => sum + val, 0) / statValues.length : 0;
        console.log(`Season average for ${request.statType}: ${seasonAverage.toFixed(1)} (from ${statValues.length} games)`);
      }
      
            // Calculate recent form (last 10 games)
      console.log(`Calculating recent form for ${request.playerName} - total games available: ${playerStats.length}`);
      

      
      // Sort by date and get last 10 games with better date handling
      // The gameDate format is "Wed, May 28, 2025" so we need to parse it correctly
      const sortedGames = playerStats
        .map(game => {
          let parsedDate: Date;
          let gameDateStr: string = '';
          
          try {
            // Handle the format "Wed, May 28, 2025"
            // The database field is game_date, not gameDate
            gameDateStr = (game as any).game_date;
            
            if (gameDateStr && typeof gameDateStr === 'string' && gameDateStr.includes(', ')) {
              const dateParts = gameDateStr.split(', ');
              if (dateParts.length === 3) {
                const monthDay = dateParts[1]; // "May 28"
                const year = dateParts[2]; // "2025"
                parsedDate = new Date(`${monthDay}, ${year}`);
              } else {
                parsedDate = new Date(gameDateStr);
              }
            } else {
              parsedDate = new Date(gameDateStr);
            }
            
            // Validate the parsed date
            if (isNaN(parsedDate.getTime())) {
              console.log(`⚠️  Invalid date for game: ${gameDateStr}, using fallback`);
              parsedDate = new Date(); // Use current date as fallback
            }
          } catch (error) {
            console.log(`⚠️  Date parsing error for game: ${gameDateStr}, using fallback`);
            parsedDate = new Date(); // Use current date as fallback
          }
          
          return {
            ...game,
            parsedDate: parsedDate
          };
        })
        .sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
      

      
      const recentGames = sortedGames.slice(0, 10);
      
      const recentValues = recentGames.map(game => game[request.statType] as number).filter(val => val !== undefined && !isNaN(val));
      
      // IMPORTANT: Don't fall back to seasonAverage - calculate recent form from actual recent games
      let recentForm = 0;
      if (recentValues.length > 0) {
        recentForm = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
        console.log(`Recent form calculation: ${recentValues.length} valid games, average: ${recentForm.toFixed(1)}`);
      } else {
        console.log(`⚠️  No valid recent games found, recent form will be 0`);
        recentForm = 0;
      }
      
      // Calculate head-to-head performance against this opponent
      const h2hGames = playerStats.filter(game => game.opponent === request.opponent);
      const h2hValues = h2hGames.map(game => game[request.statType] as number).filter(val => val !== undefined && !isNaN(val));
      const h2hAverage = h2hValues.length > 0 ? h2hValues.reduce((sum, val) => sum + val, 0) / h2hValues.length : seasonAverage;
      console.log(`Head-to-head vs ${request.opponent}: ${h2hAverage.toFixed(1)} (from ${h2hValues.length} games)`);
      
      // Calculate weighted projection (favor recent form and head-to-head)
      let projectedValue = (seasonAverage * 0.4) + (recentForm * 0.4) + (h2hAverage * 0.2);
      console.log(`Weighted projection before home/away: ${projectedValue.toFixed(1)} = (${seasonAverage.toFixed(1)} × 0.4) + (${recentForm.toFixed(1)} × 0.4) + (${h2hAverage.toFixed(1)} × 0.2)`);
      
      // Apply home/away factor
      if (request.isHome) {
        projectedValue *= 1.05; // 5% boost at home
        console.log(`Home game adjustment: ${projectedValue.toFixed(1)} × 1.05 = ${projectedValue.toFixed(1)}`);
      } else {
        projectedValue *= 0.98; // 2% reduction on road
        console.log(`Away game adjustment: ${projectedValue.toFixed(1)} × 0.98 = ${projectedValue.toFixed(1)}`);
      }
      
      // Check for back-to-back games (consecutive days) - Lower impact factor
      const backToBackAdjustment = await this.backToBackService.checkBackToBackGames(request.team, request.gameDate);
      if (backToBackAdjustment !== 1.0) {
        // Apply with 60% weight to prevent over-adjustment
        const weightedAdjustment = Math.pow(backToBackAdjustment, 0.6);
        projectedValue *= weightedAdjustment;
        console.log(`🔄 Back-to-back adjustment: ×${weightedAdjustment.toFixed(3)} (${backToBackAdjustment.toFixed(3)} with 60% weight) = ${projectedValue.toFixed(1)}`);
      }
      
      // Check opponent's PACE rating (affects scoring opportunities) - High impact factor
      const paceAdjustment = await this.paceService.checkOpponentPace(request.opponent);
      if (paceAdjustment !== 1.0) {
        // Apply with full weight as pace is critical for scoring
        projectedValue *= paceAdjustment;
        console.log(`🏃‍♀️ PACE adjustment: ×${paceAdjustment.toFixed(3)} (full weight) = ${projectedValue.toFixed(1)}`);
      }
      
      // Calculate injury impact factor
      
      
      let injuryImpact = 1.0;
      if (request.teammateInjuries && request.teammateInjuries.length > 0) {

        try {
          // Import the injury impact service dynamically to avoid circular dependencies
          const { InjuryImpactService } = await import('./InjuryImpactService');
          
          // Get player position if not provided (needed for injury impact calculation)
          if (!request.playerPosition) {
            request.playerPosition = await this.getPlayerPosition(request.playerName);
          }
          
          // Calculate detailed injury impact
          const injuryImpactData = await InjuryImpactService.calculateInjuryImpact(
            request.team,
            request.gameDate,
            request.playerPosition || 'Unknown',
            request.playerName,
            request.statType as 'points' | 'rebounds' | 'assists'
          );
          
          injuryImpact = injuryImpactData.factor;
          console.log(`🏥 INJURY IMPACT: ${injuryImpactData.reason}`);
          console.log(`🏥 Significant injuries: ${injuryImpactData.significantInjuries.join(', ')}`);
          console.log(`🏥 Impact factor: ×${injuryImpact.toFixed(3)} = ${(projectedValue * injuryImpact).toFixed(1)}`);
          
        } catch (error) {
          console.warn('Error calculating detailed injury impact, using simple heuristic:', error);
          // Fallback to simple heuristic
          const injuryCount = request.teammateInjuries.length;
          if (injuryCount === 1) injuryImpact = 1.05; // Slight boost
          else if (injuryCount === 2) injuryImpact = 1.1; // Moderate boost
          else if (injuryCount >= 3) injuryImpact = 1.15; // Significant boost
          
          console.log(`🏥 INJURY IMPACT (fallback): ${injuryCount} injuries = ×${injuryImpact.toFixed(3)}`);
        }
        
        // Apply injury impact to projected value - Medium impact factor
        // Apply with 80% weight to prevent over-adjustment
        const weightedInjuryImpact = Math.pow(injuryImpact, 0.8);
        projectedValue *= weightedInjuryImpact;
        console.log(`🏥 Weighted injury impact: ×${weightedInjuryImpact.toFixed(3)} (${injuryImpact.toFixed(3)} with 80% weight) = ${projectedValue.toFixed(1)}`);
              }

      // Apply usage percentage adjustment for points projections
      if (request.statType === 'points') {
        try {
          const season = this.extractSeasonFromDate(request.gameDate);
          const usagePercentage = await this.getPlayerUsagePercentage(request.playerName, season);
          
          if (usagePercentage > 0) {
            // Calculate usage adjustment factor
            // High usage players (>25%) get a boost, low usage players (<15%) get a reduction
            let usageAdjustment = 1.0;
            
            if (usagePercentage >= 25) {
              // Very high usage players get significant boost
              usageAdjustment = 1.08; // +8%
              console.log(`📊 High usage player (${usagePercentage}%): +8% boost`);
            } else if (usagePercentage >= 20) {
              // High usage players get moderate boost
              usageAdjustment = 1.05; // +5%
              console.log(`📊 High usage player (${usagePercentage}%): +5% boost`);
            } else if (usagePercentage >= 15) {
              // Medium usage players get slight boost
              usageAdjustment = 1.02; // +2%
              console.log(`📊 Medium usage player (${usagePercentage}%): +2% boost`);
            } else if (usagePercentage < 10) {
              // Very low usage players get reduction
              usageAdjustment = 0.95; // -5%
              console.log(`📊 Low usage player (${usagePercentage}%): -5% reduction`);
            } else {
              // Low usage players get slight reduction
              usageAdjustment = 0.98; // -2%
              console.log(`📊 Low usage player (${usagePercentage}%): -2% reduction`);
            }
            
            const beforeUsageAdjustment = projectedValue;
            // Usage is a high impact factor - apply with full weight
            projectedValue *= usageAdjustment;
            console.log(`📊 Usage percentage adjustment: ${beforeUsageAdjustment.toFixed(1)} × ${usageAdjustment.toFixed(3)} (full weight) = ${projectedValue.toFixed(1)}`);
          } else {
            console.log(`📊 No usage percentage data available for ${request.playerName}, skipping adjustment`);
          }
        } catch (error) {
          console.log(`Error applying usage percentage adjustment:`, error);
        }

        // Apply PER (Player Efficiency Rating) adjustment for better accuracy
        try {
          const season = this.extractSeasonFromDate(request.gameDate);
          const perFactor = await this.calculatePERFactor(request.playerName, season);
          
          if (perFactor !== 1.0) {
            const beforePERAdjustment = projectedValue;
            // PER is a medium impact factor - apply with 80% weight
            const weightedPERFactor = Math.pow(perFactor, 0.8);
            projectedValue *= weightedPERFactor;
            console.log(`📊 Weighted PER adjustment: ${beforePERAdjustment.toFixed(1)} × ${weightedPERFactor.toFixed(3)} (${perFactor.toFixed(3)} with 80% weight) = ${projectedValue.toFixed(1)}`);
          }
        } catch (error) {
          console.log(`Error applying PER adjustment:`, error);
        }
      }
      
      // OLD INDIVIDUAL DEFENSIVE ADJUSTMENT REMOVED - Now using position-specific system only
      console.log(`\n=== POSITION-SPECIFIC DEFENSIVE SYSTEM (${request.statType.toUpperCase()}) ===`);
      console.log(`Opponent: ${request.opponent}`);
      console.log(`Home/Away: ${request.isHome ? 'Home' : 'Away'}`);
      console.log(`Note: Individual defensive adjustment replaced with position-specific analysis below`);

        // Apply position-specific defensive adjustment for ALL stat types
        if (request.statType === 'points') {
          console.log(`\n=== POSITION-SPECIFIC DEFENSIVE ADJUSTMENT (${request.statType.toUpperCase()}) ===`);
          
          // Extract season from gameDate (assuming format like "Fri, May 16, 2025")
          const season = request.gameDate.includes('2025') ? '2025' : '2024';
          console.log(`Season detected from game date: ${season}`);
          
          console.log(`Fetching defensive stats for ${request.opponent}...`);
          
          // Get both overall team defense and position-specific defense
          const [overallTeamDefense, positionSpecificDefense] = await Promise.all([
            this.getOpponentTeamDefensiveStats(request.opponent, season),
            this.positionDefenseService.getOpponentPositionSpecificDefense(request.opponent, season, request.playerName)
          ]);
          
          if (overallTeamDefense || positionSpecificDefense) {
            const leagueAveragePoints = this.leagueAveragesService.getLeagueAverage('points');
            
            console.log(`Team defensive stats found:`);
            if (overallTeamDefense) {
              console.log(`- Overall points allowed by ${request.opponent}: ${overallTeamDefense.toFixed(1)}`);
            }
            if (positionSpecificDefense) {
              console.log(`- Position-specific points allowed by ${request.opponent}: ${positionSpecificDefense.toFixed(1)}`);
            }
            console.log(`- WNBA league average points: ${leagueAveragePoints.toFixed(1)}`);
            
            // Calculate dual-factor defensive adjustment
            let overallDefenseAdjustment = 1.0;
            let positionDefenseAdjustment = 1.0;
            let overallDefenseRating = '';
            let positionDefenseRating = '';
            
            // Factor 1: Overall Team Defense (indicates pace and scoring opportunities) - SECONDARY FACTOR
            if (overallTeamDefense) {
              if (overallTeamDefense <= 78.0) {
                // Elite Overall Defense - slower pace, fewer opportunities
                overallDefenseAdjustment = 0.98; // -2% (minor pace impact)
                overallDefenseRating = 'Elite Overall Defense';
                console.log(`🎯 RESULT: Elite overall defense detected (≤78.0 OPP PTS)`);
                console.log(`🎯 Applying -2% pace adjustment: ×0.98 (minor pace impact)`);
              } else if (overallTeamDefense <= 81.5) {
                // Strong Overall Defense - moderate pace
                overallDefenseAdjustment = 0.99; // -1% (minimal pace impact)
                overallDefenseRating = 'Strong Overall Defense';
                console.log(`🎯 RESULT: Strong overall defense detected (78.1-81.5 OPP PTS)`);
                console.log(`🎯 Applying -1% pace adjustment: ×0.99 (minimal pace impact)`);
              } else if (overallTeamDefense <= 84.5) {
                // Average Overall Defense - normal pace
                overallDefenseAdjustment = 1.0; // No adjustment
                overallDefenseRating = 'Average Overall Defense';
                console.log(`🎯 RESULT: Average overall defense detected (81.6-84.5 OPP PTS)`);
                console.log(`🎯 No pace adjustment needed: ×1.0 (normal scoring opportunities)`);
              } else {
                // Weak Overall Defense - high pace, more opportunities
                overallDefenseAdjustment = 1.01; // +1% (minor pace boost)
                overallDefenseRating = 'Weak Overall Defense';
                console.log(`🎯 RESULT: Weak overall defense detected (>84.5 OPP PTS)`);
                console.log(`🎯 Applying +1% pace adjustment: ×1.01 (minor pace boost)`);
              }
            }
            
            // Factor 2: Position-Specific Defense (how well they guard the specific position) - PRIMARY FACTOR
            if (positionSpecificDefense) {
              // Get position-specific thresholds based on the data we collected
              const positionThresholds = this.positionDefenseService['getPositionSpecificThresholds'](request.playerName);
              
              if (positionSpecificDefense <= positionThresholds.elite) {
                // Elite Position Defense - significant reduction
                positionDefenseAdjustment = 0.88; // -12% (very difficult to score)
                positionDefenseRating = 'Elite Position Defense';
                console.log(`🎯 RESULT: Elite position defense detected (≤${positionThresholds.elite.toFixed(1)} OPP PTS)`);
                console.log(`🎯 Applying -12% position adjustment: ×0.88 (very difficult to score)`);
              } else if (positionSpecificDefense <= positionThresholds.strong) {
                // Strong Position Defense - moderate reduction
                positionDefenseAdjustment = 0.94; // -6% (difficult to score)
                positionDefenseRating = 'Strong Position Defense';
                console.log(`🎯 RESULT: Strong position defense detected (≤${positionThresholds.strong.toFixed(1)} OPP PTS)`);
                console.log(`🎯 Applying -6% position adjustment: ×0.94 (difficult to score)`);
              } else if (positionSpecificDefense <= positionThresholds.average) {
                // Average Position Defense - no adjustment
                positionDefenseAdjustment = 1.0; // No adjustment
                positionDefenseRating = 'Average Position Defense';
                console.log(`🎯 RESULT: Average position defense detected (≤${positionThresholds.average.toFixed(1)} OPP PTS)`);
                console.log(`🎯 No position adjustment needed: ×1.0 (normal difficulty)`);
              } else {
                // Weak Position Defense - significant boost
                positionDefenseAdjustment = 1.10; // +10% (easy to score)
                positionDefenseRating = 'Weak Position Defense';
                console.log(`🎯 RESULT: Weak position defense detected (>${positionThresholds.average.toFixed(1)} OPP PTS)`);
                console.log(`🎯 Applying +10% position adjustment: ×1.10 (easy to score)`);
              }
            }
            
            // Combine both adjustments for final defensive factor
            // Position defense gets more weight (70%) vs overall defense (30%)
            const combinedDefenseAdjustment = (positionDefenseAdjustment * 0.7) + (overallDefenseAdjustment * 0.3);
            
            console.log(`\n📊 Combined Defensive Analysis:`);
            console.log(`  - Overall Defense: ${overallDefenseRating} (${overallTeamDefense?.toFixed(1) || 'N/A'} OPP PTS) - 30% weight`);
            console.log(`  - Position Defense: ${positionDefenseRating} (${positionSpecificDefense?.toFixed(1) || 'N/A'} OPP PTS) - 70% weight`);
            console.log(`  - Combined Adjustment: (${positionDefenseAdjustment.toFixed(3)} × 0.7) + (${overallDefenseAdjustment.toFixed(3)} × 0.3) = ${combinedDefenseAdjustment.toFixed(3)}`);
              
              const beforeAdjustment = projectedValue;
            projectedValue *= combinedDefenseAdjustment;
            console.log(`📊 Combined defensive adjustment: ${beforeAdjustment.toFixed(1)} × ${combinedDefenseAdjustment.toFixed(3)} = ${projectedValue.toFixed(1)}`);
            
          } else {
            console.log(`⚠️  No team defensive stats found for ${request.opponent}`);
          }
        } else {
          console.log(`\n=== POSITION-SPECIFIC DEFENSIVE ADJUSTMENT ===`);
          console.log(`Skipping position-specific defensive adjustment - not a points projection (${request.statType})`);
        }
        
        // Apply regression factor (regression to mean for outliers)
        try {
          const regressionFactor = await this.calculateRegressionFactor(playerStats, request.statType);
          if (regressionFactor !== 1.0) {
            const beforeRegression = projectedValue;
            // Regression is a low impact factor - apply with 60% weight
            const weightedRegressionFactor = Math.pow(regressionFactor, 0.6);
            projectedValue *= weightedRegressionFactor;
            console.log(`📊 Weighted regression adjustment: ${beforeRegression.toFixed(1)} × ${weightedRegressionFactor.toFixed(3)} (${regressionFactor.toFixed(3)} with 60% weight) = ${projectedValue.toFixed(1)}`);
          }
        } catch (error) {
          console.log(`Error applying regression adjustment:`, error);
        }
        
        // Round to 1 decimal place
        projectedValue = Math.round(projectedValue * 10) / 10;
        
        console.log(`\n=== FINAL PROJECTION SUMMARY ===`);
        console.log(`🎯 Final projected value: ${projectedValue.toFixed(1)}`);
        console.log(`📊 Projection breakdown:`);
        console.log(`  - Base projection (season avg + recent form + h2h): ${((seasonAverage * 0.4) + (recentForm * 0.4) + (h2hAverage * 0.2)).toFixed(1)}`);
        console.log(`  - Home/Away adjustment: ${request.isHome ? '+5%' : '-2%'}`);
        console.log(`  - Back-to-back adjustment: ${backToBackAdjustment !== 1.0 ? `×${backToBackAdjustment.toFixed(3)} (-6% due to fatigue)` : 'None (team had rest day)'}`);
        console.log(`  - PACE adjustment: ${paceAdjustment !== 1.0 ? `×${paceAdjustment.toFixed(3)} (${paceAdjustment > 1.0 ? '+' : ''}${((paceAdjustment - 1) * 100).toFixed(1)}% due to ${paceAdjustment > 1.0 ? 'high' : 'low'} PACE)` : 'None (average PACE)'}`);
        console.log(`  - Injury impact adjustment: ${injuryImpact !== 1.0 ? `×${injuryImpact.toFixed(3)} (${injuryImpact > 1.0 ? '+' : ''}${((injuryImpact - 1) * 100).toFixed(1)}% due to teammate injuries)` : 'None (no significant injuries)'}`);
        console.log(`  - Usage percentage adjustment: ${request.statType === 'points' ? 'Applied above (up to ±8% based on USG%)' : 'N/A (not points)'}`);
        console.log(`  - Position-specific defensive adjustment: ${request.statType === 'points' ? 'Applied above (up to ±12%)' : 'N/A (not points)'}`);
        console.log(`  - Final value: ${projectedValue.toFixed(1)}`);
        
        if (request.sportsbookLine) {
          const edge = projectedValue - request.sportsbookLine;
          console.log(`💰 Edge vs Book Line: ${projectedValue.toFixed(1)} - ${request.sportsbookLine.toFixed(1)} = ${edge > 0 ? '+' : ''}${edge.toFixed(1)}`);
        }
      
      // Calculate confidence score based on data availability
      let confidenceScore = 0.5; // Base confidence
      if (playerStats.length >= 20) confidenceScore += 0.2;
      else if (playerStats.length >= 10) confidenceScore += 0.1;
      if (h2hGames.length >= 3) confidenceScore += 0.1;
      if (recentValues.length >= 8) confidenceScore += 0.1;
      confidenceScore = Math.min(confidenceScore, 0.9);
      
      // Calculate edge vs sportsbook line
      const edge = request.sportsbookLine ? projectedValue - request.sportsbookLine : 0;
      
      // Enhanced Risk Level Calculation - Factors in multiple risk factors
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
      
      // Factor 1: Data Confidence (30% weight)
      const dataConfidenceRisk = confidenceScore >= 0.8 ? 0 : confidenceScore >= 0.6 ? 0.5 : 1;
      console.log(`DEBUG: confidenceScore=${confidenceScore}, dataConfidenceRisk=${dataConfidenceRisk}`);
      
      // Factor 2: Edge vs Line (25% weight) - closer to line = higher risk
      let edgeRisk = 0;
      if (request.sportsbookLine) {
        const edgeAbs = Math.abs(edge);
        if (edgeAbs <= 1.0) edgeRisk = 1;        // Very close = HIGH risk (below recommendation threshold)
        else if (edgeAbs <= 1.5) edgeRisk = 1;   // Close = HIGH risk
        else if (edgeAbs <= 2.0) edgeRisk = 0.6; // Moderate = MEDIUM-HIGH risk
        else if (edgeAbs <= 3.0) edgeRisk = 0.3; // Good = MEDIUM risk
        else edgeRisk = 0;                        // Large edge = LOW risk
        console.log(`DEBUG: edge=${edge}, edgeAbs=${edgeAbs}, edgeRisk=${edgeRisk}`);
      } else {
        console.log(`DEBUG: No sportsbook line, edgeRisk=${edgeRisk}`);
      }
      
      // Factor 3: Matchup Analysis (25% weight) - unfavorable = higher risk
      let matchupRisk = 0;
      if (request.statType === 'points') {
        try {
          const season = this.extractSeasonFromDate(request.gameDate);
          const positionSpecificDefense = await this.positionDefenseService.getOpponentPositionSpecificDefense(request.opponent, season, request.playerName);
          
          // Get position-specific defense or fall back to overall team defense
          let defensiveValue = positionSpecificDefense;
          let defenseSource = 'position-specific';
          
          if (!defensiveValue) {
            // Fallback to overall team defense (points allowed per game)
            try {
              const { data: teamDefense, error } = await this.supabase
                .from('team_defensive_stats')
                .select('overall_avg_allowed')
                .eq('team', request.opponent)
                .eq('stat_type', 'points')
                .eq('season', season)
                .limit(1);
              
              if (!error && teamDefense && teamDefense.length > 0) {
                // Convert team points allowed to per-player estimate (divide by 5)
                defensiveValue = teamDefense[0].overall_avg_allowed / 5;
                defenseSource = 'overall-team-fallback';
                console.log(`DEBUG: Using fallback team defense: ${teamDefense[0].overall_avg_allowed} / 5 = ${defensiveValue}`);
              } else {
                // Final fallback to hardcoded values
                const fallbackDefense = this.getFallbackTeamDefense(request.opponent);
                defensiveValue = fallbackDefense;
                defenseSource = 'hardcoded-fallback';
                console.log(`DEBUG: Using hardcoded fallback defense: ${defensiveValue}`);
              }
            } catch (fallbackError) {
              // Final fallback to hardcoded values
              const fallbackDefense = this.getFallbackTeamDefense(request.opponent);
              defensiveValue = fallbackDefense;
              defenseSource = 'hardcoded-fallback-error';
              console.log(`DEBUG: Using hardcoded fallback due to error: ${defensiveValue}`);
            }
          }
          
          if (defensiveValue) {
            const playerPosition = this.positionDefenseService['determinePlayerPosition'](request.playerName);
            const positionThresholds = this.positionDefenseService['getPositionSpecificThresholds'](request.playerName);
            
            // Calculate defensive matchup factor for risk assessment using per-player logic
            let defensiveFactor = 100; // neutral
            
            // Use the same per-player league average logic
            const leagueAverage = 13.2; // Per-player average for points
            const defensiveRatio = defensiveValue / leagueAverage;
            
            if (defensiveRatio > 2.0) {
              defensiveFactor = 140; // Very weak defense = very favorable (+40%)
            } else if (defensiveRatio > 1.5) {
              defensiveFactor = 135; // Weak defense = favorable (+35%)
            } else if (defensiveRatio > 1.2) {
              defensiveFactor = 130; // Below average defense = favorable (+30%)
            } else if (defensiveRatio < 0.8) {
              defensiveFactor = 75; // Strong defense = unfavorable (-25%)
            } else {
              defensiveFactor = 100; // Average defense = neutral (0%)
            }
            
            // Combine historical performance with defensive matchup for risk
            const historicalH2H = seasonAverage > 0 ? (h2hAverage / seasonAverage) * 100 : 100;
            const combinedMatchup = (historicalH2H * 0.7) + (defensiveFactor * 0.3);
            
            if (combinedMatchup < 95) matchupRisk = 1;        // Unfavorable = HIGH risk
            else if (combinedMatchup < 105) matchupRisk = 0.5; // Neutral = MEDIUM risk
            else matchupRisk = 0;                              // Favorable = LOW risk
            
            console.log(`DEBUG: ${defenseSource} defense=${defensiveValue}, defensiveFactor=${defensiveFactor}, historicalH2H=${historicalH2H}, combinedMatchup=${combinedMatchup}, matchupRisk=${matchupRisk}`);
          } else {
            console.log(`DEBUG: No defense data available, matchupRisk=${matchupRisk}`);
          }
        } catch (error) {
          console.log(`Could not calculate matchup risk:`, error);
          matchupRisk = 0.5; // Default to medium risk if error
          console.log(`DEBUG: Matchup risk calculation failed, defaulting to ${matchupRisk}`);
        }
      } else {
        console.log(`DEBUG: Not points stat type, matchupRisk=${matchupRisk}`);
      }
      
      // Factor 4: Performance Stability (20% weight) - volatile = higher risk
      let stabilityRisk = 0;
      if (seasonAverage > 0) {
        const recentFormValue = recentValues.length > 0 ? recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length : seasonAverage;
        const variance = Math.abs(recentFormValue - seasonAverage) / seasonAverage;
        
        if (variance <= 0.05) stabilityRisk = 0;      // ≤5% variance = LOW risk
        else if (variance <= 0.15) stabilityRisk = 0.5; // 5-15% variance = MEDIUM risk
        else stabilityRisk = 1;                         // >15% variance = HIGH risk
        
        console.log(`DEBUG: seasonAverage=${seasonAverage}, recentFormValue=${recentFormValue}, variance=${variance}, stabilityRisk=${stabilityRisk}`);
      } else {
        console.log(`DEBUG: No season average, stabilityRisk=${stabilityRisk}`);
      }

      // Factor 5: Usage Percentage Impact (15% weight) - high usage = lower risk for points
      let usageRisk = 0;
      if (request.statType === 'points') {
        try {
          const season = this.extractSeasonFromDate(request.gameDate);
          const usagePercentage = await this.getPlayerUsagePercentage(request.playerName, season);
          
          if (usagePercentage > 0) {
            // High usage players tend to be more consistent and reliable
            if (usagePercentage >= 25) {
              usageRisk = 0;        // Very high usage = LOW risk
            } else if (usagePercentage >= 20) {
              usageRisk = 0.2;      // High usage = LOW-MEDIUM risk
            } else if (usagePercentage >= 15) {
              usageRisk = 0.4;      // Medium usage = MEDIUM risk
            } else if (usagePercentage >= 10) {
              usageRisk = 0.6;      // Low usage = MEDIUM-HIGH risk
            } else {
              usageRisk = 0.8;      // Very low usage = HIGH risk
            }
            
            console.log(`DEBUG: usagePercentage=${usagePercentage}%, usageRisk=${usageRisk}`);
          } else {
            usageRisk = 0.5; // Default to medium risk if no usage data
            console.log(`DEBUG: No usage data, usageRisk=${usageRisk}`);
          }
        } catch (error) {
          usageRisk = 0.5; // Default to medium risk if error
          console.log(`DEBUG: Usage risk calculation failed, defaulting to ${usageRisk}`);
        }
      } else {
        usageRisk = 0; // Not applicable for non-points stats
        console.log(`DEBUG: Not points stat type, usageRisk=${usageRisk}`);
      }
      
      // Calculate weighted risk score (0 = LOW risk, 1 = HIGH risk)
      const weightedRiskScore = (
        (dataConfidenceRisk * 0.25) +    // 25% weight (reduced from 30%)
        (edgeRisk * 0.25) +              // 25% weight
        (matchupRisk * 0.25) +           // 25% weight
        (stabilityRisk * 0.15) +         // 15% weight (reduced from 20%)
        (usageRisk * 0.10)               // 10% weight (new factor)
      );
      
      console.log(`DEBUG: Final calculation breakdown:`);
      console.log(`  dataConfidenceRisk * 0.25 = ${dataConfidenceRisk} * 0.25 = ${(dataConfidenceRisk * 0.25).toFixed(3)}`);
      console.log(`  edgeRisk * 0.25 = ${edgeRisk} * 0.25 = ${(edgeRisk * 0.25).toFixed(3)}`);
      console.log(`  matchupRisk * 0.25 = ${matchupRisk} * 0.25 = ${(matchupRisk * 0.25).toFixed(3)}`);
      console.log(`  stabilityRisk * 0.15 = ${stabilityRisk} * 0.15 = ${(stabilityRisk * 0.15).toFixed(3)}`);
      console.log(`  usageRisk * 0.10 = ${usageRisk} * 0.10 = ${(usageRisk * 0.10).toFixed(3)}`);
      console.log(`  Total weightedRiskScore = ${weightedRiskScore.toFixed(3)}`);
      
      // Determine final risk level based on weighted score
      let calculatedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      if (weightedRiskScore <= 0.20) {
        calculatedRiskLevel = 'LOW';
      } else if (weightedRiskScore > 0.20 && weightedRiskScore <= 0.50) {
        calculatedRiskLevel = 'MEDIUM';
      } else {
        calculatedRiskLevel = 'HIGH';
      }
      
      // Assign to the main riskLevel variable
      riskLevel = calculatedRiskLevel;
      
      console.log(`DEBUG: Risk level calculation:`);
      console.log(`  Weighted Score: ${weightedRiskScore.toFixed(3)}`);
      console.log(`  Threshold Check: ${weightedRiskScore} <= 0.20? ${weightedRiskScore <= 0.20}`);
      console.log(`  Threshold Check: ${weightedRiskScore} > 0.20 AND <= 0.50? ${weightedRiskScore > 0.20 && weightedRiskScore <= 0.50}`);
      console.log(`  Threshold Check: ${weightedRiskScore} > 0.50? ${weightedRiskScore > 0.50}`);
      console.log(`  Calculated Risk Level: ${calculatedRiskLevel}`);
      console.log(`  Final Risk Level Variable: ${riskLevel}`);
      console.log(`DEBUG: Risk level thresholds: <=0.20=LOW, 0.21-0.50=MEDIUM, >0.50=HIGH`);
      
      // Log the enhanced risk assessment
      console.log(`\n=== ENHANCED RISK ASSESSMENT ===`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log(`Data Confidence Risk: ${(dataConfidenceRisk * 100).toFixed(0)}% (${(confidenceScore * 100).toFixed(1)}% confidence)`);
      console.log(`Edge Risk: ${(edgeRisk * 100).toFixed(0)}% (${edge.toFixed(1)} point edge)`);
      console.log(`Matchup Risk: ${(matchupRisk * 100).toFixed(0)}% (${request.opponent} matchup)`);
      console.log(`Stability Risk: ${(stabilityRisk * 100).toFixed(0)}% (performance variance)`);
      console.log(`Usage Risk: ${(usageRisk * 100).toFixed(0)}% (usage percentage impact)`);
      console.log(`Weighted Risk Score: ${(weightedRiskScore * 100).toFixed(1)}%`);
      console.log(`Final Risk Level: ${riskLevel}`);
      console.log(`Risk Level Variable:`, riskLevel);
      console.log(`Risk Level Type:`, typeof riskLevel);
      console.log(`Expected Result: ${weightedRiskScore <= 0.20 ? 'LOW' : weightedRiskScore > 0.20 && weightedRiskScore <= 0.50 ? 'MEDIUM' : 'HIGH'}`);
      console.log(`Expected Result Check: 0.525 <= 0.20? ${0.525 <= 0.20} (should be false)`);
      console.log(`Expected Result Check: 0.525 > 0.20 AND <= 0.50? ${0.525 > 0.20 && 0.525 <= 0.50} (should be false, so HIGH)`);
      console.log(`Actually, with 0.525: LOW if ≤0.20, MEDIUM if 0.21-0.50, HIGH if >0.50`);
      console.log(`Since 0.525 > 0.50, it should be HIGH (which makes sense for a close game!)`);
      
      // Generate recommendation with more defined thresholds - more conservative
      let recommendation: 'OVER' | 'UNDER' | 'PASS' = 'PASS';
      if (confidenceScore >= 0.6) {
        // More defined thresholds to avoid picks on games that are too close
        if (edge >= 2.0) {
          recommendation = 'OVER'; // Strong edge - clear OVER
        } else if (edge >= 1.5) {
          recommendation = 'OVER'; // Strong edge - OVER
        } else if (edge <= -2.0) {
          recommendation = 'UNDER'; // Strong edge - clear UNDER
        } else if (edge <= -1.5) {
          recommendation = 'UNDER'; // Strong edge - UNDER
        } else {
          recommendation = 'PASS'; // Edge between -1.5 and +1.5 - too close to call
        }
      }
      
      // Log the recommendation reasoning
      console.log(`\n=== RECOMMENDATION LOGIC ===`);
      console.log(`Edge: ${edge.toFixed(1)} points`);
      console.log(`Confidence Score: ${(confidenceScore * 100).toFixed(1)}%`);
      if (edge >= 2.0) {
        console.log(`🎯 RECOMMENDATION: OVER (Strong edge: +${edge.toFixed(1)} points)`);
      } else if (edge >= 1.5) {
        console.log(`🎯 RECOMMENDATION: OVER (Strong edge: +${edge.toFixed(1)} points)`);
      } else if (edge <= -2.0) {
        console.log(`🎯 RECOMMENDATION: UNDER (Strong edge: ${edge.toFixed(1)} points)`);
      } else if (edge <= -1.5) {
        console.log(`🎯 RECOMMENDATION: UNDER (Strong edge: ${edge.toFixed(1)} points)`);
      } else {
        console.log(`🎯 RECOMMENDATION: PASS (Edge too close: ${edge.toFixed(1)} points)`);
      }
      
      // Calculate confidence breakdown factors
      const historicalAccuracy = Math.min(confidenceScore * 100, 95); // Based on confidence score
      const recentFormPercentage = seasonAverage > 0 ? Math.round((recentForm / seasonAverage) * 100) : 100;
      
      // Enhanced matchup analysis that considers position-specific defensive data
      let matchupAnalysis = seasonAverage > 0 ? Math.round((h2hAverage / seasonAverage) * 100) : 100;
      
      // If we have position-specific defensive data, enhance the matchup analysis
      if (request.statType === 'points') {
        try {
          const season = this.extractSeasonFromDate(request.gameDate);
          const positionSpecificDefense = await this.positionDefenseService.getOpponentPositionSpecificDefense(request.opponent, season, request.playerName);
          
          if (positionSpecificDefense) {
            const playerPosition = this.positionDefenseService['determinePlayerPosition'](request.playerName);
            const positionThresholds = this.positionDefenseService['getPositionSpecificThresholds'](request.playerName);
            
            // Use the SAME dual-factor logic as the main projection calculation
            // Get overall team defense for comprehensive matchup analysis
            const overallTeamDefense = await this.getOpponentTeamDefensiveStats(request.opponent, season);
            
            // Calculate defensive matchup factor using dual-factor system
            let overallDefenseFactor = 100; // neutral
            let positionDefenseFactor = 100; // neutral
            
            // Factor 1: Overall Team Defense (30% weight) - pace and scoring opportunities
            if (overallTeamDefense) {
              if (overallTeamDefense <= 78.0) {
                overallDefenseFactor = 98; // Elite defense = slightly unfavorable (-2%)
              } else if (overallTeamDefense <= 81.5) {
                overallDefenseFactor = 99; // Strong defense = slightly unfavorable (-1%)
              } else if (overallTeamDefense <= 84.5) {
                overallDefenseFactor = 100; // Average defense = neutral (0%)
              } else {
                overallDefenseFactor = 101; // Weak defense = slightly favorable (+1%)
              }
            }
            
            // Factor 2: Position-Specific Defense (70% weight) - how well they guard the position
            const leagueAverage = 13.2; // Per-player average for points
            const defensiveRatio = positionSpecificDefense / leagueAverage;
            
            if (defensiveRatio > 2.0) {
              positionDefenseFactor = 140; // Very weak defense = very favorable (+40%)
            } else if (defensiveRatio > 1.5) {
              positionDefenseFactor = 135; // Weak defense = favorable (+35%)
            } else if (defensiveRatio > 1.2) {
              positionDefenseFactor = 130; // Below average defense = favorable (+30%)
            } else if (defensiveRatio < 0.8) {
              positionDefenseFactor = 75; // Strong defense = unfavorable (-25%)
            } else {
              positionDefenseFactor = 100; // Average defense = neutral (0%)
            }
            
            // Combine both factors using the same weights as main calculation
            const defensiveFactor = Math.round(
              (positionDefenseFactor * 0.7) + (overallDefenseFactor * 0.3)
            );
            
            // Combine historical performance (60%) with defensive matchup (40%)
            // Give more weight to current defensive matchup since it's more relevant
            const historicalWeight = 0.6;
            const defensiveWeight = 0.4;
            
            matchupAnalysis = Math.round(
              (matchupAnalysis * historicalWeight) + (defensiveFactor * defensiveWeight)
            );
            
            console.log(`Enhanced matchup analysis (DUAL-FACTOR):`);
            console.log(`  - Historical performance: ${Math.round((h2hAverage / seasonAverage) * 100)}% (${h2hAverage.toFixed(1)} vs ${seasonAverage.toFixed(1)} season avg)`);
            console.log(`  - Overall team defense: ${overallDefenseFactor}% (${overallTeamDefense?.toFixed(1) || 'N/A'} OPP PTS) - 30% weight`);
            console.log(`  - Position-specific defense: ${positionDefenseFactor}% (${positionSpecificDefense} OPP PTS) - 70% weight`);
            console.log(`  - Combined defensive factor: (${positionDefenseFactor} × 0.7) + (${overallDefenseFactor} × 0.3) = ${defensiveFactor}%`);
            console.log(`  - Final matchup: ${matchupAnalysis}% (${historicalWeight * 100}% historical + ${defensiveWeight * 100}% defensive)`);
            
            // Log the final matchup category
            let matchupCategory = '';
            if (matchupAnalysis >= 105) {
              matchupCategory = 'Favorable ✅';
            } else if (matchupAnalysis >= 95) {
              matchupCategory = 'Neutral';
            } else {
              matchupCategory = 'Unfavorable ❌';
            }
            console.log(`  - Final Matchup Rating: ${matchupCategory} (${matchupAnalysis}%)`);
          }
        } catch (error) {
          console.log(`Could not enhance matchup analysis with defensive data:`, error);
        }
      }
      
      console.log(`Confidence breakdown factors:`);
      console.log(`- Historical Accuracy: ${historicalAccuracy}% (based on confidence score)`);
      console.log(`- Recent Form: ${recentFormPercentage}% (${recentForm.toFixed(1)} vs ${seasonAverage.toFixed(1)} season avg)`);
      console.log(`- Matchup Analysis: ${matchupAnalysis}% (${h2hAverage.toFixed(1)} vs ${seasonAverage.toFixed(1)} season avg)`);
      
      const projection: ProjectionResult = {
        projectedValue,
        confidenceScore,
        factors: {
          seasonAverage: seasonAverage > 0 ? seasonAverage : 0,
          recentForm: recentForm > 0 ? recentForm : 0,
          opponentDefense: 1.0, // Default value - now calculated in position-specific system below
          homeAway: request.isHome ? 1.05 : 0.98,
          backToBack: backToBackAdjustment, // Back-to-back fatigue factor
          pace: paceAdjustment, // PACE factor (scoring opportunities)
          restFactor: 1.0, // Placeholder
          injuryImpact: injuryImpact, // Calculated injury impact factor
          headToHead: h2hAverage > 0 ? h2hAverage : 0,
          perFactor: 1.0, // PER efficiency factor (calculated above in projection)
          regressionFactor: 1.0, // Regression to mean for outliers (calculated above in projection)
          lineupShiftMultiplier: 1.0 // Default to no lineup shift impact
        },
        // Additional calculated values for UI display
        historicalAccuracy: historicalAccuracy,
        recentFormPercentage: recentFormPercentage,
        matchupAnalysis: matchupAnalysis,
        seasonGamesCount: playerStats.length, // Actual number of season games available
        teammateInjuries: request.teammateInjuries || [], // List of significant injured teammates
        riskLevel,
        edge,
        recommendation
      };
      
      console.log('Manual projection calculated:', projection);
      return projection;
    } catch (error) {
      console.error('Error generating projection:', error);
      return null;
    }
  }

  /**
   * Batch generate projections for multiple players
   */
  async generateBatchProjections(requests: ProjectionRequest[]): Promise<ProjectionResult[]> {
    const projections: ProjectionResult[] = [];
    
    for (const request of requests) {
      const projection = await this.generateProjection(request);
      if (projection) {
        projections.push(projection);
      }
    }
    
    return projections;
  }

  /**
   * Check if a projection already exists for the same player, stat type, and date
   */
  private async checkExistingProjection(
    playerName: string, 
    statType: string, 
    gameDate: string
  ): Promise<boolean> {
    try {
      // Extract the date part from the game date (e.g., "Fri, May 16, 2025" -> "2025-05-16")
      const date = new Date(gameDate);
      const dateString = date.toISOString().split('T')[0];
      
      // Check if a projection was created today for this player and stat type
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('player_projections')
        .select('id, created_at')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .gte('created_at', `${todayString}T00:00:00`)
        .lte('created_at', `${todayString}T23:59:59`)
        .limit(1);

      if (error) {
        console.error('Error checking for existing projection:', error);
        return false; // Allow save if check fails
      }

      const hasExistingProjection = data && data.length > 0;
      
      if (hasExistingProjection) {
        console.log(`Duplicate projection detected for ${playerName} - ${statType} on ${todayString}`);
        console.log('Existing projection:', data[0]);
      }

      return hasExistingProjection;
    } catch (error) {
      console.error('Error in checkExistingProjection:', error);
      return false; // Allow save if check fails
    }
  }

  /**
   * Public method to check if a projection exists for today for a specific player and stat type
   * This can be used by UI components to show appropriate messaging
   */
  async hasProjectionToday(playerName: string, statType: string): Promise<boolean> {
    return this.projectionStorageService.hasProjectionToday(playerName, statType);
  }

  /**
   * Get all projections for today for a specific player
   * This can be used to show existing projections when duplicates are detected
   */
  async getProjectionsToday(playerName: string): Promise<any[]> {
    return this.projectionStorageService.getProjectionsToday(playerName);
  }

  /**
   * Get the count of projections for today for a specific player
   * This can be useful for showing how many projections already exist
   */
  async getProjectionCountToday(playerName: string): Promise<number> {
    return this.projectionStorageService.getProjectionCountToday(playerName);
  }

  /**
   * Get projections by stat type for today for a specific player
   * This can be useful for showing what specific stat projections already exist
   */
  async getProjectionsByStatTypeToday(playerName: string): Promise<{ [statType: string]: any[] }> {
    return this.projectionStorageService.getProjectionsByStatTypeToday(playerName);
  }

  /**
   * Save projection to database
   */
  async saveProjection(projection: ProjectionResult, request: ProjectionRequest): Promise<void> {
    return this.projectionStorageService.saveProjection(projection, request);
  }

  /**
   * Update existing projection for today
   */
  async updateProjectionToday(projection: ProjectionResult, request: ProjectionRequest): Promise<void> {
    return this.projectionStorageService.updateProjectionToday(projection, request);
  }

  /**
   * Get the latest projection for a player/stat type today
   */
  async getLatestProjectionToday(playerName: string, statType: string): Promise<any | null> {
    return this.projectionStorageService.getLatestProjectionToday(playerName, statType);
  }

  /**
   * Helper method to determine if a team is home
   * This is a simplified approach - in a real system, you'd have actual home/away data
   */
  private determineHomeTeam(team: string, opponent: string, gameDate: string): boolean {
    // For now, we'll use a simple heuristic based on team names
    // In a real system, this would come from the game schedule data
    
    // Check if we have any indication of home/away in the existing data
    // For now, we'll alternate based on game date to simulate home/away pattern
    if (gameDate) {
      const date = new Date(gameDate);
      const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      // Simple pattern: even days = home, odd days = away
      return dayOfYear % 2 === 0;
    }
    
    // Fallback: return true as default
    return true;
  }

  /**
   * Get recent projections for a player with game outcomes
   */
  async getRecentProjections(playerName: string, limit: number = 10): Promise<any[]> {
    return this.projectionStorageService.getRecentProjections(playerName, limit);
  }





  /**
   * Get projection accuracy statistics
   */
  async getProjectionAccuracy(playerName?: string): Promise<any> {
    return this.leagueAveragesService.getProjectionAccuracy(playerName);
  }

  /**
   * Get available seasons from the database
   */
  async getAvailableSeasons(): Promise<string[]> {
    return this.leagueAveragesService.getAvailableSeasons();
  }

  /**
   * Get opponent team defensive stats for total points allowed per game
   * This fetches data similar to the "OPP PTS" column from WNBA stats
   */
  async getOpponentTeamDefensiveStats(opponent: string, season: string = '2025'): Promise<number | null> {
    try {
      console.log(`  🔍 Fetching official team defensive stats for ${opponent} in ${season} season...`);
      
      // Get official WNBA team defensive stats (OPP PTS column)
      const officialStats = await this.getOfficialTeamDefensiveStats(season);
      
      if (officialStats.size === 0) {
        console.log(`  ⚠️  No official defensive stats available for ${season} season`);
        return null;
      }

      // Find the team in our official stats
      // Handle team name variations and partial matches
      let foundTeam: string | null = null;
      let pointsAllowed: number | null = null;

      for (const [team, points] of officialStats) {
        // Check for exact match first
        if (team.toLowerCase() === opponent.toLowerCase()) {
          foundTeam = team;
          pointsAllowed = points;
          break;
        }
        
        // Check for partial match (handle cases like "New York Liberty" vs "New York Liberty (5-4) Table)")
        if (team.toLowerCase().includes(opponent.toLowerCase()) || 
            opponent.toLowerCase().includes(team.toLowerCase())) {
          foundTeam = team;
          pointsAllowed = points;
          break;
        }
      }

      if (!foundTeam || pointsAllowed === null) {
        console.log(`  ⚠️  Team "${opponent}" not found in official defensive stats`);
        console.log(`  📋 Available teams: ${Array.from(officialStats.keys()).join(', ')}`);
        return null;
      }

      console.log(`  ✅ Found official defensive stats for ${foundTeam}: ${pointsAllowed} OPP PTS`);
      
      // Compare with league average for context
                  const leagueAverage = this.leagueAveragesService.getLeagueAverage('points');
      const ratio = pointsAllowed / leagueAverage;
      
      let defenseRating: string;
      if (pointsAllowed <= 78.0) {
        defenseRating = '🟢 Elite Defense';
      } else if (pointsAllowed <= 81.5) {
        defenseRating = '🟡 Strong Defense';
      } else if (pointsAllowed <= 84.5) {
        defenseRating = '🟠 Average Defense';
      } else {
        defenseRating = '🔴 Weak Defense';
      }

      console.log(`  📊 Defensive Analysis:`);
      console.log(`    - ${foundTeam}: ${pointsAllowed} OPP PTS`);
      console.log(`    - League Average: ${leagueAverage} points`);
      console.log(`    - Ratio: ${ratio.toFixed(3)}`);
      console.log(`    - Rating: ${defenseRating}`);
      
      return pointsAllowed;
    } catch (error) {
      console.error('  ❌ Error in getOpponentTeamDefensiveStats:', error);
      return null;
    }
  }

  /**
   * Get opponent position-specific defensive stats for a player
   * This fetches data from our position-specific defensive stats tables
   */






  /**
   * Extract season from a game date string (e.g., "Fri, May 16, 2025" -> "2025")
   */
  private extractSeasonFromDate(gameDate: string): string {
    const date = new Date(gameDate);
    return date.getFullYear().toString();
  }

  /**
   * Get the most recent projection for a specific player and stat type
   */
  async getMostRecentProjection(playerName: string, statType: string): Promise<any | null> {
    return this.projectionStorageService.getMostRecentProjection(playerName, statType);
  }

  /**
   * Check if a specific projection combination exists for today
   * This checks for player, stat type, and game combination
   */
  async hasProjectionCombinationToday(
    playerName: string, 
    statType: string, 
    gameId?: string
  ): Promise<boolean> {
    return this.projectionStorageService.hasProjectionCombinationToday(playerName, statType, gameId);
  }

  /**
   * Get the most recent projection for a specific game
   * This can be useful for showing existing projections for the same game
   */
  async getMostRecentProjectionForGame(gameId: string): Promise<any | null> {
    return this.projectionStorageService.getMostRecentProjectionForGame(gameId);
  }

  /**
   * Get all projections for a specific game today
   * This can be useful for showing all projections for the same game
   */
  async getProjectionsForGameToday(gameId: string): Promise<any[]> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('player_projections')
        .select(`
          id,
          player_name,
          game_id,
          stat_type,
          projected_value,
          confidence_score,
          edge,
          recommendation,
          factors_used,
          is_home,
          sportsbook_line,
          days_rest,
          teammate_injuries,
          created_at
        `)
        .eq('game_id', gameId)
        .gte('created_at', `${todayString}T00:00:00`)
        .lte('created_at', `${todayString}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projections for game today:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getProjectionsForGameToday:', error);
      return [];
    }
  }

  /**
   * Get the count of projections for a specific game today
   * This can be useful for showing how many projections exist for the same game
   */
  async getProjectionCountForGameToday(gameId: string): Promise<number> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { count, error } = await this.supabase
        .from('player_projections')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId)
        .gte('created_at', `${todayString}T00:00:00`)
        .lte('created_at', `${todayString}T23:59:59`);

      if (error) {
        console.error('Error counting projections for game today:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getProjectionCountForGameToday:', error);
      return 0;
    }
  }

  /**
   * Get the most recent projection for a specific player and stat type today
   * This can be useful for showing the existing projection when a duplicate is detected
   */
  async getMostRecentProjectionForPlayerAndStatToday(
    playerName: string, 
    statType: string
  ): Promise<any | null> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('player_projections')
        .select(`
          id,
          player_name,
          game_id,
          stat_type,
          projected_value,
          confidence_score,
          edge,
          recommendation,
          factors_used,
          is_home,
          sportsbook_line,
          days_rest,
          teammate_injuries,
          created_at
        `)
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .gte('created_at', `${todayString}T00:00:00`)
        .lte('created_at', `${todayString}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('Error fetching most recent projection for player and stat today:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getMostRecentProjectionForPlayerAndStatToday:', error);
      return null;
    }
  }

  /**
   * Get all projections for a specific player and stat type today
   * This can be useful for showing all projections for the same player and stat type
   */
  async getProjectionsForPlayerAndStatToday(
    playerName: string, 
    statType: string
  ): Promise<any[]> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('player_projections')
        .select(`
          id,
          player_name,
          game_id,
          stat_type,
          projected_value,
          confidence_score,
          edge,
          recommendation,
          factors_used,
          is_home,
          sportsbook_line,
          days_rest,
          teammate_injuries,
          created_at
        `)
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .gte('created_at', `${todayString}T00:00:00`)
        .lte('created_at', `${todayString}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projections for player and stat today:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getProjectionsForPlayerAndStatToday:', error);
      return [];
    }
  }

  /**
   * Get the count of projections for a specific player and stat type today
   * This can be useful for showing how many projections exist for the same player and stat type
   */
  async getProjectionCountForPlayerAndStatToday(
    playerName: string, 
    statType: string
  ): Promise<number> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { count, error } = await this.supabase
        .from('player_projections')
        .select('*', { count: 'exact', head: true })
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .gte('created_at', `${todayString}T00:00:00`)
        .lte('created_at', `${todayString}T23:59:59`);

      if (error) {
        console.error('Error counting projections for player and stat today:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getProjectionCountForPlayerAndStatToday:', error);
      return 0;
    }
  }

  /**
   * Get the most recent projection for a specific player and stat type for any date
   * This can be useful for showing the most recent projection regardless of date
   */
  async getMostRecentProjectionForPlayerAndStat(
    playerName: string, 
    statType: string
  ): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('player_projections')
        .select(`
          id,
          player_name,
          game_id,
          stat_type,
          projected_value,
          confidence_score,
          edge,
          recommendation,
          factors_used,
          is_home,
          sportsbook_line,
          days_rest,
          teammate_injuries,
          created_at
        `)
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('Error fetching most recent projection for player and stat:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getMostRecentProjectionForPlayerAndStat:', error);
      return null;
    }
  }

  /**
   * Get all projections for a specific player and stat type for any date
   * This can be useful for showing all projections for the same player and stat type
   */
  async getProjectionsForPlayerAndStat(
    playerName: string, 
    statType: string
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('player_projections')
        .select(`
          id,
          player_name,
          game_id,
          stat_type,
          projected_value,
          confidence_score,
          edge,
          recommendation,
          factors_used,
          is_home,
          sportsbook_line,
          days_rest,
          teammate_injuries,
          created_at
        `)
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projections for player and stat:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getProjectionsForPlayerAndStat:', error);
      return [];
    }
  }

  /**
   * Get the count of projections for a specific player and stat type for any date
   * This can be useful for showing how many projections exist for the same player and stat type
   */
  async getProjectionCountForPlayerAndStat(
    playerName: string, 
    statType: string
  ): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('player_projections')
        .select('*', { count: 'exact', head: true })
        .eq('player_name', playerName)
        .eq('stat_type', statType);

      if (error) {
        console.error('Error counting projections for player and stat:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getProjectionCountForPlayerAndStat:', error);
      return 0;
    }
  }

  /**
   * Get the most recent projection for a specific player and stat type for a specific date range
   * This can be useful for showing projections within a specific time period
   */
  async getMostRecentProjectionForPlayerAndStatInDateRange(
    playerName: string, 
    statType: string,
    startDate: string,
    endDate: string
  ): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('player_projections')
        .select(`
          id,
          player_name,
          game_id,
          stat_type,
          projected_value,
          confidence_score,
          edge,
          recommendation,
          factors_used,
          is_home,
          sportsbook_line,
          days_rest,
          teammate_injuries,
          created_at
        `)
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('Error fetching most recent projection for player and stat in date range:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getMostRecentProjectionForPlayerAndStatInDateRange:', error);
      return null;
    }
  }

  /**
   * Get all projections for a specific player and stat type for a specific date range
   * This can be useful for showing all projections within a specific time period
   */
  async getProjectionsForPlayerAndStatInDateRange(
    playerName: string, 
    statType: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('player_projections')
        .select(`
          id,
          player_name,
          game_id,
          stat_type,
          projected_value,
          confidence_score,
          edge,
          recommendation,
          factors_used,
          is_home,
          sportsbook_line,
          days_rest,
          teammate_injuries,
          created_at
        `)
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projections for player and stat in date range:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getProjectionsForPlayerAndStatInDateRange:', error);
      return [];
    }
  }

  /**
   * Get the count of projections for a specific player and stat type in a specific date range
   * This can be useful for showing how many projections exist within a specific time period
   */
  async getProjectionCountForPlayerAndStatInDateRange(
    playerName: string, 
    statType: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('player_projections')
        .select('*', { count: 'exact', head: true })
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) {
        console.error('Error counting projections for player and stat in date range:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getProjectionCountForPlayerAndStatInDateRange:', error);
      return 0;
    }
  }

  /**
   * Get player position from database
   */
  private async getPlayerPosition(playerName: string): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('players')
        .select('position')
        .eq('name', playerName)
        .single();

      if (error || !data) {
        console.warn(`Could not find position for ${playerName}, using default`);
        return 'Unknown';
      }

      return data.position || 'Unknown';
    } catch (error) {
      console.warn(`Error getting position for ${playerName}:`, error);
      return 'Unknown';
    }
  }

  /**
   * Calculate recent form percentage
   */
  private calculateRecentFormPercentage(playerStats: PlayerGameLog[], statType: string): number {
    if (playerStats.length < 10) return 100;
    
    const recentGames = playerStats.slice(0, 10);
    const recentValues = recentGames.map(game => game[statType] as number).filter(val => val !== undefined && !isNaN(val));
    
    if (recentValues.length === 0) return 100;
    
    const recentAverage = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const seasonValues = playerStats.map(game => game[statType] as number).filter(val => val !== undefined && !isNaN(val));
    const seasonAverage = seasonValues.reduce((sum, val) => sum + val, 0) / seasonValues.length;
    
    if (seasonAverage === 0) return 100;
    return (recentAverage / seasonAverage) * 100;
  }

  /**
   * Calculate matchup analysis
   */
  private calculateMatchupAnalysis(playerStats: PlayerGameLog[], opponent: string, statType: string): number {
    const headToHeadGames = playerStats.filter(game => game.opponent === opponent);
    if (headToHeadGames.length === 0) return 100;
    
    const h2hValues = headToHeadGames.map(game => game[statType] as number).filter(val => val !== undefined && !isNaN(val));
    if (h2hValues.length === 0) return 100;
    
    const h2hAverage = h2hValues.reduce((sum, val) => sum + val, 0) / h2hValues.length;
    const seasonValues = playerStats.map(game => game[statType] as number).filter(val => val !== undefined && !isNaN(val));
    const seasonAverage = seasonValues.reduce((sum, val) => sum + val, 0) / seasonValues.length;
    
    if (seasonAverage === 0) return 100;
    return (h2hAverage / seasonAverage) * 100;
  }

  /**
   * Get player usage percentage from advanced stats
   */
  private async getPlayerUsagePercentage(playerName: string, season: string = '2025'): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('player_advanced_stats')
        .select('usage_percentage')
        .eq('player_name', playerName)
        .eq('season', season)
        .limit(1);

      if (error) {
        console.log(`Error fetching usage percentage for ${playerName}:`, error);
        return 0;
      }

      if (data && data.length > 0) {
        const usagePercentage = data[0].usage_percentage || 0;
        console.log(`📊 ${playerName} usage percentage: ${usagePercentage}%`);
        return usagePercentage;
      }

      return 0;
    } catch (error) {
      console.log(`Error in getPlayerUsagePercentage for ${playerName}:`, error);
      return 0;
    }
  }

  /**
   * Calculate regression factor for outliers
   */
  private async calculateRegressionFactor(playerStats: any[], statType: string): Promise<number> {
    if (playerStats.length < 10) {
      return 1.0; // Not enough data for regression
    }

    const statValues = playerStats.map(game => game[statType] || 0).filter(val => val !== undefined && !isNaN(val));
    const mean = statValues.reduce((sum, val) => sum + val, 0) / statValues.length;
    const variance = statValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / statValues.length;
    const stdDev = Math.sqrt(variance);

    // Points-specific regression logic:
    if (statType === 'points') {
      if (mean > 20 && stdDev > 8) {
        return 0.93; // Elite scorer with high variance = regress down (-7%)
      } else if (mean > 15 && stdDev > 6) {
        return 0.96; // Good scorer with variance = regress down (-4%)
      } else if (mean < 8 && stdDev > 4) {
        return 1.07; // Poor scorer with variance = regress up (+7%)
      } else if (mean < 12 && stdDev > 5) {
        return 1.04; // Below average with variance = regress up (+4%)
      }
    } else if (statType === 'rebounds') {
      if (mean > 10 && stdDev > 4) {
        return 0.94; // Elite rebounder with high variance = regress down (-6%)
      } else if (mean > 7 && stdDev > 3) {
        return 0.97; // Good rebounder with variance = regress down (-3%)
      } else if (mean < 3 && stdDev > 2) {
        return 1.06; // Poor rebounder with variance = regress up (+6%)
      } else if (mean < 5 && stdDev > 2.5) {
        return 1.03; // Below average with variance = regress up (+3%)
      }
    } else if (statType === 'assists') {
      if (mean > 8 && stdDev > 3) {
        return 0.92; // Elite playmaker with high variance = regress down (-8%)
      } else if (mean > 6 && stdDev > 2.5) {
        return 0.96; // Good playmaker with variance = regress down (-4%)
      } else if (mean < 2 && stdDev > 2) {
        return 1.04; // Below average with variance = regress up (+4%)
      }
    }

    return 1.0; // Stable performer = no regression
  }

  /**
   * Calculate PER (Player Efficiency Rating) adjustment factor
   * Higher PER = more efficient player = better scoring opportunities
   */
  private async calculatePERFactor(playerName: string, season: string = '2025'): Promise<number> {
    try {
      // Get player's PER from advanced stats
      const { data, error } = await this.supabase
        .from('player_advanced_stats')
        .select('per')
        .eq('player_name', playerName)
        .eq('season', season)
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
        console.log(`🏆 High PER (${per.toFixed(1)}): +3% boost to points`);
      } else if (per <= 12.0) {
        perFactor = 0.97; // Low efficiency = -3% penalty
        console.log(`⚠️ Low PER (${per.toFixed(1)}): -3% penalty to points`);
      } else {
        perFactor = 1.0; // Average efficiency = no adjustment
        console.log(`📊 Average PER (${per.toFixed(1)}): no adjustment to points`);
      }

      return perFactor;

    } catch (error) {
      console.error(`Error calculating PER factor for ${playerName}:`, error);
      return 1.0; // Neutral factor on error
    }
  }

}