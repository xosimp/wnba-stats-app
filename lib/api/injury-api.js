const { createClient } = require('@supabase/supabase-js');

class InjuryAPI {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    this.cache = new Map();
    this.CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours
  }

  async fetchInjuries() {
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

      const injuries = data?.map((row) => ({
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

  getFallbackInjuries() {
    // Return some sample injury data for testing
    return [
      {
        id: '1',
        playerName: 'Cecilia Zandalasini',
        team: 'Golden State Valkyries',
        teamAbbrev: 'GV',
        position: 'F',
        injury: 'Knee',
        status: 'Out',
        expectedReturn: '2025-08-25',
        lastUpdated: new Date().toISOString(),
        playerId: '12345',
        teamId: 'GV001'
      }
    ];
  }
}

// Create and export a singleton instance
const injuryAPI = new InjuryAPI();
module.exports = { injuryAPI };
