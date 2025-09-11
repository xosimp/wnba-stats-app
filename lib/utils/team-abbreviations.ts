import { TEAMS } from '../constants/team-data';

// WNBA teams only (first 13 teams - now includes Golden State Valkyries)
const WNBA_TEAMS = TEAMS.slice(0, 13);

export function getTeamAbbreviation(teamName: string): string {
  if (!teamName) return 'TBD';
  
  // Clean the team name by removing extra text like "(12-12) Table"
  const cleanTeamName = teamName.replace(/\s*\(\d+-\d+\)\s*Table?/i, '').trim();
  
  // Find the team by name
  const team = WNBA_TEAMS.find(t => {
    const nameMatch = t.name.toLowerCase() === cleanTeamName.toLowerCase();
    const abbreviationMatch = t.abbreviation?.toLowerCase() === cleanTeamName.toLowerCase();
    
    return nameMatch || abbreviationMatch;
  });
  
  return team?.abbreviation || cleanTeamName;
} 