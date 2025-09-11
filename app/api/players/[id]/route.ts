import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    
    const { id } = await params;
    
    // Fetch player data from database
    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('player_id', id)
      .single();

    if (error) {
      console.error('Error fetching player:', error);
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    return NextResponse.json(player);
  } catch (error) {
    console.error('Error in player API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player data' },
      { status: 500 }
    );
  }
} 