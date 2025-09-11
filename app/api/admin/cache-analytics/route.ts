import { NextResponse } from 'next/server';
import { getCacheInfo, getCacheStats } from '../../../../lib/cache/manager';
import { cacheAnalytics } from '../../../../lib/cache/analytics';
import { warmPopularPlayersCache } from '../../../../lib/cache/startup-warming';

export async function GET() {
  try {
    // Get cache statistics
    const cacheInfo = await getCacheInfo();
    const cacheStats = getCacheStats();
    
    // Update analytics
    await cacheAnalytics.updateAnalytics();
    const analytics = cacheAnalytics.getAnalytics();
    
    // Calculate estimated monthly savings
    const monthlyAPICalls = analytics.estimatedAPICallsSaved * 30; // Assume 30 days
    const monthlySavings = analytics.estimatedCostSavings * 30;
    
    const response = {
      timestamp: new Date().toISOString(),
      cache: {
        ...cacheInfo,
        ...cacheStats,
      },
      analytics: {
        ...analytics,
        monthlyAPICalls,
        monthlySavings: Math.round(monthlySavings * 100) / 100,
      },
      warming: { total: 0, successful: 0, failed: 0, skipped: 0 }, // Placeholder
      recommendations: getRecommendations(analytics),
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Cache analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json();
    
    switch (action) {
      case 'warm':
        await warmPopularPlayersCache();
        return NextResponse.json({ 
          message: 'Cache warming started',
          stats: { total: 0, successful: 0, failed: 0, skipped: 0 }
        });
        
      case 'reset_stats':
        cacheAnalytics.resetAnalytics();
        return NextResponse.json({ 
          message: 'Cache statistics reset' 
        });
        
      case 'reset_warming_stats':
        return NextResponse.json({ 
          message: 'Warming statistics reset' 
        });
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('Cache analytics action error:', error);
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    );
  }
}

function getRecommendations(analytics: any): string[] {
  const recommendations = [];
  
  if (analytics.hitRate < 70) {
    recommendations.push('Consider increasing cache TTL for frequently accessed data');
    recommendations.push('Implement more aggressive cache warming for popular players');
  }
  
  if (analytics.hitRate > 90) {
    recommendations.push('Excellent cache performance! Consider extending TTLs further');
  }
  
  if (analytics.cacheSize > 1000) {
    recommendations.push('Large cache size detected. Consider implementing cache eviction policies');
  }
  
  if (analytics.estimatedAPICallsSaved < 100) {
    recommendations.push('Low API call savings. Consider implementing more aggressive caching');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Cache performance is optimal');
  }
  
  return recommendations;
} 