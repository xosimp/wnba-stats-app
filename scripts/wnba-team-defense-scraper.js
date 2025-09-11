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
 * Scrapes WNBA team defensive stats from the official stats site
 * Source: https://stats.wnba.com/teams/opponent/?sort=W&dir=-1
 * Returns: Array of team defensive stats objects
 */
async function scrapeTeamDefensiveStats(season = '2025') {
  console.log(`🏀 Scraping WNBA team defensive stats for ${season} season...`);
  
  let browser;
  
  try {
    // Launch browser in stealth mode
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
        '--disable-javascript',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-ipc-flooding-protection',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set stealth mode
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
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the WNBA opponent stats page
    console.log('🌐 Navigating to WNBA stats site...');
    await page.goto('https://stats.wnba.com/teams/opponent/?sort=W&dir=-1', {
      waitUntil: 'domcontentloaded',
      timeout: 120000 // 2 minutes timeout
    });
    
    // Wait for the page to fully load
    console.log('⏳ Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Wait for the stats table to load
    console.log('🔍 Looking for stats table...');
    await page.waitForSelector('table', { timeout: 60000 });
    
    // Extract all team defensive stats from the table
    console.log('📊 Extracting team defensive stats...');
    const teamStats = await page.evaluate(() => {
      const stats = [];
      
      // Find all tables on the page
      const tables = document.querySelectorAll('table');
      let targetTable = null;
      
      // Look for the table with team stats (usually the one with team names and defensive stats)
      for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr');
        if (rows.length > 0) {
          const firstRow = rows[0];
          const teamCell = firstRow.querySelector('td[data-stat="team"]') || 
                          firstRow.querySelector('td:first-child');
          if (teamCell && teamCell.textContent && teamCell.textContent.trim()) {
            targetTable = table;
            break;
          }
        }
      }
      
      if (!targetTable) {
        console.error('Could not find team stats table');
        return stats;
      }
      
      // Get all column headers
      const headerRow = targetTable.querySelector('thead tr');
      const headers = [];
      if (headerRow) {
        const headerCells = headerRow.querySelectorAll('th');
        headerCells.forEach((cell, index) => {
          const headerText = cell.textContent.trim();
          if (headerText) {
            headers.push(headerText);
          }
        });
      }
      
      const rows = targetTable.querySelectorAll('tbody tr');
      
      rows.forEach((row, rowIndex) => {
        try {
          const cells = row.querySelectorAll('td');
          if (cells.length > 0) {
            // The team name is in the second column (index 1)
            const teamCell = cells[1];
            const teamName = teamCell ? teamCell.textContent.trim() : '';
            
            if (teamName && teamName !== 'TEAM' && !teamName.match(/^\d+$/)) {
              const teamData = {
                team: teamName,
                rowIndex: rowIndex
              };
              
              // Map columns based on their actual positions in the WNBA stats table
              // This fixes the column mixing issue - using the correct positions from debug
              if (cells[0]) teamData['TEAM'] = parseInt(cells[0].textContent.trim()) || 0; // Ranking
              if (cells[2]) teamData['GP'] = parseInt(cells[2].textContent.trim()) || 0; // Games Played
              if (cells[3]) teamData['W'] = parseInt(cells[3].textContent.trim()) || 0; // Wins
              if (cells[4]) teamData['L'] = parseInt(cells[4].textContent.trim()) || 0; // Losses
              if (cells[5]) teamData['MIN'] = parseInt(cells[5].textContent.trim()) || 0; // Minutes
              if (cells[6]) teamData['OppFGM'] = parseFloat(cells[6].textContent.trim()) || 0; // Opponent Field Goals Made
              if (cells[7]) teamData['OppFGA'] = parseFloat(cells[7].textContent.trim()) || 0; // Opponent Field Goals Attempted
              if (cells[8]) teamData['OppFG%'] = parseFloat(cells[8].textContent.trim()) || 0; // Opponent Field Goal Percentage
              if (cells[9]) teamData['Opp3PM'] = parseFloat(cells[9].textContent.trim()) || 0; // Opponent 3-Pointers Made
              if (cells[10]) teamData['Opp3PA'] = parseFloat(cells[10].textContent.trim()) || 0; // Opponent 3-Pointers Attempted
              if (cells[11]) teamData['Opp3P%'] = parseFloat(cells[11].textContent.trim()) || 0; // Opponent 3-Point Percentage
              if (cells[12]) teamData['OppFTM'] = parseFloat(cells[12].textContent.trim()) || 0; // Opponent Free Throws Made
              if (cells[13]) teamData['OppFTA'] = parseFloat(cells[13].textContent.trim()) || 0; // Opponent Free Throws Attempted
              if (cells[14]) teamData['OppFT%'] = parseFloat(cells[14].textContent.trim()) || 0; // Opponent Free Throw Percentage
              if (cells[15]) teamData['OppOREB'] = parseFloat(cells[15].textContent.trim()) || 0; // Opponent Offensive Rebounds
              if (cells[16]) teamData['OppDREB'] = parseFloat(cells[16].textContent.trim()) || 0; // Opponent Defensive Rebounds
              if (cells[17]) teamData['OppREB'] = parseFloat(cells[17].textContent.trim()) || 0; // Opponent Total Rebounds
              if (cells[18]) teamData['OppAST'] = parseFloat(cells[18].textContent.trim()) || 0; // Opponent Assists
              if (cells[19]) teamData['OppTOV'] = parseFloat(cells[19].textContent.trim()) || 0; // Opponent Turnovers
              if (cells[20]) teamData['OppSTL'] = parseFloat(cells[20].textContent.trim()) || 0; // Opponent Steals
              if (cells[21]) teamData['OppBLK'] = parseFloat(cells[21].textContent.trim()) || 0; // Opponent Blocks
              if (cells[22]) teamData['OppBLKA'] = parseFloat(cells[22].textContent.trim()) || 0; // Opponent Blocked Against
              if (cells[23]) teamData['OppPF'] = parseFloat(cells[23].textContent.trim()) || 0; // Opponent Personal Fouls
              if (cells[24]) teamData['OppPFD'] = parseFloat(cells[24].textContent.trim()) || 0; // Opponent Personal Fouls Drawn
              if (cells[25]) teamData['OppPTS'] = parseFloat(cells[25].textContent.trim()) || 0; // Opponent Points (this is the +/- column with actual opponent points allowed)
              if (cells[26]) teamData['+/-'] = parseFloat(cells[26].textContent.trim()) || 0; // Plus/Minus (this is the GP RANK)
              if (cells[27]) teamData['GP RANK'] = parseFloat(cells[27].textContent.trim()) || 0; // Games Played Rank
              
              // Store the raw cell data for debugging
              teamData.rawCells = Array.from(cells).map(cell => cell.textContent.trim());
              teamData.headers = headers;
              
              stats.push(teamData);
              console.log(`Scraped: ${teamName} - All columns properly mapped`);
            }
          }
        } catch (error) {
          console.warn(`Error parsing row ${rowIndex}:`, error);
        }
      });
      
      return stats;
    });
    
    if (teamStats.length === 0) {
      console.warn('⚠️ No team stats found, falling back to hardcoded values');
      return getFallbackStats();
    }
    
    console.log(`✅ Successfully scraped ${teamStats.length} team defensive stats`);
    
    // Process and map team names to our database format
    const processedStats = teamStats.map(stat => {
      let mappedTeamName = stat.team;
      
      // Map team names to match our database format
      if (stat.team.includes('New York')) mappedTeamName = 'New York Liberty';
      else if (stat.team.includes('Connecticut')) mappedTeamName = 'Connecticut Sun';
      else if (stat.team.includes('Las Vegas')) mappedTeamName = 'Las Vegas Aces';
      else if (stat.team.includes('Washington')) mappedTeamName = 'Washington Mystics';
      else if (stat.team.includes('Minnesota')) mappedTeamName = 'Minnesota Lynx';
      else if (stat.team.includes('Seattle')) mappedTeamName = 'Seattle Storm';
      else if (stat.team.includes('Indiana')) mappedTeamName = 'Indiana Fever';
      else if (stat.team.includes('Phoenix')) mappedTeamName = 'Phoenix Mercury';
      else if (stat.team.includes('Dallas')) mappedTeamName = 'Dallas Wings';
      else if (stat.team.includes('Chicago')) mappedTeamName = 'Chicago Sky';
      else if (stat.team.includes('Atlanta')) mappedTeamName = 'Atlanta Dream';
      else if (stat.team.includes('Los Angeles')) mappedTeamName = 'Los Angeles Sparks';
      else if (stat.team.includes('Golden State')) mappedTeamName = 'Golden State Valkyries';
      
      return {
        ...stat,
        team: mappedTeamName
      };
    });
    
    // Log each team's defensive rating
    for (const stat of processedStats) {
      const oppPts = stat['OPP PTS'] || stat['OPP PTS.1'] || stat['OPP PTS.2'];
      if (oppPts) {
        const defenseRating = oppPts <= 81.5 ? '🟢 Strong' : 
                             oppPts <= 83.5 ? '🟡 Average' : 
                             oppPts <= 85.0 ? '🟠 Below Average' : '🔴 Weak';
        console.log(`  ${defenseRating} ${stat.team}: ${oppPts} OPP PTS`);
      }
    }
    
    return processedStats;
    
  } catch (error) {
    console.error('❌ Error during scraping:', error);
    
    // Fallback to hardcoded values
    console.warn('⚠️ Falling back to hardcoded team defensive stats');
    return getFallbackStats();
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Store team defensive stats in the database
 */
async function storeTeamDefensiveStats(stats, season = '2025') {
  try {
    console.log(`💾 Storing ${stats.length} team defensive stats in database...`);
    
    // First, clear existing stats for this season
    const { error: deleteError } = await supabase
      .from('team_defensive_stats')
      .delete()
      .eq('season', season);
    
    if (deleteError) {
      console.error('❌ Error clearing existing stats:', deleteError);
    } else {
      console.log('✅ Cleared existing stats for season', season);
    }
    
    // Prepare data for insertion
    const insertData = stats.map(stat => {
      // The OppPTS column (cells[25]) contains the actual opponent points allowed values (this is what we need for projections)
      const oppPts = stat['OppPTS'] || 0;
      
      // Create a comprehensive record with all the data
      const record = {
        team: stat.team,
        season: season,
        stat_type: 'points',
        overall_avg_allowed: oppPts,
        home_avg_allowed: oppPts, // We'll update these separately if available
        away_avg_allowed: oppPts, // We'll update these separately if available
        
        // Store all the additional stats we scraped with correct mapping
        games_played: parseInt(stat['GP']) || 0, // Games Played from cells[2]
        wins: parseInt(stat['W']) || 0, // Wins from cells[3]
        losses: parseInt(stat['L']) || 0, // Losses from cells[4]
        minutes: parseInt(stat['MIN']) || 0, // Minutes from cells[5]
        opp_fgm: parseFloat(stat['OppFGM']) || 0,
        opp_fga: parseFloat(stat['OppFGA']) || 0,
        opp_fg_pct: parseFloat(stat['OppFG%']) || 0,
        opp_3pm: parseFloat(stat['Opp3PM']) || 0,
        opp_3pa: parseFloat(stat['Opp3PA']) || 0,
        opp_3p_pct: parseFloat(stat['Opp3P%']) || 0,
        opp_ftm: parseFloat(stat['OppFTM']) || 0,
        opp_fta: parseFloat(stat['OppFTA']) || 0,
        opp_ft_pct: parseFloat(stat['OppFT%']) || 0,
        opp_oreb: parseFloat(stat['OppOREB']) || 0,
        opp_dreb: parseFloat(stat['OppDREB']) || 0,
        opp_reb: parseFloat(stat['OppREB']) || 0,
        opp_ast: parseFloat(stat['OppAST']) || 0,
        opp_tov: parseFloat(stat['OppTOV']) || 0,
        opp_stl: parseFloat(stat['OppSTL']) || 0,
        opp_blk: parseFloat(stat['OppBLK']) || 0,
        opp_blka: parseFloat(stat['OppBLKA']) || 0,
        opp_pf: parseFloat(stat['OppPF']) || 0,
        opp_pfd: parseFloat(stat['OppPFD']) || 0,
        opp_pts: oppPts, // This is the OppPTS column value (actual opponent points allowed)
        plus_minus: parseFloat(stat['+/-']) || 0, // This is the GP RANK
        gp_rank: parseInt(stat['GP RANK']) || 0 // Games Played Rank
      };
      
      return record;
    });
    
    // Insert new stats
    const { data, error } = await supabase
      .from('team_defensive_stats')
      .insert(insertData);
    
    if (error) {
      console.error('❌ Error inserting team defensive stats:', error);
      return false;
    }
    
    console.log(`✅ Successfully stored ${insertData.length} team defensive stats in database`);
    return true;
    
  } catch (error) {
    console.error('❌ Error storing team defensive stats:', error);
    return false;
  }
}

/**
 * Main function to scrape and store team defensive stats
 */
async function main() {
  try {
    console.log('🚀 Starting WNBA Team Defense Stats Scraper...\n');
    
    // Scrape the stats
    const stats = await scrapeTeamDefensiveStats('2025');
    
    if (stats && stats.length > 0) {
      // Store in database
      const success = await storeTeamDefensiveStats(stats, '2025');
      
      if (success) {
        console.log('\n🎉 SUCCESS: Team defensive stats scraped and stored!');
        console.log(`📊 Total teams processed: ${stats.length}`);
        
        // Show summary
        console.log('\n📋 Summary of scraped data:');
        stats.forEach((stat, index) => {
          const oppPts = stat['OppPTS'] || 0;
          if (oppPts) {
            const defenseRating = oppPts <= 78.0 ? '🟢 Elite' : 
                                 oppPts <= 81.5 ? '🟡 Strong' : 
                                 oppPts <= 84.5 ? '🟠 Average' : '🔴 Weak';
            console.log(`  ${index + 1}. ${defenseRating} ${stat.team}: ${oppPts} OPP PTS`);
          }
        });
      } else {
        console.log('\n❌ FAILED: Could not store stats in database');
      }
    } else {
      console.log('\n❌ FAILED: No stats scraped');
    }
    
  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error);
  }
}

// Export for use in other modules
module.exports = {
  scrapeTeamDefensiveStats,
  storeTeamDefensiveStats,
  main
};

// Run main function if called directly
if (require.main === module) {
  main();
}