import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GameDataService } from '../../../../../lib/services/GameDataService';
import { OddsApiService } from '../../../../../lib/odds-api';
import { isSameTeam } from '../../../../../lib/utils/opponent-normalization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get player data to find their team
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    console.log(`Looking for upcoming opponent for ${player.name} (${player.team})`);

    // Try GameDataService first to find upcoming games
    const gameDataService = new GameDataService(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const upcomingGames = await gameDataService.getUpcomingGames(50);
    if (Array.isArray(upcomingGames) && upcomingGames.length > 0) {
      const now = new Date();
      const playerTeam = player.team;
      // Find the next game for the player's team
      const nextGame = upcomingGames
        .filter(game => new Date(game.game_date) > now)
        .sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime())
        .find(game => game.team === playerTeam || game.opponent === playerTeam);
      
      if (nextGame) {
        const opponent = nextGame.team === playerTeam ? nextGame.opponent : nextGame.team;
        console.log(`Found upcoming opponent via GameDataService: ${opponent}`);
        return NextResponse.json({ opponent });
      }
    }

    // Fallback: Use odds API to find upcoming games
    console.log('GameDataService failed, trying odds API fallback...');
    try {
      const upcomingGames = await OddsApiService.getUpcomingGames();
      
      if (upcomingGames && upcomingGames.length > 0) {
        const now = new Date();
        const playerTeam = player.team;
        // Sort all upcoming games by time ascending
        const sorted = [...upcomingGames]
          .filter(g => new Date(g.commence_time) > now)
          .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
        // Find the first event involving the player's team (normalized)
        const nextEvent = sorted.find(game => 
          isSameTeam(game.home_team, playerTeam) || isSameTeam(game.away_team, playerTeam)
        );
        if (nextEvent) {
          const isHome = isSameTeam(nextEvent.home_team, playerTeam);
          const opponent = isHome ? nextEvent.away_team : nextEvent.home_team;
          console.log(`Found upcoming opponent via odds API: ${opponent}`);
          return NextResponse.json({ opponent });
        }
      }
    } catch (oddsError) {
      console.error('Odds API fallback failed:', oddsError);
    }

    // If both APIs fail, return null
    console.log('No upcoming games found for this player\'s team');
    return NextResponse.json({ 
      opponent: null, 
      message: 'No upcoming games found for this player\'s team' 
    });

  } catch (error) {
    console.error('Error fetching upcoming opponent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upcoming opponent' },
      { status: 500 }
    );
  }
} 