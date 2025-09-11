import React from 'react';
import { cn } from '../../lib/utils/cn';

export function LoadingSkeleton({ className, width = '100%', height = '1.5rem' }: { className?: string; width?: string | number; height?: string | number }) {
  return <div className={cn('animate-pulse bg-gray-200 rounded', className)} style={{ width, height }} />;
} 