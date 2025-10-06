const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Scrapes NBA player per-game stats from Basketball Reference
 * Source: https://www.basketball-reference.com/leagues/NBA_2025_per_game.html
 * Returns: Array of player per-game stats objects
 */
async function scrapeNBAPlayerStats(season = '2025') {
  console.log(`🏀 Starting NBA Player Stats Scraper for ${season} season...`);
  console.log(`📊 Source: Basketball Reference NBA Per Game Statistics\n`);
  
  let browser;
  
  try {
    // Launch browser in enhanced stealth mode (same as WNBA scraper)
    browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-notifications',
        '--disable-geolocation',
        '--disable-media-session',
        '--disable-speech-api',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--disable-component-update',
        '--disable-client-side-phishing-detection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });
    
    const page = await browser.newPage();
    
    // Enable console logging from browser context
    page.on('console', msg => {
      console.log('Browser console:', msg.text());
    });
    
    // Enhanced stealth mode with ad-blocking
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1'
    });
    
    // Block ads and unwanted resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();
      
      // Block common ad domains and unwanted resource types
      const blockedDomains = [
        'doubleclick.net', 'googleadservices.com', 'googlesyndication.com',
        'facebook.com', 'facebook.net', 'twitter.com', 'amazon-adsystem.com',
        'adnxs.com', 'adsystem.com', 'adtech.com', 'advertising.com',
        'analytics', 'tracking', 'pixel', 'beacon', 'stats'
      ];
      
      const blockedResourceTypes = ['image', 'media', 'font', 'stylesheet'];
      
      // Block ads and unwanted resources
      if (blockedDomains.some(domain => url.includes(domain)) || 
          blockedResourceTypes.includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Set viewport and add human-like behavior
    await page.setViewport({ width: 1920, height: 1080 });
    await page.mouse.move(Math.random() * 1920, Math.random() * 1080);
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Navigate to the NBA per-game stats page (2024-2025 season)
    const url = `https://www.basketball-reference.com/leagues/NBA_2025_per_game.html`;
    console.log(`🌐 Navigating to: ${url}`);
    
    // Navigate to the page
    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 120000
      });
      console.log(`📡 Response status: ${response.status()}`);
      console.log(`📡 Response URL: ${response.url()}`);
    } catch (error) {
      console.log(`⚠️ Navigation error: ${error.message}`);
      throw error;
    }
    
    // Wait for page to stabilize
    console.log('⏳ Waiting for page to load and stabilize...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Additional wait for dynamic content to load
    console.log('⏳ Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Wait for the stats table to load with retry logic
    console.log('🔍 Looking for NBA per-game stats table...');
    let tableFound = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!tableFound && retryCount < maxRetries) {
      try {
        // Try multiple possible selectors for NBA stats table
        const possibleSelectors = [
          '#all_per_game_stats',
          'table[id="per_game"]',
          '#per_game',
          '#stats',
          'table[id="stats"]',
          'table[class*="stats"]',
          'table[class*="sortable"]',
          'table'
        ];
        
        for (const selector of possibleSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 10000 });
            console.log(`✅ Found table with selector: ${selector}`);
            tableFound = true;
            break;
          } catch (e) {
            console.log(`❌ Selector ${selector} not found`);
          }
        }
        
        if (tableFound) break;
        
        retryCount++;
        console.log(`⚠️ No table found, retry ${retryCount}/${maxRetries}...`);
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          if (retryCount === 2) {
            console.log('🔄 Refreshing page...');
            await page.reload({ waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      } catch (error) {
        retryCount++;
        console.log(`⚠️ Error during retry ${retryCount}:`, error.message);
      }
    }
    
    if (!tableFound) {
      throw new Error('NBA per-game stats table could not be found after multiple retries');
    }
    
    // Extract player stats from the table
    console.log('📊 Extracting NBA player per-game stats...');
    
    // Check if the table exists before extracting
    const tableExists = await page.$('#all_per_game_stats') || await page.$('#per_game') || await page.$('table[class*="stats"]') || await page.$('table[class*="sortable"]');
    console.log(`Table exists: ${!!tableExists}`);
    
    if (tableExists) {
      // Wait a bit more for rows to populate
      console.log('⏳ Waiting for table rows to populate...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const rowCount = await page.evaluate(() => {
        let table = document.querySelector('#all_per_game_stats');
        if (!table) {
          table = document.querySelector('#per_game');
        }
        if (!table) {
          table = document.querySelector('table[class*="stats"]');
        }
        if (!table) {
          table = document.querySelector('table[class*="sortable"]');
        }
        return table ? table.querySelectorAll('tbody tr').length : 0;
      });
      console.log(`Table has ${rowCount} player rows`);
    }
    
    const playerStats = await page.evaluate(() => {
      const stats = [];
      
      // Find the NBA per-game stats table
      let table = document.querySelector('#all_per_game_stats');
      if (!table) {
        table = document.querySelector('#per_game');
      }
      if (!table) {
        table = document.querySelector('table[id="per_game"]');
      }
      if (!table) {
        table = document.querySelector('#stats');
      }
      if (!table) {
        table = document.querySelector('table[class*="stats"]');
      }
      if (!table) {
        table = document.querySelector('table[class*="sortable"]');
      }
      if (!table) {
        table = document.querySelector('table');
      }
      
      if (!table) {
        console.error('No table found on the page');
        return stats;
      }
      
      console.log(`Found table: id="${table.id}", class="${table.className}"`);
      
      // Get all rows - NBA table uses tbody tr structure
      let rows = table.querySelectorAll('tbody tr');
      console.log(`Found ${rows.length} rows with 'tbody tr' selector`);
      
      if (rows.length === 0) {
        rows = table.querySelectorAll('tr[data-row]');
        console.log(`Found ${rows.length} rows with 'tr[data-row]' selector`);
      }
      
      if (rows.length === 0) {
        rows = table.querySelectorAll('tr');
        console.log(`Found ${rows.length} rows with 'tr' selector`);
      }
      
      // Debug: log the first few rows to see their structure
      if (rows.length > 0) {
        console.log('First row HTML:', rows[0].outerHTML.substring(0, 300));
        console.log('First row classes:', rows[0].className);
        console.log('First row data attributes:', rows[0].getAttribute('data-row'));
      } else {
        console.log('No rows found with any selector');
        console.log('Table HTML preview:', table.outerHTML.substring(0, 1000));
      }
      
      for (const row of rows) {
        try {
          // Debug: log each row being processed
          console.log(`Processing row: class="${row.className}", data-row="${row.getAttribute('data-row')}"`);
          
          // Skip rows that don't have player data
          let playerCell = row.querySelector('th[data-stat="name_display"]');
          if (!playerCell) {
            playerCell = row.querySelector('td[data-stat="name_display"]');
          }
          if (!playerCell) {
            playerCell = row.querySelector('th[data-stat="player"]');
          }
          if (!playerCell) {
            playerCell = row.querySelector('td[data-stat="player"]');
          }
          
          console.log(`Player cell found: ${!!playerCell}, content: "${playerCell ? playerCell.textContent.trim() : 'NONE'}"`);
          
          if (!playerCell || !playerCell.textContent.trim()) {
            console.log('Skipping row - no player data');
            continue;
          }
          
          const anchor = playerCell.querySelector('a');
          const playerName = (anchor ? anchor.textContent : playerCell.textContent).trim();
          
          // Skip non-player rows (League Average, etc.)
          if (playerName.toLowerCase().includes('league average') || 
              playerName.toLowerCase().includes('team') ||
              playerName.toLowerCase().includes('total')) {
            console.log('Skipping non-player row:', playerName);
            continue;
          }
          
          // Get team abbreviation
          let team = '';
          const teamCell = row.querySelector('td[data-stat="team_name_abbr"]');
          if (teamCell) {
            team = teamCell.textContent.trim();
          }
          
          // Fallback for team extraction
          if (!team && anchor) {
            const href = anchor.getAttribute('href');
            if (href && href.includes('/teams/')) {
              const teamMatch = href.match(/\/teams\/([A-Z]{3})\//);
              if (teamMatch) {
                team = teamMatch[1];
              }
            }
          }
          
          if (!team) {
            team = 'UNK';
          }

          // Get basic info
          const ageCell = row.querySelector('td[data-stat="age"]');
          const age = ageCell ? parseInt(ageCell.textContent.trim()) || 0 : 0;
          
          const posCell = row.querySelector('td[data-stat="pos"]');
          const position = posCell ? posCell.textContent.trim() : '';
          
          const gamesCell = row.querySelector('td[data-stat="games"]');
          const games = gamesCell ? parseInt(gamesCell.textContent.trim()) || 0 : 0;
          
          const gamesStartedCell = row.querySelector('td[data-stat="games_started"]');
          const gamesStarted = gamesStartedCell ? parseInt(gamesStartedCell.textContent.trim()) || 0 : 0;
          
          const minutesCell = row.querySelector('td[data-stat="mp_per_g"]');
          const minutesPlayed = minutesCell ? parseFloat(minutesCell.textContent.trim()) || 0 : 0;
          
          // Field Goals
          const fgCell = row.querySelector('td[data-stat="fg_per_g"]');
          const fieldGoals = fgCell ? parseFloat(fgCell.textContent.trim()) || 0 : 0;
          
          const fgaCell = row.querySelector('td[data-stat="fga_per_g"]');
          const fieldGoalAttempts = fgaCell ? parseFloat(fgaCell.textContent.trim()) || 0 : 0;
          
          const fgPctCell = row.querySelector('td[data-stat="fg_pct"]');
          const fieldGoalPercentage = fgPctCell ? Math.min(parseFloat(fgPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          // 3-Point Shooting
          const fg3Cell = row.querySelector('td[data-stat="fg3_per_g"]');
          const threePointers = fg3Cell ? parseFloat(fg3Cell.textContent.trim()) || 0 : 0;
          
          const fg3aCell = row.querySelector('td[data-stat="fg3a_per_g"]');
          const threePointAttempts = fg3aCell ? parseFloat(fg3aCell.textContent.trim()) || 0 : 0;
          
          const fg3PctCell = row.querySelector('td[data-stat="fg3_pct"]');
          const threePointPercentage = fg3PctCell ? Math.min(parseFloat(fg3PctCell.textContent.trim()) || 0, 1.0) : 0;
          
          // 2-Point Shooting
          const fg2Cell = row.querySelector('td[data-stat="fg2_per_g"]');
          const twoPointers = fg2Cell ? parseFloat(fg2Cell.textContent.trim()) || 0 : 0;
          
          const fg2aCell = row.querySelector('td[data-stat="fg2a_per_g"]');
          const twoPointAttempts = fg2aCell ? parseFloat(fg2aCell.textContent.trim()) || 0 : 0;
          
          const fg2PctCell = row.querySelector('td[data-stat="fg2_pct"]');
          const twoPointPercentage = fg2PctCell ? Math.min(parseFloat(fg2PctCell.textContent.trim()) || 0, 1.0) : 0;
          
          // Effective Field Goal Percentage
          const efgPctCell = row.querySelector('td[data-stat="efg_pct"]');
          const effectiveFieldGoalPercentage = efgPctCell ? Math.min(parseFloat(efgPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          // Free Throws
          const ftCell = row.querySelector('td[data-stat="ft_per_g"]');
          const freeThrows = ftCell ? parseFloat(ftCell.textContent.trim()) || 0 : 0;
          
          const ftaCell = row.querySelector('td[data-stat="fta_per_g"]');
          const freeThrowAttempts = ftaCell ? parseFloat(ftaCell.textContent.trim()) || 0 : 0;
          
          const ftPctCell = row.querySelector('td[data-stat="ft_pct"]');
          const freeThrowPercentage = ftPctCell ? Math.min(parseFloat(ftPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          // Rebounds
          const orbCell = row.querySelector('td[data-stat="orb_per_g"]');
          const offensiveRebounds = orbCell ? parseFloat(orbCell.textContent.trim()) || 0 : 0;
          
          const drbCell = row.querySelector('td[data-stat="drb_per_g"]');
          const defensiveRebounds = drbCell ? parseFloat(drbCell.textContent.trim()) || 0 : 0;
          
          const trbCell = row.querySelector('td[data-stat="trb_per_g"]');
          const totalRebounds = trbCell ? parseFloat(trbCell.textContent.trim()) || 0 : 0;
          
          // Other Stats
          const astCell = row.querySelector('td[data-stat="ast_per_g"]');
          const assists = astCell ? parseFloat(astCell.textContent.trim()) || 0 : 0;
          
          const stlCell = row.querySelector('td[data-stat="stl_per_g"]');
          const steals = stlCell ? parseFloat(stlCell.textContent.trim()) || 0 : 0;
          
          const blkCell = row.querySelector('td[data-stat="blk_per_g"]');
          const blocks = blkCell ? parseFloat(blkCell.textContent.trim()) || 0 : 0;
          
          const tovCell = row.querySelector('td[data-stat="tov_per_g"]');
          const turnovers = tovCell ? parseFloat(tovCell.textContent.trim()) || 0 : 0;
          
          const pfCell = row.querySelector('td[data-stat="pf_per_g"]');
          const personalFouls = pfCell ? parseFloat(pfCell.textContent.trim()) || 0 : 0;
          
          // Points
          const ptsCell = row.querySelector('td[data-stat="pts_per_g"]');
          const points = ptsCell ? parseFloat(ptsCell.textContent.trim()) || 0 : 0;
          
          // Awards (if available)
          let awards = null;
          const awardsCell = row.querySelector('td[data-stat="awards"]');
          if (awardsCell && awardsCell.textContent.trim()) {
            awards = awardsCell.textContent.trim();
          }
          
          // Create player stats object matching the NBA table schema
          const playerStat = {
            player_id: playerName.toLowerCase().replace(/\s+/g, '_'), // Simple ID generation
            player_name: playerName,
            season: '2024-25',
            
            // Basic Info
            age: age,
            team: team,
            position: position,
            
            // Games
            games: games,
            games_started: gamesStarted,
            minutes_played: minutesPlayed,
            
            // Field Goals
            field_goals: fieldGoals,
            field_goal_attempts: fieldGoalAttempts,
            field_goal_percentage: fieldGoalPercentage,
            
            // 3-Point Shooting
            three_pointers: threePointers,
            three_point_attempts: threePointAttempts,
            three_point_percentage: threePointPercentage,
            
            // 2-Point Shooting
            two_pointers: twoPointers,
            two_point_attempts: twoPointAttempts,
            two_point_percentage: twoPointPercentage,
            
            // Effective Field Goal Percentage
            effective_field_goal_percentage: effectiveFieldGoalPercentage,
            
            // Free Throws
            free_throws: freeThrows,
            free_throw_attempts: freeThrowAttempts,
            free_throw_percentage: freeThrowPercentage,
            
            // Rebounds
            offensive_rebounds: offensiveRebounds,
            defensive_rebounds: defensiveRebounds,
            total_rebounds: totalRebounds,
            
            // Other Stats
            assists: assists,
            steals: steals,
            blocks: blocks,
            turnovers: turnovers,
            personal_fouls: personalFouls,
            
            // Points
            points: points,
            
            // Awards
            awards: awards,
            
            // Metadata
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          stats.push(playerStat);
          
        } catch (error) {
          console.error(`Error processing row: ${error.message}`);
          continue;
        }
      }
      
      return stats;
    });
    
    console.log(`✅ Successfully extracted ${playerStats.length} NBA player stats`);
    
    // Save to database
    if (playerStats.length > 0) {
      console.log('💾 Saving NBA player stats to database...');
      console.log(`📊 Sample data structure:`, JSON.stringify(playerStats[0], null, 2));
      
      // Deduplicate players (some players appear multiple times for different teams)
      const uniquePlayers = new Map();
      playerStats.forEach(player => {
        const key = `${player.player_name}_${player.season}`;
        if (!uniquePlayers.has(key)) {
          uniquePlayers.set(key, player);
        }
      });
      
      const deduplicatedStats = Array.from(uniquePlayers.values());
      console.log(`📊 Deduplicated from ${playerStats.length} to ${deduplicatedStats.length} unique players`);
      
      const { data, error } = await supabase
        .from('nba_player_stats')
        .insert(deduplicatedStats);
      
      if (error) {
        console.error('❌ Database error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log(`✅ Successfully saved ${playerStats.length} NBA player stats to database`);
      
      // Log some sample data for verification
      console.log('\n📊 Sample NBA player stats:');
      playerStats.slice(0, 3).forEach(player => {
        console.log(`   ${player.player_name} (${player.team}): ${player.points} PPG, ${player.total_rebounds} RPG, ${player.assists} APG`);
      });
      
    } else {
      console.log('⚠️  No NBA player stats found to save');
    }
    
    return playerStats;
    
  } catch (error) {
    console.error('❌ Error scraping NBA player stats:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// Export the function for use in other scripts
module.exports = { scrapeNBAPlayerStats };

// Run the scraper if this script is executed directly
if (require.main === module) {
  scrapeNBAPlayerStats()
    .then(() => {
      console.log('🎉 NBA player stats scraping completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 NBA player stats scraping failed:', error);
      process.exit(1);
    });
}
