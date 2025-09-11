import { NextRequest, NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerName = searchParams.get('name');
    
    if (!playerName) {
      return NextResponse.json({ error: 'Player name required' }, { status: 400 });
    }

    // Clean the player name
    const cleanName = playerName
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();

    // Read the player_images directory
    const playerImagesDir = path.join(process.cwd(), 'public', 'player_images');
    const files = await readdir(playerImagesDir);
    
    // Find files that match the player name pattern
    const matchingFiles = files.filter(file => {
      const fileName = file.toLowerCase().replace('.png', '');
      return fileName.startsWith(cleanName + '_') || fileName === cleanName;
    });

    if (matchingFiles.length > 0) {
      // Return the first matching file
      const imageUrl = `/player_images/${matchingFiles[0]}`;
      return NextResponse.json({ 
        found: true, 
        imageUrl,
        filename: matchingFiles[0]
      });
    } else {
      return NextResponse.json({ 
        found: false, 
        message: `No image found for player: ${playerName}`,
        searchedName: cleanName
      });
    }

  } catch (error) {
    console.error('Error finding player image:', error);
    return NextResponse.json({ error: 'Failed to find player image' }, { status: 500 });
  }
} 