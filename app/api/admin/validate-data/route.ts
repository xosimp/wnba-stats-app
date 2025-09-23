import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';

interface ValidationIssue {
  type: 'missing_image' | 'missing_stats' | 'invalid_data' | 'cache_issue';
  severity: 'low' | 'medium' | 'high';
  message: string;
  playerId?: string;
  playerName?: string;
  details?: string;
}

interface ValidationResult {
  totalIssues: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  issues: ValidationIssue[];
  summary: {
    totalPlayers: number;
    playersWithImages: number;
    playersWithStats: number;
    cacheKeys: number;
    missingImages: number;
    missingStats: number;
  };
}

async function validatePlayerImages(): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const imageDir = path.join(process.cwd(), 'public', 'player_images');
  
  if (!fs.existsSync(imageDir)) {
    issues.push({
      type: 'missing_image',
      severity: 'high',
      message: 'Player images directory does not exist',
      details: `Expected directory: ${imageDir}`
    });
    return issues;
  }
  
  try {
    const files = fs.readdirSync(imageDir);
    const imageFiles = files.filter(file => file.endsWith('.png'));
    
    // Check if we have any images at all
    if (imageFiles.length === 0) {
      issues.push({
        type: 'missing_image',
        severity: 'high',
        message: 'No player images found',
        details: `Directory exists but contains no PNG files`
      });
    }
    
    // Check for common missing players (based on popular searches)
    const popularPlayers = [
      { id: '3149391', name: "A'ja Wilson" },
      { id: '4433402', name: 'Angel Reese' },
      { id: '4693825', name: 'Caitlin Clark' }
    ];
    
    for (const player of popularPlayers) {
      const expectedImage = `${player.name.replace(/ /g, '_').replace(/'/g, '').toLowerCase()}_${player.id}.png`;
      if (!imageFiles.includes(expectedImage)) {
        issues.push({
          type: 'missing_image',
          severity: 'medium',
          message: `Missing image for popular player: ${player.name}`,
          playerId: player.id,
          playerName: player.name,
          details: `Expected file: ${expectedImage}`
        });
      }
    }
    
  } catch (error) {
    issues.push({
      type: 'missing_image',
      severity: 'high',
      message: 'Error reading player images directory',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  return issues;
}

async function validateCacheData(): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  
  try {
    let redis = null;
    try {
      redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        retryDelayOnFailover: 0,
        enableReadyCheck: false,
        connectTimeout: 1000,
        commandTimeout: 1000,
      });
      
      // Handle connection errors silently
      redis.on('error', (err) => {
        if (err.message.includes('ECONNREFUSED')) {
          redis = null;
        }
      });
    } catch (error) {
      console.log('Redis not available, continuing without cache');
      redis = null;
    }
    
    // Check Redis connection
    if (redis) {
      try {
        await redis.ping();
      } catch (error) {
        issues.push({
          type: 'cache_issue',
          severity: 'high',
          message: 'Redis connection failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
        await redis.disconnect();
        return issues;
      }
    } else {
      issues.push({
        type: 'cache_issue',
        severity: 'medium',
        message: 'Redis not available',
        details: 'Redis connection could not be established'
      });
      return issues;
    }
    
    // Check for player stats cache keys
    const playerKeys = await redis.keys('wnba:player:*');
    const scheduleKeys = await redis.keys('wnba:schedule:*');
    
    if (playerKeys.length === 0) {
      issues.push({
        type: 'cache_issue',
        severity: 'medium',
        message: 'No player stats found in cache',
        details: 'This might indicate the cache is empty or keys are using a different pattern'
      });
    }
    
    if (scheduleKeys.length === 0) {
      issues.push({
        type: 'cache_issue',
        severity: 'medium',
        message: 'No schedule data found in cache',
        details: 'This might indicate the cache is empty or keys are using a different pattern'
      });
    }
    
    // Check TTL for some keys
    if (playerKeys.length > 0) {
      const sampleKey = playerKeys[0];
      const ttl = await redis.ttl(sampleKey);
      
      if (ttl === -1) {
        issues.push({
          type: 'cache_issue',
          severity: 'low',
          message: 'Some cache keys have no expiration',
          details: `Key ${sampleKey} has no TTL set`
        });
      }
    }
    
    if (redis) {
      await redis.disconnect();
    }
    
  } catch (error) {
    issues.push({
      type: 'cache_issue',
      severity: 'high',
      message: 'Error validating cache data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  return issues;
}

async function validateLogFiles(): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const logDir = path.join(process.cwd(), 'logs');
  
  if (!fs.existsSync(logDir)) {
    issues.push({
      type: 'invalid_data',
      severity: 'low',
      message: 'Logs directory does not exist',
      details: 'No logs are being generated'
    });
    return issues;
  }
  
  const expectedLogFiles = [
    'player_searches.json',
    'api_health.json',
    'performance.json'
  ];
  
  for (const logFile of expectedLogFiles) {
    const logPath = path.join(logDir, logFile);
    if (!fs.existsSync(logPath)) {
      issues.push({
        type: 'invalid_data',
        severity: 'low',
        message: `Log file not found: ${logFile}`,
        details: `Expected file: ${logPath}`
      });
    }
  }
  
  return issues;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminToken = searchParams.get('token');
    
    // Simple admin check
    if (adminToken !== 'wnba_admin_2024_secure') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Run all validations
    const imageIssues = await validatePlayerImages();
    const cacheIssues = await validateCacheData();
    const logIssues = await validateLogFiles();
    
    const allIssues = [...imageIssues, ...cacheIssues, ...logIssues];
    
    // Calculate summary
    const highPriority = allIssues.filter(issue => issue.severity === 'high').length;
    const mediumPriority = allIssues.filter(issue => issue.severity === 'medium').length;
    const lowPriority = allIssues.filter(issue => issue.severity === 'low').length;
    
    // Generate summary stats
    const imageDir = path.join(process.cwd(), 'public', 'player_images');
    const imageFiles = fs.existsSync(imageDir) ? fs.readdirSync(imageDir).filter(f => f.endsWith('.png')).length : 0;
    
    const summary = {
      totalPlayers: 0, // Would need to fetch from API to get actual count
      playersWithImages: imageFiles,
      playersWithStats: 0, // Would need to check cache
      cacheKeys: 0, // Would need to check Redis
      missingImages: imageIssues.filter(i => i.type === 'missing_image').length,
      missingStats: cacheIssues.filter(i => i.type === 'cache_issue').length
    };
    
    const result: ValidationResult = {
      totalIssues: allIssues.length,
      highPriority,
      mediumPriority,
      lowPriority,
      issues: allIssues,
      summary
    };
    
    // Generate HTML
    const issuesHtml = allIssues.map((issue, index) => {
      const severityClass = issue.severity === 'high' ? 'error' : issue.severity === 'medium' ? 'warning' : 'info';
      const severityIcon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🔵';
      
      return `
        <tr class="issue-row ${severityClass}">
          <td>${severityIcon} ${issue.severity.toUpperCase()}</td>
          <td>${issue.message}</td>
          <td>${issue.playerName || '-'}</td>
          <td>${issue.playerId || '-'}</td>
          <td>${issue.details || '-'}</td>
        </tr>
      `;
    }).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Data Validation Tool</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            background: #f8f9fa; 
            color: #333;
          }
          .container { 
            max-width: 1400px; 
            margin: 0 auto; 
            padding: 20px;
          }
          .header { 
            background: white; 
            padding: 30px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            margin-bottom: 20px;
          }
          h1 { 
            color: #2c3e50; 
            margin: 0 0 20px 0; 
            font-size: 2.5em;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          .stat-card {
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            color: white;
          }
          .stat-card.success { background: #28a745; }
          .stat-card.warning { background: #ffc107; color: #333; }
          .stat-card.error { background: #dc3545; }
          .stat-card.info { background: #007bff; }
          .stat-card h3 {
            margin: 0 0 10px 0;
            font-size: 2em;
          }
          .stat-card p {
            margin: 0;
            opacity: 0.9;
          }
          .section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          .section h2 {
            color: #2c3e50;
            margin: 0 0 20px 0;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
          }
          th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
          }
          .issue-row.error {
            background: #fff8f8;
          }
          .issue-row.warning {
            background: #fffbf0;
          }
          .issue-row.info {
            background: #f8f9fa;
          }
          .refresh-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            margin-bottom: 20px;
          }
          .refresh-btn:hover {
            background: #218838;
          }
          .no-issues {
            background: #d4edda;
            color: #155724;
            padding: 20px;
            border-radius: 5px;
            text-align: center;
            font-size: 1.2em;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔍 Data Validation Tool</h1>
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card ${result.totalIssues === 0 ? 'success' : 'error'}">
              <h3>${result.totalIssues}</h3>
              <p>Total Issues</p>
            </div>
            <div class="stat-card error">
              <h3>${result.highPriority}</h3>
              <p>High Priority</p>
            </div>
            <div class="stat-card warning">
              <h3>${result.mediumPriority}</h3>
              <p>Medium Priority</p>
            </div>
            <div class="stat-card info">
              <h3>${result.lowPriority}</h3>
              <p>Low Priority</p>
            </div>
            <div class="stat-card info">
              <h3>${result.summary.playersWithImages}</h3>
              <p>Player Images</p>
            </div>
            <div class="stat-card info">
              <h3>${result.summary.missingImages}</h3>
              <p>Missing Images</p>
            </div>
          </div>
          
          <div class="section">
            <h2>📊 Data Summary</h2>
            <p><strong>Player Images:</strong> ${result.summary.playersWithImages} found</p>
            <p><strong>Missing Images:</strong> ${result.summary.missingImages} issues</p>
            <p><strong>Cache Issues:</strong> ${result.summary.missingStats} detected</p>
          </div>
          
          <div class="section">
            <h2>🚨 Validation Issues</h2>
            ${result.totalIssues === 0 ? 
              '<div class="no-issues">✅ No issues found! Your data looks good.</div>' :
              `<table>
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Issue</th>
                    <th>Player Name</th>
                    <th>Player ID</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  ${issuesHtml}
                </tbody>
              </table>`
            }
          </div>
        </div>
      </body>
      </html>
    `;
    
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('Error running data validation:', error);
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error - Data Validation</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #dc3545; }
          .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Error Running Data Validation</h1>
          <div class="error">
            <p>Failed to run data validation. Please try again.</p>
            <p>Error: ${error}</p>
          </div>
        </div>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
} 