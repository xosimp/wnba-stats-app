const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const puppeteer = require('puppeteer');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = 'https://www.basketball-reference.com';
const SEASON = '2025';
const SCHEDULE_URL = `${BASE_URL}/wnba/years/${SEASON}_games.html`;
const RATE_LIMIT_DELAY = 4000; // 4-second delay to avoid being blocked
const BROWSER_RESTART_INTERVAL = 25; // Restart browser every 25 games

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to extract team abbreviation from team name
function extractTeamAbbreviation(teamName) {
  const teamMap = {
    'Minnesota Lynx': 'MIN',
    'New York Liberty': 'NYL',
    'Connecticut Sun': 'CON',
    'Indiana Fever': 'IND',
    'Las Vegas Aces': 'LVA',
    'Phoenix Mercury': 'PHO',
    'Seattle Storm': 'SEA',
    'Atlanta Dream': 'ATL',
    'Chicago Sky': 'CHI',
    'Dallas Wings': 'DAL',
    'Los Angeles Sparks': 'LAS',
    'Washington Mystics': 'WAS',
    'Golden State Valkyries': 'GSV'
  };
  
  const cleanTeamName = teamName.replace(/\s*\(\d+-\d+\)\s*Table?$/, '');
  return teamMap[cleanTeamName] || cleanTeamName;
}

// Helper function to parse minutes string to decimal
function parseMinutes(minutesStr) {
  if (!minutesStr || minutesStr === '' || typeof minutesStr !== 'string') return null;
  
  const match = minutesStr.match(/(\d+):(\d+)/);
  if (match) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    return minutes + (seconds / 60);
  }
  
  const justMinutes = parseInt(minutesStr);
  if (!isNaN(justMinutes)) {
    return justMinutes;
  }
  
  return null;
}

// Enhanced stealth configuration
async function setupStealthPage(browser) {
  const page = await browser.newPage();
  
  // Set realistic viewport
  await page.setViewport({ width: 1366, height: 768 });
  
  // Set realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Set additional headers
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });
  
  // Block unnecessary resources to speed up loading
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  return page;
}

// Helper function to clean player data
function cleanPlayerData(playerData, gameInfo) {
  const teamAbbreviation = extractTeamAbbreviation(playerData.team);
  
  return {
    player_name: playerData.player_name,
    team: teamAbbreviation,
    game_id: playerData.game_id,
    game_date: playerData.game_date,
    opponent: playerData.opponent,
    ishome: playerData.isHome,
    minutes: playerData.minutes,
    points: parseInt(playerData.points) || 0,
    rebounds: parseInt(playerData.rebounds) || 0,
    assists: parseInt(playerData.assists) || 0,
    steals: parseInt(playerData.steals) || 0,
    blocks: parseInt(playerData.blocks) || 0,
    turnovers: parseInt(playerData.turnovers) || 0,
    fouls: parseInt(playerData.fouls) || 0,
    field_goals_made: parseInt(playerData.field_goals_made) || 0,
    field_goals_attempted: parseInt(playerData.field_goals_attempted) || 0,
    three_points_made: parseInt(playerData.three_points_made) || 0,
    three_points_attempted: parseInt(playerData.three_points_attempted) || 0,
    free_throws_made: parseInt(playerData.free_throws_made) || 0,
    free_throws_attempted: parseInt(playerData.free_throws_attempted) || 0,
    plus_minus: parseInt(playerData.plus_minus) || 0
  };
}

// Fetch game schedule from basketball-reference
async function fetchGameSchedule(page) {
  try {
    console.log('📅 Fetching WNBA game schedule...');
    await page.goto(SCHEDULE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(2000);
    
    const games = await page.evaluate(() => {
      const rows = document.querySelectorAll('#schedule tbody tr');
      const games = [];
      
      // Team abbreviation mapping for consistency
      const teamAbbrevMap = {
        'Minnesota Lynx': 'MIN',
        'New York Liberty': 'NYL',
        'Connecticut Sun': 'CON',
        'Indiana Fever': 'IND',
        'Las Vegas Aces': 'LVA',
        'Phoenix Mercury': 'PHO',
        'Seattle Storm': 'SEA',
        'Atlanta Dream': 'ATL',
        'Chicago Sky': 'CHI',
        'Dallas Wings': 'DAL',
        'Los Angeles Sparks': 'LAS',
        'Washington Mystics': 'WAS',
        'Golden State Valkyries': 'GSV'
      };
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 7) { // 7 cells: date (th), visitor (td), visitor_score (td), home (td), home_score (td), box_score (td), notes (td)
          const dateCell = cells[0]; // This is a <th> element
          const visitorCell = cells[1];
          const visitorScoreCell = cells[2];
          const homeCell = cells[3];
          const homeScoreCell = cells[4];
          const boxScoreCell = cells[5];
          const notesCell = cells[6];
          
          if (dateCell && visitorCell && homeCell) {
            const dateText = dateCell.textContent.trim();
            const visitorText = visitorCell.textContent.trim();
            const homeText = homeCell.textContent.trim();
            const visitorScore = visitorScoreCell?.textContent?.trim();
            const homeScore = homeScoreCell?.textContent?.trim();
            const boxScoreLink = boxScoreCell?.querySelector('a');
            const notes = notesCell?.textContent?.trim();
            
            // Check if game is completed (has scores and box score link)
            const isCompleted = visitorScore && homeScore && boxScoreLink;
            
            if (isCompleted) {
              let gameDate;
              try {
                // Format: "Mon, May 19, 2025"
                const dateMatch = dateText.match(/(\w+), (\w+) (\d+), (\d+)/);
                if (dateMatch) {
                  const [, day, month, dayNum, year] = dateMatch;
                  const monthMap = {
                    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                  };
                  const monthNum = monthMap[month];
                  if (monthNum) {
                    gameDate = `${year}-${monthNum}-${dayNum.padStart(2, '0')}`;
                  }
                }
              } catch (error) {
                console.log('Date parsing error:', error);
              }
              
              const homeAbbr = teamAbbrevMap[homeText] || homeText;
              const visitorAbbr = teamAbbrevMap[visitorText] || visitorText;
              
              if (gameDate && homeAbbr) {
                // Fix URL format: add 0 before team abbreviation (e.g., 20250801ATL -> 202508010ATL)
                const gameId = `${gameDate.replace(/-/g, '')}0${homeAbbr}`;
                const scoreText = visitorScore && homeScore ? `${visitorScore}-${homeScore}` : '';
                
                games.push({
                  gameId,
                  gameDate,
                  dateText,
                  visitor: visitorText,
                  home: homeText,
                  visitorAbbr,
                  homeAbbr,
                  score: scoreText,
                  isCompleted: true
                });
              }
            }
          }
        }
      });
      
      return games;
    });
    
    console.log(`📊 Found ${games.length} games in schedule`);
    return games;
  } catch (error) {
    console.error('Error fetching game schedule:', error.message);
    return [];
  }
}

// Fetch box score for a specific game
async function fetchBoxScore(page, game) {
  try {
    const boxScoreUrl = `${BASE_URL}/wnba/boxscores/${game.gameId}.html`;
    console.log(`📊 Fetching box score: ${boxScoreUrl}`);
    
    await page.goto(boxScoreUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(1000);
    
    const gameLogs = await page.evaluate((gameInfo) => {
      // Helper function to parse minutes string to decimal
      function parseMinutes(minutesStr) {
        if (!minutesStr || minutesStr === '' || typeof minutesStr !== 'string') return null;
        
        const match = minutesStr.match(/(\d+):(\d+)/);
        if (match) {
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          return minutes + (seconds / 60);
        }
        
        const justMinutes = parseInt(minutesStr);
        if (!isNaN(justMinutes)) {
          return justMinutes;
        }
        
        return null;
      }
      
      const logs = [];
      const playerMap = new Map(); // To deduplicate players and keep only the row with highest minutes
      
      // Get only the main game box scores (not quarter/half breakdowns)
      // Only select tables that end with "-game-basic" and don't contain quarter indicators
      const tables = document.querySelectorAll('table[id*="box-"][id$="-game-basic"]:not([id*="-q1-"]):not([id*="-q2-"]):not([id*="-q3-"]):not([id*="-q4-"]):not([id*="-h1-"]):not([id*="-h2-"])');
      
      tables.forEach(table => {
        const teamName = table.id.replace('box-', '').replace('-game-basic', '');
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 8) {
            // Player name is in the first cell (th element)
            const playerName = cells[0]?.textContent?.trim();
            const minutes = cells[1]?.textContent?.trim();
            const fg = cells[2]?.textContent?.trim();
            const fga = cells[3]?.textContent?.trim();
            const points = cells[19]?.textContent?.trim(); // Points is in column 19
            const fgPct = cells[4]?.textContent?.trim();
            const fg3 = cells[5]?.textContent?.trim();
            const fg3a = cells[6]?.textContent?.trim();
            const fg3Pct = cells[7]?.textContent?.trim();
            const ft = cells[8]?.textContent?.trim();
            const fta = cells[9]?.textContent?.trim();
            const ftPct = cells[10]?.textContent?.trim();
            const rebounds = cells[13]?.textContent?.trim(); // TRB - Total Rebounds
            const assists = cells[14]?.textContent?.trim();
            const steals = cells[15]?.textContent?.trim();
            const blocks = cells[16]?.textContent?.trim();
            const turnovers = cells[17]?.textContent?.trim();
            const fouls = cells[18]?.textContent?.trim();
            const plusMinus = cells[20]?.textContent?.trim(); // Plus/Minus is in column 20
            
            if (playerName && playerName !== 'Team Totals' && playerName !== 'Reserves' && playerName !== '') {
              // Parse minutes to decimal for comparison
              let minutesDecimal = 0;
              if (minutes) {
                const match = minutes.match(/(\d+):(\d+)/);
                if (match) {
                  minutesDecimal = parseInt(match[1]) + (parseInt(match[2]) / 60);
                }
              }
              
              // Determine opponent
              const isHome = teamName.toUpperCase() === gameInfo.homeAbbr.toUpperCase();
              const opponent = isHome ? gameInfo.visitorAbbr : gameInfo.homeAbbr;
              
              const playerData = {
                player_name: playerName,
                team: teamName.toUpperCase(),
                game_id: gameInfo.gameId,
                game_date: gameInfo.dateText,
                opponent: opponent,
                minutes: parseMinutes(minutes),
                points: parseInt(points) || 0,
                rebounds: parseInt(rebounds) || 0,
                assists: parseInt(assists) || 0,
                steals: parseInt(steals) || 0,
                blocks: parseInt(blocks) || 0,
                turnovers: parseInt(turnovers) || 0,
                field_goals_made: parseInt(fg) || 0,
                field_goals_attempted: parseInt(fga) || 0,
                three_points_made: parseInt(fg3) || 0,
                three_points_attempted: parseInt(fg3a) || 0,
                free_throws_made: parseInt(ft) || 0,
                free_throws_attempted: parseInt(fta) || 0,
                fouls: parseInt(fouls) || 0,
                plus_minus: parseInt(plusMinus) || 0,
                ishome: isHome,
                minutesDecimal: minutesDecimal // Used for comparison only
              };
              
              // Only keep the row with the highest minutes for each player (final totals)
              const existingPlayer = playerMap.get(playerName);
              if (!existingPlayer || minutesDecimal > existingPlayer.minutesDecimal) {
                playerMap.set(playerName, playerData);
              }
            }
          }
        });
      });
      
      // Convert map to array and remove the minutesDecimal field used for comparison
      return Array.from(playerMap.values()).map(player => {
        const { minutesDecimal, ...cleanPlayer } = player;
        return cleanPlayer;
      });
    }, game);
    
    console.log(`📊 Extracted ${gameLogs.length} player records for ${game.gameId}`);
    return gameLogs;
  } catch (error) {
    console.error(`❌ Error fetching box score for ${game.gameId}:`, error.message);
    return [];
  }
}

// Check which games are missing or incomplete
async function identifyMissingAndIncompleteGames(scheduleGames) {
  try {
    console.log('🔍 Checking database for missing and incomplete games...');
    
    // Get ALL existing game IDs from database using proper pagination
    let allExistingGames = [];
    let from = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data: batchData, error, count } = await supabase
        .from('wnba_game_logs')
        .select('game_id, minutes, opponent, ishome', { count: 'exact' })
        .range(from, from + batchSize - 1);
      
      if (error) {
        console.error('❌ Error fetching batch:', error.message);
        break;
      }
      
      if (!batchData || batchData.length === 0) {
        break;
      }
      
      allExistingGames = allExistingGames.concat(batchData);
      
      // If we got less than batchSize, we've reached the end
      if (batchData.length < batchSize) {
        break;
      }
      
      from += batchSize;
    }
    
    const existingGameIds = [...new Set(allExistingGames.map(g => g.game_id))];
    console.log(`📊 Found ${existingGameIds.length} existing games in database (from ${allExistingGames.length} total records)`);
    
    // Find missing games
    const missingGames = scheduleGames.filter(game => !existingGameIds.includes(game.gameId));
    console.log(`❌ Missing games: ${missingGames.length}`);
    
    // Find incomplete games (missing minutes, opponent, or ishome data)
    const incompleteGames = [];
    existingGameIds.forEach(gameId => {
      const gameLogs = allExistingGames.filter(g => g.game_id === gameId);
      const totalPlayers = gameLogs.length;
      const playersWithMinutes = gameLogs.filter(log => log.minutes !== null && log.minutes > 0).length;
      const playersWithOpponent = gameLogs.filter(log => log.opponent && log.opponent !== 'null').length;
      const playersWithIsHome = gameLogs.filter(log => log.ishome !== null && log.ishome !== undefined).length;
      
      if (playersWithMinutes < totalPlayers || playersWithOpponent < totalPlayers || playersWithIsHome < totalPlayers) {
        const gameInfo = scheduleGames.find(g => g.gameId === gameId);
        if (gameInfo) {
          incompleteGames.push({
            ...gameInfo,
            totalPlayers,
            withMinutes: playersWithMinutes,
            withOpponent: playersWithOpponent,
            withIsHome: playersWithIsHome
          });
        }
      }
    });
    
    console.log(`⚠️  Incomplete games: ${incompleteGames.length}`);
    
    return { missingGames, incompleteGames };
  } catch (error) {
    console.error('❌ Error identifying missing games:', error.message);
    return { missingGames: [], incompleteGames: [] };
  }
}

// Insert game logs into database
async function insertGameLogs(gameLogs) {
  try {
    if (gameLogs.length === 0) {
      console.log('⚠️  No game logs to insert');
      return false;
    }
    
    // Minutes are already parsed in fetchBoxScore, so use them directly
    const processedLogs = gameLogs;
    
    const { error } = await supabase
      .from('wnba_game_logs')
      .upsert(processedLogs, { 
        onConflict: 'player_name,game_id',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error('❌ Error inserting game logs:', error.message);
      return false;
    }
    
    console.log(`✅ Successfully inserted ${processedLogs.length} game logs`);
    return true;
  } catch (error) {
    console.error('❌ Error in insertGameLogs:', error.message);
    return false;
  }
}

// Main scraping function
async function scrapeMissingGames() {
  console.log('🚀 Starting WNBA Game Log Scraper (Daily Automation)...\n');
  
  let browser = await puppeteer.launch({ 
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage', 
      '--memory-pressure-off',
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
      '--disable-plugins',
      '--disable-images',
      '--disable-javascript',
      '--disable-plugins-discovery',
      '--disable-preconnect',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
  
  try {
    let page = await setupStealthPage(browser);
    
    // Get schedule
    const scheduleGames = await fetchGameSchedule(page);
    if (scheduleGames.length === 0) {
      console.log('❌ No games found in schedule');
      return;
    }
    
    // Filter to only completed games
    const today = new Date();
    const completedGames = scheduleGames.filter(game => {
      const gameDate = new Date(game.gameDate);
      return gameDate < today && game.isCompleted;
    });
    
    console.log(`🏁 Completed games: ${completedGames.length}`);
    
    // Identify missing and incomplete games
    const { missingGames, incompleteGames } = await identifyMissingAndIncompleteGames(completedGames);
    
    // Process missing games first
    if (missingGames.length > 0) {
      console.log(`\n📥 Processing ${missingGames.length} missing games...`);
      
      let gamesProcessed = 0;
      
      for (let i = 0; i < missingGames.length; i++) {
        const game = missingGames[i];
        console.log(`\n[${i + 1}/${missingGames.length}] Processing: ${game.gameId}`);
        
        // Restart browser every BROWSER_RESTART_INTERVAL games
        if (gamesProcessed > 0 && gamesProcessed % BROWSER_RESTART_INTERVAL === 0) {
          console.log('🔄 Restarting browser to prevent memory issues...');
          await page.close();
          await browser.close();
          browser = await puppeteer.launch({ 
            headless: true,
            args: [
              '--no-sandbox', 
              '--disable-setuid-sandbox', 
              '--disable-dev-shm-usage', 
              '--memory-pressure-off',
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
              '--disable-plugins',
              '--disable-images',
              '--disable-javascript',
              '--disable-plugins-discovery',
              '--disable-preconnect',
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding'
            ]
          });
          page = await setupStealthPage(browser);
        }
        
        const gameLogs = await fetchBoxScore(page, game);
        if (gameLogs.length > 0) {
          const success = await insertGameLogs(gameLogs);
          if (success) {
            console.log(`✅ Successfully processed ${game.gameId}`);
            gamesProcessed++;
          }
        } else {
          console.log(`⚠️  No player data extracted for ${game.gameId}`);
        }
        
        // Rate limiting
        if (i < missingGames.length - 1) {
          console.log(`⏳ Waiting ${RATE_LIMIT_DELAY/1000} seconds before next game...`);
          await delay(RATE_LIMIT_DELAY);
        }
      }
    }
    
    // Process incomplete games
    if (incompleteGames.length > 0) {
      console.log(`\n🔧 Processing ${incompleteGames.length} incomplete games...`);
      
      let incompleteGamesProcessed = 0;
      
      for (let i = 0; i < incompleteGames.length; i++) {
        const game = incompleteGames[i];
        console.log(`\n[${i + 1}/${incompleteGames.length}] Fixing: ${game.gameId}`);
        
        // Restart browser every BROWSER_RESTART_INTERVAL games
        if (incompleteGamesProcessed > 0 && incompleteGamesProcessed % BROWSER_RESTART_INTERVAL === 0) {
          console.log('🔄 Restarting browser to prevent memory issues...');
          await page.close();
          await browser.close();
          browser = await puppeteer.launch({ 
            headless: true,
            args: [
              '--no-sandbox', 
              '--disable-setuid-sandbox', 
              '--disable-dev-shm-usage', 
              '--memory-pressure-off',
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
              '--disable-plugins',
              '--disable-images',
              '--disable-javascript',
              '--disable-plugins-discovery',
              '--disable-preconnect',
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding'
            ]
          });
          page = await setupStealthPage(browser);
        }
        
        // Delete existing incomplete data
        const { error: deleteError } = await supabase
          .from('wnba_game_logs')
          .delete()
          .eq('game_id', game.gameId);
        
        if (deleteError) {
          console.error(`❌ Error deleting incomplete game ${game.gameId}:`, deleteError.message);
          continue;
        }
        
        console.log(`🗑️  Deleted incomplete data for ${game.gameId}`);
        
        // Re-scrape the game
        const gameLogs = await fetchBoxScore(page, game);
        if (gameLogs.length > 0) {
          const success = await insertGameLogs(gameLogs);
          if (success) {
            console.log(`✅ Successfully fixed ${game.gameId}`);
            incompleteGamesProcessed++;
          }
        } else {
          console.log(`⚠️  No player data extracted for ${game.gameId}`);
        }
        
        // Rate limiting
        if (i < incompleteGames.length - 1) {
          console.log(`⏳ Waiting ${RATE_LIMIT_DELAY/1000} seconds before next game...`);
          await delay(RATE_LIMIT_DELAY);
        }
      }
    }
    
    if (missingGames.length === 0 && incompleteGames.length === 0) {
      console.log('\n🎉 All games are up-to-date! No new games to scrape.');
    } else {
      console.log('\n🎉 Game scraping completed!');
    }
    
  } catch (error) {
    console.error('❌ Error during scraping:', error);
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeMissingGames();
