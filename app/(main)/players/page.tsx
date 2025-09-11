"use client";
import '../../globals.css';
import { PlayerSearch } from '../../../components/search/PlayerSearch';
import { ErrorBoundary } from '../../../components/ui/ErrorBoundary';
import { Suspense } from 'react';
import { usePlayerImagePreloader } from '../../../hooks/usePlayerImagePreloader';

// Loading component for the search bar
function SearchBarSkeleton() {
  return (
    <div className="w-full h-full min-h-screen relative bg-white">
      {/* Player Search text positioned at top left underneath header */}
      <div 
        className="fixed z-20" 
        style={{ 
          top: '141px', 
          left: '85px', 
          color: '#71FD08 !important',
          fontSize: '1.5rem !important',
          fontWeight: '600 !important',
          zIndex: 20,
          textShadow: '2px 2px 4px rgba(0,0,0,0.8), 1px 1px 2px rgba(0,0,0,0.9)'
        }}
      >
        Player Search
      </div>
      
      {/* Search bar positioned underneath the Player Search text */}
      <div 
        className="fixed z-20" 
        style={{ 
          top: '184px', 
          left: '44px', 
          width: '250px',
          zIndex: 20
        }}
      >
        <div className="relative w-full">
          <div
            className="w-full px-4 py-3 rounded-2xl text-[0.875rem] font-medium font-['Lexend'] text-[#f3f3f3] border-2 transition-all duration-300 text-center pr-10"
            style={{
              borderRadius: '16px !important',
              paddingTop: '12px !important',
              paddingBottom: '12px !important',
              height: '15px !important',
              backgroundColor: '#14171F',
              borderColor: '#71FD08',
              boxShadow: '0 4px 12px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.9)',
            }}
          >
            <div className="animate-pulse bg-gray-600 h-4 rounded" style={{ width: '60%', margin: '0 auto' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayerSearchPage() {
  // Player image preloader - runs when page loads
  const { status: preloadStatus, progress, isPreloading } = usePlayerImagePreloader();
  
  return (
    <ErrorBoundary>
      <div className="dashboard-page min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 pt-24 pb-8 px-8" style={{ 
        margin: 0, 
        paddingTop: '96px',
        background: 'linear-gradient(135deg, #111827 0%, #000000 50%, #111827 100%) !important',
        position: 'relative',
        zIndex: 1
      }}>
        
        {/* Player Image Preloading Indicator - Subtle and non-intrusive */}
        {isPreloading && preloadStatus.total > 0 && (
          <div style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#71FD08',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 9999,
            border: '1px solid #71FD08',
            opacity: 0.9
          }}>
            <div style={{ marginBottom: '4px' }}>Preloading Images</div>
            <div style={{ 
              width: '100px', 
              height: '4px', 
              background: 'rgba(113, 253, 8, 0.3)', 
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: '#71FD08',
                transition: 'width 0.3s ease',
                borderRadius: '2px'
              }} />
            </div>
            <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.8 }}>
              {preloadStatus.loaded}/{preloadStatus.total}
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto">
          <main className="flex flex-col items-center justify-start">
            <Suspense fallback={<SearchBarSkeleton />}>
              <PlayerSearch />
            </Suspense>
            {/* Spacer to guarantee 3 inches of blank space at bottom */}
            <div className="w-full" style={{ height: '96px' }} />
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
} 