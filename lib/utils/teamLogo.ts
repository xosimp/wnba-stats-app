// Utility function to get team logos from the database
export function getTeamLogoUrl(teamSlug: string): string {
  // Convert team slug to lowercase for consistency
  const normalizedSlug = teamSlug.toLowerCase().replace(/\s+/g, '_');
  
  // Return the database endpoint URL
  return `/api/images/team/${normalizedSlug}`;
}

// Team slug mappings for common team names
export const TEAM_SLUG_MAPPINGS: Record<string, string> = {
  'atlanta dream': 'atlanta_dream',
  'chicago sky': 'chicago_sky',
  'connecticut sun': 'connecticut_sun',
  'dallas wings': 'dallas_wings',
  'golden state valkyries': 'golden_state_valkyries',
  'indiana fever': 'indiana_fever',
  'los angeles sparks': 'los_angeles_sparks',
  'minnesota lynx': 'minnesota_lynx',
  'las vegas aces': 'new_las_vegas_aces',
  'new york liberty': 'new_york_liberty',
  'phoenix mercury': 'phoenix_mercury',
  'seattle storm': 'seattle_storm',
  'washington mystics': 'washington_mystics'
};

// Helper function to convert team name to slug
export function getTeamSlug(teamName: string): string {
  const normalizedName = teamName.toLowerCase();
  return TEAM_SLUG_MAPPINGS[normalizedName] || normalizedName.replace(/\s+/g, '_');
}

// Get team logo URL from team name
export function getTeamLogoUrlFromName(teamName: string): string {
  const teamSlug = getTeamSlug(teamName);
  return getTeamLogoUrl(teamSlug);
} 