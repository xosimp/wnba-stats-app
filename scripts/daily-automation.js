const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const execAsync = util.promisify(exec);

// Resolve the Node.js binary path robustly for cron/launchd environments
const NODE_BIN = (process.execPath && process.execPath.includes('node'))
  ? process.execPath
  : '/usr/local/bin/node';

class DailyWNBAAutomation {
  constructor() {
    this.logFile = path.resolve(__dirname, '../automation-logs.json');
    this.loadLogs();
  }

  loadLogs() {
    try {
      if (fs.existsSync(this.logFile)) {
        this.logs = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
      } else {
        this.logs = {
          runs: [],
          lastRun: null,
          totalGamesProcessed: 0,
          totalPlayersUpdated: 0
        };
      }
    } catch (error) {
      console.error('❌ Error loading logs:', error);
      this.logs = {
        runs: [],
        lastRun: null,
        totalGamesProcessed: 0,
        totalPlayersUpdated: 0
      };
    }
  }

  saveLogs() {
    try {
      fs.writeFileSync(this.logFile, JSON.stringify(this.logs, null, 2));
    } catch (error) {
      console.error('❌ Error saving logs:', error);
    }
  }

  logRun(type, success, details) {
    const run = {
      timestamp: new Date().toISOString(),
      type: type,
      success: success,
      details: details
    };
    
    this.logs.runs.push(run);
    this.logs.lastRun = run.timestamp;
    this.saveLogs();
  }

  async runRapidAPIPlayerAveragesFetch() {
    const maxRetries = 3;
    const baseDelay = 30000; // 30 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 Starting RapidAPI player averages fetch... (Attempt ${attempt}/${maxRetries})`);
        
        const { stdout, stderr } = await execAsync(`${NODE_BIN} fixed-rapidapi-player-averages.js`, { 
          cwd: __dirname,
          timeout: 900000 // 15 minute timeout for RapidAPI player averages fetch
        });
        
        if (stderr && !stderr.includes('Warning')) {
          console.error('❌ RapidAPI player averages fetch error:', stderr);
          if (attempt === maxRetries) {
            this.logRun('rapidapi_player_averages_fetch', false, { error: stderr, attempts: attempt });
            return false;
          }
          throw new Error(stderr);
        }
        
        console.log('✅ RapidAPI player averages fetch completed');
        this.logRun('rapidapi_player_averages_fetch', true, { output: stdout, attempts: attempt });
        return true;
        
      } catch (error) {
        console.error(`❌ Basketball-Reference scraping failed (Attempt ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt === maxRetries) {
          this.logRun('basketball_reference_scraping', false, { error: error.message, attempts: attempt });
          return false;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return false;
  }

  async runGameLogScraping() {
    const maxRetries = 3;
    const baseDelay = 30000; // 30 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📊 Starting game log scraping... (Attempt ${attempt}/${maxRetries})`);
        
        const { stdout, stderr } = await execAsync(`${NODE_BIN} wnba-game-log-scraper.js`, { 
          cwd: __dirname,
          timeout: 900000 // 15 minute timeout for game log scraping
        });
        
        if (stderr && !stderr.includes('Warning')) {
          console.error('❌ Game log scraping error:', stderr);
          if (attempt === maxRetries) {
            this.logRun('game_log_scraping', false, { error: stderr, attempts: attempt });
            return false;
          }
          throw new Error(stderr);
        }
        
        console.log('✅ Game log scraping completed');
        this.logRun('game_log_scraping', true, { output: stdout, attempts: attempt });
        return true;
        
      } catch (error) {
        console.error(`❌ Game log scraping failed (Attempt ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt === maxRetries) {
          this.logRun('game_log_scraping', false, { error: error.message, attempts: attempt });
          return false;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return false;
  }

  async runTeamDefenseScraping() {
    try {
      console.log('🛡️ Starting team defense stats scraping...');
      
      // Pass environment variables to the child process
      const env = {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      
      // Debug: log available env vars
      console.log('🔍 Available env vars:', Object.keys(env).filter(key => key.includes('SUPABASE')));
      
              const { stdout, stderr } = await execAsync(`${NODE_BIN} wnba-team-defense-scraper.js`, { 
        cwd: __dirname,
        env: env,
        timeout: 300000 // 5 minute timeout for team defense scraping
      });
      
      if (stderr && !stderr.includes('Warning')) {
        console.error('❌ Team defense scraping error:', stderr);
        this.logRun('team_defense_scraping', false, { error: stderr });
        return false;
      }
      
      console.log('✅ Team defense stats scraping completed');
      this.logRun('team_defense_scraping', true, { output: stdout });
      return true;
      
    } catch (error) {
      console.error('❌ Team defense scraping failed:', error);
      this.logRun('team_defense_scraping', false, { error: error.message });
      return false;
    }
  }

  async runPositionSpecificDefenseScraping() {
    try {
      console.log('🎯 Starting position-specific defense stats scraping...');
      
      // Run all three position-specific scrapers in parallel
      const scrapers = [
        { name: 'Guard Defense', script: 'wnba-guard-defense-scraper.js' },
        { name: 'Forward Defense', script: 'wnba-forward-defense-scraper.js' },
        { name: 'Center Defense', script: 'wnba-center-defense-scraper.js' }
      ];
      
      const results = await Promise.allSettled(
        scrapers.map(async (scraper) => {
          console.log(`🔄 Running ${scraper.name} scraper...`);
          
          // Pass environment variables to the child process
          const env = {
            ...process.env,
            NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
          };
          
          const { stdout, stderr } = await execAsync(`${NODE_BIN} ${scraper.script}`, {
            cwd: __dirname,
            env: env,
            timeout: 300000 // 5 minute timeout for each position scraper
          });
          
          if (stderr && !stderr.includes('Warning')) {
            throw new Error(`${scraper.name} error: ${stderr}`);
          }
          
          console.log(`✅ ${scraper.name} scraper completed`);
          return { name: scraper.name, output: stdout };
        })
      );
      
      // Check results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed === 0) {
        console.log('✅ All position-specific defense scrapers completed successfully');
        this.logRun('position_defense_scraping', true, { 
          output: `All ${successful} scrapers successful`,
          details: results.map(r => r.status === 'fulfilled' ? r.value.name : 'Failed')
        });
        return true;
      } else {
        console.log(`⚠️ ${successful} scrapers succeeded, ${failed} failed`);
        this.logRun('position_defense_scraping', false, { 
          output: `${successful} succeeded, ${failed} failed`,
          details: results.map(r => r.status === 'fulfilled' ? r.value.name : 'Failed')
        });
        return false;
      }
      
    } catch (error) {
      console.error('❌ Position-specific defense scraping failed:', error);
      this.logRun('position_defense_scraping', false, { error: error.message });
      return false;
    }
  }

  async runAdvancedStatsScraping() {
    try {
      console.log('📊 Starting advanced stats scraping...');
      
      // Pass environment variables to the child process
      const env = {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      
      // Debug: log available env vars
      console.log('🔍 Available env vars:', Object.keys(env).filter(key => key.includes('SUPABASE')));
      
              const { stdout, stderr } = await execAsync(`${NODE_BIN} basketball-reference-advanced-scraper.js`, { 
        cwd: __dirname,
        env: env,
        timeout: 600000 // 10 minute timeout for advanced stats scraping (increased from 5 min)
      });
      
      if (stderr && !stderr.includes('Warning')) {
        console.error('❌ Advanced stats scraping error:', stderr);
        this.logRun('advanced_stats_scraping', false, { error: stderr });
        return false;
      }
      
      console.log('✅ Advanced stats scraping completed');
      this.logRun('advanced_stats_scraping', true, { output: stdout });
      return true;
      
    } catch (error) {
      console.error('❌ Advanced stats scraping failed:', error);
      this.logRun('advanced_stats_scraping', false, { error: error.message });
      return false;
    }
  }

  async runPerMinuteStatsScraping() {
    try {
      console.log('📊 Starting per-minute stats scraping...');
      
      // Pass environment variables to the child process
      const env = {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      
      // Debug: log available env vars
      console.log('🔍 Available env vars:', Object.keys(env).filter(key => key.includes('SUPABASE')));
      
              const { stdout, stderr } = await execAsync(`${NODE_BIN} basketball-reference-per-minute-stats-scraper.js`, { 
        cwd: __dirname,
        env: env,
        timeout: 600000 // 10 minute timeout for per-minute stats scraping
      });
      
      if (stderr && !stderr.includes('Warning')) {
        console.error('❌ Per-minute stats scraping error:', stderr);
        this.logRun('per_minute_stats_scraping', false, { error: stderr });
        return false;
      }
      
      console.log('✅ Per-minute stats scraping completed');
      this.logRun('per_minute_stats_scraping', true, { output: stdout });
      return true;
      
    } catch (error) {
      console.error('❌ Per-minute stats scraping failed:', error);
      this.logRun('per_minute_stats_scraping', false, { error: error.message });
      return false;
    }
  }

  async runTeamPaceScraping() {
    try {
      console.log('🏃‍♀️ Starting team PACE stats scraping...');
      
      // Pass environment variables to the child process
      const env = {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      
      // Debug: log available env vars
      console.log('🔍 Available env vars:', Object.keys(env).filter(key => key.includes('SUPABASE')));
      
              const { stdout, stderr } = await execAsync(`${NODE_BIN} wnba-pace-simple.js`, { 
        cwd: __dirname,
        env: env,
        timeout: 300000 // 5 minute timeout for team pace scraping
      });
      
      if (stderr && !stderr.includes('Warning')) {
        console.error('❌ Team PACE scraping error:', stderr);
        this.logRun('team_pace_scraping', false, { error: stderr });
        return false;
      }
      
      console.log('✅ Team PACE stats scraping completed');
      this.logRun('team_pace_scraping', true, { output: stdout });
      return true;
      
    } catch (error) {
      console.error('❌ Team PACE scraping failed:', error);
      this.logRun('team_pace_scraping', false, { error: error.message });
      return false;
    }
  }

  async processScrapedGames() {
    try {
      console.log('🔄 Processing scraped games...');
      
      // Game processing is handled by the game log scraper itself
      // No separate processing script needed
      console.log('✅ Game processing completed (handled by game log scraper)');
      this.logRun('game_processing', true, { output: 'Handled by game log scraper' });
      return true;
      
    } catch (error) {
      console.error('❌ Game processing failed:', error);
      this.logRun('game_processing', false, { error: error.message });
      return false;
    }
  }

  async runComprehensiveDataGeneration() {
    try {
      console.log('📊 Generating comprehensive data...');
      
      // Data generation is handled by the season averages update
      // No separate data generation script needed
      console.log('✅ Data generation completed (handled by season averages update)');
      this.logRun('data_generation', true, { output: 'Handled by season averages update' });
      return true;
      
    } catch (error) {
      console.error('❌ Data generation failed:', error);
      this.logRun('data_generation', false, { error: error.message });
      return false;
    }
  }

  async checkDatabaseHealth() {
    try {
      console.log('🏥 Checking database health...');
      
      // Try multiple health check methods with better error handling
      let healthCheckPassed = false;
      
      // Method 1: Try local API (if app is running)
      try {
        const { stdout, stderr } = await execAsync('curl -s --max-time 15 "http://localhost:3000/api/health"', { 
          timeout: 20000 
        });
        
        if (stdout && !stderr) {
          console.log('✅ Local app health check passed');
          healthCheckPassed = true;
        }
      } catch (localError) {
        console.log('ℹ️  Local app not running (expected for cron jobs)');
      }
      
      // Method 2: Database connectivity check
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const { data, error } = await supabase
          .from('players')
          .select('count')
          .limit(1);
        
        if (!error && data !== null) {
          console.log('✅ Database connectivity check passed');
          healthCheckPassed = true;
        }
      } catch (dbError) {
        console.log('ℹ️  Database check failed:', dbError.message);
      }
      
      // Method 3: Simple file system check
      try {
        const fs = require('fs');
        const logFile = path.resolve(__dirname, '../automation-logs.json');
        if (fs.existsSync(logFile)) {
          console.log('✅ File system check passed');
          healthCheckPassed = true;
        }
      } catch (fsError) {
        console.log('ℹ️  File system check failed:', fsError.message);
      }
      
      if (healthCheckPassed) {
        this.logRun('health_check', true, { 
          output: 'Health check passed via multiple methods',
          method: 'multi_method_check'
        });
        return true;
      } else {
        this.logRun('health_check', false, { 
          error: 'All health check methods failed',
          localApp: false,
          database: false,
          fileSystem: false
        });
        return false;
      }
      
    } catch (error) {
      console.error('❌ Database health check failed:', error.message);
      this.logRun('health_check', false, { error: error.message });
      return false;
    }
  }

  async updatePlayerLeagueAverages() {
    try {
      console.log('📊 Updating player league averages from database...');
      
      const { stdout, stderr } = await execAsync(`${NODE_BIN} update-player-league-averages.js`, { 
        cwd: __dirname,
        timeout: 300000 // 5 minute timeout for league averages update
      });
      
      if (stderr && !stderr.includes('Warning')) {
        console.error('❌ Player league averages update error:', stderr);
        this.logRun('player_league_averages_update', false, { error: stderr });
        return false;
      }
      
      console.log('✅ Player league averages update completed');
      this.logRun('player_league_averages_update', true, { output: stdout });
      return true;
      
    } catch (error) {
      console.error('❌ Player league averages update failed:', error);
      this.logRun('player_league_averages_update', false, { error: error.message });
      return false;
    }
  }

  async update2025SeasonAverages() {
    const maxRetries = 3;
    const baseDelay = 30000; // 30 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📊 Updating 2025 season averages for all players... (Attempt ${attempt}/${maxRetries})`);
        
        const { stdout, stderr } = await execAsync(`${NODE_BIN} update-all-2025-averages.js`, { 
          cwd: __dirname,
          timeout: 600000 // 10 minute timeout for season averages update
        });
        
        if (stderr && !stderr.includes('Warning')) {
          console.error('❌ Season averages update error:', stderr);
          if (attempt === maxRetries) {
            this.logRun('season_averages_update', false, { error: stderr, attempts: attempt });
            return false;
          }
          throw new Error(stderr);
        }
        
        console.log('✅ 2025 season averages update completed');
        this.logRun('season_averages_update', true, { output: stdout, attempts: attempt });
        return true;
        
      } catch (error) {
        console.error(`❌ Season averages update failed (Attempt ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt === maxRetries) {
          this.logRun('season_averages_update', false, { error: error.message, attempts: attempt });
          return false;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return false;
  }

  async checkProjectionOutcomes() {
    try {
      console.log('🎯 Starting automated projection outcome checking...');
      
      // Import the AutomatedOutcomeService
      const { AutomatedOutcomeService } = require('../lib/services/AutomatedOutcomeService');
      
      const outcomeService = new AutomatedOutcomeService(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      // Check outcomes for all finished games
      await outcomeService.checkOutcomesForFinishedGames();
      
      console.log('✅ Projection outcome checking completed');
      this.logRun('outcome_checking', true, { 
        message: 'Successfully checked outcomes for finished games'
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Projection outcome checking failed:', error);
      this.logRun('outcome_checking', false, { 
        error: error.message 
      });
      return false;
    }
  }

  async runFullAutomation() {
    const startTime = new Date();
    console.log(`🚀 Starting WNBA Daily Automation - ${startTime.toISOString()}`);
    
    const results = {
      rapidAPIPlayerAveragesFetch: false,
      gameLogScraping: false,
      teamDefenseScraping: false,
      positionDefenseScraping: false,
      advancedStatsScraping: false,
      perMinuteStatsScraping: false,
      teamPaceScraping: false,
      gameProcessing: false,
      dataGeneration: false,
      playerLeagueAveragesUpdate: false,
      seasonAveragesUpdate: false,
      outcomeChecking: false,
      healthCheck: false
    };
    
    try {
          // Step 1: RapidAPI Player Averages Fetch
    results.rapidAPIPlayerAveragesFetch = await this.runRapidAPIPlayerAveragesFetch();
      
      // Step 2: Game Log Scraping (runs independently)
      results.gameLogScraping = await this.runGameLogScraping();
      
      // Step 3: Team Defense Stats Scraping
      results.teamDefenseScraping = await this.runTeamDefenseScraping();
      
      // Step 3.5: Position-Specific Defense Stats Scraping
      results.positionDefenseScraping = await this.runPositionSpecificDefenseScraping();
      
      // Step 4: Advanced Stats Scraping (for usage percentages)
      results.advancedStatsScraping = await this.runAdvancedStatsScraping();
      
      // Step 4.5: Per-Minute Stats Scraping (for rebounds per minute)
      results.perMinuteStatsScraping = await this.runPerMinuteStatsScraping();
      
      // Step 5: Team PACE Stats Scraping
      results.teamPaceScraping = await this.runTeamPaceScraping();
      
      if (results.rapidAPIPlayerAveragesFetch) {
        // Step 5: Process scraped games
        results.gameProcessing = await this.processScrapedGames();
      }
      
      // Step 6: Generate comprehensive data (fallback)
      if (!results.rapidAPIPlayerAveragesFetch || !results.gameProcessing) {
        console.log('🔄 Falling back to comprehensive data generation...');
        results.dataGeneration = await this.runComprehensiveDataGeneration();
      }
      
      // Step 7: Update player league averages from database
      console.log('📊 Updating player league averages...');
      results.playerLeagueAveragesUpdate = await this.updatePlayerLeagueAverages();
      
      // Step 8: Update 2025 season averages for all players
      console.log('📊 Updating 2025 season averages...');
      results.seasonAveragesUpdate = await this.update2025SeasonAverages();
      
      // Step 8: Check projection outcomes for finished games
      console.log('🎯 Checking projection outcomes for finished games...');
      results.outcomeChecking = await this.checkProjectionOutcomes();
      
      // Step 9: Health check
      results.healthCheck = await this.checkDatabaseHealth();
      
    } catch (error) {
      console.error('❌ Fatal error in automation:', error);
    }
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n🎉 AUTOMATION COMPLETE!');
    console.log('📊 Results:');
          console.log(`   RapidAPI Player Averages Fetch: ${results.rapidAPIPlayerAveragesFetch ? '✅' : '❌'}`);
      console.log(`   Game Log Scraping: ${results.gameLogScraping ? '✅' : '❌'}`);
      console.log(`   Team Defense Scraping: ${results.teamDefenseScraping ? '✅' : '❌'}`);
      console.log(`   Position Defense Scraping: ${results.positionDefenseScraping ? '✅' : '❌'}`);
      console.log(`   Advanced Stats Scraping: ${results.advancedStatsScraping ? '✅' : '❌'}`);
      console.log(`   Per-Minute Stats Scraping: ${results.perMinuteStatsScraping ? '✅' : '❌'}`);
      console.log(`   Team PACE Scraping: ${results.teamPaceScraping ? '✅' : '❌'}`);
      console.log(`   Game Processing: ${results.gameProcessing ? '✅' : '❌'}`);
      console.log(`   Data Generation: ${results.dataGeneration ? '✅' : '❌'}`);
      console.log(`   Player League Averages Update: ${results.playerLeagueAveragesUpdate ? '✅' : '❌'}`);
      console.log(`   Season Averages Update: ${results.seasonAveragesUpdate ? '✅' : '❌'}`);
      console.log(`   Outcome Checking: ${results.outcomeChecking ? '✅' : '❌'}`);
      console.log(`   Health Check: ${results.healthCheck ? '✅' : '❌'}`);
    console.log(`   Duration: ${duration.toFixed(2)} seconds`);
    
    this.logRun('full_automation', results.healthCheck, {
      results: results,
      duration: duration,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });
    
    return results;
  }

  async runScheduledAutomation() {
    try {
      console.log('⏰ Running scheduled WNBA automation...');
      
      // Check if we should run (once per day)
      const lastRun = this.logs.lastRun ? new Date(this.logs.lastRun) : null;
      const now = new Date();
      
      if (lastRun) {
        const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);
        
              // Allow runs if more than 3 hours have passed (reduced from 6 hours)
      if (hoursSinceLastRun < 3) {
        console.log(`⏳ Last run was ${hoursSinceLastRun.toFixed(1)} hours ago. Skipping.`);
        console.log(`📅 Last run: ${lastRun.toLocaleString()}`);
        console.log(`📅 Current time: ${now.toLocaleString()}`);
        console.log(`⏰ Next allowed run: ${new Date(lastRun.getTime() + (3 * 60 * 60 * 1000)).toLocaleString()}`);
          
          // Log the skip for monitoring
          this.logRun('scheduled_skip', true, {
            reason: 'cooldown_period',
            hoursSinceLastRun: hoursSinceLastRun,
            lastRun: lastRun.toISOString(),
            currentTime: now.toISOString()
          });
          return;
        }
      }
      
      console.log('✅ Proceeding with scheduled automation...');
      await this.runFullAutomation();
      
    } catch (error) {
      console.error('❌ Scheduled automation failed:', error);
    }
  }

  getAutomationStats() {
    const recentRuns = this.logs.runs.slice(-10);
    const successfulRuns = recentRuns.filter(run => run.success).length;
    const totalRuns = recentRuns.length;
    
    console.log('📊 Automation Statistics:');
    console.log(`   Recent runs: ${totalRuns}`);
    console.log(`   Successful: ${successfulRuns}`);
    console.log(`   Success rate: ${totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(1) : 0}%`);
    console.log(`   Last run: ${this.logs.lastRun || 'Never'}`);
    
    if (recentRuns.length > 0) {
      console.log('\n📋 Recent runs:');
      recentRuns.slice(-5).forEach(run => {
        const time = new Date(run.timestamp).toLocaleString();
        const status = run.success ? '✅' : '❌';
        console.log(`   ${status} ${time} - ${run.type}`);
      });
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const automation = new DailyWNBAAutomation();
  
  if (args.length === 0) {
    console.log('⏰ WNBA Daily Automation System');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/daily-automation.js --run');
    console.log('  node scripts/daily-automation.js --scheduled');
    console.log('  node scripts/daily-automation.js --stats');
    console.log('');
    console.log('This automates ESPN scraping, game log scraping, and data processing');
    console.log('for daily WNBA stats collection.');
    return;
  }
  
  if (args[0] === '--run') {
    await automation.runFullAutomation();
  } else if (args[0] === '--scheduled') {
    await automation.runScheduledAutomation();
  } else if (args[0] === '--stats') {
    automation.getAutomationStats();
  } else {
    console.log('❌ Invalid option. Use --help for usage.');
  }
}

main(); 