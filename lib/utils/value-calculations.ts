// TODO: Implement value bet calculation utilities
export function calculateValue(prediction: number, line: number, odds: number) {
  return {
    diff: prediction - line,
    isValueBet: prediction - line > 2 && odds > -120,
  };
} 