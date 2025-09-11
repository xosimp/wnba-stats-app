import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface APIHealthLog {
  timestamp: string;
  endpoint: string;
  status: 'success' | 'error' | 'rate_limited';
  responseTime: number;
  error?: string;
}

interface APIHealthStats {
  totalCalls: number;
  successfulCalls: number;
  errorCalls: number;
  rateLimitedCalls: number;
  averageResponseTime: number;
  successRate: number;
  recentErrors: string[];
  endpointBreakdown: { [key: string]: number };
}

function getAPIHealthLogs(): APIHealthLog[] {
  const logFile = path.join(process.cwd(), 'logs', 'api_health.json');
  
  if (!fs.existsSync(logFile)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(logFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading API health logs:', error);
    return [];
  }
}

function logAPIHealth(log: APIHealthLog) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'api_health.json');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Read existing logs or create new array
    let logs: APIHealthLog[] = [];
    if (fs.existsSync(logFile)) {
      try {
        const existingData = fs.readFileSync(logFile, 'utf8');
        logs = JSON.parse(existingData);
      } catch (error) {
        console.error('Error reading existing API health log file:', error);
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
    console.error('Error logging API health:', error);
  }
}

function calculateAPIHealthStats(logs: APIHealthLog[]): APIHealthStats {
  if (logs.length === 0) {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      errorCalls: 0,
      rateLimitedCalls: 0,
      averageResponseTime: 0,
      successRate: 0,
      recentErrors: [],
      endpointBreakdown: {}
    };
  }
  
  const totalCalls = logs.length;
  const successfulCalls = logs.filter(log => log.status === 'success').length;
  const errorCalls = logs.filter(log => log.status === 'error').length;
  const rateLimitedCalls = logs.filter(log => log.status === 'rate_limited').length;
  
  const totalResponseTime = logs.reduce((sum, log) => sum + log.responseTime, 0);
  const averageResponseTime = totalResponseTime / totalCalls;
  
  const successRate = (successfulCalls / totalCalls) * 100;
  
  const recentErrors = logs
    .filter(log => log.status === 'error' && log.error)
    .slice(-10)
    .map(log => log.error!)
    .reverse();
  
  const endpointBreakdown: { [key: string]: number } = {};
  logs.forEach(log => {
    endpointBreakdown[log.endpoint] = (endpointBreakdown[log.endpoint] || 0) + 1;
  });
  
  return {
    totalCalls,
    successfulCalls,
    errorCalls,
    rateLimitedCalls,
    averageResponseTime,
    successRate,
    recentErrors,
    endpointBreakdown
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminToken = searchParams.get('token');
    
    // Simple admin check
    if (adminToken !== 'wnba_admin_2024_secure') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const logs = getAPIHealthLogs();
    const stats = calculateAPIHealthStats(logs);
    
    // Generate HTML for recent logs
    const recentLogs = logs.slice(-50).reverse();
    const logsHtml = recentLogs.map((log) => {
      const date = new Date(log.timestamp).toLocaleString();
      const statusClass = log.status === 'success' ? 'success' : log.status === 'rate_limited' ? 'warning' : 'error';
      const statusText = log.status === 'success' ? '✅ Success' : log.status === 'rate_limited' ? '⚠️ Rate Limited' : '❌ Error';
      
      return `
        <tr class="log-row ${statusClass}">
          <td>${date}</td>
          <td><code>${log.endpoint}</code></td>
          <td>${statusText}</td>
          <td>${log.responseTime.toFixed(0)}ms</td>
          <td>${log.error || '-'}</td>
        </tr>
      `;
    }).join('');
    
    // Generate HTML for endpoint breakdown
    const endpointHtml = Object.entries(stats.endpointBreakdown)
      .sort(([,a], [,b]) => b - a)
      .map(([endpoint, count]) => `
        <tr>
          <td><code>${endpoint}</code></td>
          <td>${count}</td>
        </tr>
      `).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>API Health Monitor</title>
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
          .log-row.warning {
            background: #fffbf0;
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
          .error-list {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin-top: 10px;
          }
          .error-list pre {
            margin: 5px 0;
            font-size: 0.9em;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔌 API Health Monitor</h1>
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card success">
              <h3>${stats.totalCalls}</h3>
              <p>Total API Calls</p>
            </div>
            <div class="stat-card success">
              <h3>${stats.successfulCalls}</h3>
              <p>Successful</p>
            </div>
            <div class="stat-card error">
              <h3>${stats.errorCalls}</h3>
              <p>Errors</p>
            </div>
            <div class="stat-card warning">
              <h3>${stats.rateLimitedCalls}</h3>
              <p>Rate Limited</p>
            </div>
            <div class="stat-card info">
              <h3>${stats.successRate.toFixed(1)}%</h3>
              <p>Success Rate</p>
            </div>
            <div class="stat-card info">
              <h3>${stats.averageResponseTime.toFixed(0)}ms</h3>
              <p>Avg Response Time</p>
            </div>
          </div>
          
          <div class="section">
            <h2>📊 API Endpoint Usage</h2>
            <table>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Call Count</th>
                </tr>
              </thead>
              <tbody>
                ${endpointHtml}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <h2>🕒 Recent API Calls (Last 50)</h2>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Response Time</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                ${logsHtml}
              </tbody>
            </table>
          </div>
          
          ${stats.recentErrors.length > 0 ? `
          <div class="section">
            <h2>❌ Recent Errors</h2>
            <div class="error-list">
              ${stats.recentErrors.map(error => `<pre>${error}</pre>`).join('')}
            </div>
          </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
    
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('Error generating API health report:', error);
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error - API Health Monitor</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #dc3545; }
          .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Error Loading API Health Data</h1>
          <div class="error">
            <p>Failed to load API health data. Please try again.</p>
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

// Note: logAPIHealth function is available for internal use but not exported as a route 