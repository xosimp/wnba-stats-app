import sharp from 'sharp';

export interface ProcessedImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'png' | 'jpeg';
}

/**
 * Removes white/light backgrounds from images and returns a processed image buffer
 * @param imageBuffer - The input image buffer
 * @param options - Processing options
 * @returns Promise<Buffer> - The processed image buffer
 */
export async function removeBackground(
  imageBuffer: Buffer,
  options: ProcessedImageOptions = {}
): Promise<Buffer> {
  const {
    width = 400,
    height = 400,
    quality = 90,
    format = 'webp'
  } = options;

  try {
    // Create a sharp instance from the buffer
    let sharpInstance = sharp(imageBuffer);

    // Resize the image to the specified dimensions
    sharpInstance = sharpInstance.resize(width, height, {
      fit: 'cover',
      position: 'center'
    });

    // Remove white/light background by thresholding
    // This creates a mask where white/light pixels become transparent
    const processed = await sharpInstance
      .removeAlpha() // Remove any existing alpha channel
      .threshold(240) // Convert pixels with value > 240 to white, rest to black
      .negate() // Invert the mask (white becomes black, black becomes white)
      .toFormat('png')
      .png({ quality: 100 })
      .toBuffer();

    // Apply the mask to the original image
    const finalImage = await sharp(imageBuffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .composite([
        {
          input: processed,
          blend: 'dest-in' // Use the mask to control transparency
        }
      ])
      .toFormat(format, { quality })
      .toBuffer();

    return finalImage;
  } catch (error) {
    console.error('Error processing image:', error);
    // Return the original image if processing fails
    return imageBuffer;
  }
}

/**
 * Alternative method using color distance for more precise background removal
 * @param imageBuffer - The input image buffer
 * @param options - Processing options
 * @returns Promise<Buffer> - The processed image buffer
 */
export async function removeBackgroundAdvanced(
  imageBuffer: Buffer,
  options: ProcessedImageOptions = {}
): Promise<Buffer> {
  const {
    width = 400,
    height = 400,
    quality = 90,
    format = 'webp'
  } = options;

  try {
    // Create a sharp instance from the buffer
    let sharpInstance = sharp(imageBuffer);

    // Resize the image to the specified dimensions
    sharpInstance = sharpInstance.resize(width, height, {
      fit: 'cover',
      position: 'center'
    });

    // Get image metadata
    const metadata = await sharpInstance.metadata();
    
    // Process the image to remove white/light backgrounds
    const processed = await sharpInstance
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Create a new buffer with alpha channel
    const { data, info } = processed;
    const newData = Buffer.alloc(info.width * info.height * 4);

    // Process each pixel
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate color distance from white
      const distanceFromWhite = Math.sqrt(
        Math.pow(255 - r, 2) + 
        Math.pow(255 - g, 2) + 
        Math.pow(255 - b, 2)
      );
      
      // If pixel is close to white (distance < 50), make it transparent
      const alpha = distanceFromWhite < 50 ? 0 : 255;
      
      const pixelIndex = (i / 3) * 4;
      newData[pixelIndex] = r;
      newData[pixelIndex + 1] = g;
      newData[pixelIndex + 2] = b;
      newData[pixelIndex + 3] = alpha;
    }

    // Create final image with alpha channel
    const finalImage = await sharp(newData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
    .toFormat(format, { quality })
    .toBuffer();

    return finalImage;
  } catch (error) {
    console.error('Error processing image with advanced method:', error);
    // Return the original image if processing fails
    return imageBuffer;
  }
}

/**
 * Creates a data URL from a buffer
 * @param buffer - The image buffer
 * @param mimeType - The MIME type of the image
 * @returns string - The data URL
 */
export function bufferToDataURL(buffer: Buffer, mimeType: string = 'image/webp'): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Downloads an image from URL and processes it
 * @param imageUrl - The URL of the image to process
 * @param options - Processing options
 * @returns Promise<string> - The processed image as a data URL
 */
export async function processImageFromURL(
  imageUrl: string,
  options: ProcessedImageOptions = {}
): Promise<string> {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process the image
    const processedBuffer = await removeBackgroundAdvanced(buffer, options);
    
    // Convert to data URL
    const mimeType = options.format === 'png' ? 'image/png' : 'image/webp';
    return bufferToDataURL(processedBuffer, mimeType);
  } catch (error) {
    console.error('Error processing image from URL:', error);
    // Return the original URL if processing fails
    return imageUrl;
  }
} 