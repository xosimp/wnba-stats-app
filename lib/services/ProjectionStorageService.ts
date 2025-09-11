import { createClient } from '@supabase/supabase-js';
import { ProjectionResult, ProjectionRequest } from '../algorithms/Algorithms';

/**
 * Service for handling projection storage and retrieval operations
 * Manages all CRUD operations for player projections
 */
export class ProjectionStorageService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Save a projection to the database
   * Only saves one projection per player/stat type per day
   */
  async saveProjection(projection: ProjectionResult, request: ProjectionRequest): Promise<void> {
    try {
      // Check if a projection already exists for this player/stat type today
      const hasExistingProjection = await this.hasProjectionToday(request.playerName, request.statType);
      
      if (hasExistingProjection) {
        console.log(`⏭️ Projection already exists for ${request.playerName} ${request.statType} today, updating instead...`);
        return this.updateProjectionToday(projection, request);
      }

      const projectionData = {
        player_name: request.playerName,
        stat_type: request.statType,
        game_date: request.gameDate,
        game_id: request.gameId,
        opponent: request.opponent,
        team: request.team,
        projected_value: projection.projectedValue,
        confidence_score: projection.confidenceScore,
        risk_level: projection.riskLevel,
        edge: projection.edge || 0,
        recommendation: projection.recommendation || 'PASS',
        factors_used: projection.factors && Object.keys(projection.factors).length > 0 ? projection.factors : null,
        is_home: request.isHome,
        sportsbook_line: request.sportsbookLine || null,
        days_rest: request.daysRest || 0,
        teammate_injuries: request.teammateInjuries && request.teammateInjuries.length > 0 ? request.teammateInjuries : null,
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('player_projections')
        .insert(projectionData);

      if (error) {
        throw new Error(`Failed to save projection: ${error.message}`);
      }

      console.log(`✅ Projection saved for ${request.playerName} ${request.statType} vs ${request.opponent} (first of the day)`);
    } catch (error) {
      console.error('Error saving projection:', error);
      throw error;
    }
  }

  /**
   * Update an existing projection for today
   * Useful when user wants to regenerate a projection
   */
  async updateProjectionToday(projection: ProjectionResult, request: ProjectionRequest): Promise<void> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      // Find the existing projection for today
      const { data: existingProjections, error: fetchError } = await this.supabase
        .from('player_projections')
        .select('id')
        .eq('player_name', request.playerName)
        .eq('stat_type', request.statType)
        .gte('created_at', `${todayString}T00:00:00`)
        .lt('created_at', `${todayString}T23:59:59.999Z`)
        .limit(1);

      if (fetchError || !existingProjections || existingProjections.length === 0) {
        console.log(`❌ No existing projection found for ${request.playerName} ${request.statType} today`);
        return;
      }

      const existingId = existingProjections[0].id;
      
      const updateData = {
        projected_value: projection.projectedValue,
        confidence_score: projection.confidenceScore,
        risk_level: projection.riskLevel,
        edge: projection.edge || 0,
        recommendation: projection.recommendation || 'PASS',
        factors_used: projection.factors && Object.keys(projection.factors).length > 0 ? projection.factors : null,
        sportsbook_line: request.sportsbookLine || null,
        days_rest: request.daysRest || 0,
        teammate_injuries: request.teammateInjuries && request.teammateInjuries.length > 0 ? request.teammateInjuries : null,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await this.supabase
        .from('player_projections')
        .update(updateData)
        .eq('id', existingId);

      if (updateError) {
        throw new Error(`Failed to update projection: ${updateError.message}`);
      }

      console.log(`🔄 Projection updated for ${request.playerName} ${request.statType} vs ${request.opponent}`);
    } catch (error) {
      console.error('Error updating projection:', error);
      throw error;
    }
  }

  /**
   * Check if a projection already exists for today
   */
  async hasProjectionToday(playerName: string, statType: string): Promise<boolean> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('player_projections')
        .select('id')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .gte('created_at', `${todayString}T00:00:00`)
        .lt('created_at', `${todayString}T23:59:59.999Z`)
        .limit(1);

      if (error) {
        console.error('Error checking existing projection:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error in hasProjectionToday:', error);
      return false;
    }
  }

  /**
   * Get all projections for a player today
   */
  async getProjectionsToday(playerName: string): Promise<any[]> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('player_projections')
        .select('*')
        .eq('player_name', playerName)
        .gte('created_at', `${todayString}T00:00:00`)
        .lte('created_at', `${todayString}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projections today:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getProjectionsToday:', error);
      return [];
    }
  }

  /**
   * Get projection count for a player today
   */
  async getProjectionCountToday(playerName: string): Promise<number> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { count, error } = await this.supabase
        .from('player_projections')
        .select('*', { count: 'exact', head: true })
        .eq('player_name', playerName)
        .gte('created_at', `${todayString}T00:00:00`)
        .lte('created_at', `${todayString}T23:59:59`);

      if (error) {
        console.error('Error counting projections today:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getProjectionCountToday:', error);
      return 0;
    }
  }

  /**
   * Get projections grouped by stat type for a player today
   */
  async getProjectionsByStatTypeToday(playerName: string): Promise<{ [statType: string]: any[] }> {
    try {
      const projections = await this.getProjectionsToday(playerName);
      
      const grouped: { [statType: string]: any[] } = {};
      
      projections.forEach((projection: any) => {
        const statType = projection.stat_type;
        if (!grouped[statType]) {
          grouped[statType] = [];
        }
        grouped[statType].push(projection);
      });

      return grouped;
    } catch (error) {
      console.error('Error in getProjectionsByStatTypeToday:', error);
      return {};
    }
  }

  /**
   * Get the most recent projection for a specific player/stat type today
   */
  async getLatestProjectionToday(playerName: string, statType: string): Promise<any | null> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('player_projections')
        .select('*')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .gte('created_at', `${todayString}T00:00:00`)
        .lt('created_at', `${todayString}T23:59:59.999Z`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching latest projection:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error in getLatestProjectionToday:', error);
      return null;
    }
  }

  /**
   * Get recent projections for a player
   */
  async getRecentProjections(playerName: string, limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('player_projections')
        .select('*')
        .eq('player_name', playerName)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching recent projections:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRecentProjections:', error);
      return [];
    }
  }

  /**
   * Get the most recent projection for a specific player and stat type
   */
  async getMostRecentProjection(playerName: string, statType: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('player_projections')
        .select('*')
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
        console.error('Error fetching most recent projection:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getMostRecentProjection:', error);
      return null;
    }
  }

  /**
   * Check if a specific projection combination exists for today
   */
  async hasProjectionCombinationToday(
    playerName: string, 
    statType: string, 
    gameId?: string
  ): Promise<boolean> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      let query = this.supabase
        .from('player_projections')
        .select('id')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .gte('created_at', `${todayString}T00:00:00`)
        .lte('created_at', `${todayString}T23:59:59`);

      if (gameId) {
        query = query.eq('game_id', gameId);
      }

      const { data, error } = await query.limit(1);

      if (error) {
        console.error('Error checking projection combination:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error in hasProjectionCombinationToday:', error);
      return false;
    }
  }

  /**
   * Get the most recent projection for a specific game
   */
  async getMostRecentProjectionForGame(gameId: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('player_projections')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching most recent projection for game:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getMostRecentProjectionForGame:', error);
      return null;
    }
  }

  /**
   * Get all projections for a specific game today
   */
  async getProjectionsForGameToday(gameId: string): Promise<any[]> {
    try {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('player_projections')
        .select('*')
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
   * Get projection count for a specific game today
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
   * Check if a projection already exists
   */
  async checkExistingProjection(
    playerName: string,
    statType: string,
    gameDate: string,
    opponent: string
  ): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('player_projections')
        .select('*')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .eq('game_date', gameDate)
        .eq('opponent', opponent)
        .limit(1);

      if (error) {
        console.error('Error checking existing projection:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error in checkExistingProjection:', error);
      return null;
    }
  }
}
