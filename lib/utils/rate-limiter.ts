// Simple in-memory rate limiter (for demonstration only)
const requests: Record<string, number[]> = {};

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (!requests[key]) requests[key] = [];
  requests[key] = requests[key].filter(ts => now - ts < windowMs);
  if (requests[key].length >= limit) return false;
  requests[key].push(now);
  return true;
} 