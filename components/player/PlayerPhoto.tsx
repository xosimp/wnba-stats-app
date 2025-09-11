import React, { useEffect, useState } from 'react';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import { getPlayerImageUrl } from '../../lib/utils/playerImage';

// Helper function to get player ID from player name or ID
function getPlayerId(src: string): string | null {
  // If src is already a number, return it
  if (/^\d+$/.test(src)) {
    return src;
  }
  
  // If src is a player name, we'll need to look it up
  // For now, return null and fall back to file system
  return null;
}

interface PlayerPhotoProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  autoProcess?: boolean;
}

export function PlayerPhoto({ 
  src, 
  alt, 
  size = 'md',
  className = '',
  autoProcess = true 
}: PlayerPhotoProps) {
  const { processedImage, isProcessing, processImage } = useImageProcessing();
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  // Size classes mapping
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-40 h-40'
  };

  useEffect(() => {
    if (!src) {
      setImageSrc('/default-player.png');
      return;
    }

    async function loadImage() {
      if (!src) return;
      
      // Try to get player ID for database lookup
      const playerId = getPlayerId(src);
      
      if (playerId) {
        // Use database image endpoint - load directly without processing for speed
        const imageUrl = `/api/images/player/${playerId}`;
        setImageSrc(imageUrl);
      } else {
        // Fallback to file system for player names
        const imageUrl = src.startsWith('http') || src.startsWith('/') ? src : await getPlayerImageUrl(src);

        if (autoProcess) {
          // Only process file system images, not database images
          processImage(imageUrl, {
            width: size === 'xl' ? 400 : size === 'lg' ? 320 : size === 'md' ? 240 : 160,
            height: size === 'xl' ? 400 : size === 'lg' ? 320 : size === 'md' ? 240 : 160,
            quality: 90,
            format: 'webp'
          });
        } else {
          setImageSrc(imageUrl);
        }
      }
    }

    loadImage();
  }, [src, autoProcess, processImage, size]);

  useEffect(() => {
    if (processedImage) {
      setImageSrc(processedImage);
    }
  }, [processedImage]);

  if (!imageSrc) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-200 animate-pulse flex items-center justify-center ${className}`}>
        {isProcessing && (
          <div className="text-gray-400 text-xs">Processing...</div>
        )}
      </div>
    );
  }

  return (
    <img 
      src={imageSrc} 
      alt={alt || 'Player'} 
      className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      style={{
        background: 'transparent',
        opacity: '100%'
      }}
    />
  );
} 