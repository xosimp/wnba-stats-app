import { NextRequest, NextResponse } from 'next/server';
import { ProjectionDataService } from '../../../../lib/services/ProjectionDataService';
import { ProjectionRequest } from '../../../../lib/algorithms/Algorithms';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerName, team, opponent, statType, isHome, gameDate, gameId, sportsbookLine, daysRest, teammateInjuries } = body;

    // Validate required fields
    if (!playerName || !opponent || !statType) {
      return NextResponse.json(
        { error: 'Missing required fields: playerName, opponent, statType' },
        { status: 400 }
      );
    }

    // Create projection request
    const projectionRequest: ProjectionRequest = {
      playerName,
      team: team || 'Unknown',
      opponent,
      statType,
      isHome: isHome ?? true,
      gameDate: gameDate || new Date().toISOString().split('T')[0],
      gameId: gameId || (() => {
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const teamAbbr = (team || 'Unknown').substring(0, 3).toUpperCase();
        const oppAbbr = opponent.substring(0, 3).toUpperCase();
        return `${dateStr}_${teamAbbr}_${oppAbbr}`;
      })(),
      sportsbookLine,
      daysRest,
      teammateInjuries: teammateInjuries || []
    };

    // Generate projection
    const projectionService = ProjectionDataService.getInstance();
    const projection = await projectionService.generateProjection(projectionRequest);

    if (!projection) {
      return NextResponse.json(
        { error: 'Unable to generate projection. Please check player data availability.' },
        { status: 500 }
      );
    }

    // Save projection to database
    await projectionService.saveProjection(projection, projectionRequest);

    return NextResponse.json({
      success: true,
      projection,
      request: projectionRequest
    });

  } catch (error) {
    console.error('Error generating projection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const projectionService = ProjectionDataService.getInstance();
    
    // Get available players and teams
    const [players, teams] = await Promise.all([
      projectionService.getAvailablePlayers(),
      projectionService.getAvailableTeams()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        players,
        teams
      }
    });

  } catch (error) {
    console.error('Error fetching available data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
