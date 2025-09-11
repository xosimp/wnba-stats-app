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
 * Scrapes WNBA player per-minute stats from Basketball Reference
 * Source: https://www.basketball-reference.com/wnba/years/2025_per_minute.html
 * Returns: Array of player per-minute stats objects including TRB per minute
 */
async function scrapePerMinuteStats(season = '2025') {
  console.log(`🏀 Starting WNBA Per-Minute Stats Scraper for ${season} season...`);
  console.log(`📊 Source: Basketball Reference Per-Minute Stats\n`);
  
  let browser;
  
  try {
    // Launch browser in enhanced stealth mode (same as advanced scraper)
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
    
    // Block ads and unwanted resources (same as advanced scraper)
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
    
    // Navigate to the per-minute stats page
    const url = `https://www.basketball-reference.com/wnba/years/${season}_per_minute.html`;
    console.log(`🌐 Navigating to: ${url}`);
    
    // First, let's verify this URL exists by checking what we get
    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 120000
      });
      console.log(`📡 Response status: ${response.status()}`);
      console.log(`📡 Response URL: ${response.url()}`);
    } catch (error) {
      console.log(`⚠️ Navigation error: ${error.message}`);
      // Try alternative URL patterns
      const alternativeUrl = `https://www.basketball-reference.com/wnba/years/${season}_per_36_minutes.html`;
      console.log(`🔄 Trying alternative URL: ${alternativeUrl}`);
      await page.goto(alternativeUrl, {
        waitUntil: 'networkidle2',
        timeout: 120000
      });
    }
    
    // Wait for page to stabilize
    console.log('⏳ Waiting for page to load and stabilize...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Additional wait for dynamic content to load
    console.log('⏳ Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Wait for the stats table to load with retry logic
    console.log('🔍 Looking for per-minute stats table...');
    let tableFound = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!tableFound && retryCount < maxRetries) {
      try {
        // Try multiple possible selectors (based on screenshot: table has id="per_minute_sh")
        const possibleSelectors = [
          '#per_minute',
          'table[id="per_minute"]',
          '#per_minute_sh',
          'table[id="per_minute_sh"]',
          '#stats',
          'table[id="stats"]',
          'table[class*="stats"]',
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
      throw new Error('Per-minute stats table could not be found after multiple retries');
    }
    
    // Extract player stats from the table
    console.log('📊 Extracting player per-minute stats...');
    
    // Check if the table exists before extracting
    const tableExists = await page.$('#per_minute');
    console.log(`Table exists: ${!!tableExists}`);
    
    if (tableExists) {
      // Wait a bit more for rows to populate
      console.log('⏳ Waiting for table rows to populate...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const rowCount = await page.evaluate(() => {
        const table = document.querySelector('#per_minute');
        return table ? table.querySelectorAll('tbody tr').length : 0;
      });
      console.log(`Table has ${rowCount} player rows`);
    }
    
    const playerStats = await page.evaluate(() => {
      const stats = [];
      
      // Find the per-minute stats table (based on actual HTML: id="per_minute")
      let table = document.querySelector('#per_minute');
      if (!table) {
        table = document.querySelector('table[id="per_minute"]');
      }
      if (!table) {
        table = document.querySelector('#per_minute_sh');
      }
      if (!table) {
        table = document.querySelector('table[id="per_minute_sh"]');
      }
      if (!table) {
        table = document.querySelector('#stats');
      }
      if (!table) {
        table = document.querySelector('table[class*="stats"]');
      }
      if (!table) {
        table = document.querySelector('table');
      }
      
      if (!table) {
        console.error('No table found on the page');
        return stats;
      }
      
      console.log(`Found table: id="${table.id}", class="${table.className}"`);
      
      // Get all rows (based on screenshot: rows have class="full_table" and data-row attributes)
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
          
          // Skip rows that don't have player data (based on screenshot: player names in th[data-stat="player"])
          let playerCell = row.querySelector('th[data-stat="player"]');
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
          
          // Get team abbreviation
          let team = '';
          const teamCell = row.querySelector('td[data-stat="team"]');
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

          // Get basic stats
          const posCell = row.querySelector('td[data-stat="pos"]');
          const position = posCell ? posCell.textContent.trim() : '';
          
          const gamesCell = row.querySelector('td[data-stat="g"]');
          const gamesPlayed = gamesCell ? parseInt(gamesCell.textContent.trim()) || 0 : 0;
          
          const totalMinutesCell = row.querySelector('td[data-stat="mp"]');
          const totalMinutes = totalMinutesCell ? parseInt(totalMinutesCell.textContent.trim()) || 0 : 0;
          
          // Get per-36 stats (based on actual HTML data attributes)
          const fgPer36Cell = row.querySelector('td[data-stat="fg_per_mp"]');
          const fgPer36 = fgPer36Cell ? parseFloat(fgPer36Cell.textContent.trim()) || 0 : 0;
          
          const fgaPer36Cell = row.querySelector('td[data-stat="fga_per_mp"]');
          const fgaPer36 = fgaPer36Cell ? parseFloat(fgaPer36Cell.textContent.trim()) || 0 : 0;
          
          const fg3Per36Cell = row.querySelector('td[data-stat="fg3_per_mp"]');
          const fg3Per36 = fg3Per36Cell ? parseFloat(fg3Per36Cell.textContent.trim()) || 0 : 0;
          
          const fg3aPer36Cell = row.querySelector('td[data-stat="fg3a_per_mp"]');
          const fg3aPer36 = fg3aPer36Cell ? parseFloat(fg3aPer36Cell.textContent.trim()) || 0 : 0;
          
          const fg2Per36Cell = row.querySelector('td[data-stat="fg2_per_mp"]');
          const fg2Per36 = fg2Per36Cell ? parseFloat(fg2Per36Cell.textContent.trim()) || 0 : 0;
          
          const fg2aPer36Cell = row.querySelector('td[data-stat="fg2a_per_mp"]');
          const fg2aPer36 = fg2aPer36Cell ? parseFloat(fg2aPer36Cell.textContent.trim()) || 0 : 0;
          
          const ftPer36Cell = row.querySelector('td[data-stat="ft_per_mp"]');
          const ftPer36 = ftPer36Cell ? parseFloat(ftPer36Cell.textContent.trim()) || 0 : 0;
          
          const ftaPer36Cell = row.querySelector('td[data-stat="fta_per_mp"]');
          const ftaPer36 = ftaPer36Cell ? parseFloat(ftaPer36Cell.textContent.trim()) || 0 : 0;
          
          // 🎯 KEY METRICS: Rebounds (based on actual HTML data attributes)
          const orbPer36Cell = row.querySelector('td[data-stat="orb_per_mp"]');
          const orbPer36 = orbPer36Cell ? parseFloat(orbPer36Cell.textContent.trim()) || 0 : 0;
          
          const trbPer36Cell = row.querySelector('td[data-stat="trb_per_mp"]');
          const trbPer36 = trbPer36Cell ? parseFloat(trbPer36Cell.textContent.trim()) || 0 : 0;
          
          // Calculate defensive rebounds
          const drbPer36 = trbPer36 - orbPer36;
          
          // Other stats
          const astPer36Cell = row.querySelector('td[data-stat="ast_per_mp"]');
          const astPer36 = astPer36Cell ? parseFloat(astPer36Cell.textContent.trim()) || 0 : 0;
          
          const stlPer36Cell = row.querySelector('td[data-stat="stl_per_mp"]');
          const stlPer36 = stlPer36Cell ? parseFloat(stlPer36Cell.textContent.trim()) || 0 : 0;
          
          const blkPer36Cell = row.querySelector('td[data-stat="blk_per_mp"]');
          const blkPer36 = blkPer36Cell ? parseFloat(blkPer36Cell.textContent.trim()) || 0 : 0;
          
          const tovPer36Cell = row.querySelector('td[data-stat="tov_per_mp"]');
          const tovPer36 = tovPer36Cell ? parseFloat(tovPer36Cell.textContent.trim()) || 0 : 0;
          
          const pfPer36Cell = row.querySelector('td[data-stat="pf_per_mp"]');
          const pfPer36 = pfPer36Cell ? parseFloat(pfPer36Cell.textContent.trim()) || 0 : 0;
          
          const ptsPer36Cell = row.querySelector('td[data-stat="pts_per_mp"]');
          const ptsPer36 = ptsPer36Cell ? parseFloat(ptsPer36Cell.textContent.trim()) || 0 : 0;
          
          // Create player stats object
          const playerStat = {
            player_name: playerName,
            team: team,
            position: position,
            season: '2025',
            games_played: gamesPlayed,
            total_minutes: totalMinutes,
            
            // Per-minute stats (calculated from per-36)
            fg_per_minute: fgPer36 / 36,
            fga_per_minute: fgaPer36 / 36,
            fg3_per_minute: fg3Per36 / 36,
            fg3a_per_minute: fg3aPer36 / 36,
            fg2_per_minute: fg2Per36 / 36,
            fg2a_per_minute: fg2aPer36 / 36,
            ft_per_minute: ftPer36 / 36,
            fta_per_minute: ftaPer36 / 36,
            trb_per_minute: trbPer36 / 36,        // 🎯 KEY METRIC
            orb_per_minute: orbPer36 / 36,         // 🎯 KEY METRIC
            drb_per_minute: drbPer36 / 36,         // 🎯 KEY METRIC
            ast_per_minute: astPer36 / 36,
            stl_per_minute: stlPer36 / 36,
            blk_per_minute: blkPer36 / 36,
            tov_per_minute: tovPer36 / 36,
            pf_per_minute: pfPer36 / 36,
            pts_per_minute: ptsPer36 / 36,
            
            // Per-36 minute stats (from Basketball Reference)
            fg_per_36: fgPer36,
            fga_per_36: fgaPer36,
            fg3_per_36: fg3Per36,
            fg3a_per_36: fg3aPer36,
            fg2_per_36: fg2Per36,
            fg2a_per_36: fg2aPer36,
            ft_per_36: ftPer36,
            fta_per_36: ftaPer36,
            trb_per_36: trbPer36,             // 🎯 KEY METRIC
            orb_per_36: orbPer36,              // 🎯 KEY METRIC
            drb_per_36: drbPer36,              // 🎯 KEY METRIC
            ast_per_36: astPer36,
            stl_per_36: stlPer36,
            blk_per_36: blkPer36,
            tov_per_36: tovPer36,
            pf_per_36: pfPer36,
            pts_per_36: ptsPer36,
            
            // Metadata
            scraped_at: new Date().toISOString(),
            source: 'basketball-reference-per-minute'
          };
          
          stats.push(playerStat);
          
        } catch (error) {
          console.error(`Error processing row: ${error.message}`);
          continue;
        }
      }
      
      return stats;
    });
    
    console.log(`✅ Successfully extracted ${playerStats.length} player per-minute stats`);
    
    // Save to database
    if (playerStats.length > 0) {
      console.log('💾 Saving per-minute stats to database...');
      console.log(`📊 Sample data structure:`, JSON.stringify(playerStats[0], null, 2));
      
            const { data, error } = await supabase
        .from('player_per_minute_stats')
        .insert(playerStats);
      
      if (error) {
        console.error('❌ Database error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log(`✅ Successfully saved ${playerStats.length} player per-minute stats to database`);
      
      // Log some sample data for verification
      console.log('\n📊 Sample per-minute stats:');
      playerStats.slice(0, 3).forEach(player => {
        console.log(`   ${player.player_name} (${player.team}): TRB/min: ${player.trb_per_minute.toFixed(4)}, TRB/36: ${player.trb_per_36}`);
      });
      
    } else {
      console.log('⚠️  No player stats found to save');
    }
    
    return playerStats;
    
  } catch (error) {
    console.error('❌ Error scraping per-minute stats:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// Export the function for use in other scripts
module.exports = { scrapePerMinuteStats };

// Run the scraper if this script is executed directly
if (require.main === module) {
  scrapePerMinuteStats()
    .then(() => {
      console.log('🎉 Per-minute stats scraping completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Per-minute stats scraping failed:', error);
      process.exit(1);
    });
}
