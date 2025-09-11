import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';

interface PerformanceLog {
  timestamp: string;
  endpoint: string;
  cacheHit: boolean;
  responseTime: number;
  cacheSize?: number;
  error?: string;
}

interface PerformanceStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  averageResponseTime: number;
  errorRate: number;
  totalErrors: number;
  cacheSize: number;
  endpointBreakdown: { [key: string]: { hits: number; misses: number; avgTime: number } };
}

function getPerformanceLogs(): PerformanceLog[] {
  const logFile = path.join(process.cwd(), 'logs', 'performance.json');
  
  if (!fs.existsSync(logFile)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(logFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading performance logs:', error);
    return [];
  }
}

function logPerformance(log: PerformanceLog) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'performance.json');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Read existing logs or create new array
    let logs: PerformanceLog[] = [];
    if (fs.existsSync(logFile)) {
      try {
        const existingData = fs.readFileSync(logFile, 'utf8');
        logs = JSON.parse(existingData);
      } catch (error) {
        console.error('Error reading existing performance log file:', error);
        logs = [];
      }
    }
    
    // Add new log
    logs.push(log);
    
    // Keep only last 1000 entries to prevent file from growing too large
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    // Write back to file
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    
  } catch (error) {
    console.error('Error logging performance:', error);
  }
}

function calculatePerformanceStats(logs: PerformanceLog[]): PerformanceStats {
  if (logs.length === 0) {
    return {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      averageResponseTime: 0,
      errorRate: 0,
      totalErrors: 0,
      cacheSize: 0,
      endpointBreakdown: {}
    };
  }
  
  const totalRequests = logs.length;
  const cacheHits = logs.filter(log => log.cacheHit).length;
  const cacheMisses = totalRequests - cacheHits;
  const cacheHitRate = (cacheHits / totalRequests) * 100;
  
  const totalResponseTime = logs.reduce((sum, log) => sum + log.responseTime, 0);
  const averageResponseTime = totalResponseTime / totalRequests;
  
  const totalErrors = logs.filter(log => log.error).length;
  const errorRate = (totalErrors / totalRequests) * 100;
  
  // Calculate cache size (average of recent logs)
  const recentLogs = logs.slice(-10);
  const cacheSize = recentLogs.length > 0 
    ? recentLogs.reduce((sum, log) => sum + (log.cacheSize || 0), 0) / recentLogs.length
    : 0;
  
  // Endpoint breakdown
  const endpointBreakdown: { [key: string]: { hits: number; misses: number; avgTime: number } } = {};
  logs.forEach(log => {
    if (!endpointBreakdown[log.endpoint]) {
      endpointBreakdown[log.endpoint] = { hits: 0, misses: 0, avgTime: 0 };
    }
    
    if (log.cacheHit) {
      endpointBreakdown[log.endpoint].hits++;
    } else {
      endpointBreakdown[log.endpoint].misses++;
    }
    
    // Calculate average time for this endpoint
    const endpointLogs = logs.filter(l => l.endpoint === log.endpoint);
    const totalTime = endpointLogs.reduce((sum, l) => sum + l.responseTime, 0);
    endpointBreakdown[log.endpoint].avgTime = totalTime / endpointLogs.length;
  });
  
  return {
    totalRequests,
    cacheHits,
    cacheMisses,
    cacheHitRate,
    averageResponseTime,
    errorRate,
    totalErrors,
    cacheSize: Math.round(cacheSize),
    endpointBreakdown
  };
}

async function getRedisStats() {
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Get Redis info
    const info = await redis.info();
    const keys = await redis.dbsize();
    
    // Parse memory info
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const memoryUsed = memoryMatch ? memoryMatch[1] : 'Unknown';
    
    await redis.disconnect();
    
    return {
      keys,
      memoryUsed,
      connected: true
    };
  } catch (error) {
    console.error('Error getting Redis stats:', error);
    return {
      keys: 0,
      memoryUsed: 'Unknown',
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminToken = searchParams.get('token');
    
    // Simple admin check
    if (adminToken !== 'wnba_admin_2024_secure') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const logs = getPerformanceLogs();
    const stats = calculatePerformanceStats(logs);
    const redisStats = await getRedisStats();
    
    // Generate HTML for recent logs
    const recentLogs = logs.slice(-50).reverse();
    const logsHtml = recentLogs.map((log) => {
      const date = new Date(log.timestamp).toLocaleString();
      const cacheStatus = log.cacheHit ? '✅ Cache Hit' : '❌ Cache Miss';
      const cacheClass = log.cacheHit ? 'success' : 'error';
      
      return `
        <tr class="log-row ${cacheClass}">
          <td>${date}</td>
          <td><code>${log.endpoint}</code></td>
          <td>${cacheStatus}</td>
          <td>${log.responseTime.toFixed(0)}ms</td>
          <td>${log.cacheSize || '-'}</td>
          <td>${log.error || '-'}</td>
        </tr>
      `;
    }).join('');
    
    // Generate HTML for endpoint breakdown
    const endpointHtml = Object.entries(stats.endpointBreakdown)
      .sort(([,a], [,b]) => (b.hits + b.misses) - (a.hits + a.misses))
      .map(([endpoint, data]) => {
        const total = data.hits + data.misses;
        const hitRate = total > 0 ? ((data.hits / total) * 100).toFixed(1) : '0';
        
        return `
          <tr>
            <td><code>${endpoint}</code></td>
            <td>${total}</td>
            <td>${data.hits}</td>
            <td>${data.misses}</td>
            <td>${hitRate}%</td>
            <td>${data.avgTime.toFixed(0)}ms</td>
          </tr>
        `;
      }).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Performance Dashboard</title>
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
          .log-row.success {
            background: #f8fff9;
          }
          .log-row.error {
            background: #fff8f8;
          }
          code {
            background: #f1f3f4;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9em;
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
          .redis-status {
            background: ${redisStats.connected ? '#d4edda' : '#f8d7da'};
            color: ${redisStats.connected ? '#155724' : '#721c24'};
            padding: 15px;
            border-radius: 5px;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚡ Performance Dashboard</h1>
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card success">
              <h3>${stats.totalRequests}</h3>
              <p>Total Requests</p>
            </div>
            <div class="stat-card success">
              <h3>${stats.cacheHits}</h3>
              <p>Cache Hits</p>
            </div>
            <div class="stat-card error">
              <h3>${stats.cacheMisses}</h3>
              <p>Cache Misses</p>
            </div>
            <div class="stat-card info">
              <h3>${stats.cacheHitRate.toFixed(1)}%</h3>
              <p>Cache Hit Rate</p>
            </div>
            <div class="stat-card info">
              <h3>${stats.averageResponseTime.toFixed(0)}ms</h3>
              <p>Avg Response Time</p>
            </div>
            <div class="stat-card ${stats.errorRate > 5 ? 'error' : 'info'}">
              <h3>${stats.errorRate.toFixed(1)}%</h3>
              <p>Error Rate</p>
            </div>
          </div>
          
          <div class="section">
            <h2>🗄️ Redis Status</h2>
            <div class="redis-status">
              <strong>Status:</strong> ${redisStats.connected ? '✅ Connected' : '❌ Disconnected'}<br>
              <strong>Keys:</strong> ${redisStats.keys}<br>
              <strong>Memory Used:</strong> ${redisStats.memoryUsed}<br>
              ${redisStats.error ? `<strong>Error:</strong> ${redisStats.error}` : ''}
            </div>
          </div>
          
          <div class="section">
            <h2>📊 Endpoint Performance</h2>
            <table>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Total Requests</th>
                  <th>Cache Hits</th>
                  <th>Cache Misses</th>
                  <th>Hit Rate</th>
                  <th>Avg Time</th>
                </tr>
              </thead>
              <tbody>
                ${endpointHtml}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <h2>🕒 Recent Requests (Last 50)</h2>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Endpoint</th>
                  <th>Cache Status</th>
                  <th>Response Time</th>
                  <th>Cache Size</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                ${logsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('Error generating performance report:', error);
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error - Performance Dashboard</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #dc3545; }
          .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Error Loading Performance Data</h1>
          <div class="error">
            <p>Failed to load performance data. Please try again.</p>
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

// Note: logPerformance function is available for internal use but not exported as a route 