#!/bin/bash

# Daily WNBA Stats Scraper
# This script runs the ESPN scraper daily to keep player stats fresh

# Set the working directory to the project root
cd "$(dirname "$0")/.."

# Create logs directory if it doesn't exist
mkdir -p logs

# Get current timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Log file for this run
LOG_FILE="logs/daily-scraper-$(date '+%Y-%m-%d').log"

echo "[$TIMESTAMP] Starting daily WNBA stats scraper..." | tee -a "$LOG_FILE"

# Check if Node.js is available (try multiple paths)
NODE_PATH=""
if command -v node &> /dev/null; then
    NODE_PATH="node"
elif [ -f "/usr/local/bin/node" ]; then
    NODE_PATH="/usr/local/bin/node"
elif [ -f "/opt/homebrew/bin/node" ]; then
    NODE_PATH="/opt/homebrew/bin/node"
else
    echo "[$TIMESTAMP] ERROR: Node.js is not installed or not in PATH" | tee -a "$LOG_FILE"
    exit 1
fi

echo "[$TIMESTAMP] Using Node.js at: $NODE_PATH" | tee -a "$LOG_FILE"

# Check if the scraper script exists
if [ ! -f "scripts/wnba-game-log-scraper.js" ]; then
    echo "[$TIMESTAMP] ERROR: Game log scraper script not found" | tee -a "$LOG_FILE"
    exit 1
fi

# Run the scraper
echo "[$TIMESTAMP] Running WNBA game log scraper..." | tee -a "$LOG_FILE"

# Run the scraper and capture output
$NODE_PATH scripts/wnba-game-log-scraper.js 2>&1 | tee -a "$LOG_FILE"

# Check if the scraper ran successfully
if [ $? -eq 0 ]; then
    echo "[$TIMESTAMP] ✅ Daily scraper completed successfully" | tee -a "$LOG_FILE"
    
    # Get summary of updates
    MISSING_GAMES=$(grep -c "❌ Missing games:" "$LOG_FILE" || echo "0")
    INCOMPLETE_GAMES=$(grep -c "⚠️  Incomplete games:" "$LOG_FILE" || echo "0")
    SUCCESSFUL_GAMES=$(grep -c "✅ Successfully processed" "$LOG_FILE" || echo "0")
    SUCCESSFULLY_FIXED=$(grep -c "✅ Successfully fixed" "$LOG_FILE" || echo "0")
    
    echo "[$TIMESTAMP] 📊 Summary: $MISSING_GAMES missing games, $INCOMPLETE_GAMES incomplete games, $SUCCESSFUL_GAMES processed, $SUCCESSFULLY_FIXED fixed" | tee -a "$LOG_FILE"
else
    echo "[$TIMESTAMP] ❌ Daily scraper failed with exit code $?" | tee -a "$LOG_FILE"
    exit 1
fi

echo "[$TIMESTAMP] Daily scraper run completed" | tee -a "$LOG_FILE" 