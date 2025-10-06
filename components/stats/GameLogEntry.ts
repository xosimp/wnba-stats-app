// GameLogEntry interface - shared between PlayerStatsGraph and BarChart
export interface GameLogEntry {
  date: string;
  points: number | string;
  assists?: number | string;
  rebounds?: number | string;
  steals?: number | string;
  blocks?: number | string;
  fieldGoalsAttempted?: number | string;
  threePointersAttempted?: number | string;
  freeThrowsAttempted?: number | string;
  opp?: string;
  opponent_abbr?: string;
  opponent?: string;
  homeAway?: string;
  eventId?: string;
  [key: string]: any;
}
