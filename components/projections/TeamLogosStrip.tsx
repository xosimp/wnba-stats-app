'use client';

import React from 'react';

type TeamLogosStripProps = {
  playerTeam: string | null;
  selectedOpponent: string;
  selectedPlayer: string;
  logoAnimation: boolean;
  getTeamLogo: (teamName: string | null) => string | null;
  getPlayerImageFilename: (playerName: string) => string | null | undefined;
};

export function TeamLogosStrip(props: TeamLogosStripProps) {
  const { playerTeam, selectedOpponent, selectedPlayer, logoAnimation, getTeamLogo, getPlayerImageFilename } = props;

  // Add CSS keyframes for animations
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInUp {
        0% {
          opacity: 0;
          transform: translateY(30px) scale(0.9);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

    // Always show the component - VS text and lines are always visible
  return (
    <div className="mt-8 text-center" style={{
      position: 'relative',
      height: 'auto',
      minHeight: '200px',
      maxWidth: '400px',
      margin: '0 auto'
    }}>

      {/* VS Text with horizontal lines - always displayed */}
      <>
        {/* Left horizontal line */}
        <div style={{
          position: 'absolute',
          top: '-303px',
          left: 'calc(50% - 30px)',
          width: '80px',
          height: '2px',
          backgroundColor: '#71FD08',
          borderRadius: '1px',
          opacity: 0.8,
          transition: 'all 0.6s ease-out',
          zIndex: 14,
          boxShadow: '0 0 10px rgba(113, 253, 8, 0.5)'
        }}></div>
        
        {/* VS Text */}
        <div style={{
          position: 'absolute',
          top: '-323px',
          left: 'calc(50% + 110px)',
          transform: 'translateX(-50%)',
          width: '60px',
          height: '40px',
          backgroundColor: '#71FD08',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#000000',
          fontSize: '18px',
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
          opacity: 0.8,
          transition: 'all 0.6s ease-out',
          zIndex: 15,
          boxShadow: '0 0 20px rgba(113, 253, 8, 0.3)'
        }}>
          VS
        </div>
        
        {/* Right horizontal line */}
        <div style={{
          position: 'absolute',
          top: '-303px',
          left: 'calc(50% + 170px)',
          width: '80px',
          height: '2px',
          backgroundColor: '#71FD08',
          borderRadius: '1px',
          opacity: 0.8,
          transition: 'all 0.6s ease-out',
          zIndex: 14,
          boxShadow: '0 0 10px rgba(113, 253, 8, 0.5)'
        }}></div>
      </>

      {/* Opponent Team Logo - show when opponent is selected */}
      {selectedOpponent && getTeamLogo(selectedOpponent) && (
        <div style={{
          position: 'absolute',
          top: '-250px',
          left: '222px',
          opacity: 1,
          transform: 'translateY(0) scale(1)',
          transition: 'all 0.8s ease-out',
          animation: 'fadeInUp 0.8s ease-out'
        }}>
          <div className="relative inline-block">
            <img
              src={getTeamLogo(selectedOpponent)!}
              alt={`${selectedOpponent} logo`}
              style={{
                width: '182px',
                height: '182px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 0 8px rgba(0, 0, 0, 0.9)), drop-shadow(0 0 0 12px rgba(0, 0, 0, 0.7)), drop-shadow(0 0 0 16px rgba(0, 0, 0, 0.5))',
                transition: 'all 0.5s ease-in-out'
              }}
            />
          </div>
        </div>
      )}

      {/* Player Image - show when player is selected */}
      {selectedPlayer && (
        <div style={{
          position: 'absolute',
          top: '-550px',
          right: '-1px',
          opacity: 1,
          transform: 'translateY(0) scale(1)',
          transition: 'all 0.8s ease-out',
          animation: 'fadeInUp 0.8s ease-out'
        }}>
          <div className="relative inline-block">
            <img
              src={`/player_images/${getPlayerImageFilename(selectedPlayer) || 'default_player.png'}`}
              alt={`${selectedPlayer} photo`}
              onError={(e) => {
                e.currentTarget.src = '/player_images/default_player.png';
              }}
              style={{
                width: '180px',
                height: '180px',
                objectFit: 'cover',
                borderRadius: '90px',
                filter: 'drop-shadow(0 0 20px rgba(113, 253, 8, 1)) !important',
                boxShadow: '0 0 20px rgba(113, 253, 8, 1), 0 0 40px rgba(113, 253, 8, 1), 0 0 60px rgba(113, 253, 8, 1), 0 0 80px rgba(113, 253, 8, 0.9), 0 0 100px rgba(113, 253, 8, 0.8) !important',
                transition: 'all 0.5s ease-in-out',
                border: '3px solid #71FD08'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}


