import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return NextResponse.json({ error: 'Missing RapidAPI key' }, { status: 500 });
    }

    // Fetch schedule for 2025 season
    const url = `https://wnba-api.p.rapidapi.com/wnbaschedule?year=2025`;
    
    console.log('Fetching WNBA schedule for year: 2025');
    
    const apiRes = await fetch(url, {
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'wnba-api.p.rapidapi.com',
      },
    });

    console.log('Schedule API response status:', apiRes.status);

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      console.log('Schedule API error:', errorText);
      return NextResponse.json({ 
        error: 'Failed to fetch schedule', 
        details: errorText 
      }, { status: 502 });
    }

    const apiData = await apiRes.json();
    console.log('Schedule API raw response structure:', Object.keys(apiData));

    // Process the schedule data to build eventId -> opponent mapping
    const eventIdToOpponent: Record<string, { homeTeam: string; awayTeam: string; homeAway: string }> = {};
    
    // The API returns an object with dates as keys and arrays of games as values
    if (apiData && typeof apiData === 'object') {
      // Iterate through all dates
      Object.keys(apiData).forEach(date => {
        const gamesForDate = apiData[date];
        if (Array.isArray(gamesForDate)) {
          console.log(`Processing ${gamesForDate.length} games for date ${date}`);
          if (gamesForDate.length > 0) {
            console.log('Sample game structure:', gamesForDate[0]);
          }
          
          gamesForDate.forEach((game: any) => {
            // The game has an 'id' field which is the eventId, and 'competitors' array
            if (game.id && game.competitors && Array.isArray(game.competitors)) {
              // Find home and away teams from competitors array
              const homeTeam = game.competitors.find((team: any) => team.isHome)?.abbrev;
              const awayTeam = game.competitors.find((team: any) => !team.isHome)?.abbrev;
              
              if (homeTeam && awayTeam) {
                // Store both home and away perspectives
                eventIdToOpponent[game.id] = {
                  homeTeam,
                  awayTeam,
                  homeAway: 'home' // This will be determined by player's team
                };
              }
            }
          });
        }
      });
    }

    console.log('Built eventId to opponent mapping:', Object.keys(eventIdToOpponent).length, 'games');
    console.log('Sample mappings:', Object.entries(eventIdToOpponent).slice(0, 3));

    return NextResponse.json({
      schedule: apiData,
      eventIdToOpponent,
      totalGames: Object.keys(eventIdToOpponent).length,
    });

  } catch (e) {
    console.log('Server error in schedule route:', e);
    return NextResponse.json({ 
      error: 'Failed to fetch or process schedule',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 });
  }
} 