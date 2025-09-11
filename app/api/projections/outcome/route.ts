import { NextRequest, NextResponse } from 'next/server';
import { ProjectionOutcomeService } from '../../../../lib/services/ProjectionOutcomeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      playerName,
      projectionDate,
      statType,
      projectedValue,
      gameId,
      gameDate,
      playerTeam,
      opponent,
      sportsbookLine
    } = body;

    console.log('🎯 Outcome API called for:', playerName, statType);

    // Initialize the outcome service with server-side environment variables
    const outcomeService = new ProjectionOutcomeService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!  // Use service role key for server-side
    );

    const outcome = await outcomeService.getOutcomeForDisplay(
      playerName,
      projectionDate,
      statType,
      parseFloat(projectedValue),
      gameId,
      gameDate,
      playerTeam,
      opponent,
      sportsbookLine ? parseFloat(sportsbookLine) : undefined
    );

    return NextResponse.json({ 
      success: true, 
      outcome 
    });

  } catch (error) {
    console.error('❌ Outcome API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}
