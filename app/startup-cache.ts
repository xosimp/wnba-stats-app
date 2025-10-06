import { warmPopularPlayersCache } from '../lib/cache/startup-warming';

// This function will be called during app startup
export async function initializeAppCache() {
  // Only run on server-side
  if (typeof window === 'undefined') {
    try {
      console.log('🚀 Initializing app cache in background...');
      // Run cache warming in background without blocking
      warmPopularPlayersCache().catch(error => {
        console.error('❌ App cache initialization failed:', error);
      });
      console.log('✅ App cache initialization started (non-blocking)');
    } catch (error) {
      console.error('❌ App cache initialization failed:', error);
    }
  }
}

// Note: Auto-initialization removed to prevent module initialization issues
// Call initializeAppCache() manually when needed 