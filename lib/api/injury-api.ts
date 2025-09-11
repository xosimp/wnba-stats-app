import { createClient } from '@supabase/supabase-js';

export interface Injury {
  id: string;
  playerName: string;
  team: string;
  teamAbbrev: string;
  position: string;
  injury: string;
  status: 'Out' | 'Questionable' | 'Probable' | 'Doubtful' | 'Day-to-Day';
  expectedReturn?: string;
  lastUpdated: string;
  playerId?: string;
  teamId?: string;
}

export interface InjuryUpdate {
  playerName: string;
  team: string;
  teamAbbrev: string;
  position: string;
  injury: string;
  status: 'Out' | 'Questionable' | 'Probable' | 'Doubtful' | 'Day-to-Day';
  expectedReturn?: string;
  playerId?: string;
  teamId?: string;
}

class InjuryAPI {
  private supabase: any;
  private cache: Map<string, { data: Injury[], timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async fetchInjuries(): Promise<Injury[]> {
    const cacheKey = 'injuries';
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if it's still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Fetch from database
      const { data, error } = await this.supabase
        .from('player_injuries')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) {
        console.error('Error fetching injuries:', error);
        throw error;
      }

      const injuries: Injury[] = data?.map((row: any) => ({
        id: row.id,
        playerName: row.player_name,
        team: row.team,
        teamAbbrev: row.team_abbrev,
        position: row.position,
        injury: row.injury,
        status: row.status,
        expectedReturn: row.expected_return,
        lastUpdated: row.last_updated,
        playerId: row.player_id,
        teamId: row.team_id
      })) || [];

      // Cache the data
      this.cache.set(cacheKey, {
        data: injuries,
        timestamp: Date.now()
      });

      return injuries;
    } catch (error) {
      console.error('Error fetching injuries:', error);
      // Return fallback data if API fails
      return this.getFallbackInjuries();
    }
  }

  async updateInjury(injuryId: string, update: Partial<InjuryUpdate>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('player_injuries')
        .update({
          ...update,
          last_updated: new Date().toISOString()
        })
        .eq('id', injuryId);

      if (error) {
        console.error('Error updating injury:', error);
        throw error;
      }

      // Clear cache to force refresh
      this.cache.clear();
    } catch (error) {
      console.error('Error updating injury:', error);
      throw error;
    }
  }

  async addInjury(injury: InjuryUpdate): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('player_injuries')
        .insert({
          player_name: injury.playerName,
          team: injury.team,
          team_abbrev: injury.teamAbbrev,
          position: injury.position,
          injury: injury.injury,
          status: injury.status,
          expected_return: injury.expectedReturn,
          last_updated: new Date().toISOString(),
          player_id: injury.playerId,
          team_id: injury.teamId
        });

      if (error) {
        console.error('Error adding injury:', error);
        throw error;
      }

      // Clear cache to force refresh
      this.cache.clear();
    } catch (error) {
      console.error('Error adding injury:', error);
      throw error;
    }
  }

  async removeInjury(injuryId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('player_injuries')
        .delete()
        .eq('id', injuryId);

      if (error) {
        console.error('Error removing injury:', error);
        throw error;
      }

      // Clear cache to force refresh
      this.cache.clear();
    } catch (error) {
      console.error('Error removing injury:', error);
      throw error;
    }
  }

  // Fallback data when API is unavailable
  private getFallbackInjuries(): Injury[] {
    // Return empty array to show "No Player Injuries" instead of fake data
    return [];
  }

  // Clear cache manually
  clearCache(): void {
    this.cache.clear();
  }

  // Get cache status
  getCacheStatus(): { hasCache: boolean; age: number } {
    const cached = this.cache.get('injuries');
    if (!cached) {
      return { hasCache: false, age: 0 };
    }
    return {
      hasCache: true,
      age: Date.now() - cached.timestamp
    };
  }
}

export const injuryAPI = new InjuryAPI(); 