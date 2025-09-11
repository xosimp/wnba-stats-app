import React from 'react';

export function SearchResults({ results }: { results: any[] }) {
  if (!results.length) return null;
  return (
    <ul className="bg-white rounded shadow divide-y">
      {results.map(player => (
        <li key={player.id} className="p-2 hover:bg-blue-50 cursor-pointer">
          {player.name} {player.team && <span className="text-xs text-gray-500">({player.team})</span>}
        </li>
      ))}
    </ul>
  );
} 