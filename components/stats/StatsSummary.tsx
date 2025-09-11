import React from 'react';

export function StatsSummary({ averages }: { averages: Record<string, number> }) {
  return (
    <div className="flex gap-4">
      <div>PTS: <span className="font-bold">{averages.points}</span></div>
      <div>REB: <span className="font-bold">{averages.rebounds}</span></div>
      <div>AST: <span className="font-bold">{averages.assists}</span></div>
    </div>
  );
} 