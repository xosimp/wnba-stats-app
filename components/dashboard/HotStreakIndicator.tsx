import React from 'react';

interface HotStreakIndicatorProps {
  isOnHotStreak: boolean;
  loading?: boolean;
  hotStreakStat?: string;
}

export function HotStreakIndicator({ isOnHotStreak, loading = false, hotStreakStat }: HotStreakIndicatorProps) {
  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!isOnHotStreak) {
    return null; // Don't show fire emoji if not on hot streak
  }

  return (
    <div
      className="absolute bottom-3 right-3 z-30"
      style={{
        position: 'absolute',
        bottom: '-15px',
        right: '-15px',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}
          >
      {hotStreakStat && (
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#FF6B35',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
            border: '1px solid #FF6B35',
            marginTop: '15px',
            marginLeft: '5px'
          }}
        >
          {hotStreakStat}
        </div>
      )}
      <img
        src="/Fire_Emoji.PNG"
        alt="Hot Streak"
        style={{
          width: '100px',
          height: '100px',
          objectFit: 'contain',
          filter: 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.8))'
        }}
      />
    </div>
  );
} 