#!/usr/bin/env node

/**
 * Simple WNBA Team PACE Scraper
 * Focuses on essential PACE data for projections
 */

const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Try multiple .env file locations for cron compatibility
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
} catch (error) {
  try {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  } catch (error2) {
    console.log('No .env files found, using system environment variables');
  }
}

// Initialize Supabase client with better error handling
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Environment check:');
console.log('  Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('  Supabase Key:', supabaseKey ? '✅ Set' : '❌ Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Set' : 'Missing');
  console.error('  Current working directory:', process.cwd());
  console.error('  Script directory:', __dirname);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// WNBA Advanced Stats URL
const WNBA_PACE_URL = 'https://stats.wnba.com/teams/advanced/?dir=-1&sort=PACE';

async function scrapePaceData() {
  let browser;
  try {
    console.log('🚀 Starting Simple WNBA PACE Scraper...\n');
    
    // Launch browser with minimal settings
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('🌐 Navigating to WNBA Advanced Stats page...');
    await page.goto(WNBA_PACE_URL, { 
      waitUntil: 'domcontentloaded',
      timeout: 120000 
    });

    // Wait for table to load
    console.log('⏳ Waiting for stats table...');
    await page.waitForSelector('table', { timeout: 90000 });

    // Extract PACE data
    console.log('📊 Extracting PACE data...');
    const paceData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const teams = [];
      

      
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 18) { // Need at least 18 columns for PACE
          // Try to find team name - it might be in column 1 or 2 when sorted by pace
          let teamName = '';
          for (let i = 0; i < Math.min(5, cells.length); i++) {
            const cellText = cells[i]?.textContent?.trim();
            if (cellText && cellText.length > 3 && !cellText.match(/^\d+$/) && 
                !cellText.match(/^\d+\.\d+$/) && !cellText.match(/^[A-Z]+$/)) {
              teamName = cellText;
              break;
            }
          }
          
          // PACE should be around column 17-18, but let's find it dynamically
          let pace = 0;
          for (let i = 15; i < Math.min(20, cells.length); i++) {
            const cellValue = parseFloat(cells[i]?.textContent);
            if (cellValue && cellValue >= 90 && cellValue <= 100) { // PACE values should be 92-98
              pace = cellValue;
              break;
            }
          }
          
          if (teamName && teamName !== '' && pace > 0) {
            teams.push({
              rank: index + 1,
              team_name: teamName,
              pace: pace
            });
          }
        }
      });
      
      return teams;
    });

    if (paceData.length === 0) {
      throw new Error('No PACE data found');
    }

    console.log(`✅ Found PACE data for ${paceData.length} teams`);
    
    // Display PACE rankings
    console.log('\n🏃‍♀️ Team PACE Rankings:');
    paceData
      .sort((a, b) => b.pace - a.pace)
      .forEach((team, index) => {
        console.log(`  ${index + 1}. ${team.team_name}: ${team.pace} PACE`);
      });

    // Store in database
    console.log('\n💾 Storing PACE data...');
    
    try {
      // Clear existing data
      const { error: deleteError } = await supabase
        .from('team_pace_stats')
        .delete()
        .eq('season', '2025');

      if (deleteError) {
        console.log('⚠️  Error clearing data:', deleteError.message);
      }

      // Insert new data (just PACE for now)
      const insertData = paceData.map(team => ({
        team_name: team.team_name,
        rank: team.rank,
        pace: team.pace,
        season: '2025'
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('team_pace_stats')
        .insert(insertData)
        .select();

      if (insertError) {
        throw new Error(`Insert failed: ${insertError.message}`);
      }

      console.log(`✅ Stored ${inserted.length} team PACE records`);
      
    } catch (dbError) {
      console.log('⚠️  Database storage failed (table may not exist):', dbError.message);
      console.log('📝 To fix this, run the following SQL in your database:');
      console.log(`
        CREATE TABLE team_pace_stats (
          id SERIAL PRIMARY KEY,
          team_name VARCHAR(100) NOT NULL,
          pace DECIMAL(5,2) NOT NULL,
          rank INTEGER NOT NULL,
          season VARCHAR(4) NOT NULL DEFAULT '2025',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_team_pace_stats_season ON team_pace_stats(season);
        CREATE INDEX idx_team_pace_stats_team ON team_pace_stats(team_name);
        ALTER TABLE team_pace_stats ADD CONSTRAINT unique_team_season UNIQUE (team_name, season);
      `);
      
      // Continue execution even if database storage fails
      console.log('✅ PACE scraping completed (data not stored in database)');
    }
    
    // Calculate thresholds for projection system
    const paceValues = paceData.map(t => t.pace);
    const avgPace = paceValues.reduce((sum, pace) => sum + pace, 0) / paceValues.length;
    const stdDev = Math.sqrt(paceValues.reduce((sum, pace) => sum + Math.pow(pace - avgPace, 2), 0) / paceValues.length);
    
    console.log('\n📊 PACE Analysis:');
    console.log(`  - Average: ${avgPace.toFixed(2)}`);
    console.log(`  - High threshold: ${(avgPace + stdDev).toFixed(2)} (+3-5% scoring boost)`);
    console.log(`  - Low threshold: ${(avgPace - stdDev).toFixed(2)} (-2-3% scoring reduction)`);

    console.log('\n🎉 PACE Scraping Complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run if called directly
if (require.main === module) {
  scrapePaceData()
    .then(() => {
      console.log('✅ Success');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { scrapePaceData };
