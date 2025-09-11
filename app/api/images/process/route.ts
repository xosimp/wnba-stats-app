import { NextRequest, NextResponse } from 'next/server';
import { removeBackgroundAdvanced, ProcessedImageOptions } from '../../../../lib/utils/image-processing';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, options } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Fetch the image from the provided URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: 400 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process the image to remove background
    const processedBuffer = await removeBackgroundAdvanced(buffer, options as ProcessedImageOptions);

    // Convert to base64 for response
    const base64 = processedBuffer.toString('base64');
    const mimeType = options?.format === 'png' ? 'image/png' : 'image/webp';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      processedImage: dataUrl,
      originalUrl: imageUrl
    });

  } catch (error) {
    console.error('Image processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json(
      { error: 'Image URL is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch the image from the provided URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: 400 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get options from query parameters
    const options: ProcessedImageOptions = {
      width: searchParams.get('width') ? parseInt(searchParams.get('width')!) : 400,
      height: searchParams.get('height') ? parseInt(searchParams.get('height')!) : 400,
      quality: searchParams.get('quality') ? parseInt(searchParams.get('quality')!) : 90,
      format: (searchParams.get('format') as 'webp' | 'png' | 'jpeg') || 'webp'
    };

    // Process the image to remove background
    const processedBuffer = await removeBackgroundAdvanced(buffer, options);

    // Convert to base64 for response
    const base64 = processedBuffer.toString('base64');
    const mimeType = options.format === 'png' ? 'image/png' : 'image/webp';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      processedImage: dataUrl,
      originalUrl: imageUrl
    });

  } catch (error) {
    console.error('Image processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    );
  }
} 