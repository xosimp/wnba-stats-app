import { TEAMS } from '../constants/team-data';

// WNBA team abbreviations mapping
const WNBA_TEAMS = TEAMS.slice(0, 12); // First 12 teams are WNBA teams

/**
 * Extract opponent abbreviation from various possible API response formats
 */
export function extractOpponentAbbreviation(opponentData: any): string {
  if (!opponentData) {
    return 'TBD';
  }

  // If opponentData is a string, try to match it directly
  if (typeof opponentData === 'string') {
    const cleanOpponent = opponentData.trim().toUpperCase();
    
    // Check if it's already a valid abbreviation
    const team = WNBA_TEAMS.find(t => t.abbreviation === cleanOpponent);
    if (team && team.abbreviation) {
      return team.abbreviation;
    }
    
              // Try to match by name
          const teamByName = WNBA_TEAMS.find(t => 
            t.name.toLowerCase().includes(cleanOpponent.toLowerCase()) ||
            cleanOpponent.toLowerCase().includes(t.name.toLowerCase())
          );
          if (teamByName && teamByName.abbreviation) {
            return teamByName.abbreviation;
          }
    
    return cleanOpponent; // Return as-is if no match found
  }

  // If opponentData is an object, try different properties
  if (typeof opponentData === 'object') {
    // Try common property names
    const possibleProps = ['abbreviation', 'abbr', 'code', 'name', 'team'];
    
    for (const prop of possibleProps) {
      if (opponentData[prop]) {
        const value = opponentData[prop];
        if (typeof value === 'string') {
          const cleanValue = value.trim().toUpperCase();
          
          // Check if it's already a valid abbreviation
          const team = WNBA_TEAMS.find(t => t.abbreviation === cleanValue);
          if (team && team.abbreviation) {
            return team.abbreviation;
          }
          
          // Try to match by name
          const teamByName = WNBA_TEAMS.find(t => 
            t.name.toLowerCase().includes(cleanValue.toLowerCase()) ||
            cleanValue.toLowerCase().includes(t.name.toLowerCase())
          );
          if (teamByName && teamByName.abbreviation) {
            return teamByName.abbreviation;
          }
          
          return cleanValue; // Return as-is if no match found
        }
      }
    }
  }

  return 'TBD';
}

/**
 * Extract home/away indicator from game data
 */
export function extractHomeAway(gameData: any): string {
  if (!gameData) {
    return 'home';
  }

  // If homeAway is already a string
  if (typeof gameData.homeAway === 'string') {
    return gameData.homeAway.toLowerCase();
  }

  // Check for other possible properties
  const possibleProps = ['home', 'away', 'location', 'venue'];
  
  for (const prop of possibleProps) {
    if (gameData[prop]) {
      const value = gameData[prop];
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (lowerValue.includes('away') || lowerValue.includes('@')) {
          return 'away';
        }
        if (lowerValue.includes('home') || lowerValue.includes('vs')) {
          return 'home';
        }
      }
    }
  }

  return 'home'; // Default to home
}

/**
 * Process game data to extract opponent and home/away information
 */
export function processGameData(gameData: any): {
  opponent: string;
  homeAway: string;
  eventId?: string;
  date?: string;
} {
  return {
    opponent: extractOpponentAbbreviation(gameData.opponent),
    homeAway: extractHomeAway(gameData),
    eventId: gameData.eventId,
    date: gameData.date,
  };
} 