export async function getSportsbookLines() {
  const res = await fetch('/api/sportsbook/lines');
  const data = await res.json();
  return data.lines || [];
} 