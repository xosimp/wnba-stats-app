import React from 'react';
import { GameLogRow } from './GameLogRow';

export function StatsTable({ games }: { games: any[] }) {
  if (!games.length) return <div>No games available.</div>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th>Date</th>
          <th>PTS</th>
          <th>REB</th>
          <th>AST</th>
        </tr>
      </thead>
      <tbody>
        {games.map((g, i) => <GameLogRow key={i} game={g} />)}
      </tbody>
    </table>
  );
} 