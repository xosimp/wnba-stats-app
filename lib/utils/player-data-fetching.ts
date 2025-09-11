// TODO: Implement player data fetching utilities
export async function fetchPlayerData(id: string) {
  const [playerRes, statsRes, predictionRes] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/players/${id}`),
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/stats/${id}`),
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/predictions/${id}`),
  ]);
  const playerData = await playerRes.json();
  const statsData = await statsRes.json();
  const predictionData = await predictionRes.json();
  if (!playerData.player) return null;
  return {
    player: playerData.player,
    stats: statsData.stats,
    prediction: predictionData.prediction,
  };
} 