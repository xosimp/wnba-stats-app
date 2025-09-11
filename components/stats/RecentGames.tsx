import React from 'react';

export function RecentGames({ games }: { games: any[] }) {
  if (!games.length) return <div>No recent games.</div>;
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
        {games.map((g, i) => (
          <tr key={i} className="text-center">
            <td>{g.date}</td>
            <td>{g.points}</td>
            <td>{g.rebounds}</td>
            <td>{g.assists}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
} 