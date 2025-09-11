import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Fetch top players by points per game
    const { data: players, error } = await supabase
      .from('player_stats_2025')
      .select('id, name, team, points, rebounds, assists, steals, blocks, minutes')
      .not('points', 'is', null)
      .order('points', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching top players:', error);
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }

    // Transform the data to match the expected format
    const topPlayers = players?.map(player => ({
      id: player.id,
      name: player.name,
      team: player.team,
      points: player.points,
      rebounds: player.rebounds,
      assists: player.assists,
      steals: player.steals,
      blocks: player.blocks,
      minutes: player.minutes,
    })) || [];

    return NextResponse.json(topPlayers);
  } catch (error) {
    console.error('Error in top players API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 