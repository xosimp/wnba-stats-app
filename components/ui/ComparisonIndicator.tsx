import React from 'react';

export function ComparisonIndicator({ prediction, line }: { prediction: number; line: number }) {
  if (prediction > line) return <span className="text-green-600">▲</span>;
  if (prediction < line) return <span className="text-red-600">▼</span>;
  return <span className="text-gray-500">●</span>;
} 