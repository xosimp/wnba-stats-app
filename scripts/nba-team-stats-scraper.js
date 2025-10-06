const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function scrapeNBATeamStats() {
  let browser;
  
  try {
    console.log('🏀 Starting NBA Team Stats Scraper for 2025 season...');
    console.log('📊 Source: Basketball Reference NBA Team Statistics');
    
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
    
    const url = `https://www.basketball-reference.com/leagues/NBA_2025.html`;
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
      let table = document.querySelector('#per_game-team');
      if (!table) {
        table = document.querySelector('#all_team-stats-per_game');
      }
      if (!table) {
        table = document.querySelector('#team-stats-per_game');
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
      throw new Error('❌ NBA team stats table not found');
    }
    
    console.log('🔍 Looking for NBA team stats table...');
    
    // Find the table
    const tableSelector = await page.evaluate(() => {
      const selectors = [
        '#per_game-team',
        '#all_team-stats-per_game',
        '#team-stats-per_game',
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
      throw new Error('❌ Could not find NBA team stats table');
    }
    
    console.log('📊 Extracting NBA team stats...');
    
    if (tableExists) {
      // Wait a bit more for rows to populate
      console.log('⏳ Waiting for table rows to populate...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const rowCount = await page.evaluate(() => {
        let table = document.querySelector('#per_game-team');
        if (!table) {
          table = document.querySelector('#all_team-stats-per_game');
        }
        if (!table) {
          table = document.querySelector('#team-stats-per_game');
        }
        if (!table) {
          table = document.querySelector('table[class*="stats"]');
        }
        if (!table) {
          table = document.querySelector('table[class*="sortable"]');
        }
        return table ? table.querySelectorAll('tbody tr').length : 0;
      });
      console.log(`Table has ${rowCount} team rows`);
    }
    
    const teamStats = await page.evaluate(() => {
      const stats = [];
      
      // Find the table
      let table = document.querySelector('#per_game-team');
      if (!table) {
        table = document.querySelector('#all_team-stats-per_game');
      }
      if (!table) {
        table = document.querySelector('#team-stats-per_game');
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
          
          // Skip rows that don't have team data
          let teamCell = row.querySelector('th[data-stat="team"]');
          if (!teamCell) {
            teamCell = row.querySelector('td[data-stat="team"]');
          }
          if (!teamCell) {
            teamCell = row.querySelector('th[data-stat="team_name"]');
          }
          if (!teamCell) {
            teamCell = row.querySelector('td[data-stat="team_name"]');
          }
          
          console.log(`Team cell found: ${!!teamCell}, content: "${teamCell ? teamCell.textContent.trim() : 'NONE'}"`);
          
          if (!teamCell || !teamCell.textContent.trim()) {
            console.log('Skipping row - no team data');
            continue;
          }
          
          const anchor = teamCell.querySelector('a');
          const teamName = (anchor ? anchor.textContent : teamCell.textContent).trim();
          
          // Skip non-team rows (League Average, etc.)
          if (teamName.toLowerCase().includes('league average') || 
              teamName.toLowerCase().includes('team') ||
              teamName.toLowerCase().includes('total')) {
            console.log('Skipping non-team row:', teamName);
            continue;
          }
          
          // Get team abbreviation from href or extract from team name
          let teamAbbreviation = '';
          if (anchor) {
            const href = anchor.getAttribute('href');
            if (href && href.includes('/teams/')) {
              const teamMatch = href.match(/\/teams\/([A-Z]{3})\//);
              if (teamMatch) {
                teamAbbreviation = teamMatch[1];
              }
            }
          }
          
          // Fallback: extract abbreviation from team name
          if (!teamAbbreviation) {
            const teamAbbrevMap = {
              'Atlanta Hawks': 'ATL',
              'Boston Celtics': 'BOS',
              'Brooklyn Nets': 'BKN',
              'Charlotte Hornets': 'CHA',
              'Chicago Bulls': 'CHI',
              'Cleveland Cavaliers': 'CLE',
              'Dallas Mavericks': 'DAL',
              'Denver Nuggets': 'DEN',
              'Detroit Pistons': 'DET',
              'Golden State Warriors': 'GSW',
              'Houston Rockets': 'HOU',
              'Indiana Pacers': 'IND',
              'Los Angeles Clippers': 'LAC',
              'Los Angeles Lakers': 'LAL',
              'Memphis Grizzlies': 'MEM',
              'Miami Heat': 'MIA',
              'Milwaukee Bucks': 'MIL',
              'Minnesota Timberwolves': 'MIN',
              'New Orleans Pelicans': 'NOP',
              'New York Knicks': 'NYK',
              'Oklahoma City Thunder': 'OKC',
              'Orlando Magic': 'ORL',
              'Philadelphia 76ers': 'PHI',
              'Phoenix Suns': 'PHO',
              'Portland Trail Blazers': 'POR',
              'Sacramento Kings': 'SAC',
              'San Antonio Spurs': 'SAS',
              'Toronto Raptors': 'TOR',
              'Utah Jazz': 'UTA',
              'Washington Wizards': 'WAS'
            };
            teamAbbreviation = teamAbbrevMap[teamName] || 'UNK';
          }
          
          // Get games
          const gamesCell = row.querySelector('td[data-stat="g"]');
          const games = gamesCell ? parseInt(gamesCell.textContent.trim()) || 0 : 0;
          
          const minutesCell = row.querySelector('td[data-stat="mp"]');
          const minutesPlayed = minutesCell ? parseFloat(minutesCell.textContent.trim()) || 0 : 0;
          
          // Field Goals
          const fgCell = row.querySelector('td[data-stat="fg"]');
          const fieldGoals = fgCell ? parseFloat(fgCell.textContent.trim()) || 0 : 0;
          
          const fgaCell = row.querySelector('td[data-stat="fga"]');
          const fieldGoalAttempts = fgaCell ? parseFloat(fgaCell.textContent.trim()) || 0 : 0;
          
          const fgPctCell = row.querySelector('td[data-stat="fg_pct"]');
          const fieldGoalPercentage = fgPctCell ? Math.min(parseFloat(fgPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          // 3-Point Shooting
          const fg3Cell = row.querySelector('td[data-stat="fg3"]');
          const threePointers = fg3Cell ? parseFloat(fg3Cell.textContent.trim()) || 0 : 0;
          
          const fg3aCell = row.querySelector('td[data-stat="fg3a"]');
          const threePointAttempts = fg3aCell ? parseFloat(fg3aCell.textContent.trim()) || 0 : 0;
          
          const fg3PctCell = row.querySelector('td[data-stat="fg3_pct"]');
          const threePointPercentage = fg3PctCell ? Math.min(parseFloat(fg3PctCell.textContent.trim()) || 0, 1.0) : 0;
          
          // 2-Point Shooting
          const fg2Cell = row.querySelector('td[data-stat="fg2"]');
          const twoPointers = fg2Cell ? parseFloat(fg2Cell.textContent.trim()) || 0 : 0;
          
          const fg2aCell = row.querySelector('td[data-stat="fg2a"]');
          const twoPointAttempts = fg2aCell ? parseFloat(fg2aCell.textContent.trim()) || 0 : 0;
          
          const fg2PctCell = row.querySelector('td[data-stat="fg2_pct"]');
          const twoPointPercentage = fg2PctCell ? Math.min(parseFloat(fg2PctCell.textContent.trim()) || 0, 1.0) : 0;
          
          // Free Throws
          const ftCell = row.querySelector('td[data-stat="ft"]');
          const freeThrows = ftCell ? parseFloat(ftCell.textContent.trim()) || 0 : 0;
          
          const ftaCell = row.querySelector('td[data-stat="fta"]');
          const freeThrowAttempts = ftaCell ? parseFloat(ftaCell.textContent.trim()) || 0 : 0;
          
          const ftPctCell = row.querySelector('td[data-stat="ft_pct"]');
          const freeThrowPercentage = ftPctCell ? Math.min(parseFloat(ftPctCell.textContent.trim()) || 0, 1.0) : 0;
          
          // Rebounds
          const orbCell = row.querySelector('td[data-stat="orb"]');
          const offensiveRebounds = orbCell ? parseFloat(orbCell.textContent.trim()) || 0 : 0;
          
          const drbCell = row.querySelector('td[data-stat="drb"]');
          const defensiveRebounds = drbCell ? parseFloat(drbCell.textContent.trim()) || 0 : 0;
          
          const trbCell = row.querySelector('td[data-stat="trb"]');
          const totalRebounds = trbCell ? parseFloat(trbCell.textContent.trim()) || 0 : 0;
          
          // Other Stats
          const astCell = row.querySelector('td[data-stat="ast"]');
          const assists = astCell ? parseFloat(astCell.textContent.trim()) || 0 : 0;
          
          const stlCell = row.querySelector('td[data-stat="stl"]');
          const steals = stlCell ? parseFloat(stlCell.textContent.trim()) || 0 : 0;
          
          const blkCell = row.querySelector('td[data-stat="blk"]');
          const blocks = blkCell ? parseFloat(blkCell.textContent.trim()) || 0 : 0;
          
          const tovCell = row.querySelector('td[data-stat="tov"]');
          const turnovers = tovCell ? parseFloat(tovCell.textContent.trim()) || 0 : 0;
          
          const pfCell = row.querySelector('td[data-stat="pf"]');
          const personalFouls = pfCell ? parseFloat(pfCell.textContent.trim()) || 0 : 0;
          
          // Points
          const ptsCell = row.querySelector('td[data-stat="pts"]');
          const points = ptsCell ? parseFloat(ptsCell.textContent.trim()) || 0 : 0;
          
          const teamStat = {
            team_name: teamName,
            team_abbreviation: teamAbbreviation,
            season: '2024-25',
            games: games,
            minutes_played: minutesPlayed,
            field_goals: fieldGoals,
            field_goal_attempts: fieldGoalAttempts,
            field_goal_percentage: fieldGoalPercentage,
            three_pointers: threePointers,
            three_point_attempts: threePointAttempts,
            three_point_percentage: threePointPercentage,
            two_pointers: twoPointers,
            two_point_attempts: twoPointAttempts,
            two_point_percentage: twoPointPercentage,
            free_throws: freeThrows,
            free_throw_attempts: freeThrowAttempts,
            free_throw_percentage: freeThrowPercentage,
            offensive_rebounds: offensiveRebounds,
            defensive_rebounds: defensiveRebounds,
            total_rebounds: totalRebounds,
            assists: assists,
            steals: steals,
            blocks: blocks,
            turnovers: turnovers,
            personal_fouls: personalFouls,
            points: points,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          stats.push(teamStat);
          console.log(`✅ Extracted stats for: ${teamName} (${teamAbbreviation})`);
          
        } catch (error) {
          console.error(`❌ Error processing row:`, error);
          continue;
        }
      }
      
      return stats;
    });
    
    console.log(`✅ Successfully extracted ${teamStats.length} NBA team stats`);
    
    if (teamStats.length === 0) {
      console.log('⚠️  No NBA team stats found to save');
      return;
    }
    
    // Save to database
    if (teamStats.length > 0) {
      console.log('💾 Saving NBA team stats to database...');
      console.log(`📊 Sample data structure:`, JSON.stringify(teamStats[0], null, 2));
      
      const { data, error } = await supabase
        .from('nba_team_stats')
        .insert(teamStats);
      
      if (error) {
        console.error('❌ Database error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log(`✅ Successfully saved ${teamStats.length} NBA team stats to database`);
      
      // Show sample of saved data
      console.log('\n📊 Sample NBA team stats:');
      teamStats.slice(0, 3).forEach(team => {
        console.log(`   ${team.team_name} (${team.team_abbreviation}): ${team.points} PPG, ${team.total_rebounds} RPG, ${team.assists} APG`);
      });
    }
    
  } catch (error) {
    console.error('💥 NBA team stats scraping failed:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// Run the scraper
scrapeNBATeamStats()
  .then(() => {
    console.log('🎉 NBA team stats scraping completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 NBA team stats scraping failed:', error);
    process.exit(1);
  });
