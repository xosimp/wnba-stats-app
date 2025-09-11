# Automated WNBA Stats Updates

## Overview
Your WNBA stats app now automatically updates player statistics every day at 3:00 AM to ensure fresh, real-time data.

## How It Works

### Daily Update Process
1. **Cron Job**: Runs every day at 3:00 AM
2. **Script**: `scripts/update-all-mapped-players.js`
3. **Logs**: All output is saved to `logs/daily_wnba_update.log`

### What Gets Updated
- **42 players** with confirmed WNBA API mappings
- Real 2025 season stats (points, rebounds, assists, etc.)
- Database is updated with live data from WNBA API

### Current Mapped Players
- Caitlin Clark (IND): 16.5 PPG, 8.8 APG, 5.0 RPG
- Kahleah Copper (PHX): 16.7 PPG, 1.8 APG, 3.5 RPG
- Dearica Hamby (LA): 17.2 PPG, 3.7 APG, 7.5 RPG
- Shakira Austin (WAS): 12.4 PPG, 1.8 APG, 6.6 RPG
- Rickea Jackson (LA): 13.1 PPG, 1.9 APG, 2.9 RPG
- And 37+ more players...

## Monitoring

### Check Update Status
```bash
node scripts/check-daily-update.js
```

This will show:
- When the last update ran
- How many players were updated
- Any errors that occurred

### View Logs
```bash
tail -f logs/daily_wnba_update.log
```

## Manual Updates

### Run Update Now
```bash
node scripts/update-all-mapped-players.js
```

### Test Specific Player
```bash
curl "http://localhost:3000/api/stats/database/62" | jq '.seasonStats'
```

## Cron Job Details

**Schedule**: Every day at 3:00 AM
**Command**: 
```bash
cd /Users/simp/wnba-stats-app && /usr/local/bin/node scripts/update-all-mapped-players.js >> logs/daily_wnba_update.log 2>&1
```

**To view/edit cron jobs**:
```bash
crontab -l    # View current jobs
crontab -e    # Edit jobs
```

## Adding More Players

After All-Star week, when the API returns full rosters:

1. Run the mapping script:
   ```bash
   node scripts/map-all-players-from-api.js
   ```

2. Update the API route with new mappings:
   ```typescript
   // In app/api/stats/database/[playerId]/route.ts
   const PLAYER_ID_MAPPINGS: Record<string, string> = {
     // Add new mappings here
   };
   ```

3. The daily update will automatically include new players.

## Troubleshooting

### If updates stop working:
1. Check if your machine is running at 3:00 AM
2. Verify the cron job is still active: `crontab -l`
3. Check the log file for errors: `cat logs/daily_wnba_update.log`

### If you need to restart the cron job:
```bash
# Remove the job
crontab -e
# Delete the line with update-all-mapped-players.js

# Add it back
(crontab -l 2>/dev/null; echo "0 3 * * * cd /Users/simp/wnba-stats-app && /usr/local/bin/node scripts/update-all-mapped-players.js >> logs/daily_wnba_update.log 2>&1") | crontab -
```

## Benefits

✅ **Always Fresh Data**: Stats update automatically every day
✅ **No Manual Work**: Set it and forget it
✅ **Error Logging**: All issues are logged for debugging
✅ **Scalable**: Easy to add more players as they're mapped
✅ **Reliable**: Uses proven cron job system

Your WNBA stats app will now always display the latest, most accurate player statistics! 