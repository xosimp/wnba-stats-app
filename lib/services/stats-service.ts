export async function getPlayerStats(playerId: string) {
  const res = await fetch(`/api/stats/${playerId}`);
  const data = await res.json();
  return data.stats || null;
} 