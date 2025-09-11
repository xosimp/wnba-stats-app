import React from 'react';

export function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <div className="max-w-2xl mx-auto p-4">{children}</div>;
} 