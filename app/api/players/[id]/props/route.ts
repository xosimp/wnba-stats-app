import { NextRequest, NextResponse } from 'next/server';
import { SportsbookClient } from '../../../../../lib/sportsbook/client';

const sportsbookClient = new SportsbookClient();

export async function GET(request: NextRequest) {
  try {
    // Extract playerId from the URL
    const urlParts = request.nextUrl.pathname.split('/');
    const playerId = urlParts[urlParts.length - 2]; // .../players/[id]/props
    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    // const props = await sportsbookClient.getPlayerProps(playerId);
    // if (!props) {
    //   return NextResponse.json({ error: 'No props found for player' }, { status: 404 });
    // }

    // return NextResponse.json({ success: true, data: props });
    return NextResponse.json({ success: true, data: [] });
  } catch (error) {
    console.error('Error fetching player props:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player props' },
      { status: 500 }
    );
  }
} 