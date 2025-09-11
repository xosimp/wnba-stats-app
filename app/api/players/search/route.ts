import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const league = searchParams.get('league') || 'WNBA';
    
    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    console.log(`🔍 Searching for players with query: "${query}" in league: ${league}`);
    
    // Clean the query - remove punctuation and normalize
    const cleanQuery = query.replace(/['"]/g, '').trim();
    
    // Create search patterns for exact name matching
    const searchPatterns = [
      // Exact match (case insensitive)
      cleanQuery,
      // First name only (starts with)
      `${cleanQuery}%`,
      // Last name only (ends with)
      `%${cleanQuery}`,
      // Full name without punctuation
      cleanQuery.replace(/\s+/g, ' '),
    ];
    
    // Add specific variations for names with punctuation
    if (cleanQuery.toLowerCase().includes('aja')) {
      searchPatterns.push('A\'ja%', 'Aja%');
    }
    if (cleanQuery.toLowerCase().includes('jewell')) {
      searchPatterns.push('Jewell%', 'Jewel%');
    }
    if (cleanQuery.toLowerCase().includes('napheesa')) {
      searchPatterns.push('Napheesa%', 'Naph%');
    }
    
    // Use a simpler approach with multiple queries and combine results
    let allPlayers: any[] = [];
    
    for (const pattern of searchPatterns) {
      const { data: patternPlayers, error: patternError } = await supabase
        .from('players')
        .select('*')
        .ilike('name', pattern)
        .limit(20);
      
      if (patternError) {
        console.error(`Error with pattern "${pattern}":`, patternError);
        continue;
      }
      
      if (patternPlayers) {
        allPlayers = [...allPlayers, ...patternPlayers];
      }
    }
    
    // Remove duplicates
    const uniquePlayers = allPlayers.filter((player, index, self) => 
      index === self.findIndex(p => p.id === player.id)
    );
    
    // Check which players have recent game logs (active players)
    const playersWithActivity = await Promise.all(
      uniquePlayers.map(async (player) => {
        const { data: recentGames } = await supabase
          .from('wnba_game_logs')
          .select('game_date')
          .eq('player_name', player.name)
          .gte('game_date', '2025-05-01') // Only games from this season
          .order('game_date', { ascending: false })
          .limit(1);
        
        return {
          ...player,
          hasRecentActivity: recentGames && recentGames.length > 0
        };
      })
    );
    
    // Sort by activity first (active players first), then by name
    const sortedPlayers = playersWithActivity.sort((a, b) => {
      if (a.hasRecentActivity && !b.hasRecentActivity) return -1;
      if (!a.hasRecentActivity && b.hasRecentActivity) return 1;
      return a.name.localeCompare(b.name);
    });
    
    const players = sortedPlayers.slice(0, 20);
    
    // Ensure each player has both id and playerId fields for frontend compatibility
    const playersWithIds = players.map(player => ({
      ...player,
      playerId: player.id // Add playerId field for frontend compatibility
    }));
    
    console.log(`✅ Found ${playersWithIds?.length || 0} players matching "${query}"`);
    
    return NextResponse.json({
      results: playersWithIds || [],
      query: query,
      total: playersWithIds?.length || 0
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 