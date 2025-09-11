// Basic cache manager for WNBA stats app
export interface CacheInfo {
  status: string;
  size: number;
  hitRate: number;
  lastUpdated: string;
}

export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
}

let cacheStats = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  averageResponseTime: 0,
  lastUpdated: new Date().toISOString()
};

export async function getCacheInfo(): Promise<CacheInfo> {
  return {
    status: 'active',
    size: 0,
    hitRate: 0,
    lastUpdated: new Date().toISOString()
  };
}

export function getCacheStats(): CacheStats {
  return cacheStats;
}

export function updateCacheStats(hit: boolean, responseTime: number) {
  cacheStats.totalRequests++;
  if (hit) {
    cacheStats.cacheHits++;
  } else {
    cacheStats.cacheMisses++;
  }
  
  // Update average response time
  const total = cacheStats.totalRequests;
  cacheStats.averageResponseTime = 
    ((cacheStats.averageResponseTime * (total - 1)) + responseTime) / total;
  
  cacheStats.lastUpdated = new Date().toISOString();
}
