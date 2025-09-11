import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Fetching all players for preloading...');
    
    // Get all players from the players table
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, team')
      .order('name')
      .limit(500); // Limit to prevent overwhelming the system
    
    if (error) {
      console.error('Error fetching all players:', error);
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }
    
    console.log(`✅ Fetched ${players?.length || 0} players for preloading`);
    
    return NextResponse.json({
      players: players || [],
      total: players?.length || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
