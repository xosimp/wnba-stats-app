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
 * Scrapes WNBA player advanced stats from Basketball Reference
 * Source: https://www.basketball-reference.com/wnba/years/2025_advanced.html
 * Returns: Array of player advanced stats objects including USG%
 */
async function scrapeAdvancedStats(season = '2025') {
  console.log(`🏀 Starting WNBA Advanced Stats Scraper for ${season} season...`);
  console.log(`📊 Source: Basketball Reference Advanced Stats\n`);
  
  let browser;
  
  try {
    // Launch browser in enhanced stealth mode
    browser = await puppeteer.launch({ 
      headless: true, // Set to true for production, false for debugging
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
    
    // Add random mouse movements to appear more human-like
    await page.mouse.move(Math.random() * 1920, Math.random() * 1080);
    
    // Random delay to avoid detection
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Navigate to Basketball Reference advanced stats page
    const url = `https://www.basketball-reference.com/wnba/years/${season}_advanced.html`;
    console.log(`🌐 Navigating to: ${url}`);
    
    // Navigate with enhanced stealth
    await page.goto(url, {
      waitUntil: 'networkidle2', // Wait for network to be idle
      timeout: 120000 // 2 minutes timeout
    });
    
    // Wait for the page to fully load and stabilize
    console.log('⏳ Waiting for page to load and stabilize...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Wait for the stats table to load with retry logic
    console.log('🔍 Looking for advanced stats table...');
    let tableFound = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!tableFound && retryCount < maxRetries) {
      try {
        // Try multiple possible selectors
        const possibleSelectors = [
          '#advanced',
          'table[id="advanced"]',
          '#advanced_stats',
          'table[id="advanced_stats"]',
          'table[class*="advanced"]',
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
          
          // Try to refresh the page if needed
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
      // Debug: let's see what's actually on the page
      console.log('🔍 Debug: Checking page content...');
      const pageContent = await page.content();
      const tables = await page.$$('table');
      console.log(`Found ${tables.length} tables on the page`);
      
      // Log all table IDs and classes
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const id = await table.evaluate(el => el.id);
        const className = await table.evaluate(el => el.className);
        console.log(`Table ${i + 1}: id="${id}", class="${className}"`);
      }
      
      throw new Error('Advanced stats table could not be found after multiple retries');
    }
    
    // Extract all player advanced stats from the table
    console.log('📊 Extracting player advanced stats...');
    
    // Debug: let's see what's on the page
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);
    
    const tableCount = await page.$$eval('table', tables => tables.length);
    console.log(`Total tables on page: ${tableCount}`);
    
    const playerStats = await page.evaluate(() => {
      const stats = [];
      
      // Find the advanced stats table - try multiple selectors
      let table = document.querySelector('#advanced');
      if (!table) {
        table = document.querySelector('table[id="advanced"]');
      }
      if (!table) {
        table = document.querySelector('#advanced_stats');
      }
      if (!table) {
        table = document.querySelector('table[id="advanced_stats"]');
      }
      if (!table) {
        table = document.querySelector('table[class*="advanced"]');
      }
      if (!table) {
        table = document.querySelector('table[class*="stats"]');
      }
      if (!table) {
        // Last resort: get the first table
        table = document.querySelector('table');
      }
      
      if (!table) {
        console.error('No table found on the page');
        return stats;
      }
      
      console.log(`Found table: id="${table.id}", class="${table.className}"`);
      
      // Get all rows in the table body - try different selectors
      let rows = table.querySelectorAll('tbody tr');
      console.log(`Found ${rows.length} rows with 'tbody tr' selector`);
      
      // If no rows found, try alternative selectors
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
        console.log('First row HTML:', rows[0].outerHTML.substring(0, 200));
        console.log('First row classes:', rows[0].className);
        console.log('First row data attributes:', rows[0].getAttribute('data-row'));
      } else {
        console.log('No rows found with any selector');
        console.log('Table HTML preview:', table.outerHTML.substring(0, 500));
      }
      
      for (const row of rows) {
        try {
          // Debug: log row info
          console.log(`Processing row: class="${row.className}", data-row="${row.getAttribute('data-row')}"`);
          
          // Skip rows that don't have player data (Basketball-Reference uses TH for player cell)
          let playerCell = row.querySelector('th[data-stat="player"]');
          if (!playerCell) {
            playerCell = row.querySelector('td[data-stat="player"]');
          }
          console.log(`Player cell found: ${!!playerCell}, content: "${playerCell ? playerCell.textContent.trim() : 'NONE'}"`);
          
          if (!playerCell || !playerCell.textContent.trim()) {
            console.log('Skipping row - no player data');
            continue;
          }
          
          const anchor = playerCell ? playerCell.querySelector('a') : null;
          const playerName = (anchor ? anchor.textContent : playerCell.textContent).trim();
          
          // Get team abbreviation - try multiple selectors and improve extraction
          let team = '';
          const teamCell = row.querySelector('td[data-stat="team_id"]');
          if (teamCell) {
            team = teamCell.textContent.trim();
          } else {
            // Try alternative selectors for team
            const teamCellAlt = row.querySelector('td[data-stat="team"]');
            if (teamCellAlt) {
              team = teamCellAlt.textContent.trim();
            }
          }
          
          // If team is still empty, try to extract from player link or other sources
          if (!team && anchor) {
            const href = anchor.getAttribute('href');
            if (href && href.includes('/teams/')) {
              const teamMatch = href.match(/\/teams\/([A-Z]{3})\//);
              if (teamMatch) {
                team = teamMatch[1];
              }
            }
          }
          
          // Fallback: if no team found, use a placeholder that won't cause DB issues
          if (!team || team === '') {
            team = 'UNK'; // Unknown team - will need manual update later
          }

          // Get position
          const posCell = row.querySelector('td[data-stat="pos"]');
          const position = posCell ? posCell.textContent.trim() : '';
          
          // Get games played
          const gamesCell = row.querySelector('td[data-stat="g"]');
          const gamesPlayed = gamesCell ? parseInt(gamesCell.textContent.trim()) || 0 : 0;
          
          // Get total minutes
          const totalMinutesCell = row.querySelector('td[data-stat="mp"]');
          const totalMinutes = totalMinutesCell ? parseInt(totalMinutesCell.textContent.trim()) || 0 : 0;
          
          // Get average minutes - improve calculation
          let avgMinutes = 0;
          const avgMinutesCell = row.querySelector('td[data-stat="mp_per_g"]');
          if (avgMinutesCell && avgMinutesCell.textContent.trim()) {
            avgMinutes = parseFloat(avgMinutesCell.textContent.trim()) || 0;
          } else if (totalMinutes > 0 && gamesPlayed > 0) {
            // Calculate average minutes if not provided
            avgMinutes = Math.round((totalMinutes / gamesPlayed) * 100) / 100;
          }
          
          // Get advanced metrics
          const perCell = row.querySelector('td[data-stat="per"]');
          const per = perCell ? parseFloat(perCell.textContent.trim()) || 0 : 0;
          
          const tsCell = row.querySelector('td[data-stat="ts_pct"]');
          const tsPercentage = tsCell ? parseFloat(tsCell.textContent.trim()) || 0 : 0;
          
          const efgCell = row.querySelector('td[data-stat="efg_pct"]');
          const efgPercentage = efgCell ? parseFloat(efgCell.textContent.trim()) || 0 : 0;
          
          const threePointRateCell = row.querySelector('td[data-stat="fg3a_per_fga_pct"]');
          const threePointAttemptRate = threePointRateCell ? parseFloat(threePointRateCell.textContent.trim()) || 0 : 0;
          
          const ftRateCell = row.querySelector('td[data-stat="fta_per_fga_pct"]');
          const freeThrowRate = ftRateCell ? parseFloat(ftRateCell.textContent.trim()) || 0 : 0;
          
          // Get rebounding rates
          const orbCell = row.querySelector('td[data-stat="orb_pct"]');
          const offensiveReboundPercentage = orbCell ? parseFloat(orbCell.textContent.trim()) || 0 : 0;
          
          const trbCell = row.querySelector('td[data-stat="trb_pct"]');
          const totalReboundPercentage = trbCell ? parseFloat(trbCell.textContent.trim()) || 0 : 0;
          
          // Get other rates
          const astCell = row.querySelector('td[data-stat="ast_pct"]');
          const assistPercentage = astCell ? parseFloat(astCell.textContent.trim()) || 0 : 0;
          
          const stlCell = row.querySelector('td[data-stat="stl_pct"]');
          const stealPercentage = stlCell ? parseFloat(stlCell.textContent.trim()) || 0 : 0;
          
          const blkCell = row.querySelector('td[data-stat="blk_pct"]');
          const blockPercentage = blkCell ? parseFloat(blkCell.textContent.trim()) || 0 : 0;
          
          const tovCell = row.querySelector('td[data-stat="tov_pct"]');
          const turnoverPercentage = tovCell ? parseFloat(tovCell.textContent.trim()) || 0 : 0;
          
          // Get USAGE PERCENTAGE - This is the key metric for injury impact!
          const usgCell = row.querySelector('td[data-stat="usg_pct"]');
          const usagePercentage = usgCell ? parseFloat(usgCell.textContent.trim()) || 0 : 0;
          
          // Get ratings
          const ortgCell = row.querySelector('td[data-stat="off_rtg"]');
          const offensiveRating = ortgCell ? parseInt(ortgCell.textContent.trim()) || 0 : 0;
          
          const drtgCell = row.querySelector('td[data-stat="def_rtg"]');
          const defensiveRating = drtgCell ? parseInt(drtgCell.textContent.trim()) || 0 : 0;
          
          // Get win shares
          const owsCell = row.querySelector('td[data-stat="ows"]');
          const offensiveWinShares = owsCell ? parseFloat(owsCell.textContent.trim()) || 0 : 0;
          
          const dwsCell = row.querySelector('td[data-stat="dws"]');
          const defensiveWinShares = dwsCell ? parseFloat(dwsCell.textContent.trim()) || 0 : 0;
          
          const wsCell = row.querySelector('td[data-stat="ws"]');
          const totalWinShares = wsCell ? parseFloat(wsCell.textContent.trim()) || 0 : 0;
          
          const ws40Cell = row.querySelector('td[data-stat="ws_per_40"]');
          const winSharesPer40 = ws40Cell ? parseFloat(ws40Cell.textContent.trim()) || 0 : 0;
          
          // Create player stats object
          const playerStat = {
            player_name: playerName,
            team: team,
            position: position,
            season: 2025,
            games_played: gamesPlayed,
            total_minutes: totalMinutes,
            avg_minutes: avgMinutes,
            per: per,
            ts_percentage: tsPercentage,
            efg_percentage: efgPercentage,
            three_point_attempt_rate: threePointAttemptRate,
            free_throw_rate: freeThrowRate,
            offensive_rebound_percentage: offensiveReboundPercentage,
            total_rebound_percentage: totalReboundPercentage,
            assist_percentage: assistPercentage,
            steal_percentage: stealPercentage,
            block_percentage: blockPercentage,
            turnover_percentage: turnoverPercentage,
            usage_percentage: usagePercentage, // Key metric for injury impact!
            offensive_rating: offensiveRating,
            defensive_rating: defensiveRating,
            offensive_win_shares: offensiveWinShares,
            defensive_win_shares: defensiveWinShares,
            total_win_shares: totalWinShares,
            win_shares_per_40: winSharesPer40
          };
          
          stats.push(playerStat);
          
        } catch (error) {
          console.error(`Error parsing row for player:`, error);
          continue;
        }
      }
      
      return stats;
    });
    
    console.log(`✅ Successfully extracted ${playerStats.length} player advanced stats`);
    
    // Log some sample data for verification
    if (playerStats.length > 0) {
      console.log('\n📋 Sample player stats:');
      const samplePlayer = playerStats[0];
      console.log(`Player: ${samplePlayer.player_name}`);
      console.log(`Team: ${samplePlayer.team}`);
      console.log(`Position: ${samplePlayer.position}`);
      console.log(`Usage %: ${samplePlayer.usage_percentage}`);
      console.log(`PER: ${samplePlayer.per}`);
      console.log(`TS%: ${samplePlayer.ts_percentage}`);
    }
    
    // Save to database
    console.log('\n💾 Saving advanced stats to database...');
    await saveAdvancedStatsToDatabase(playerStats, season);
    
    console.log('🎉 Advanced stats scraping completed successfully!');
    return playerStats;
    
  } catch (error) {
    console.error('💥 Error scraping advanced stats:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Saves advanced stats to the database
 */
async function saveAdvancedStatsToDatabase(playerStats, season) {
  try {
    console.log(`💾 Saving ${playerStats.length} players to database...`);
    
    // Filter out duplicates before processing
    const uniqueStats = [];
    const seen = new Set();
    
    for (const player of playerStats) {
      const key = `${player.player_name}-${player.team}-${player.season}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueStats.push(player);
      }
    }
    
    console.log(`🔄 Filtered to ${uniqueStats.length} unique players (removed ${playerStats.length - uniqueStats.length} duplicates)`);
    
    // Use UPSERT (INSERT ... ON CONFLICT) instead of DELETE + INSERT
    // This handles duplicates gracefully and is more efficient
    console.log('🔄 Using UPSERT to handle duplicates gracefully...');
    
    // Insert/update stats in batches with conflict resolution
    const batchSize = 25; // Reduced batch size to avoid conflicts
    let insertedCount = 0;
    let updatedCount = 0;
    
    for (let i = 0; i < uniqueStats.length; i += batchSize) {
      const batch = uniqueStats.slice(i, i + batchSize);
      
      try {
        // Use UPSERT with conflict resolution on player_name, team, season
        const { data, error } = await supabase
          .from('player_advanced_stats')
          .upsert(batch, {
            onConflict: 'player_name,team,season',
            ignoreDuplicates: false
          })
          .select();
        
        if (error) {
          console.error(`Error upserting batch ${Math.floor(i/batchSize) + 1}:`, error);
          
          // Try individual inserts for failed batch
          console.log('🔄 Attempting individual inserts for failed batch...');
          for (const player of batch) {
            try {
              const { error: individualError } = await supabase
                .from('player_advanced_stats')
                .upsert([player], {
                  onConflict: 'player_name,team,season',
                  ignoreDuplicates: false
                });
              
              if (individualError) {
                console.error(`Failed to insert ${player.player_name}:`, individualError);
              } else {
                insertedCount++;
              }
            } catch (individualError) {
              console.error(`Individual insert failed for ${player.player_name}:`, individualError);
            }
          }
        } else {
          insertedCount += batch.length;
          console.log(`✅ Upserted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} players`);
        }
      } catch (batchError) {
        console.error(`Batch ${Math.floor(i/batchSize) + 1} failed completely:`, batchError);
        
        // Fallback to individual inserts for this batch
        for (const player of batch) {
          try {
            const { error: individualError } = await supabase
              .from('player_advanced_stats')
              .upsert([player], {
                onConflict: 'player_name,team,season',
                ignoreDuplicates: false
              });
            
            if (individualError) {
              console.error(`Failed to insert ${player.player_name}:`, individualError);
            } else {
              insertedCount++;
            }
          } catch (individualError) {
            console.error(`Individual insert failed for ${player.player_name}:`, individualError);
          }
        }
      }
    }
    
    console.log(`🎯 Total players processed: ${insertedCount}/${uniqueStats.length}`);
    
    // Verify the data was saved
    const { data: verifyData, error: verifyError } = await supabase
      .from('player_advanced_stats')
      .select('player_name, team, usage_percentage, avg_minutes')
      .eq('season', season)
      .limit(10);
    
    if (verifyError) {
      console.error('Error verifying saved data:', verifyError);
    } else {
      console.log('\n🔍 Verification - Sample saved data:');
      verifyData.forEach(player => {
        console.log(`${player.player_name} (${player.team}): ${player.usage_percentage}% usage, ${player.avg_minutes} avg min`);
      });
    }
    
  } catch (error) {
    console.error('💥 Error saving to database:', error);
    throw error;
  }
}

/**
 * Clean up unknown team entries by updating them with proper team names
 */
async function cleanupUnknownTeams() {
  try {
    console.log('🧹 Cleaning up unknown team entries...');
    
    // Get all players with UNK team
    const { data: unknownPlayers, error: fetchError } = await supabase
      .from('player_advanced_stats')
      .select('player_name, season')
      .eq('team', 'UNK')
      .eq('season', 2025);
    
    if (fetchError) {
      console.error('Error fetching unknown team players:', fetchError);
      return;
    }
    
    if (unknownPlayers.length === 0) {
      console.log('✅ No unknown team entries to clean up');
      return;
    }
    
    console.log(`🔍 Found ${unknownPlayers.length} players with unknown teams`);
    
    // Try to find team names from other tables
    let updatedCount = 0;
    for (const player of unknownPlayers) {
      try {
        // Look for team in player_stats table
        const { data: playerData, error: playerError } = await supabase
          .from('player_stats')
          .select('team')
          .eq('player_name', player.player_name)
          .eq('season', player.season)
          .not('team', 'is', null)
          .not('team', 'eq', '')
          .limit(1);
        
        if (playerData && playerData.length > 0 && playerData[0].team) {
          // Update the advanced stats with the found team
          const { error: updateError } = await supabase
            .from('player_advanced_stats')
            .update({ team: playerData[0].team })
            .eq('player_name', player.player_name)
            .eq('team', 'UNK')
            .eq('season', player.season);
          
          if (updateError) {
            console.error(`Failed to update ${player.player_name}:`, updateError);
          } else {
            updatedCount++;
            console.log(`✅ Updated ${player.player_name} team to ${playerData[0].team}`);
          }
        }
      } catch (error) {
        console.error(`Error processing ${player.player_name}:`, error);
      }
    }
    
    console.log(`🎯 Updated ${updatedCount}/${unknownPlayers.length} unknown team entries`);
    
  } catch (error) {
    console.error('Error cleaning up unknown teams:', error);
  }
}

/**
 * Main function to run the scraper
 */
async function main() {
  try {
    console.log('🚀 Starting WNBA Advanced Stats Scraper...\n');
    
    const season = process.argv[2] || '2025';
    console.log(`📅 Scraping season: ${season}`);
    
    const stats = await scrapeAdvancedStats(season);
    
    console.log(`\n🎉 Scraping completed successfully!`);
    console.log(`📊 Total players processed: ${stats.length}`);
    console.log(`💾 Data saved to player_advanced_stats table`);
    
    // Clean up unknown team entries
    await cleanupUnknownTeams();
    
    // Log some high-usage players for verification
    const highUsagePlayers = stats
      .filter(p => p.usage_percentage > 25)
      .sort((a, b) => b.usage_percentage - a.usage_percentage)
      .slice(0, 10);
    
    if (highUsagePlayers.length > 0) {
      console.log('\n🔥 Top 10 High Usage Players (>25%):');
      highUsagePlayers.forEach((player, index) => {
        console.log(`${index + 1}. ${player.player_name} (${player.team}): ${player.usage_percentage}% usage`);
      });
    }
    
  } catch (error) {
    console.error('💥 Scraper failed:', error);
    process.exit(1);
  }
}

// Run the scraper if called directly
if (require.main === module) {
  main();
}

module.exports = { scrapeAdvancedStats, saveAdvancedStatsToDatabase };
