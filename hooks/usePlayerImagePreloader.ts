import { useEffect, useState } from 'react';

interface Player {
  id: number;
  name: string;
  team: string;
}

interface PreloadStatus {
  total: number;
  loaded: number;
  failed: number;
  isComplete: boolean;
}

export function usePlayerImagePreloader() {
  const [status, setStatus] = useState<PreloadStatus>({
    total: 0,
    loaded: 0,
    failed: 0,
    isComplete: false
  });

  const [isPreloading, setIsPreloading] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const preloadAllPlayerImages = async (isRetry = false) => {
    if (isPreloading && !isRetry) return;
    
    console.log(`🚀 ${isRetry ? 'Retrying' : 'Starting'} player image preloading... (attempt ${retryCount + 1})`);
    setIsPreloading(true);
    setStartTime(Date.now());
    setStatus({ total: 0, loaded: 0, failed: 0, isComplete: false });

    try {
      // Fetch all players with retry logic
      console.log('📡 Fetching players from API...');
      const response = await fetch('/api/players/all', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const players = data.players || [];
      
      console.log(`📊 Found ${players.length} players to preload`);
      
      if (players.length === 0) {
        console.log('⚠️ No players found, completing preload');
        setStatus({ total: 0, loaded: 0, failed: 0, isComplete: true });
        setIsPreloading(false);
        return;
      }

      setStatus(prev => ({ ...prev, total: players.length }));
      console.log(`🎯 Starting to preload ${players.length} player images...`);

      // Preload images in batches to avoid overwhelming the browser
      const batchSize = 5; // Reduced batch size for more visible progress
      const batches = [];
      
      for (let i = 0; i < players.length; i += batchSize) {
        batches.push(players.slice(i, i + batchSize));
      }

      console.log(`📦 Processing ${batches.length} batches of ${batchSize} players each`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} players`);
        
        await Promise.allSettled(
          batch.map(async (player: Player) => {
            try {
              const img = new Image();
              
              return new Promise<void>((resolve, reject) => {
                img.onload = () => {
                  console.log(`✅ Loaded image for ${player.name}`);
                  setStatus(prev => ({ ...prev, loaded: prev.loaded + 1 }));
                  resolve();
                };
                
                img.onerror = () => {
                  console.log(`❌ Failed to load image for ${player.name}`);
                  setStatus(prev => ({ ...prev, failed: prev.failed + 1 }));
                  resolve(); // Don't reject, just count as failed
                };
                
                // Set source to trigger loading
                const imageUrl = `/api/images/player/${encodeURIComponent(player.name)}`;
                console.log(`🖼️ Loading image for ${player.name} from: ${imageUrl}`);
                img.src = imageUrl;
              });
            } catch (error) {
              console.log(`💥 Exception loading image for ${player.name}:`, error);
              setStatus(prev => ({ ...prev, failed: prev.failed + 1 }));
            }
          })
        );
        
        // Longer delay between batches to make progress more visible
        if (batchIndex < batches.length - 1) {
          console.log(`⏳ Waiting 200ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log('🎉 Player image preloading completed!');
      setStatus(prev => ({ ...prev, isComplete: true }));
      
      // Mark that we've preloaded images this session
      try {
        sessionStorage.setItem('player_images_preloaded', 'true');
        console.log('💾 Marked images as preloaded for this session');
      } catch (error) {
        console.warn('⚠️ Could not save preload status to sessionStorage:', error);
      }
      
      // Ensure minimum display time of 2 seconds so users can see the progress
      const elapsed = Date.now() - (startTime || 0);
      const minDisplayTime = 2000; // 2 seconds
      
      if (elapsed < minDisplayTime) {
        const remainingTime = minDisplayTime - elapsed;
        console.log(`⏰ Waiting ${remainingTime}ms to ensure minimum display time...`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
    } catch (error) {
      console.error('💥 Error preloading player images:', error);
      
      // Retry logic for server startup issues
      if (retryCount < 3 && (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')))) {
        console.log(`🔄 Retrying in 2 seconds... (${retryCount + 1}/3)`);
        setRetryCount(prev => prev + 1);
        
        setTimeout(() => {
          preloadAllPlayerImages(true);
        }, 2000);
        
        return;
      }
      
      setStatus(prev => ({ ...prev, isComplete: true }));
    } finally {
      if (retryCount >= 3 || !isPreloading) {
        console.log('🏁 Preloading finished, setting isPreloading to false');
        setIsPreloading(false);
      }
    }
  };

  // Auto-start preloading when hook is used, with a small delay to ensure server is ready
  useEffect(() => {
    // Check if we've already preloaded images this session
    const hasPreloadedThisSession = sessionStorage.getItem('player_images_preloaded');
    
    if (hasPreloadedThisSession === 'true') {
      console.log('🔄 Images already preloaded this session, skipping...');
      setStatus(prev => ({ 
        ...prev, 
        isPreloading: false, 
        total: 0, 
        loaded: 0, 
        failed: 0, 
        progress: '100.0%',
        isComplete: true
      }));
      return;
    }

    console.log('🪝 usePlayerImagePreloader hook initialized, starting preload in 1 second...');
    const timer = setTimeout(() => {
      preloadAllPlayerImages();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const progress = status.total > 0 ? (status.loaded / status.total) * 100 : 0;
  
  console.log('📊 Preloader state:', { 
    isPreloading, 
    total: status.total, 
    loaded: status.loaded, 
    failed: status.failed, 
    progress: progress.toFixed(1) + '%',
    isComplete: status.isComplete,
    retryCount
  });

  // Function to manually clear session preload flag (useful for testing or force refresh)
  const clearPreloadSession = () => {
    try {
      sessionStorage.removeItem('player_images_preloaded');
      console.log('🧹 Cleared preload session flag');
    } catch (error) {
      console.warn('⚠️ Could not clear preload session flag:', error);
    }
  };

  // Function to check if images are already cached
  const checkImageCache = async (playerName: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);  // Image is cached
      img.onerror = () => resolve(false); // Image is not cached
      img.src = `/api/images/player/${encodeURIComponent(playerName)}`;
      setTimeout(() => resolve(false), 100); // Timeout fallback
    });
  };

  return {
    status,
    isPreloading,
    preloadAllPlayerImages,
    progress,
    clearPreloadSession,
    checkImageCache
  };
}
