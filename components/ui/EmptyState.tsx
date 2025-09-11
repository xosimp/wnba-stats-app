import React from 'react';

export function EmptyState({ message }: { message?: string }) {
  return <div className="text-gray-500">{message || 'No data available.'}</div>;
} 