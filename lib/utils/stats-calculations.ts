// TODO: Implement stats calculation utilities
export function calculateAverage(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
} 