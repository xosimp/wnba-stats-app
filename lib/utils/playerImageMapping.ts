// Player Image Mapping Utility
// Maps player names to their exact image filenames

export const PLAYER_IMAGE_MAPPING: Record<string, string> = {
  // A
  "A'ja Wilson": "aja_wilson_3149391.png",
  "Aaliyah Edwards": "aaliyah_edwards_4433408.png",
  "Aaliyah Nye": "aaliyah_nye_4597509.png",
  "Aari McDonald": "aari_mcdonald_4066553.png",
  "Alanna Smith": "alanna_smith_3913881.png",
  "Alissa Pili": "alissa_pili_5105752.png",
  "Aliyah Boston": "aliyah_boston_4432831.png",
  "Allisha Gray": "allisha_gray_3058901.png",
  "Alysha Clark": "alysha_clark_924.png",
  "Alyssa Thomas": "alyssa_thomas_2529140.png",
  "Anastasiia Olairi Kosu": "anastasiia_olairi_kosu_5278237.png",
  "Aneesah Morrow": "aneesah_morrow_4684384.png",
  "Angel Reese": "angel_reese_4433402.png",
  "Ariel Atkins": "ariel_atkins_3146151.png",
  "Arike Ogunbowale": "arike_ogunbowale_3904577.png",
  "Aziaha James": "aziaha_james_4433807.png",
  "Azura Stevens": "azura_stevens_3142010.png",
  
  // B
  "Breanna Stewart": "breanna_stewart_2998928.png",
  "Bria Hartley": "bria_hartley_2529185.png",
  "Brianna Turner": "brianna_turner_3142086.png",
  
  // C
  "Caitlin Clark": "caitlin_clark_4433403.png",
  
  // G
  "Gabby Williams": "gabby_williams_3142328.png",
  
  // J
  "Jackie Young": "jackie_young_4065870.png",
  "Jewell Loyd": "jewell_loyd_2987869.png",
  
  // S
  "Shakira Austin": "shakira_austin_4398911.png",
  
  // Add more mappings as needed...
};

export function getPlayerImageFilename(playerName: string): string | null {
  // Direct mapping
  if (PLAYER_IMAGE_MAPPING[playerName]) {
    return PLAYER_IMAGE_MAPPING[playerName];
  }
  
  // Try case-insensitive matching
  const lowerPlayerName = playerName.toLowerCase();
  for (const [mappedName, filename] of Object.entries(PLAYER_IMAGE_MAPPING)) {
    if (mappedName.toLowerCase() === lowerPlayerName) {
      return filename;
    }
  }
  
  // Try partial matching
  for (const [mappedName, filename] of Object.entries(PLAYER_IMAGE_MAPPING)) {
    if (mappedName.toLowerCase().includes(lowerPlayerName) || 
        lowerPlayerName.includes(mappedName.toLowerCase())) {
      return filename;
    }
  }
  
  return null;
}

export function generatePossibleFilenames(playerName: string): string[] {
  const possibleNames: string[] = [];
  
  // Try direct mapping first
  const mappedFilename = getPlayerImageFilename(playerName);
  if (mappedFilename) {
    possibleNames.push(mappedFilename);
  }
  
  // Generate variations
  const normalizedName = playerName.toLowerCase()
    .replace(/'/g, '') // Remove apostrophes
    .replace(/\s+/g, '_'); // Replace spaces with underscores
  
  // Common player IDs
  const commonPlayerIds = [
    '4433402', '4433403', '4065870', '2987869', '3149391', '3142328',
    '4433408', '4597509', '4066553', '3913881', '5105752', '4432831',
    '3058901', '924', '2529140', '5278237', '4684384', '3146151',
    '3904577', '4433807', '3142010', '2998928', '2529185', '3142086',
    '4398911'
  ];
  
  // Add variations with player IDs
  for (const id of commonPlayerIds) {
    possibleNames.push(`${normalizedName}_${id}.png`);
  }
  
  // Add variations without player IDs
  possibleNames.push(`${normalizedName}.png`);
  possibleNames.push(normalizedName.replace(/_/g, '') + '.png');
  possibleNames.push(normalizedName.replace(/_/g, '-') + '.png');
  
  return possibleNames;
} 