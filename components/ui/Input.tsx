import React from 'react';
import { cn } from '../../lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-secondary text-primary',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          className
        )}
        disabled={disabled}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input'; 