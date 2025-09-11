import { NextRequest, NextResponse } from 'next/server';
import { AssistsProjectionService } from '../../../../lib/services/AssistsProjectionService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      playerName,
      team,
      opponent,
      isHome,
      gameDate,
      daysRest,
      sportsbookLine,
      teammateInjuries
    } = body;

    // Validate required fields
    if (!playerName || !team || !opponent) {
      return NextResponse.json(
        { error: 'Missing required fields: playerName, team, opponent' },
        { status: 400 }
      );
    }

    // Initialize the assists projection service
    const assistsService = new AssistsProjectionService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Generate the assists projection
    const projection = await assistsService.generateAssistsProjection({
      playerName,
      team,
      opponent,
      statType: 'assists',
      isHome: isHome || false,
      gameDate: gameDate || new Date().toISOString().split('T')[0],
      daysRest: daysRest || 2,
      sportsbookLine: sportsbookLine?.toString(),
      teammateInjuries: teammateInjuries || [],
      gameId: `${gameDate || new Date().toISOString().split('T')[0]}_${team}_${opponent}`
    });

    if (!projection) {
      return NextResponse.json(
        { error: 'Failed to generate assists projection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      projection,
      message: `Assists projection generated for ${playerName} vs ${opponent}`
    });

  } catch (error) {
    console.error('Error in assists projection API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Assists projection API endpoint',
    usage: 'POST with playerName, team, opponent, and optional parameters'
  });
}
