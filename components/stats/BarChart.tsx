import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getTeamAbbreviation } from '../../lib/utils/team-abbreviations';
import { GameLogEntry } from './PlayerStatsGraph.helpers';

interface BarChartProps {
  games: GameLogEntry[];
  selectedPeriod: string;
  selectedStatType: string;
  finalBookLine: number;
  fallbackBookLine?: number | null;
  bookLineLoading: boolean;
  periodLoading: boolean;
  formatGameDate: (eventId?: string, date?: string) => string;
  getBarStyles: (index: number, games: GameLogEntry[], selectedPeriod: string) => any;
  getBookLinePosition: (value: number, selectedPeriod: string) => string;
  maxVisibleValue?: number; // Add this prop
}

// Utility to map stat value to pixel position on the chart
function calculateBookLineHeight(statValue: number, graphHeight: number, minVisibleValue: number, maxVisibleValue: number) {
  statValue = Math.max(minVisibleValue, Math.min(maxVisibleValue, statValue));
  const range = maxVisibleValue - minVisibleValue;
  const proportion = (statValue - minVisibleValue) / range;
  const pixelHeight = graphHeight * proportion;
  return pixelHeight;
}

const BarChart: React.FC<BarChartProps> = ({
  games,
  selectedPeriod,
  selectedStatType,
  finalBookLine,
  fallbackBookLine,
  bookLineLoading,
  periodLoading,
  formatGameDate,
  getBarStyles,
  getBookLinePosition,
  maxVisibleValue = 50, // Default to 50
}) => {
  // Add CSS keyframes for spinner animation
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  console.log("BarChart games prop:", games);
  console.log("BarChart selectedStatType:", selectedStatType);
  // Define the visible Y-axis range and graph height
  const minVisibleValue = 0; // Adjust if your Y axis starts above 0
  // const maxVisibleValue = 50; // Remove this line
  const graphHeight = 385; // Should match the bar container height
  const chartBottomOffset = 0; // Offset to align grid lines and bars with bottom of chart

  // Use the actual book line value from API/props
  const bookLineValue = finalBookLine;

  // Add loading state for stat type changes
  const [isStatTypeLoading, setIsStatTypeLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  console.log("BarChart isStatTypeLoading:", isStatTypeLoading);
  console.log("BarChart periodLoading:", periodLoading);
  
  // Set initial load to false after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 1000); // Wait 1 second after mount to allow for initial data loading
    return () => clearTimeout(timer);
  }, []);
  
  // Effect to show loading when stat type changes (but not during initial load)
  useEffect(() => {
    if (!isInitialLoad) {
      console.log('Stat type changed to:', selectedStatType, 'showing loading...');
      setIsStatTypeLoading(true);
      const timer = setTimeout(() => {
        console.log('Hiding loading for:', selectedStatType);
        setIsStatTypeLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedStatType, isInitialLoad]);
  
  // Show loading overlay for both stat type changes and period data loading
  const shouldShowLoading = isStatTypeLoading || periodLoading;

  return (
    <motion.div
      className="relative mx-auto"
      style={{ width: 420 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {/* Vertical axis labels - now absolutely positioned for perfect alignment */}
      <div style={{ position: 'absolute', left: 0, top: 0, height: graphHeight, width: 46, zIndex: 10 }}>
        {[...Array((maxVisibleValue / 5) + 1)].map((_, i) => {
          const value = i * 5;
          return (
            <span
              key={value}
              style={{
                position: 'absolute',
                left: 0,
                bottom: `${calculateBookLineHeight(value, graphHeight, minVisibleValue, maxVisibleValue)}px`,
                color: '#D1D5DB',
                fontSize: 14,
                lineHeight: 1,
                transform: 'translateY(50%)', // Center label on grid line
                paddingLeft: 2,
                pointerEvents: 'none',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
              }}
            >
              {value}
            </span>
          );
        })}
      </div>
      {/* Background colors based on book line */}
      {typeof bookLineValue === 'number' && bookLineValue > 0 && !['FGA', '3PA', 'FTA'].includes(selectedStatType) && (
        <>
          {/* Red background below book line */}
          <div
            style={{
              position: 'absolute',
              left: 26,
              right: 10,
              bottom: -8,
              height: `${calculateBookLineHeight(bookLineValue, graphHeight, minVisibleValue, maxVisibleValue) + chartBottomOffset + 5}px`,
              background: 'linear-gradient(to bottom, rgba(239, 68, 68, 0.7) 0%, rgba(239, 68, 68, 0.4) 10%, rgba(0, 0, 0, 0.8) 100%)', // Red gradient with more prominent black
              border: '2px solid rgba(239, 68, 68, 0.8)',
              borderBottomLeftRadius: '8px',
              borderBottomRightRadius: '8px',
              borderTopLeftRadius: '0px',
              borderTopRightRadius: '0px',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
          {/* Green background above book line */}
          <div
            style={{
              position: 'absolute',
              left: 26,
              right: 10,
              bottom: `${calculateBookLineHeight(bookLineValue, graphHeight, minVisibleValue, maxVisibleValue) + chartBottomOffset}px`,
              height: `${graphHeight - calculateBookLineHeight(bookLineValue, graphHeight, minVisibleValue, maxVisibleValue)}px`,
              background: 'linear-gradient(to top, rgba(113, 253, 8, 0.7) 0%, rgba(113, 253, 8, 0.4) 20%, rgba(0, 0, 0, 0.8) 100%)', // Green gradient with more prominent black
              border: '2px solid rgba(113, 253, 8, 0.8)',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              borderBottomLeftRadius: '0px',
              borderBottomRightRadius: '0px',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
        </>
      )}
      
      {/* Light gradient background for FGA, 3PA, and FTA */}
      {['FGA', '3PA', 'FTA'].includes(selectedStatType) && (
        <div
          style={{
            position: 'absolute',
            left: 26,
            right: 10,
            bottom: -8,
            height: `${graphHeight + 13}px`,
            background: 'linear-gradient(to top, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 20%, rgba(139, 92, 246, 0.05) 50%, rgba(0, 0, 0, 0.6) 80%, rgba(0, 0, 0, 0.8) 100%)', // Extended purple gradient with more purple at bottom
            border: '2px solid #8B5CF6',
            borderRadius: '8px',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      
      {/* Horizontal grid lines */}
      {[...Array((maxVisibleValue / 5))].map((_, i) => {
        const value = (i + 1) * 5;
        const y = calculateBookLineHeight(value, graphHeight, minVisibleValue, maxVisibleValue);
        return (
          <div
            key={value}
            style={{
              position: 'absolute',
              left: 26,
              right: 10,
              bottom: `${y + chartBottomOffset}px`,
              height: 2,
              background: 'rgba(40,45,55,0.2)',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        );
      })}
      

      {/* Book line and label */}
      {typeof bookLineValue === 'number' && bookLineValue > 0 ? (
        <>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.1 + games.length * 0.07, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: '25.5px',
              right: 0,
              bottom: `${calculateBookLineHeight(bookLineValue, graphHeight, minVisibleValue, maxVisibleValue) + chartBottomOffset - 1}px`,
              height: 2,
              background: 'transparent',
              opacity: 1,
              borderRadius: '1px',
              zIndex: 1001,
              pointerEvents: 'none',
              transformOrigin: 'left',
              borderTop: '2px dotted white',
            }}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1 + games.length * 0.07, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              right: '-20px',
              bottom: `${calculateBookLineHeight(bookLineValue, graphHeight, minVisibleValue, maxVisibleValue) + chartBottomOffset - 9}px`,
              color: 'white',
              fontWeight: 700,
              fontSize: 14,
              background: 'black',
              padding: '2px 8px',
              borderRadius: 6,
              border: '1px solid #71FD08',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              zIndex: 1002,
              pointerEvents: 'none',
            }}
          >
            {Number(bookLineValue).toFixed(1)} {bookLineLoading && '(loading...)'}
          </motion.div>
        </>
      ) : (
        fallbackBookLine && !['FGA', '3PA', 'FTA'].includes(selectedStatType) && (
          <>
            {/* Background colors for fallback book line */}
                        {/* Red background below fallback book line */}
            <div
              style={{
                position: 'absolute',
                left: 26,
                right: 10,
                bottom: -5,
                height: `${calculateBookLineHeight(fallbackBookLine, graphHeight, minVisibleValue, maxVisibleValue) + chartBottomOffset + 5}px`,
                background: 'linear-gradient(to bottom, rgba(239, 68, 68, 0.7) 0%, rgba(239, 68, 68, 0.4) 10%, rgba(0, 0, 0, 0.8) 100%)', // Red gradient with more prominent black
                border: '2px solid rgba(239, 68, 68, 0.8)',
                borderBottomLeftRadius: '8px',
                borderBottomRightRadius: '8px',
                borderTopLeftRadius: '0px',
                borderTopRightRadius: '0px',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
                        {/* Green background above fallback book line */}
            <div
              style={{
                position: 'absolute',
                left: 26,
                right: 10,
                bottom: `${calculateBookLineHeight(fallbackBookLine, graphHeight, minVisibleValue, maxVisibleValue) + chartBottomOffset - 1}px`,
                height: `${graphHeight - calculateBookLineHeight(fallbackBookLine, graphHeight, minVisibleValue, maxVisibleValue)}px`,
                background: 'linear-gradient(to top, rgba(113, 253, 8, 0.7) 0%, rgba(113, 253, 8, 0.4) 20%, rgba(0, 0, 0, 0.8) 100%)', // Green gradient with more prominent black
                border: '2px solid rgba(113, 253, 8, 0.8)',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                borderBottomLeftRadius: '0px',
                borderBottomRightRadius: '0px',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
            
            <div
              style={{
                position: 'absolute',
                left: '25.5px',
                right: 0,
                bottom: `${calculateBookLineHeight(fallbackBookLine, graphHeight, minVisibleValue, maxVisibleValue) + chartBottomOffset - 1}px`,
                height: 2,
                background: 'transparent',
                opacity: 0.56,
                borderRadius: '1px',
                zIndex: 998,
                pointerEvents: 'none',
                transformOrigin: 'left',
                borderTop: '2px dotted white',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: '-20px',
                bottom: `${calculateBookLineHeight(fallbackBookLine, graphHeight, minVisibleValue, maxVisibleValue) + chartBottomOffset - 5}px`,
                color: 'white',
                fontWeight: 700,
                fontSize: 14,
                background: 'black',
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid #71FD08',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                zIndex: 999,
                pointerEvents: 'none',
              }}
            >
              {Number(fallbackBookLine).toFixed(1)} (fallback)
            </div>
          </>
        )
      )}
      
      {/* Default background when no book line is available */}
      {(!bookLineValue || bookLineValue <= 0) && !fallbackBookLine && !['FGA', '3PA', 'FTA'].includes(selectedStatType) && (
        <>
          {/* Red background below default threshold (38.5) */}
          <div
            style={{
              position: 'absolute',
              left: 26,
              right: 10,
              bottom: -5,
              height: `${calculateBookLineHeight(38.5, graphHeight, minVisibleValue, maxVisibleValue) + chartBottomOffset + 5}px`,
              background: 'linear-gradient(to bottom, rgba(239, 68, 68, 0.7) 0%, rgba(239, 68, 68, 0.4) 10%, rgba(0, 0, 0, 0.8) 100%)', // Red gradient with more prominent black
              border: '2px solid rgba(239, 68, 68, 0.8)',
              borderBottomLeftRadius: '8px',
              borderBottomRightRadius: '8px',
              borderTopLeftRadius: '0px',
              borderTopRightRadius: '0px',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
          {/* Green background above default threshold (38.5) */}
          <div
            style={{
              position: 'absolute',
              left: 26,
              right: 10,
              bottom: `${calculateBookLineHeight(38.5, graphHeight, minVisibleValue, maxVisibleValue) + chartBottomOffset}px`,
              height: `${graphHeight - calculateBookLineHeight(38.5, graphHeight, minVisibleValue, maxVisibleValue)}px`,
              background: 'linear-gradient(to top, rgba(113, 253, 8, 0.7) 0%, rgba(113, 253, 8, 0.4) 20%, rgba(0, 0, 0, 0.8) 100%)', // Green gradient with more prominent black
              border: '2px solid rgba(113, 253, 8, 0.8)',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              borderBottomLeftRadius: '0px',
              borderBottomRightRadius: '0px',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
        </>
      )}
      
      {/* Bar Chart */}
      <div
        className={`flex items-end h-full w-full ${games.length === 5 ? 'justify-center' : 'justify-center gap-2'}`}
        style={{
          position: 'relative',
          zIndex: 1,
          marginLeft: selectedPeriod === 'L10' ? 8 : selectedPeriod === 'Season' ? 10 : selectedPeriod === 'L5' ? 8 : selectedPeriod === 'H2H' ? 8 : 20, // All periods start closer to Y-axis
          justifyContent: selectedPeriod === 'H2H' ? 'center' : (games.length === 5 ? 'center' : undefined),
          gap: selectedPeriod === 'H2H' ? 16 : (selectedPeriod === 'Season' ? 1 : games.length > 15 ? 2 : games.length === 5 ? 18 : 8),
          display: 'flex',
          height: `${graphHeight}px`,
          minHeight: '32px',
          overflowX: selectedPeriod === 'Season' || games.length > 15 ? 'auto' : 'visible',
          maxWidth: selectedPeriod === 'Season' || games.length > 15 ? 'none' : '100%',
          alignItems: 'flex-start',
        }}
      >
        {/* Empty state for H2H when no games against opponent */}
        {games.length === 0 && selectedPeriod === 'H2H' ? (
          <div
            style={{
              position: 'absolute',
              top: 'calc(50% - 49px)',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: '16px',
              fontWeight: '500',
              zIndex: 10,
              background: 'rgba(0, 0, 0, 0.8)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #374151',
              maxWidth: '300px',
            }}
          >
            <div>No games against this opponent this season</div>
            <div style={{ fontSize: '14px', marginTop: '4px', opacity: 0.8 }}>
              Player hasn&apos;t faced this team yet in 2025
            </div>
          </div>
        ) : games.length === 0 ? (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: '16px',
              fontWeight: '500',
              zIndex: 10,
            }}
          >
            No data available
          </div>
        ) : (
          games.map((game, idx) => {
          const gamePoints = typeof game.statValue === 'number' ? game.statValue : Number(game.points);
          console.log('BarChart - Game:', game.date, 'statValue:', game.statValue, 'gamePoints:', gamePoints, 'selectedStatType:', selectedStatType);
          // Bar heights - align perfectly with Y axis/grid lines
          // For bars, we need the height from bottom to the calculated position
          let barHeight = calculateBookLineHeight(gamePoints, graphHeight, minVisibleValue, maxVisibleValue) + chartBottomOffset + 3; // Add 1 pixel to top
          barHeight = Math.max(4, barHeight); // Prevent negative/too small bars
          const opp = game.opp || game.opponent || game.opponent_abbr || 'TBD';
          const gameDate = formatGameDate(game.eventId, game.date);
          const homeAway = game.homeAway?.toLowerCase() === 'away' ? '@' : 'VS';
          const barStyles = getBarStyles(idx, games, selectedPeriod);

          return (
            <div key={idx} className="flex flex-col items-center" style={{ ...barStyles, height: '400px', position: 'relative' }}>
              {/* Bar container - positioned higher to avoid text overlap */}
              <div className="relative" style={{ height: graphHeight, width: barStyles.width, marginBottom: '0px', marginTop: '0px' }}>
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.8, delay: 0.1 + idx * 0.07, ease: 'easeOut' }}
                  style={{
                    height: barHeight,
                    background: ['FGA', '3PA', 'FTA'].includes(selectedStatType) ? '#8B5CF6' : barPointsColor(gamePoints, finalBookLine), // Cool purple for FGA, 3PA, FTA
                    borderRadius: 6,
                    width: '100%',
                    position: 'absolute',
                    bottom: ['FGA', '3PA', 'FTA'].includes(selectedStatType) ? 0 : -2, // Raise FGA, 3PA, FTA bars by 2px
                    left: 0,
                    right: 0,
                    boxShadow: '0 0 12px 2px #000',
                    zIndex: 1,
                  }}
                  className="flex items-center justify-center"
                >
                  {barHeight >= 25 && selectedPeriod !== 'Season' && (
                    <span className="absolute left-1/2 -translate-x-1/2 text-[15px] font-bold text-white" style={{ top: 6, zIndex: 1002 }}>{gamePoints}</span>
                  )}
                </motion.div>
              </div>
              
              {/* Date text - completely separate entity positioned at bottom */}
              {selectedPeriod !== 'Season' && (
                <div 
                  style={{ 
                    position: 'absolute',
                    bottom: '-42px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100%',
                    textAlign: 'center',
                    zIndex: 10
                  }}
                >
                  <div className="text-[12px]" style={{ color: '#D1D5DB' }}>
                    {(() => {
                      // Format date as M/DD
                      // Try different date formats
                      let date;
                      
                      if (game.date && typeof game.date === 'string') {
                        // Check if it's already in M/DD format
                        if (game.date.includes('/') && !game.date.includes('-') && !game.date.includes(',')) {
                          return game.date; // Already formatted
                        }
                        
                        // Handle formatted date strings like "Tue, Aug 19, 2025"
                        if (game.date.includes(',') && game.date.includes(' ')) {
                          date = new Date(game.date);
                          if (!isNaN(date.getTime())) {
                            const monthNum = date.getMonth() + 1; // getMonth() returns 0-11
                            const dayNum = date.getDate();
                            return `${monthNum}/${dayNum.toString().padStart(2, '0')}`;
                          }
                        }
                        
                        // Try to parse as ISO date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
                        if (game.date.includes('-')) {
                          const datePart = game.date.split('T')[0];
                          const [year, month, day] = datePart.split('-');
                          
                          if (year && month && day) {
                            // Create date using local timezone to avoid day shift
                            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                          }
                        }
                      }
                      
                      // Fallback to gameDate if date is invalid
                      if (!date || isNaN(date.getTime())) {
                        return gameDate || 'N/A';
                      }
                      
                      const monthNum = date.getMonth() + 1; // getMonth() returns 0-11
                      const dayNum = date.getDate();
                      return `${monthNum}/${dayNum.toString().padStart(2, '0')}`;
                    })()}
                  </div>
                  {/* Home/Away indicator */}
                  <div className="text-[10px]" style={{ color: '#D1D5DB', marginTop: '2px' }}>
                    {game.homeAway?.toLowerCase() === 'away' ? '@' : 'VS'}
                  </div>
                  {/* Opponent abbreviation */}
                  <div className="text-[10px]" style={{ color: '#D1D5DB', marginTop: '2px' }}>
                    {getTeamAbbreviation(game.opp || game.opponent || game.opponent_abbr || 'TBD')}
                  </div>
                </div>
              )}
            </div>
          );
        })
        )}
      </div>
      
      {/* Loading overlay for stat type changes - positioned at the end to ensure it's on top */}
      {shouldShowLoading && (
        <div
          style={{
            position: 'absolute',
            top: -5,
            left: -5,
            right: -20,
            bottom: -14,
            background: 'rgba(24, 27, 35, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '16px'
          }}>
            <div 
              className="rounded-full h-16 w-16 border-4 border-transparent border-b-4" 
              style={{ 
                borderColor: '#71FD08',
                animation: 'spin 1s linear infinite',
                borderTopColor: 'transparent',
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent'
              }}
            ></div>
            <div style={{ 
              color: '#71FD08', 
              fontSize: '16px', 
              fontWeight: 'bold',
              textShadow: '0 0 12px rgba(113, 253, 8, 0.8)',
              textAlign: 'center'
            }}>
              Loading {selectedStatType}...
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

function barPointsColor(gamePoints: number, finalBookLine: number) {
  if (typeof finalBookLine === 'number') {
    if (gamePoints > finalBookLine) return '#71FD08';
    return '#ef4444';
  }
  return gamePoints > 38.5 ? '#71FD08' : '#ef4444';
}

export { BarChart }; 