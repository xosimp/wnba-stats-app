const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function scrapePositionDefense() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const positions = [
      { position: 'forward', url: 'https://stats.wnba.com/teams/opponent/?sort=W&dir=-1&Season=2024&SeasonType=Regular%20Season&PlayerPosition=F' },
      { position: 'center', url: 'https://stats.wnba.com/teams/opponent/?sort=W&dir=-1&Season=2024&SeasonType=Regular%20Season&PlayerPosition=C' },
      { position: 'guard', url: 'https://stats.wnba.com/teams/opponent/?sort=W&dir=-1&Season=2024&SeasonType=Regular%20Season&PlayerPosition=G' }
    ];

    for (const { position, url } of positions) {
      console.log(`\nScraping ${position} defense data...`);
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Wait for the page to load
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for the stats table to load
      await page.waitForSelector('table', { timeout: 10000 });
      
      // Extract team names and defensive stats using the correct column indices
      const teamData = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr');
        const teams = [];
        
        rows.forEach((row, rowIndex) => {
          try {
            const cells = row.querySelectorAll('td');
            if (cells.length > 25) { // Need at least 26 cells for all stats
              // Team name is in cell 1 (skip cell 0 which is ranking)
              const teamName = cells[1]?.textContent?.trim();
              
              if (teamName && teamName !== 'TEAM') {
                // Extract defensive stats using the correct column indices
                const oppPts = parseFloat(cells[25]?.textContent?.trim() || '0');      // OppPTS
                const oppFgPct = parseFloat(cells[8]?.textContent?.trim() || '0');     // OppFG%
                const opp3pPct = parseFloat(cells[11]?.textContent?.trim() || '0');   // Opp3P%
                const oppReb = parseFloat(cells[17]?.textContent?.trim() || '0');     // OppREB
                const oppAst = parseFloat(cells[18]?.textContent?.trim() || '0');     // OppAST
                
                teams.push({
                  team: teamName,
                  oppPts,
                  oppFgPct,
                  opp3pPct,
                  oppReb,
                  oppAst
                });
                
                console.log(`Scraped ${position} defense: ${teamName} - ${oppPts} OPP PTS`);
              }
            }
          } catch (error) {
            console.warn(`Error parsing row ${rowIndex}:`, error);
          }
        });
        
        return teams;
      });
      
      console.log(`Found ${teamData.length} teams for ${position} defense:`);
      teamData.forEach(team => {
        console.log(`  ${team.team}: ${team.oppPts} OPP PTS, ${team.oppFgPct}% FG, ${team.opp3pPct}% 3P`);
      });
      
      // Insert data into database using correct column names
      for (const team of teamData) {
        const { error } = await supabase
          .from('team_defensive_stats')
          .insert({
            team: team.team,
            season: '2024',
            stat_type: `${position}_defense`,
            home_avg_allowed: team.oppPts,
            away_avg_allowed: team.oppPts, // Use same value for both
            overall_avg_allowed: team.oppPts,
            opp_pts: team.oppPts,
            opp_fg_pct: team.oppFgPct,
            opp_3p_pct: team.opp3pPct,
            opp_reb: team.oppReb,
            opp_ast: team.oppAst,
            // Set other required fields to 0 for now
            games_played: 0,
            wins: 0,
            losses: 0,
            minutes: 0,
            opp_fgm: 0,
            opp_fga: 0,
            opp_ftm: 0,
            opp_fta: 0,
            opp_ft_pct: 0,
            opp_oreb: 0,
            opp_dreb: 0,
            opp_tov: 0,
            opp_stl: 0,
            opp_blk: 0,
            opp_blka: 0,
            opp_pf: 0,
            opp_pfd: 0,
            plus_minus: 0,
            gp_rank: 0
          });
        
        if (error) {
          console.error(`Error inserting ${position} defense for ${team.team}:`, error);
        } else {
          console.log(`✓ Inserted ${position} defense for ${team.team}`);
        }
      }
      
      await page.close();
    }
    
    console.log('\n✅ 2024 position defense data scraping completed!');
    
  } catch (error) {
    console.error('Error scraping position defense data:', error);
  } finally {
    await browser.close();
  }
}

scrapePositionDefense();
