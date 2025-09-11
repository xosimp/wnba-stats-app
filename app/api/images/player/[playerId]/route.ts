import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    console.log('Looking for player image:', playerId);

    // Get player image from database using player name
    const { data: playerImage, error } = await supabase
      .from('player_images')
      .select('image_data, image_type, image_url')
      .eq('player_name', playerId)
      .single();

    if (error || !playerImage) {
      // Import complete player mapping
      const { COMPLETE_PLAYER_MAPPING } = await import('../../../../../lib/utils/completePlayerMapping');
      
      // Direct mapping for all 153 players
      const playerMappings = COMPLETE_PLAYER_MAPPING;
      
      // Try direct mapping first
      if (playerMappings[playerId]) {
        const imagePath = `/player_images/${playerMappings[playerId]}`;
        try {
          const response = await fetch(`${request.nextUrl.origin}${imagePath}`);
          if (response.ok) {
            console.log('Found image via direct mapping:', imagePath);
            return NextResponse.redirect(new URL(imagePath, request.url));
          }
        } catch (e) {
          // Continue to fallback
        }
      }
      
      // Try case-insensitive matching
      const lowerPlayerId = playerId.toLowerCase();
      for (const [mappedName, filename] of Object.entries(playerMappings)) {
        if (mappedName.toLowerCase() === lowerPlayerId) {
          const imagePath = `/player_images/${filename}`;
          try {
            const response = await fetch(`${request.nextUrl.origin}${imagePath}`);
            if (response.ok) {
              console.log('Found image via case-insensitive mapping:', imagePath);
              return NextResponse.redirect(new URL(imagePath, request.url));
            }
          } catch (e) {
            // Continue to fallback
          }
        }
      }
      
      // Fallback to default image
      return NextResponse.redirect(new URL('/player_images/jewell_loyd_2987869.png', request.url));
    }

    // Return the image data
    const response = new NextResponse(playerImage.image_data);
    response.headers.set('Content-Type', `image/${playerImage.image_type || 'png'}`);
    response.headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    response.headers.set('Access-Control-Allow-Origin', '*');

    return response;
  } catch (error) {
    console.error('Error serving player image:', error);
    return NextResponse.redirect(new URL('/default-player.png', request.url));
  }
} 