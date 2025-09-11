import React from 'react';

export function GameLogRow({ game }: { game: any }) {
  return (
    <tr className="text-center">
      <td>{game.date}</td>
      <td>{game.points}</td>
      <td>{game.rebounds}</td>
      <td>{game.assists}</td>
    </tr>
  );
} 