-- Add league column to players table
-- This migration adds a league column to distinguish between NBA and WNBA players

-- Add the league column with a default value of 'WNBA' for existing records
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS league VARCHAR(10) DEFAULT 'WNBA';

-- Create an index on the league column for better query performance
CREATE INDEX IF NOT EXISTS idx_players_league ON players(league);

-- Update any existing records that might not have the league set
UPDATE players 
SET league = 'WNBA' 
WHERE league IS NULL;

-- Add a check constraint to ensure only valid league values
ALTER TABLE players 
ADD CONSTRAINT IF NOT EXISTS check_league_values 
CHECK (league IN ('NBA', 'WNBA'));

-- Add a comment for documentation
COMMENT ON COLUMN players.league IS 'League the player belongs to: NBA or WNBA';
