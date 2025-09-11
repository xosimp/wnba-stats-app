const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function scrape2024AdvancedStats() {
  console.log('🚀 Starting 2024 Advanced Stats Scraper...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor',
      '--disable-web-security',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-client-side-phishing-detection',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-report-upload',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-domain-reliability',
      '--disable-component-extensions-with-background-pages',
      '--disable-background-networking',
      '--disable-breakpad',
      '--disable-component-update',
      '--disable-dev-shm-usage',
      '--disable-features=TranslateUI,BlinkGenPropertyTrees',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-logging',
      '--disable-login-animations',
      '--disable-notifications',
      '--disable-permissions-api',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--disable-web-resources',
      '--enable-features=NetworkService,NetworkServiceLogging',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-crash-upload',
      '--no-default-browser-check',
      '--no-first-run',
      '--no-pings',
      '--no-zygote',
      '--use-mock-keychain',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Advanced stealth configuration
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Override the `plugins` property to use a custom getter
      Object.defineProperty(navigator, 'plugins', {
        get: function() {
          return [1, 2, 3, 4, 5];
        },
      });
      
      // Override the `languages` property to use a custom getter
      Object.defineProperty(navigator, 'languages', {
        get: function() {
          return ['en-US', 'en'];
        },
      });
    });
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });
    
    console.log('📊 Navigating to 2024 Advanced Stats page...');
    
    // Add random delay before navigation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    await page.goto('https://www.basketball-reference.com/wnba/years/2024_advanced.html', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Wait for the table to load with data
    await page.waitForSelector('#advanced tbody tr.full_table', { timeout: 30000 });
    
    // Add random delay after page load
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    console.log('🔍 Extracting advanced stats data...');
    const stats = await page.evaluate(() => {
      // Use the exact selectors from the screenshot
      const rows = document.querySelectorAll('#advanced tbody tr.full_table');
      console.log('Full table rows found:', rows.length);
      
      const data = [];
      
      rows.forEach(row => {
        try {
          // Get player name from the first cell (th with link) - exactly as shown in screenshot
          const playerNameCell = row.querySelector('th[data-stat="player"] a');
          const playerName = playerNameCell?.textContent?.trim();
          
          // Get team from second cell
          const teamCell = row.querySelector('td[data-stat="team"]');
          const team = teamCell?.textContent?.trim();
          
          // Get position from third cell
          const positionCell = row.querySelector('td[data-stat="pos"]');
          const position = positionCell?.textContent?.trim();
          
          if (!playerName || !team) return;
          
          // Parse numeric values, handling empty strings and special characters
          const parseFloat = (str) => {
            if (!str || str === '' || str === '-') return null;
            const cleaned = str.replace(/[^\d.-]/g, '');
            return cleaned ? parseFloat(cleaned) : null;
          };
          
          const stat = {
            player_name: playerName,
            team: team,
            position: position,
            games_played: parseInt(row.querySelector('td[data-stat="g"]')?.textContent?.trim()) || null,
            minutes_played: parseInt(row.querySelector('td[data-stat="mp"]')?.textContent?.trim()) || null,
            per: parseFloat(row.querySelector('td[data-stat="per"]')?.textContent?.trim()),
            true_shooting_pct: parseFloat(row.querySelector('td[data-stat="ts_pct"]')?.textContent?.trim()),
            effective_fg_pct: parseFloat(row.querySelector('td[data-stat="efg_pct"]')?.textContent?.trim()),
            three_point_attempt_rate: parseFloat(row.querySelector('td[data-stat="fg3a_per_fga_pct"]')?.textContent?.trim()),
            free_throw_rate: parseFloat(row.querySelector('td[data-stat="fta_per_fga_pct"]')?.textContent?.trim()),
            offensive_rebound_pct: parseFloat(row.querySelector('td[data-stat="orb_pct"]')?.textContent?.trim()),
            total_rebound_pct: parseFloat(row.querySelector('td[data-stat="trb_pct"]')?.textContent?.trim()),
            assist_pct: parseFloat(row.querySelector('td[data-stat="ast_pct"]')?.textContent?.trim()),
            steal_pct: parseFloat(row.querySelector('td[data-stat="stl_pct"]')?.textContent?.trim()),
            block_pct: parseFloat(row.querySelector('td[data-stat="blk_pct"]')?.textContent?.trim()),
            turnover_pct: parseFloat(row.querySelector('td[data-stat="tov_pct"]')?.textContent?.trim()),
            usage_pct: parseFloat(row.querySelector('td[data-stat="usg_pct"]')?.textContent?.trim()),
            offensive_rating: parseFloat(row.querySelector('td[data-stat="off_rtg"]')?.textContent?.trim()),
            defensive_rating: parseFloat(row.querySelector('td[data-stat="def_rtg"]')?.textContent?.trim()),
            offensive_win_shares: parseFloat(row.querySelector('td[data-stat="ows"]')?.textContent?.trim()),
            defensive_win_shares: parseFloat(row.querySelector('td[data-stat="dws"]')?.textContent?.trim()),
            win_shares: parseFloat(row.querySelector('td[data-stat="ws"]')?.textContent?.trim()),
            win_shares_per_40: parseFloat(row.querySelector('td[data-stat="ws_per_40"]')?.textContent?.trim())
          };
          
          data.push(stat);
        } catch (error) {
          console.log('Error parsing row:', error);
        }
      });
      
      return data;
    });
    
    console.log(`📊 Scraped ${stats.length} players' advanced stats`);
    
    // Show sample data
    console.log('\\n🔍 Sample data:');
    stats.slice(0, 3).forEach(player => {
      console.log(`${player.player_name} (${player.team}): ${player.usage_pct}% usage, ${player.per} PER`);
    });
    
    // Insert data into database
    console.log('\\n💾 Inserting data into database...');
    
    // Clear existing data
    const { error: deleteError } = await supabase
      .from('player_advanced_stats_2024')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (deleteError) {
      console.log('⚠️  Error clearing existing data:', deleteError);
    } else {
      console.log('✅ Cleared existing 2024 advanced stats data');
    }
    
    // Insert new data in batches
    const batchSize = 50;
    let inserted = 0;
    
    for (let i = 0; i < stats.length; i += batchSize) {
      const batch = stats.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('player_advanced_stats_2024')
        .insert(batch);
      
      if (insertError) {
        console.log(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError);
      } else {
        inserted += batch.length;
        console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} players (${inserted}/${stats.length} total)`);
      }
    }
    
    console.log(`\\n🎉 Successfully scraped and inserted ${inserted} players' 2024 advanced stats!`);
    
    // Show usage rate summary
    const usageStats = stats.filter(s => s.usage_pct !== null);
    const avgUsage = usageStats.reduce((sum, s) => sum + s.usage_pct, 0) / usageStats.length;
    const maxUsage = Math.max(...usageStats.map(s => s.usage_pct));
    const minUsage = Math.min(...usageStats.map(s => s.usage_pct));
    
    console.log(`\\n📈 Usage Rate Summary:`);
    console.log(`   Average: ${avgUsage.toFixed(1)}%`);
    console.log(`   Range: ${minUsage.toFixed(1)}% - ${maxUsage.toFixed(1)}%`);
    console.log(`   Players with usage data: ${usageStats.length}`);
    
  } catch (error) {
    console.error('❌ Scraping failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrape2024AdvancedStats().catch(console.error);
