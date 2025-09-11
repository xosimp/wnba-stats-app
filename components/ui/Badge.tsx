import React from 'react';

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs font-semibold">{children}</span>;
} 