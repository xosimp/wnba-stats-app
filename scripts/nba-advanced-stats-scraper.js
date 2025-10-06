const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function scrapeNBAAdvancedStats() {
  let browser;
  
  try {
    console.log('🏀 Starting NBA Advanced Stats Scraper for 2025 season...');
    console.log('📊 Source: Basketball Reference NBA Advanced Statistics');
    
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
    
    // Block ads and unwanted resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();
      
      const blockedDomains = [
        'doubleclick.net', 'googleadservices.com', 'googlesyndication.com',
        'facebook.com', 'facebook.net', 'twitter.com', 'amazon-adsystem.com',
        'adnxs.com', 'adsystem.com', 'adtech.com', 'advertising.com',
        'analytics', 'tracking', 'pixel', 'beacon', 'stats'
      ];
      
      const blockedResourceTypes = ['image', 'media', 'font', 'stylesheet'];
      
      if (blockedDomains.some(domain => url.includes(domain)) || 
          blockedResourceTypes.includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    await page.setViewport({ width: 1920, height: 1080 });
    
    const url = `https://www.basketball-reference.com/leagues/NBA_2025_advanced.html`;
    console.log(`🌐 Navigating to: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 120000
    });
    
    console.log('⏳ Waiting for page to load and stabilize...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('⏳ Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if table exists
    const tableExists = await page.evaluate(() => {
      let table = document.querySelector('#all_advanced_stats');
      if (!table) {
        table = document.querySelector('#advanced');
      }
      if (!table) {
        table = document.querySelector('table[class*="stats"]');
      }
      if (!table) {
        table = document.querySelector('table[class*="sortable"]');
      }
      return !!table;
    });
    
    if (!tableExists) {
      throw new Error('❌ NBA advanced stats table not found');
    }
    
    console.log('🔍 Looking for NBA advanced stats table...');
    
    // Find the table
    const tableSelector = await page.evaluate(() => {
      const selectors = [
        '#all_advanced_stats',
        '#advanced',
        'table[class*="stats"]',
        'table[class*="sortable"]'
      ];
      
      for (const selector of selectors) {
        const table = document.querySelector(selector);
        if (table) {
          console.log(`✅ Found table with selector: ${selector}`);
          return selector;
        }
      }
      return null;
    });
    
    if (!tableSelector) {
      throw new Error('❌ Could not find NBA advanced stats table');
    }
    
    console.log('📊 Extracting NBA player advanced stats...');
    
    if (tableExists) {
      // Wait a bit more for rows to populate
      console.log('⏳ Waiting for table rows to populate...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const rowCount = await page.evaluate(() => {
        let table = document.querySelector('#all_advanced_stats');
        if (!table) {
          table = document.querySelector('#advanced');
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
      
      // Find the table
      let table = document.querySelector('#all_advanced_stats');
      if (!table) {
        table = document.querySelector('#advanced');
      }
      if (!table) {
        table = document.querySelector('table[class*="stats"]');
      }
      if (!table) {
        table = document.querySelector('table[class*="sortable"]');
      }
      
      if (!table) {
        console.log('❌ Table not found');
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
          
          // Generate player ID
          const playerId = playerName.toLowerCase().replace(/\s+/g, '_');
          
          // Get age
          const ageCell = row.querySelector('td[data-stat="age"]');
          const age = ageCell ? parseInt(ageCell.textContent.trim()) || 0 : 0;
          
          const posCell = row.querySelector('td[data-stat="pos"]');
          const position = posCell ? posCell.textContent.trim() : '';
          
          const gamesCell = row.querySelector('td[data-stat="games"]');
          const games = gamesCell ? parseInt(gamesCell.textContent.trim()) || 0 : 0;
          
          const gamesStartedCell = row.querySelector('td[data-stat="games_started"]');
          const gamesStarted = gamesStartedCell ? parseInt(gamesStartedCell.textContent.trim()) || 0 : 0;
          
          const minutesCell = row.querySelector('td[data-stat="mp"]');
          const minutesPlayed = minutesCell ? parseFloat(minutesCell.textContent.trim()) || 0 : 0;
          
          // Advanced Metrics
          const perCell = row.querySelector('td[data-stat="per"]');
          const per = perCell ? parseFloat(perCell.textContent.trim()) || 0 : 0;
          
          const tsPctCell = row.querySelector('td[data-stat="ts_pct"]');
          const tsPct = tsPctCell ? Math.min(parseFloat(tsPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          const fg3aPerFgaPctCell = row.querySelector('td[data-stat="fg3a_per_fga_pct"]');
          const fg3aPerFgaPct = fg3aPerFgaPctCell ? Math.min(parseFloat(fg3aPerFgaPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          const ftaPerFgaPctCell = row.querySelector('td[data-stat="fta_per_fga_pct"]');
          const ftaPerFgaPct = ftaPerFgaPctCell ? Math.min(parseFloat(ftaPerFgaPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          const orbPctCell = row.querySelector('td[data-stat="orb_pct"]');
          const orbPct = orbPctCell ? Math.min(parseFloat(orbPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          const drbPctCell = row.querySelector('td[data-stat="drb_pct"]');
          const drbPct = drbPctCell ? Math.min(parseFloat(drbPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          const trbPctCell = row.querySelector('td[data-stat="trb_pct"]');
          const trbPct = trbPctCell ? Math.min(parseFloat(trbPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          const astPctCell = row.querySelector('td[data-stat="ast_pct"]');
          const astPct = astPctCell ? Math.min(parseFloat(astPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          const stlPctCell = row.querySelector('td[data-stat="stl_pct"]');
          const stlPct = stlPctCell ? Math.min(parseFloat(stlPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          const blkPctCell = row.querySelector('td[data-stat="blk_pct"]');
          const blkPct = blkPctCell ? Math.min(parseFloat(blkPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          const tovPctCell = row.querySelector('td[data-stat="tov_pct"]');
          const tovPct = tovPctCell ? Math.min(parseFloat(tovPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          const usgPctCell = row.querySelector('td[data-stat="usg_pct"]');
          const usgPct = usgPctCell ? Math.min(parseFloat(usgPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          // Win Shares
          const owsCell = row.querySelector('td[data-stat="ows"]');
          const ows = owsCell ? parseFloat(owsCell.textContent.trim()) || 0 : 0;
          
          const dwsCell = row.querySelector('td[data-stat="dws"]');
          const dws = dwsCell ? parseFloat(dwsCell.textContent.trim()) || 0 : 0;
          
          const wsCell = row.querySelector('td[data-stat="ws"]');
          const ws = wsCell ? parseFloat(wsCell.textContent.trim()) || 0 : 0;
          
          const wsPer48Cell = row.querySelector('td[data-stat="ws_per_48"]');
          const wsPer48 = wsPer48Cell ? parseFloat(wsPer48Cell.textContent.trim()) || 0 : 0;
          
          // Box Plus/Minus
          const obpmCell = row.querySelector('td[data-stat="obpm"]');
          const obpm = obpmCell ? parseFloat(obpmCell.textContent.trim()) || 0 : 0;
          
          const dbpmCell = row.querySelector('td[data-stat="dbpm"]');
          const dbpm = dbpmCell ? parseFloat(dbpmCell.textContent.trim()) || 0 : 0;
          
          const bpmCell = row.querySelector('td[data-stat="bpm"]');
          const bpm = bpmCell ? parseFloat(bpmCell.textContent.trim()) || 0 : 0;
          
          const vorpCell = row.querySelector('td[data-stat="vorp"]');
          const vorp = vorpCell ? parseFloat(vorpCell.textContent.trim()) || 0 : 0;
          
          // Awards (if available)
          let awards = null;
          const awardsCell = row.querySelector('td[data-stat="awards"]');
          if (awardsCell && awardsCell.textContent.trim()) {
            awards = awardsCell.textContent.trim();
          }
          
          const playerStat = {
            player_id: playerId,
            player_name: playerName,
            season: '2024-25',
            age: age,
            team: team || 'UNK',
            position: position,
            games: games,
            games_started: gamesStarted,
            minutes_played: minutesPlayed,
            per: per,
            ts_pct: tsPct,
            fg3a_per_fga_pct: fg3aPerFgaPct,
            fta_per_fga_pct: ftaPerFgaPct,
            orb_pct: orbPct,
            drb_pct: drbPct,
            trb_pct: trbPct,
            ast_pct: astPct,
            stl_pct: stlPct,
            blk_pct: blkPct,
            tov_pct: tovPct,
            usg_pct: usgPct,
            ows: ows,
            dws: dws,
            ws: ws,
            ws_per_48: wsPer48,
            obpm: obpm,
            dbpm: dbpm,
            bpm: bpm,
            vorp: vorp,
            awards: awards,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          stats.push(playerStat);
          console.log(`✅ Extracted stats for: ${playerName} (${team})`);
          
        } catch (error) {
          console.error(`❌ Error processing row:`, error);
          continue;
        }
      }
      
      return stats;
    });
    
    console.log(`✅ Successfully extracted ${playerStats.length} NBA advanced player stats`);
    
    if (playerStats.length === 0) {
      console.log('⚠️  No NBA advanced player stats found to save');
      return;
    }
    
    // Save to database
    if (playerStats.length > 0) {
      console.log('💾 Saving NBA advanced player stats to database...');
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
        .from('nba_advanced_stats')
        .insert(deduplicatedStats);
      
      if (error) {
        console.error('❌ Database error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log(`✅ Successfully saved ${deduplicatedStats.length} NBA advanced player stats to database`);
      
      // Show sample of saved data
      console.log('\n📊 Sample NBA advanced player stats:');
      deduplicatedStats.slice(0, 3).forEach(player => {
        console.log(`   ${player.player_name} (${player.team}): PER ${player.per}, TS% ${(player.ts_pct * 100).toFixed(1)}%, BPM ${player.bpm}, VORP ${player.vorp}`);
      });
    }
    
  } catch (error) {
    console.error('💥 NBA advanced player stats scraping failed:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// Run the scraper
scrapeNBAAdvancedStats()
  .then(() => {
    console.log('🎉 NBA advanced player stats scraping completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 NBA advanced player stats scraping failed:', error);
    process.exit(1);
  });
