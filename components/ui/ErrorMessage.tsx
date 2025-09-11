import React from 'react';

export function ErrorMessage({ message }: { message: string }) {
  return <div className="text-red-600">{message}</div>;
} 