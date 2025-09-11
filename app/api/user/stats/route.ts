import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Fetch user preferences from the database
    const { data: userData, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching user data:', error);
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }

    // Get user search count (you can implement this based on your search tracking)
    const { data: searchData, error: searchError } = await supabase
      .from('user_searches')
      .select('count')
      .eq('email', email)
      .single();

    const userStats = {
      favoriteTeam: userData?.favorite_team || null,
      lastViewedPlayer: userData?.last_viewed_player || null,
      totalSearches: searchData?.count || 0,
      favoritePlayers: userData?.favorite_players || [],
    };

    return NextResponse.json(userStats);
  } catch (error) {
    console.error('Error in user stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 