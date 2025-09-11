'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface LeagueToggleProps {
  selectedLeague: 'WNBA' | 'NBA';
  onLeagueChange: (league: 'WNBA' | 'NBA') => void;
  className?: string;
}

export function LeagueToggle({ selectedLeague, onLeagueChange, className = '' }: LeagueToggleProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className="relative flex rounded-lg p-1"
        style={{
          background: '#14171F',
          borderRadius: '8px',
          padding: '4px',
          border: '1px solid #71FD08'
        }}
      >
        {/* Background slider */}
        <motion.div
          className="absolute top-1 bottom-1 bg-green-500 rounded-md"
          style={{
            background: '#71FD08',
            borderRadius: '6px',
            zIndex: 1
          }}
          initial={false}
          animate={{
            x: selectedLeague === 'WNBA' ? 0 : '50%',
            width: '50%'
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30
          }}
        />
        
        {/* WNBA Button */}
        <button
          onClick={() => onLeagueChange('WNBA')}
          className="relative z-10 px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
          style={{
            padding: '6px 12px',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: '6px',
            fontFamily: 'Lexend, Arial, sans-serif',
            color: selectedLeague === 'WNBA' ? '#71FD08' : '#9ca3af',
            transition: 'color 0.2s ease',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            minWidth: '60px'
          }}
        >
          WNBA
        </button>
        
        {/* NBA Button */}
        <button
          onClick={() => onLeagueChange('NBA')}
          className="relative z-10 px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
          style={{
            padding: '6px 12px',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: '6px',
            fontFamily: 'Lexend, Arial, sans-serif',
            color: selectedLeague === 'NBA' ? '#71FD08' : '#9ca3af',
            transition: 'color 0.2s ease',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            minWidth: '60px'
          }}
        >
          NBA
        </button>
      </div>
    </div>
  );
}
