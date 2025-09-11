import { TEAMS } from '../constants/team-data';

// WNBA teams only (first 13 teams)
const WNBA_TEAMS = TEAMS.slice(0, 13);

// Team name to abbreviation mapping (base set)
const TEAM_NAME_TO_ABBR: { [key: string]: string } = {
  'Atlanta Dream': 'ATL',
  'Chicago Sky': 'CHI',
  'Connecticut Sun': 'CON',
  'Dallas Wings': 'DAL',
  'Indiana Fever': 'IND',
  'Las Vegas Aces': 'LV',
  'Los Angeles Sparks': 'LA',
  'Minnesota Lynx': 'MIN',
  'New York Liberty': 'NY',
  'Phoenix Mercury': 'PHX',
  'Seattle Storm': 'SEA',
  'Washington Mystics': 'WAS',
  'Golden State Valkyries': 'GSV',
};

// Abbreviation to full name mapping (include all variants and exceptions)
const TEAM_ABBR_TO_NAME: { [key: string]: string } = {
  'ATL': 'Atlanta Dream',
  'CHI': 'Chicago Sky',
  'CON': 'Connecticut Sun',
  'CONN': 'Connecticut Sun',
  'DAL': 'Dallas Wings',
  'IND': 'Indiana Fever',
  'LV': 'Las Vegas Aces',
  'LVA': 'Las Vegas Aces',
  'LA': 'Los Angeles Sparks',
  'LAS': 'Los Angeles Sparks',
  'MIN': 'Minnesota Lynx',
  'NY': 'New York Liberty',
  'NYL': 'New York Liberty',
  'PHO': 'Phoenix Mercury',
  'PHX': 'Phoenix Mercury',
  'SEA': 'Seattle Storm',
  'WAS': 'Washington Mystics',
  'WSH': 'Washington Mystics',
  'GSV': 'Golden State Valkyries',
  'GV': 'Golden State Valkyries',
  'GS': 'Golden State Valkyries',
};

/**
 * Normalize a team name or abbreviation to a standard format for comparison
 * @param teamName - Team name or abbreviation
 * @returns Normalized team name (full name)
 */
export function normalizeTeamName(teamName: string): string {
  if (!teamName) return '';
  
  const cleanName = teamName.trim();
  
  // If it's already a full name, return it
  if (TEAM_NAME_TO_ABBR[cleanName]) {
    return cleanName;
  }
  
  // If it's an abbreviation, convert to full name
  const upper = cleanName.toUpperCase();
  if (TEAM_ABBR_TO_NAME[upper]) {
    return TEAM_ABBR_TO_NAME[upper];
  }
  
  // Try to find a match by abbreviation (case insensitive)
  if (TEAM_ABBR_TO_NAME[upper]) {
    return TEAM_ABBR_TO_NAME[upper];
  }
  
  // If no match found, return the original name
  return cleanName;
}

/**
 * Check if two team names/abbreviations refer to the same team
 * @param team1 - First team name or abbreviation
 * @param team2 - Second team name or abbreviation
 * @returns True if they refer to the same team
 */
export function isSameTeam(team1: string, team2: string): boolean {
  const normalized1 = normalizeTeamName(team1);
  const normalized2 = normalizeTeamName(team2);
  return normalized1 === normalized2 && normalized1 !== '';
} 