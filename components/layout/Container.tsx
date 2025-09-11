import React from 'react';
import { cn } from '../../lib/utils/cn';

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 w-full', className)} {...props} />
  );
} 