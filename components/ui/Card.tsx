import React from 'react';
import { cn } from '../../lib/utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('bg-primary border border-secondary rounded shadow-md p-4 sm:p-6', className)} {...props} />
  )
);
Card.displayName = 'Card'; 