# WNBA Stats App: Admin Tools Guide

## Purpose
This guide explains how to use all the admin tools in the WNBA stats app. These tools help you monitor performance, manage caches, validate data, and optimize the application.

## Admin Tools Overview

### ✅ Working Tools (Fully Functional)
- **API Health Monitor** - Tracks Sportradar API calls, rate limits, and response times
- **Data Validation Tool** - Checks for missing player images and data integrity issues
- **Featured Players Manager** - Manage which players are always cached
- **Cache Management Tool** - View and clear Redis cache contents
- **Player Search Logs** - View search analytics and popular players

### ⚠️ Partially Working Tools
- **Performance Dashboard** - Shows Redis status and response times, but cache hit rate needs integration

### 🔧 Available Endpoints
All admin tools are accessible via these URLs:
- API Health: `http://localhost:3000/api/admin/api-health?token=wnba_admin_2024_secure`
- Performance: `http://localhost:3000/api/admin/performance?token=wnba_admin_2024_secure`
- Data Validation: `http://localhost:3000/api/admin/validate-data?token=wnba_admin_2024_secure`
- Featured Players: `http://localhost:3000/api/admin/featured-players?token=wnba_admin_2024_secure`
- Cache Management: `http://localhost:3000/api/debug/players`
- Search Logs: `http://localhost:3000/api/debug/search-logs?token=wnba_admin_2024_secure`

### 🔥 Automatic Cache Warming
The app now automatically warms the cache for popular players on startup:
- **Startup Warming**: Runs automatically when the app starts
- **Popular Players**: All players in `scripts/popular_players.json` are cached
- **Concurrent Warming**: All players are warmed simultaneously for speed
- **Error Handling**: Individual player failures don't stop the process
- **Manual Trigger**: Run `npm run cache:warm` to manually warm cache

---

## How to Show the Admin Cache Clear Button

You can reveal the "Clear WNBA Cache" button in the app UI in two ways:

### 1. Add `?admin=1` to the End of the URL
- Example: `https://your-app-url.com/?admin=1`
- This works for any page in the app. Just append `?admin=1` to the URL and reload.

### 2. Set in Local Storage
- Open your browser console and run:
  ```js
  localStorage.setItem('admin', '1');
  ```
- Refresh the page. The button will appear in the bottom-right corner.

---

## How to Use the Button
- Click the **"Clear WNBA Cache"** button (bottom-right).
- You will see an alert confirming how many cache keys were cleared.
- This sends a POST request to `/api/debug/players` with an admin token for security.

---

## Security Notes
- The cache clear endpoint is protected by an admin token (`x-admin-token` header).
- The default token is `supersecret`. Change this in your environment variables for production:
  ```sh
  export ADMIN_TOKEN=your-strong-secret
  ```
- Only users with the token and the button visible can clear the cache.

---

## When to Use
- After WNBA games finish (e.g., at night) to ensure all users see fresh stats and schedules.
- If you suspect the cache is stale or want to force a refresh for all users.

---

## Troubleshooting
- If the button does not appear, check the URL or localStorage as above.
- If you see an "Unauthorized" error, ensure the admin token matches the server's `ADMIN_TOKEN`.
- If Redis is not running, start it with:
  ```sh
  brew services start redis
  ```

---

## Viewing Player Search Logs

The app automatically logs all player searches to help you identify the most popular players. You can view these logs in two ways:

### 1. Command Line Analysis
Run this command to see the most popular searches:
```bash
npm run analyze-searches
```

This will show:
- Most popular search terms
- Search frequency counts
- Success rates
- Recent searches
- Unique players found

### 2. Browser Interface
View logs in your browser with this URL:
```
http://localhost:3000/api/debug/search-logs?token=wnba_admin_2024_secure
```

This shows:
- Recent search logs (last 50)
- Search statistics
- Most popular searches
- Success rates

### 3. Log File Location
Raw logs are stored in:
```
logs/player_searches.json
```

### Using the Data
- Check which players are most searched for
- Add popular players to `scripts/popular_players.json` for always-cached status
- Monitor search success rates to improve the search algorithm

---

## Cache Management Tool

View and manage Redis cache contents for debugging and optimization.

### Access the Cache Management Tool
```
http://localhost:3000/api/debug/players
```

### What it shows:
- **Cache Statistics** - Number of cached items, TTL, size
- **Cache Contents** - All Redis keys with their metadata
- **Memory Usage** - Track Redis memory consumption
- **Cache Health** - Monitor cache expiration and performance

### Using the Data:
- Monitor cache size and memory usage
- Check TTL values to optimize cache duration
- Identify which data is consuming the most space
- Debug cache-related performance issues

### Cache Clear Function
You can also clear all WNBA caches via POST request:
```bash
curl -X POST -H "x-admin-token: supersecret" http://localhost:3000/api/debug/players
```

---

## API Health Monitor

Monitor Sportradar API calls, rate limits, and performance issues.

### Access the API Health Monitor
```
http://localhost:3000/api/admin/api-health?token=wnba_admin_2024_secure
```

### What it shows:
- **Total API Calls** - Number of requests made to Sportradar
- **Success/Error Rates** - Track API reliability
- **Rate Limit Monitoring** - See when you're hitting limits
- **Response Times** - Monitor API performance
- **Endpoint Usage** - Which API endpoints are used most
- **Recent Errors** - Latest error messages and issues

### Using the Data:
- Monitor API rate limits to avoid "Too Many Requests" errors
- Track response times to identify slow endpoints
- Review errors to fix API integration issues
- Optimize caching based on API usage patterns

---

## Performance Dashboard

Monitor cache effectiveness, response times, and Redis health.

### Access the Performance Dashboard
```
http://localhost:3000/api/admin/performance?token=wnba_admin_2024_secure
```

### What it shows:
- **Cache Hit Rate** - Percentage of requests served from cache (currently shows 0% as performance logging needs to be integrated)
- **Response Times** - Average response times for each endpoint
- **Redis Status** - Connection status, memory usage, key count
- **Error Rates** - Track system errors and failures
- **Endpoint Performance** - Detailed breakdown by API endpoint

### Using the Data:
- Optimize cache TTL settings based on hit rates
- Identify slow endpoints that need optimization
- Monitor Redis memory usage to prevent issues
- Track error rates to catch problems early

### Note:
The performance dashboard currently shows 0% cache hit rate because performance logging needs to be integrated into the API routes. The cache is working correctly (as evidenced by the 0ms response times for cached searches), but the performance monitoring system needs to be connected to track cache hits/misses.

**Current Status**: All other admin tools are fully functional and displaying correct data. The API Health Monitor shows real API call counts, the Data Validation Tool shows actual player image counts, and the Featured Players Manager allows full CRUD operations.

---

## Data Validation Tool

Check for missing player images, stats, and data integrity issues.

### Access the Data Validation Tool
```
http://localhost:3000/api/admin/validate-data?token=wnba_admin_2024_secure
```

### What it checks:
- **Player Images** - Missing images for popular players
- **Cache Data** - Redis connection and cache key validation
- **Popular Players File** - Configuration file integrity
- **Log Files** - Admin log file existence and structure
- **Data Integrity** - Duplicate entries, invalid formats

### Using the Data:
- Fix missing player images for better user experience
- Resolve cache connectivity issues
- Validate configuration files are properly formatted
- Ensure all admin tools are generating logs correctly

---

## Featured Players Manager

Easily manage which players are always cached for instant loading.

### Access the Featured Players Manager
```
http://localhost:3000/api/admin/featured-players?token=wnba_admin_2024_secure
```

### What it does:
- **Add Players** - Add new player IDs to always-cached list
- **Remove Players** - Remove players from always-cached list
- **Edit Player IDs** - Update existing player IDs
- **Save Changes** - Automatically updates `popular_players.json`

### How it works:
- Featured players are automatically cached and kept warm by the cron job
- These players load instantly when searched
- Add players that are frequently searched for to improve performance
- Changes are saved to `scripts/popular_players.json`

### Using the Data:
- Add popular players from search logs to always-cached list
- Remove players that are no longer frequently searched
- Optimize cache performance based on user behavior
- Ensure the most popular players always load quickly

---

**Keep this file for future reference!** 