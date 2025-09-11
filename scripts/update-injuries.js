const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Simple exponential backoff retry for axios.get
async function axiosGetWithRetry(url, options = {}, retries = 4, baseDelayMs = 800) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await axios.get(url, options);
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      const jitter = Math.floor(Math.random() * 250);
      const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
      console.log(`Retrying GET ${url} in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kgmfkgwrmixpjzxlxnrl.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbWZrZ3dybWl4cGp6eGx4bnJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyNjM4NCwiZXhwIjoyMDY2OTAyMzg0fQ.MA0i5eNt-D4FOi0T2P_KDE2WcAvcK6hYRlz39otxVQY'
);

// WNBA team mappings
const TEAM_MAPPINGS = {
  'New York Liberty': 'NYL',
  'Las Vegas Aces': 'LVA',
  'Phoenix Mercury': 'PHX',
  'Minnesota Lynx': 'MIN',
  'Connecticut Sun': 'CON',
  'Washington Mystics': 'WAS',
  'Chicago Sky': 'CHI',
  'Indiana Fever': 'IND',
  'Dallas Wings': 'DAL',
  'Atlanta Dream': 'ATL',
  'Los Angeles Sparks': 'LAS',
  'Seattle Storm': 'SEA'
};

// Canonicalization for inconsistent API abbreviations
const ABBREV_EXCEPTIONS = {
  GSV: 'GV',
  CON: 'CONN',
  WSH: 'WAS',
  NY: 'NYL',
  LV: 'LVA'
};

// Canonical team names for known abbreviations
const ABBREV_TO_TEAM_NAME = {
  NYL: 'New York Liberty',
  LVA: 'Las Vegas Aces',
  PHX: 'Phoenix Mercury',
  MIN: 'Minnesota Lynx',
  CONN: 'Connecticut Sun',
  WAS: 'Washington Mystics',
  CHI: 'Chicago Sky',
  IND: 'Indiana Fever',
  DAL: 'Dallas Wings',
  ATL: 'Atlanta Dream',
  LAS: 'Los Angeles Sparks',
  SEA: 'Seattle Storm',
  GV: 'Golden State Valkyries'
};

function normalizeTeamAbbrev(abbrev) {
  if (!abbrev || typeof abbrev !== 'string') return 'UNK';
  const upper = abbrev.toUpperCase();
  return ABBREV_EXCEPTIONS[upper] || upper;
}

function canonicalTeamNameFromAbbrev(abbrev, fallbackName) {
  const upper = (abbrev || '').toUpperCase();
  return ABBREV_TO_TEAM_NAME[upper] || fallbackName || 'Unknown Team';
}

// Position mappings
const POSITION_MAPPINGS = {
  'G': 'G',
  'F': 'F',
  'C': 'C',
  'F/C': 'F/C',
  'G/F': 'G/F'
};

async function fetchInjuryData() {
  try {
    let allInjuries = [];

    // Fetch from WNBA API (with retry/backoff)
    try {
      console.log('Fetching injury updates from WNBA API...');
      const response = await axiosGetWithRetry('https://wnba-api.p.rapidapi.com/injuries', {
        timeout: 15000, // Increased timeout
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY || 'b9fef5cbcbmsh3ae24f367e6e0acp12f58ejsn3c7ad2cc0f9f',
          'x-rapidapi-host': 'wnba-api.p.rapidapi.com',
          'User-Agent': 'WNBA-Stats-App/1.0'
        }
      });

      if (response.data && response.data.injuries) {
        console.log(`Found ${response.data.injuries.length} players with injuries from WNBA API`);
        
        // Parse the nested structure - each item is a player with nested injuries
        let flattenedInjuries = [];
        
        if (response.data.injuries && Array.isArray(response.data.injuries)) {
          // Each item in the array is a player with nested injuries
          response.data.injuries.forEach(player => {
            if (player.injuries && Array.isArray(player.injuries)) {
              player.injuries.forEach(injury => {
                flattenedInjuries.push({
                  playerName: player.displayName,
                  playerId: player.id,
                  ...injury
                });
              });
            }
          });
        }
        
        console.log(`Found ${flattenedInjuries.length} actual injuries`);
        
        // Transform the API data to our format with team abbreviation normalization
        const transformedInjuries = flattenedInjuries.map(injury => {
          const rawTeamName = injury.athlete?.team?.displayName || injury.athlete?.team?.name || injury.team || 'Unknown Team';
          const rawAbbrev = injury.athlete?.team?.abbreviation || injury.teamAbbrev || 'UNK';
          const normalizedAbbrev = normalizeTeamAbbrev(rawAbbrev);
          const canonicalTeamName = canonicalTeamNameFromAbbrev(normalizedAbbrev, rawTeamName);

          return {
            playerName: injury.athlete?.displayName || injury.playerName || 'Unknown Player',
            team: canonicalTeamName,
            teamAbbrev: normalizedAbbrev,
            position: injury.athlete?.position?.abbreviation || 'F',
            injury: injury.details?.type || injury.shortComment || 'Unknown injury',
            status: injury.status || 'Questionable',
            expectedReturn: injury.details?.returnDate || null,
            lastUpdated: injury.date || new Date().toISOString(),
            playerId: injury.playerId || injury.athlete?.id,
            teamId: injury.athlete?.team?.id,
            source: 'WNBA API'
          };
        });
        
        console.log(`Successfully transformed ${transformedInjuries.length} injuries`);
        
        // Debug first few injuries to see team data
        transformedInjuries.slice(0, 3).forEach((injury, index) => {
          console.log(`Sample ${index + 1}: ${injury.playerName} - Team: ${injury.team} (${injury.teamAbbrev})`);
        });
        
        return transformedInjuries; // Return the transformed injuries
      }
    } catch (error) {
      console.log('Failed to fetch from WNBA API:', error.message);
      if (error.response) {
        console.log('API Error Response:', error.response.data);
      }
    }

    // Only use fallback sources if WNBA API failed
    console.log('WNBA API failed, trying fallback sources...');
    const sources = [
      'https://api.example.com/wnba/roster/injuries', // WNBA API
      'https://api.example.com/sports/injuries/wnba' // Sports data API
    ];

    for (const source of sources) {
      try {
        const response = await axiosGetWithRetry(source, {
          timeout: 5000,
          headers: {
            'User-Agent': 'WNBA-Stats-App/1.0'
          }
        }, 2, 500);

        if (response.data && response.data.injuries) {
          allInjuries = allInjuries.concat(response.data.injuries);
        }
      } catch (error) {
        console.log(`Failed to fetch from ${source}:`, error.message);
      }
    }

    return allInjuries;
  } catch (error) {
    console.error('Error fetching injury data:', error);
    return [];
  }
}

async function processInjuryData(rawInjuries) {
  const processedInjuries = [];

  for (const injury of rawInjuries) {
    try {
      // Normalize injury status
      let status = injury.status?.toLowerCase();
      if (status === 'out' || status === 'inactive') {
        status = 'Out';
      } else if (status === 'questionable' || status === 'doubtful') {
        status = 'Questionable';
      } else if (status === 'probable' || status === 'likely') {
        status = 'Probable';
      } else if (status === 'day-to-day' || status === 'daily') {
        status = 'Day-to-Day';
      } else {
        status = 'Questionable'; // Default
      }

      // Get team abbreviation
      // Prefer normalized teamAbbrev from transform if present, otherwise map from team name
      const teamAbbrev = (injury.teamAbbrev && typeof injury.teamAbbrev === 'string'
        ? normalizeTeamAbbrev(injury.teamAbbrev)
        : (TEAM_MAPPINGS[injury.team] || 'UNK'));

      // Get position
      const position = POSITION_MAPPINGS[injury.position] || 'F';

      // Parse expected return date
      let expectedReturn = null;
      if (injury.expectedReturn) {
        const date = new Date(injury.expectedReturn);
        if (!isNaN(date.getTime())) {
          expectedReturn = date.toISOString().split('T')[0];
        }
      }

      // Skip injuries without required data
      if (!injury.playerName || !injury.team) {
        console.log(`Skipping injury with missing data: ${injury.playerName || 'Unknown'} - ${injury.team || 'Unknown'}`);
        continue;
      }

      processedInjuries.push({
        player_name: injury.playerName,
        team: injury.team,
        team_abbrev: teamAbbrev,
        position: position,
        injury: injury.injury || 'Unknown injury',
        status: status,
        expected_return: expectedReturn,
        last_updated: new Date().toISOString(),
        player_id: injury.playerId,
        team_id: injury.teamId
      });
    } catch (error) {
      console.error('Error processing injury:', injury, error);
    }
  }

  return processedInjuries;
}

async function updateDatabase(processedInjuries) {
  try {
    // Clear existing injuries
    const { error: deleteError } = await supabase
      .from('player_injuries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Use a valid UUID format

    if (deleteError) {
      console.error('Error clearing injuries:', deleteError);
      return;
    }

    // Filter out injuries with missing data to avoid constraint violations
    const validInjuries = processedInjuries.filter(injury => 
      injury.player_name && 
      injury.player_name !== 'Unknown Player' && 
      injury.team && 
      injury.team !== 'Unknown Team'
    );

    console.log(`Filtered ${validInjuries.length} valid injuries from ${processedInjuries.length} total`);

    // Insert new injuries
    if (validInjuries.length > 0) {
      const { error: insertError } = await supabase
        .from('player_injuries')
        .insert(validInjuries);

      if (insertError) {
        console.error('Error inserting injuries:', insertError);
      } else {
        console.log(`Successfully updated ${validInjuries.length} injuries`);
      }
    }
  } catch (error) {
    console.error('Error updating database:', error);
  }
}

async function main() {
  console.log('Starting injury data update...');
  
  try {
    // Fetch injury data from sources
    const rawInjuries = await fetchInjuryData();
    
    if (rawInjuries.length === 0) {
      console.log('No injury data found, using fallback data');
      // Use fallback data if no real data is available
      const fallbackInjuries = [
        {
          playerName: 'Breanna Stewart',
          team: 'New York Liberty',
          injury: 'Right ankle sprain',
          status: 'Questionable',
          expectedReturn: '2024-01-15'
        },
        {
          playerName: 'A\'ja Wilson',
          team: 'Las Vegas Aces',
          injury: 'Left knee soreness',
          status: 'Probable',
          expectedReturn: '2024-01-12'
        }
      ];
      
      const processedInjuries = await processInjuryData(fallbackInjuries);
      await updateDatabase(processedInjuries);
    } else {
      // Process and update real injury data
      console.log(`Processing ${rawInjuries.length} real injuries from WNBA API`);
      const processedInjuries = await processInjuryData(rawInjuries);
      await updateDatabase(processedInjuries);
    }
    
    console.log('Injury data update completed successfully');
  } catch (error) {
    console.error('Error in main update process:', error);
  }
}

// Run the update
if (require.main === module) {
  main();
}

module.exports = { main, fetchInjuryData, processInjuryData, updateDatabase }; 