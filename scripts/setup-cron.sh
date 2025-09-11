#!/bin/bash

# Setup Cron Job for Daily WNBA Stats Scraper
# This script sets up a cron job to run the scraper daily at 6 AM

# Get the absolute path to the project directory
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRAPER_SCRIPT="$PROJECT_DIR/scripts/schedule-daily-scraper.sh"

echo "Setting up daily WNBA stats scraper cron job..."
echo "Project directory: $PROJECT_DIR"
echo "Scraper script: $SCRAPER_SCRIPT"

# Check if the scraper script exists
if [ ! -f "$SCRAPER_SCRIPT" ]; then
    echo "❌ Error: Scraper script not found at $SCRAPER_SCRIPT"
    exit 1
fi

# Make sure the scraper script is executable
chmod +x "$SCRAPER_SCRIPT"

# Create the cron job entry (runs daily at 5:00 AM)
CRON_JOB="0 5 * * * caffeinate -s $SCRAPER_SCRIPT"

echo ""
echo "📅 Setting up cron job to run daily at 5:00 AM..."
echo "Cron job: $CRON_JOB"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$SCRAPER_SCRIPT"; then
    echo "⚠️  Cron job already exists. Removing old entry..."
    (crontab -l 2>/dev/null | grep -v "$SCRAPER_SCRIPT") | crontab -
fi

# Add the new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

if [ $? -eq 0 ]; then
    echo "✅ Cron job successfully added!"
    echo ""
    echo "📋 Current cron jobs:"
    crontab -l
    echo ""
    echo "📝 The scraper will now run automatically every day at 5:00 AM"
    echo "📁 Logs will be saved to: $PROJECT_DIR/logs/"
    echo ""
    echo "🔧 To manually run the scraper: ./scripts/schedule-daily-scraper.sh"
    echo "🔧 To remove the cron job: crontab -e (then delete the line)"
else
    echo "❌ Failed to add cron job"
    exit 1
fi 