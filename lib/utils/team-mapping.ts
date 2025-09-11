import { TEAMS } from '../constants/team-data';

// WNBA teams only (first 13 teams - now includes Golden State Valkyries)
const WNBA_TEAMS = TEAMS.slice(0, 13);

// Team abbreviation mappings to handle database inconsistencies
const TEAM_ABBREVIATION_MAPPINGS: { [key: string]: string } = {
  // New York Liberty variations
  'NYL': 'NYL',
  'NY': 'NYL',
  
  // Connecticut Sun variations
  'CONN': 'CON',
  'CON': 'CON',
  
  // Golden State Valkyries variations
  'GS': 'GSV',
  'GSV': 'GSV',
  
  // Washington Mystics variations
  'WSH': 'WAS',
  'WAS': 'WAS',
  
  // Las Vegas Aces variations
  'LV': 'LVA',
  'LVA': 'LVA',
  
  // Los Angeles Sparks variations
  'LA': 'LAS',
  'LAS': 'LAS',
  
  // Other teams (should match exactly)
  'ATL': 'ATL',
  'CHI': 'CHI',
  'DAL': 'DAL',
  'IND': 'IND',
  'MIN': 'MIN',
  'PHX': 'PHX',
  'SEA': 'SEA',
};

export function getTeamData(teamAbbreviation: string) {
  if (!teamAbbreviation) return null;
  
  // Normalize the team abbreviation
  const normalizedAbbr = TEAM_ABBREVIATION_MAPPINGS[teamAbbreviation.toUpperCase()] || teamAbbreviation.toUpperCase();
  
  // Find the team by normalized abbreviation
  const team = WNBA_TEAMS.find(t => t.abbreviation === normalizedAbbr);
  
  return team || null;
}

export function getTeamName(teamAbbreviation: string): string {
  const team = getTeamData(teamAbbreviation);
  return team?.name || teamAbbreviation;
}

export function getTeamColors(teamAbbreviation: string): string[] {
  const team = getTeamData(teamAbbreviation);
  return team?.colors || ['#23272F', '#444', '#888'];
}

export function getTeamLogo(teamAbbreviation: string): string {
  const team = getTeamData(teamAbbreviation);
  return team?.logo || '/logos/default-team-logo.png';
} 