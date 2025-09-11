'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeagueSideBannerProps {
  selectedLeague: 'WNBA' | 'NBA';
  onLeagueChange: (league: 'WNBA' | 'NBA') => void;
  hasPlayerResults?: boolean;
}

export function LeagueSideBanner({ selectedLeague, onLeagueChange, hasPlayerResults = false }: LeagueSideBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLeagueSelect = (league: 'WNBA' | 'NBA') => {
    onLeagueChange(league);
    setIsExpanded(false);
  };

  return (
    <div
      className="fixed z-50"
      style={{
        right: '20px',
        top: 'calc(50% - 244px)',
        transform: 'translateY(-50%)',
        zIndex: 50
      }}
    >
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex flex-col gap-2"
            style={{
              background: '#14171F',
              borderRadius: '16px',
              padding: '8px 12px',
              border: '2px solid #71FD08',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(113, 253, 8, 0.1)',
              minWidth: '120px',
              marginTop: '25px'
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setIsExpanded(false)}
              className="self-end mb-2"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#71FD08';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#9ca3af';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* League options */}
            <button
              onClick={() => handleLeagueSelect('WNBA')}
              className="px-4 py-2 transition-all duration-200"
              style={{
                background: selectedLeague === 'WNBA' ? '#71FD08' : 'transparent',
                color: selectedLeague === 'WNBA' ? '#111' : '#71FD08',
                border: selectedLeague === 'WNBA' ? 'none' : '1px solid #71FD08',
                borderRadius: '8px',
                fontFamily: 'Lexend, Arial, sans-serif',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                marginBottom: '8px'
              }}
              onMouseEnter={(e) => {
                if (selectedLeague !== 'WNBA') {
                  e.currentTarget.style.background = 'rgba(113, 253, 8, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedLeague !== 'WNBA') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              WNBA
            </button>

            <button
              onClick={() => handleLeagueSelect('NBA')}
              className="px-4 py-2 transition-all duration-200"
              style={{
                background: selectedLeague === 'NBA' ? '#71FD08' : 'transparent',
                color: selectedLeague === 'NBA' ? '#111' : '#71FD08',
                border: selectedLeague === 'NBA' ? 'none' : '1px solid #71FD08',
                borderRadius: '8px',
                fontFamily: 'Lexend, Arial, sans-serif',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (selectedLeague !== 'NBA') {
                  e.currentTarget.style.background = 'rgba(113, 253, 8, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedLeague !== 'NBA') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              NBA
            </button>

            {/* Coming soon indicator for NBA */}
            {selectedLeague === 'NBA' && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  textAlign: 'center',
                  marginTop: '4px',
                  fontFamily: 'Lexend, Arial, sans-serif',
                  fontStyle: 'italic'
                }}
              >
                Coming Soon
              </div>
            )}
          </motion.div>
        ) : (
          <motion.button
            initial={{ x: 20 }}
            animate={{ x: 0 }}
            exit={{ x: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200"
            style={{
              background: '#14171F',
              border: '2px solid #71FD08',
              borderRadius: '8px',
              color: '#71FD08',
              fontFamily: 'Lexend, Arial, sans-serif',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease, opacity 0.5s ease-in-out',
              opacity: hasPlayerResults ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(113, 253, 8, 0.1)';
              e.currentTarget.style.transform = 'translateX(-4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#14171F';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            <span>{selectedLeague}</span>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none"
              style={{
                transition: 'transform 0.2s ease'
              }}
            >
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
