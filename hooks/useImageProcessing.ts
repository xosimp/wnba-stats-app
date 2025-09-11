import { useState, useCallback } from 'react';

export interface ProcessedImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'png' | 'jpeg';
}

export interface UseImageProcessingReturn {
  processedImage: string | null;
  isProcessing: boolean;
  error: string | null;
  processImage: (imageUrl: string, options?: ProcessedImageOptions) => Promise<void>;
  reset: () => void;
}

export function useImageProcessing(): UseImageProcessingReturn {
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(async (
    imageUrl: string,
    options: ProcessedImageOptions = {}
  ) => {
    if (!imageUrl) {
      setError('Image URL is required');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessedImage(null);

    try {
      // Call the API endpoint to process the image
      const response = await fetch('/api/images/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          options: {
            width: options.width || 400,
            height: options.height || 400,
            quality: options.quality || 90,
            format: options.format || 'webp'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process image');
      }

      const data = await response.json();
      
      if (data.success && data.processedImage) {
        setProcessedImage(data.processedImage);
      } else {
        throw new Error('Failed to process image');
      }
    } catch (err) {
      console.error('Image processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process image');
      // Fallback to original image URL
      setProcessedImage(imageUrl);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProcessedImage(null);
    setIsProcessing(false);
    setError(null);
  }, []);

  return {
    processedImage,
    isProcessing,
    error,
    processImage,
    reset
  };
} 