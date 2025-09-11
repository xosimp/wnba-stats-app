// Utility function to get player images from the public/player_images directory
export async function getPlayerImageUrl(playerName: string): Promise<string> {
  if (!playerName) {
    return '/default-player.png';
  }

  try {
    // Use the complete mapping API
    const response = await fetch(`/api/images/player/${encodeURIComponent(playerName)}`);
    
    if (response.ok) {
      return response.url;
    }
  } catch (error) {
    console.error('Error finding player image:', error);
  }

  // Fallback to default image
  return '/default-player.png';
}

// Alternative: Generate initials for players without images
export function getPlayerInitials(playerName: string): string {
  if (!playerName) return '?';
  
  const names = playerName.split(' ');
  if (names.length >= 2) {
    return `${names[0][0]}${names[1][0]}`.toUpperCase();
  }
  return playerName.substring(0, 2).toUpperCase();
}

// Generate a fallback image URL using a service like DiceBear
export function getFallbackPlayerImage(playerName: string): string {
  if (!playerName) {
    return '/default-player.png';
  }

  // Use DiceBear API to generate consistent avatars based on player name
  const seed = playerName.toLowerCase().replace(/[^a-z]/g, '');
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// Check if a player image exists
export async function checkPlayerImageExists(playerName: string): Promise<boolean> {
  if (!playerName) return false;
  
  try {
    const response = await fetch(`/api/player-image/find?name=${encodeURIComponent(playerName)}`);
    const data = await response.json();
    return data.found;
  } catch (error) {
    return false;
  }
}

// Get the actual filename from the player_images directory
export async function getActualPlayerImageFilename(playerName: string): Promise<string | null> {
  if (!playerName) return null;
  
  const cleanName = playerName
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
  
  try {
    // This would need to be implemented server-side to read the directory
    // For now, we'll use the pattern we know works
    return `/player_images/${cleanName}_*.png`;
  } catch (error) {
    return null;
  }
} 