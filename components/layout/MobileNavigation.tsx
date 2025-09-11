"use client";
import React from 'react';
import { usePathname } from 'next/navigation';

export function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow flex justify-around py-2 z-50 sm:hidden">
      <a href="/" className={pathname === '/' ? 'text-blue-700 font-semibold' : 'text-gray-700'}>Home</a>
      <a href="/players" className={pathname?.startsWith('/players') ? 'text-blue-700 font-semibold' : 'text-gray-700'}>Players</a>
    </nav>
  );
} 