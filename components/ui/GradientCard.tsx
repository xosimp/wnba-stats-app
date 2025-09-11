import React from 'react';

interface GradientCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GradientCard({ children, className = '' }: GradientCardProps) {
  return (
    <div 
      className={`rounded-xl p-6 shadow-lg w-[200px] h-[200px] ${className}`}
      style={{
        background: 'linear-gradient(135deg, #71FD08 0%, #5CD607 40%, #14171F 90%)',
        border: '2px solid #71FD08',
        borderRadius: '12px',
        padding: '24px',
        width: '200px',
        height: '200px',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 2px 8px 0 rgba(113, 253, 8, 0.15)'
      }}
    >
      {children}
    </div>
  );
} 