# WNBA Stats App - Scripts Reference

## 🚀 Quick Start Scripts

### Check Daily Update Status
```bash
node scripts/check-daily-update.js
```
**What it does**: Shows when the last daily update ran and if it was successful.

### View Live Update Logs
```bash
tail -f logs/daily_wnba_update.log
```
**What it does**: Shows real-time logs of the automated daily updates.

---

## 📊 Player Stats Scripts

### Update All Mapped Players
```bash
node scripts/update-all-mapped-players.js
```
**What it does**: Updates stats for all 42 mapped players from live WNBA API
**When to use**: Manual update when you want fresh data immediately

### Update Single Player
```bash
node scripts/update-single-player.js
```
**What it does**: Updates stats for one specific player (Tina Charles by default)
**When to use**: When you need to update just one player's stats

### Check Player Stats
```bash
node scripts/check-player-stats.js
```
**What it does**: Shows current stats for a specific player from database
**When to use**: To verify what stats are stored for a player

### Check All Player Stats (with duplicates)
```bash
node scripts/check-all-player-stats.js
```
**What it does**: Shows ALL records for a player (including duplicates)
**When to use**: To debug duplicate record issues

---

## 🧹 Database Maintenance Scripts

### Clean Up Duplicate Records
```bash
node scripts/cleanup-duplicate-stats.js
```
**What it does**: Removes duplicate records for a specific player (Tina Charles by default)
**When to use**: When you see multiple records for the same player

### Clean Up ALL Duplicate Records
```bash
node scripts/cleanup-all-duplicates.js
```
**What it does**: Removes duplicate records for ALL players in the database
**When to use**: After running updates to ensure clean database

### Check Database Schema
```bash
node scripts/check-table-schema.js
```
**What it does**: Shows the structure of the player_season_stats table
**When to use**: To understand database structure or debug issues

---

## 🔍 Debugging Scripts

### Test API Response
```bash
curl "http://localhost:3000/api/stats/database/121" | jq '.seasonStats.avgPoints'
```
**What it does**: Tests the API endpoint for a specific player
**When to use**: To verify API is returning correct data

### Check Cron Jobs
```bash
crontab -l
```
**What it does**: Shows all scheduled automated tasks
**When to use**: To verify automated updates are scheduled

### View Recent Logs
```bash
cat logs/daily_wnba_update.log | tail -20
```
**What it does**: Shows the last 20 lines of update logs
**When to use**: To check for recent errors or successful updates

---

## 🛠️ Advanced Scripts

### Cache Popular Players
```bash
npx tsx scripts/cache_popular_players.ts
```
**What it does**: Caches data for popular players (runs every 30 minutes automatically)
**When to use**: Manual cache refresh if needed

### Fetch WNBA Players
```bash
/usr/bin/python3 /Users/simp/wnba-stats-app/fetch_wnba_players.py
```
**What it does**: Fetches player data from WNBA API (runs daily at 2:00 AM)
**When to use**: Manual player data refresh if needed

---

## 📋 Common Workflows

### When Stats Look Wrong
1. Check current stats: `node scripts/check-player-stats.js`
2. Update the player: `node scripts/update-single-player.js`
3. Verify the update: `curl "http://localhost:3000/api/stats/database/121" | jq '.seasonStats'`

### When You See Duplicate Records
1. Check for duplicates: `node scripts/check-all-player-stats.js`
2. Clean up duplicates: `node scripts/cleanup-duplicate-stats.js`
3. Verify cleanup: `node scripts/check-all-player-stats.js`

### When Daily Updates Stop Working
1. Check cron jobs: `crontab -l`
2. Check recent logs: `cat logs/daily_wnba_update.log | tail -20`
3. Run manual update: `node scripts/update-all-mapped-players.js`
4. Check status: `node scripts/check-daily-update.js`

### When Adding New Players
1. Update the mapping in `app/api/stats/database/[playerId]/route.ts`
2. Test with: `curl "http://localhost:3000/api/stats/database/NEW_ID" | jq`
3. The daily update will automatically include new players

---

## ⚙️ Cron Job Schedule

```bash
# 2:00 AM - Fetch WNBA players
0 2 * * * /usr/bin/python3 /Users/simp/wnba-stats-app/fetch_wnba_players.py

# Every 30 minutes - Cache popular players  
*/30 * * * * cd /Users/simp/wnba-stats-app && npx tsx scripts/cache_popular_players.ts

# 3:00 AM - Update all mapped players (DAILY STATS UPDATE)
0 3 * * * cd /Users/simp/wnba-stats-app && /usr/local/bin/node scripts/update-all-mapped-players.js
```

---

## 🚨 Troubleshooting

### Script Permission Issues
```bash
chmod +x scripts/*.js
```

### Node Version Issues
```bash
node --version
# Should be 18+ for all scripts
```

### Database Connection Issues
```bash
# Check if .env file exists and has correct values
cat .env | grep SUPABASE
```

### API Rate Limiting
- Scripts include 500ms delays between API calls
- If you hit rate limits, wait 1 hour and try again

---

## 📝 Log Files

- `logs/daily_wnba_update.log` - Daily player updates
- `logs/api_health.json` - API health checks
- `cache_popular_players.log` - Popular player caching
- `wnba_cron.log` - WNBA player fetching

---

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| Check daily updates | `node scripts/check-daily-update.js` |
| Update all players | `node scripts/update-all-mapped-players.js` |
| Update one player | `node scripts/update-single-player.js` |
| Clean duplicates | `node scripts/cleanup-all-duplicates.js` |
| View logs | `tail -f logs/daily_wnba_update.log` |
| Check cron jobs | `crontab -l` |

**Remember**: The system is fully automated! You only need these scripts for manual updates or troubleshooting. 🏀✨ 