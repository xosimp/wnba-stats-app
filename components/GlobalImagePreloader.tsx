'use client';

import { useEffect, useState } from 'react';
import { usePlayerImagePreloader } from '../hooks/usePlayerImagePreloader';

interface GlobalImagePreloaderProps {
  children: React.ReactNode;
}

export default function GlobalImagePreloader({ children }: GlobalImagePreloaderProps) {
  const { status, progress, isPreloading, clearPreloadSession, preloadAllPlayerImages } = usePlayerImagePreloader();
  const [showIndicator, setShowIndicator] = useState(false);

  // Show indicator only if preloading takes more than 500ms
  useEffect(() => {
    if (isPreloading) {
      const timer = setTimeout(() => {
        if (isPreloading && status.total > 0) {
          setShowIndicator(true);
        }
      }, 500);

      return () => clearTimeout(timer);
    } else {
      setShowIndicator(false);
    }
  }, [isPreloading, status.total]);

  return (
    <>
      {/* Global Preloading Indicator - Only shows if preloading takes time */}
      {showIndicator && isPreloading && status.total > 0 && (
        <div style={{
          position: 'fixed',
          top: '90px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.9)',
          color: '#71FD08',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 'bold',
          zIndex: 9999,
          border: '2px solid #71FD08',
          boxShadow: '0 4px 20px rgba(113, 253, 8, 0.3)',
          minWidth: '140px'
        }}>
          <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #71FD08',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <span>Preloading Data</span>
          </div>
          <div style={{ 
            width: '100%', 
            height: '6px', 
            background: 'rgba(113, 253, 8, 0.2)', 
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '6px'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: '#71FD08',
              transition: 'width 0.3s ease',
              borderRadius: '3px',
              boxShadow: '0 0 10px rgba(113, 253, 8, 0.5)'
            }} />
          </div>
          <div style={{ 
            fontSize: '11px', 
            textAlign: 'center', 
            opacity: 0.8,
            color: '#71FD08',
            marginBottom: '8px'
          }}>
            {status.loaded}/{status.total} ({Math.round(progress)}%)
          </div>
          
          {/* Manual refresh button */}
          <button
            onClick={() => {
              clearPreloadSession();
              preloadAllPlayerImages();
            }}
            style={{
              background: 'transparent',
              border: '1px solid #71FD08',
              color: '#71FD08',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#71FD08';
              e.currentTarget.style.color = '#000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#71FD08';
            }}
          >
            🔄 Refresh
          </button>
        </div>
      )}
      
      {/* Inject CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      {children}
    </>
  );
}
