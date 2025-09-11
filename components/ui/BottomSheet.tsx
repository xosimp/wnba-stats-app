import React from 'react';

export function BottomSheet({ children }: { children: React.ReactNode }) {
  return <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-lg shadow-lg p-4">{children}</div>;
} 