import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const playerName = decodeURIComponent(name);
    
    if (!playerName) {
      return new NextResponse('Player name required', { status: 400 });
    }

    // Clean the player name
    const cleanName = playerName
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, '-')
      .trim();

    // Generate a consistent avatar using DiceBear API
    const seed = cleanName.replace(/[^a-z]/g, '');
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&mouth=smile&style=circle`;

    // Fetch the avatar from DiceBear
    const response = await fetch(avatarUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch avatar');
    }

    const svgContent = await response.text();

    // Return the SVG with proper headers
    return new NextResponse(svgContent, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });

  } catch (error) {
    console.error('Error generating player image:', error);
    
    // Return a default avatar as fallback
    const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=default&backgroundColor=b6e3f4&mouth=smile&style=circle`;
    
    try {
      const response = await fetch(defaultAvatar);
      const svgContent = await response.text();
      
      return new NextResponse(svgContent, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    } catch (fallbackError) {
      console.error('Fallback avatar failed:', fallbackError);
      return new NextResponse('Player image not available', { status: 404 });
    }
  }
} 