"use client";
import React from 'react';

export function NavigationMenu({ pathname, className }: { pathname?: string; className?: string }) {
  return (
    <nav className={className}>
      <ul className="flex gap-4 text-base">
        <li><a href="/" className={pathname === '/' ? 'hover:underline text-blue-200 font-bold' : 'hover:underline'}>Home</a></li>
        <li><a href="/players" className={pathname && pathname.startsWith('/players') ? 'hover:underline text-blue-200 font-bold' : 'hover:underline'}>Players</a></li>
      </ul>
    </nav>
  );
} 