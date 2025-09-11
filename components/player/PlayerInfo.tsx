import React from 'react';

export function PlayerInfo({ name, team, position }: { name: string; team?: string; position?: string }) {
  return (
    <div>
      <div className="font-bold text-lg">{name}</div>
      {team && <div className="text-sm text-gray-600">Team: {team}</div>}
      {position && <div className="text-sm text-gray-600">Position: {position}</div>}
    </div>
  );
} 