#!/bin/bash

# Ensure WNBA Injury Scheduler is Running
# This script checks if the injury scheduler is running and restarts it if needed

# Harden PATH for cron/launchd environments
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/injury-scheduler.log"

# Resolve Node.js binary
NODE_PATH=""
if command -v node &> /dev/null; then
  NODE_PATH="$(command -v node)"
elif [ -x "/usr/local/bin/node" ]; then
  NODE_PATH="/usr/local/bin/node"
elif [ -x "/opt/homebrew/bin/node" ]; then
  NODE_PATH="/opt/homebrew/bin/node"
else
  echo "❌ Node.js is not installed or not in PATH" | tee -a "$LOG_FILE"
  exit 1
fi

echo "🔍 Checking WNBA Injury Scheduler status..."

# Check if injury scheduler process is running
if pgrep -f "start-injury-scheduler" > /dev/null; then
    echo "✅ Injury scheduler is already running"
    echo "📊 Process info:"
    ps aux | grep "start-injury-scheduler" | grep -v grep
else
    echo "❌ Injury scheduler is not running"
    echo "🚀 Starting injury scheduler..."
    
    # Change to project directory
    cd "$PROJECT_DIR"
    
    # Start the injury scheduler in background
    echo "🟢 Using Node at: $NODE_PATH"
    nohup "$NODE_PATH" scripts/start-injury-scheduler.js > logs/injury-scheduler.log 2>&1 &
    
    # Wait a moment and check if it started
    sleep 2
    
    if pgrep -f "start-injury-scheduler" > /dev/null; then
        echo "✅ Injury scheduler started successfully"
        echo "📊 Process info:"
        ps aux | grep "start-injury-scheduler" | grep -v grep
    else
        echo "❌ Failed to start injury scheduler"
        echo "📄 Check logs: tail -f logs/injury-scheduler.log"
    fi
fi

echo ""
echo "📅 Current time: $(date)"
echo "💡 Next update: 4 hours from now"
echo "📄 Log file: $LOG_FILE" 