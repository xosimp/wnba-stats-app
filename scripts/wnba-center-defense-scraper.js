const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

puppeteer.use(StealthPlugin());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function scrapeCenterDefensiveStats(season = '2025') {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  try {
    console.log('🏀 Starting WNBA Center Defense Stats Scraper...');
    console.log(`📊 Scraping center defensive stats for ${season} season...`);
    
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to the center defensive stats page
    const url = `https://stats.wnba.com/teams/opponent/?sort=W&dir=-1&Season=${season}&SeasonType=Regular%20Season&PlayerPosition=C`;
    console.log(`🌐 Navigating to: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for the table to load
    console.log('⏳ Waiting for table to load...');
    await page.waitForSelector('table', { timeout: 30000 });
    
    // Wait a bit more for data to populate
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract the center defensive stats
    const stats = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) {
        console.log('No table found');
        return [];
      }
      
      const rows = table.querySelectorAll('tbody tr');
      const stats = [];
      
      console.log(`Found ${rows.length} rows in center defense table`);
      
      rows.forEach((row, rowIndex) => {
        try {
          const cells = row.querySelectorAll('td');
          if (cells.length > 0) {
            const teamCell = cells[1]; // Second column contains team name
            const teamName = teamCell ? teamCell.textContent.trim() : '';
            
            if (teamName && teamName !== 'TEAM' && !teamName.match(/^\d+$/)) {
              const teamData = {
                team: teamName,
                rowIndex: rowIndex
              };
              
              // Map columns based on their actual positions in the WNBA stats table
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
              if (cells[26]) teamData['+/-'] = parseFloat(cells[26].textContent.trim()) || 0; // Plus/Minus (this is the GP RANK column)
              if (cells[27]) teamData['GP RANK'] = parseFloat(cells[27].textContent.trim()) || 0; // Games Played Rank (this is the W RANK)
              
              stats.push(teamData);
              console.log(`Scraped center defense: ${teamName} - All columns properly mapped`);
            }
          }
        } catch (error) {
          console.warn(`Error parsing row ${rowIndex}:`, error);
        }
      });
      
      return stats;
    });
    
    console.log(`✅ Successfully scraped center defensive stats for ${stats.length} teams`);
    
    // Store the center defensive stats in the database
    await storeCenterDefensiveStats(stats, season);
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error scraping center defensive stats:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function storeCenterDefensiveStats(stats, season) {
  try {
    console.log(`💾 Storing center defensive stats in database for ${season} season...`);
    
    // First, clear existing center defensive stats for this season
    const { error: deleteError } = await supabase
      .from('team_defensive_stats')
      .delete()
      .eq('season', season)
      .eq('stat_type', 'center_defense');
    
    if (deleteError) {
      console.error('Error clearing existing center defensive stats:', deleteError);
    } else {
      console.log('✅ Cleared existing center defensive stats');
    }
    
    // Prepare data for insertion
    const insertData = stats.map(stat => {
      // The OppPTS column (cells[25]) contains the actual opponent points allowed to centers
      const oppPts = stat['OppPTS'] || 0;
      
      const record = {
        team: stat.team,
        season: season,
        stat_type: 'center_defense', // New stat type for center-specific defense
        overall_avg_allowed: oppPts,
        home_avg_allowed: oppPts, // Using same value for now, can be enhanced later
        away_avg_allowed: oppPts, // Using same value for now, can be enhanced later
        
        games_played: parseInt(stat['GP']) || 0,
        wins: parseInt(stat['W']) || 0,
        losses: parseInt(stat['L']) || 0,
        minutes: parseInt(stat['MIN']) || 0,
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
        opp_pts: oppPts, // This is the OppPTS column value (actual opponent points allowed to centers)
        plus_minus: parseFloat(stat['+/-']) || 0,
        gp_rank: parseInt(stat['GP RANK']) || 0
      };
      return record;
    });
    
    // Insert the new center defensive stats
    const { data, error } = await supabase
      .from('team_defensive_stats')
      .insert(insertData);
    
    if (error) {
      console.error('❌ Error inserting center defensive stats:', error);
      throw error;
    }
    
    console.log(`✅ Successfully stored center defensive stats for ${insertData.length} teams`);
    
    // Log summary of center defensive performance
    const sortedByCenterDefense = [...stats].sort((a, b) => a['OppPTS'] - b['OppPTS']);
    console.log('\n📊 Center Defense Summary:');
    console.log(`🟢 Best Center Defense: ${sortedByCenterDefense[0]?.team} (${sortedByCenterDefense[0]?.['OppPTS']?.toFixed(1)} OPP PTS)`);
    console.log(`🔴 Worst Center Defense: ${sortedByCenterDefense[sortedByCenterDefense.length - 1]?.team} (${sortedByCenterDefense[sortedByCenterDefense.length - 1]?.['OppPTS']?.toFixed(1)} OPP PTS)`);
    
    // Calculate center defense thresholds
    const centerPoints = stats.map(s => s['OppPTS']).filter(p => p > 0);
    const avgCenterPoints = centerPoints.reduce((sum, pts) => sum + pts, 0) / centerPoints.length;
    console.log(`📈 Average Center Points Allowed: ${avgCenterPoints.toFixed(1)}`);
    
    // Suggest center defense thresholds
    const sortedCenterPoints = [...centerPoints].sort((a, b) => a - b);
    const eliteThreshold = sortedCenterPoints[Math.floor(sortedCenterPoints.length * 0.25)];
    const strongThreshold = sortedCenterPoints[Math.floor(sortedCenterPoints.length * 0.5)];
    const averageThreshold = sortedCenterPoints[Math.floor(sortedCenterPoints.length * 0.75)];
    
    console.log(`🎯 Suggested Center Defense Thresholds:`);
    console.log(`  🟢 Elite Center Defense: ≤${eliteThreshold.toFixed(1)} OPP PTS`);
    console.log(`  🟡 Strong Center Defense: ≤${strongThreshold.toFixed(1)} OPP PTS`);
    console.log(`  🟠 Average Center Defense: ≤${averageThreshold.toFixed(1)} OPP PTS`);
    console.log(`  🔴 Weak Center Defense: >${averageThreshold.toFixed(1)} OPP PTS`);
    
  } catch (error) {
    console.error('❌ Error storing center defensive stats:', error);
    throw error;
  }
}

// Run the scraper if called directly
if (require.main === module) {
  scrapeCenterDefensiveStats()
    .then(() => {
      console.log('🎉 Center Defense Scraper completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Center Defense Scraper failed:', error);
      process.exit(1);
    });
}

module.exports = { scrapeCenterDefensiveStats };
