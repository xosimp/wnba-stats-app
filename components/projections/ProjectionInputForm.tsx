'use client';

import React from 'react';
import { TEAMS } from '../../lib/constants/team-data';

type StatOption = { value: string; label: string; icon?: string };

type ProjectionInputFormProps = {
  selectedPlayer: string;
  setSelectedPlayer: (value: string) => void;
  selectedStat: string;
  setSelectedStat: (value: string) => void;
  selectedOpponent: string;
  setSelectedOpponent: (value: string) => void;
  isHome: boolean;
  setIsHome: (value: boolean) => void;
  sportsbookLine: string;
  setSportsbookLine: (value: string) => void;
  availablePlayers: string[];
  availableTeams: string[];
  playerDropdownOpen: boolean;
  setPlayerDropdownOpen: (open: boolean) => void;
  statDropdownOpen: boolean;
  setStatDropdownOpen: (open: boolean) => void;
  opponentDropdownOpen: boolean;
  setOpponentDropdownOpen: (open: boolean) => void;
  upcomingOpponent: string | null;
  setUpcomingOpponent: (value: string | null) => void;
  logoAnimation: boolean;
  setLogoAnimation: (value: boolean) => void;
  loading: boolean;
  onGenerate: () => void;
  statTypes: StatOption[];
  projectionService: {
    getPlayerUpcomingOpponent: (playerName: string) => Promise<string | null>;
    getPlayerTeam: (playerName: string) => Promise<string | null>;
  };
};

export function ProjectionInputForm(props: ProjectionInputFormProps) {
  const {
    selectedPlayer,
    setSelectedPlayer,
    selectedStat,
    setSelectedStat,
    selectedOpponent,
    setSelectedOpponent,
    isHome,
    setIsHome,
    sportsbookLine,
    setSportsbookLine,
    availablePlayers,
    availableTeams,
    playerDropdownOpen,
    setPlayerDropdownOpen,
    statDropdownOpen,
    setStatDropdownOpen,
    opponentDropdownOpen,
    setOpponentDropdownOpen,
    upcomingOpponent,
    setUpcomingOpponent,
    logoAnimation,
    setLogoAnimation,
    loading,
    onGenerate,
    statTypes,
    projectionService,
  } = props;

  // Helper function to convert team abbreviation to full team name
  const getTeamDisplayName = (teamAbbr: string): string => {
    // Handle special case for Phoenix Mercury (PHO in database, PHX in constants)
    if (teamAbbr === 'PHO') {
      return 'Phoenix Mercury';
    }
    
    const team = TEAMS.find(t => t.abbreviation === teamAbbr);
    return team ? team.name : teamAbbr;
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl mb-8 border-2 relative" style={{
      borderColor: '#71FD08', 
      borderRadius: 'clamp(12px, 1.5vw, 16px)', 
      maxWidth: 'clamp(500px, 45vw, 576px)', 
      margin: '0 auto', 
      boxShadow: '0 0 20px rgba(113, 253, 8, 0.3), 0 0 40px rgba(113, 253, 8, 0.1)', 
      padding: 'clamp(1.5rem, 3vw, 2rem)',
      backgroundImage: `
        radial-gradient(circle at 20% 20%, rgba(113, 253, 8, 0.04) 1px, transparent 1px),
        radial-gradient(circle at 80% 80%, rgba(113, 253, 8, 0.04) 1px, transparent 1px),
        linear-gradient(30deg, rgba(113, 253, 8, 0.03) 25%, transparent 25%, transparent 75%, rgba(113, 253, 8, 0.03) 75%),
        linear-gradient(-30deg, rgba(113, 253, 8, 0.03) 25%, transparent 25%, transparent 75%, rgba(113, 253, 8, 0.03) 75%)
      `,
      backgroundSize: '25px 25px, 25px 25px, 50px 50px, 50px 50px',
      backgroundPosition: '0 0, 12px 12px, 0 0, 25px 25px'
    }}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div style={{marginBottom: 'clamp(1rem, 2vw, 1.5rem)'}}>
          <label className="block font-medium mb-2" style={{
            color: '#d1d5db', 
            fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', 
            marginBottom: 'clamp(0.5rem, 1vw, 0.75rem)'
          }}>
            Player
          </label>
          <div style={{ position: 'relative', width: '119px' }} data-dropdown="player">
            <div
              onClick={() => !loading && setPlayerDropdownOpen(!playerDropdownOpen)}
              style={{
                width: '100%',
                padding: '12px 18px',
                paddingRight: '45px',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: '600',
                fontFamily: 'Lexend',
                color: '#d1d5db',
                border: '2px solid transparent',
                background: '#0f2419',
                backgroundImage: 'linear-gradient(135deg, #0a1a0f 0%, #0f2419 25%, #1a4d2e 50%, #0f2419 75%, #0a1a0f 100%)',
                boxShadow: `
                  0 0 0 2px #71FD08,
                  0 8px 25px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                `,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = `
                    0 0 0 2px #71FD08,
                    0 0 20px rgba(113, 253, 8, 0.3),
                    0 12px 35px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 rgba(255, 255, 255, 0.15),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                  `;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `
                  0 0 0 2px #71FD08,
                  0 8px 25px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                `;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {selectedPlayer || 'Choose a player...'}
            </div>

            <div style={{
              position: 'absolute',
              right: '-50px',
              top: '50%',
              transform: `translateY(-50%) ${playerDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}`,
              width: '14px',
              height: '14px',
              background: 'linear-gradient(45deg, #71FD08, #5ce605)',
              borderRadius: '2px',
              clipPath: 'polygon(20% 35%, 50% 65%, 80% 35%, 70% 25%, 50% 45%, 30% 25%)',
              pointerEvents: 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'drop-shadow(0 2px 4px rgba(113, 253, 8, 0.3))'
            }}></div>

            {playerDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '-2px',
                width: '186px',
                zIndex: 9999,
                background: 'linear-gradient(135deg, #0a1a0f 0%, #0f2419 25%, #1a4d2e 50%, #0f2419 75%, #0a1a0f 100%)',
                border: '2px solid #71FD08',
                borderRadius: '12px',
                marginTop: '4px',
                maxHeight: '217px',
                overflowY: 'auto',
                boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4), 0 0 20px rgba(113, 253, 8, 0.2)'
              }}>
                <div
                  onClick={() => {
                    setSelectedPlayer('');
                    setUpcomingOpponent(null);
                    setLogoAnimation(false);
                    setPlayerDropdownOpen(false);
                  }}
                  style={{
                    padding: '12px 18px',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    fontSize: '0.875rem',
                    fontFamily: 'Lexend',
                    fontWeight: '600',
                    borderBottom: '1px solid rgba(113, 253, 8, 0.2)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(113, 253, 8, 0.2)';
                    e.currentTarget.style.color = '#71FD08';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#9ca3af';
                  }}
                >
                  Choose a player...
                </div>
                {availablePlayers.map(player => (
                  <div
                    key={player}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedPlayer(player);
                      setPlayerDropdownOpen(false);
                      try {
                        const opponent = await projectionService.getPlayerUpcomingOpponent(player);
                        setUpcomingOpponent(opponent);
                        const team = await projectionService.getPlayerTeam(player);
                        // team is used upstream; we leave setting to parent if needed
                      } catch (err) {
                        setUpcomingOpponent(null);
                      }
                    }}
                    style={{
                      padding: '12px 18px',
                      cursor: 'pointer',
                      color: selectedPlayer === player ? '#71FD08' : '#d1d5db',
                      fontSize: '0.875rem',
                      fontFamily: 'Lexend',
                      fontWeight: selectedPlayer === player ? '700' : '600',
                      backgroundColor: selectedPlayer === player ? 'rgba(113, 253, 8, 0.1)' : 'transparent',
                      borderBottom: '1px solid rgba(113, 253, 8, 0.1)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(113, 253, 8, 0.2)';
                      e.currentTarget.style.color = '#71FD08';
                      e.currentTarget.style.paddingLeft = '24px';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = selectedPlayer === player ? 'rgba(113, 253, 8, 0.1)' : 'transparent';
                      e.currentTarget.style.color = selectedPlayer === player ? '#71FD08' : '#d1d5db';
                      e.currentTarget.style.paddingLeft = '18px';
                    }}
                  >
                    {player}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{marginBottom: '24px'}}>
          <label className="block font-medium mb-2" style={{color: '#d1d5db', fontSize: '24px', marginBottom: '12px'}}>
            Stat
          </label>
          <div style={{ position: 'relative', width: '119px' }} data-dropdown="stat">
            <div
              onClick={() => !loading && setStatDropdownOpen(!statDropdownOpen)}
              style={{
                width: '100%',
                padding: '12px 18px',
                paddingRight: '45px',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: '600',
                fontFamily: 'Lexend',
                color: '#d1d5db',
                border: '2px solid transparent',
                background: '#0f2419',
                backgroundImage: 'linear-gradient(135deg, #0a1a0f 0%, #0f2419 25%, #1a4d2e 50%, #0f2419 75%, #0a1a0f 100%)',
                boxShadow: `
                  0 0 0 2px #71FD08,
                  0 8px 25px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                `,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = `
                    0 0 0 2px #71FD08,
                    0 0 20px rgba(113, 253, 8, 0.3),
                    0 12px 35px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 rgba(255, 255, 255, 0.15),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                  `;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `
                  0 0 0 2px #71FD08,
                  0 8px 25px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                `;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {statTypes.find(stat => stat.value === selectedStat)?.label || 'Choose stat...'}
            </div>

            <div style={{
              position: 'absolute',
              right: '-50px',
              top: '50%',
              transform: `translateY(-50%) ${statDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}`,
              width: '14px',
              height: '14px',
              background: 'linear-gradient(45deg, #71FD08, #5ce605)',
              borderRadius: '2px',
              clipPath: 'polygon(20% 35%, 50% 65%, 80% 35%, 70% 25%, 50% 45%, 30% 25%)',
              pointerEvents: 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'drop-shadow(0 2px 4px rgba(113, 253, 8, 0.3))'
            }}></div>

            {statDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '-2px',
                width: '186px',
                zIndex: 9999,
                background: 'linear-gradient(135deg, #0a1a0f 0%, #0f2419 25%, #1a4d2e 50%, #0f2419 75%, #0a1a0f 100%)',
                border: '2px solid #71FD08',
                borderRadius: '12px',
                marginTop: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4), 0 0 20px rgba(113, 253, 8, 0.2)'
              }}>
                {statTypes.map(stat => (
                  <div
                    key={stat.value}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedStat(stat.value);
                      setStatDropdownOpen(false);
                    }}
                    style={{
                      padding: '12px 18px',
                      cursor: 'pointer',
                      color: selectedStat === stat.value ? '#71FD08' : '#d1d5db',
                      fontSize: '0.875rem',
                      fontFamily: 'Lexend',
                      fontWeight: selectedStat === stat.value ? '700' : '600',
                      backgroundColor: selectedStat === stat.value ? 'rgba(113, 253, 8, 0.1)' : 'transparent',
                      borderBottom: '1px solid rgba(113, 253, 8, 0.1)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(113, 253, 8, 0.2)';
                      e.currentTarget.style.color = '#71FD08';
                      e.currentTarget.style.paddingLeft = '24px';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = selectedStat === stat.value ? 'rgba(113, 253, 8, 0.1)' : 'transparent';
                      e.currentTarget.style.color = selectedStat === stat.value ? '#71FD08' : '#d1d5db';
                      e.currentTarget.style.paddingLeft = '18px';
                    }}
                  >
                    {stat.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{marginBottom: '24px'}}>
          <label className="block font-medium mb-2" style={{color: '#d1d5db', fontSize: '24px', marginBottom: '12px'}}>
            Opponent
          </label>
          <div style={{ position: 'relative', width: '119px' }} data-dropdown="opponent">
            <div
              onClick={() => !loading && setOpponentDropdownOpen(!opponentDropdownOpen)}
              style={{
                width: '100%',
                padding: '12px 18px',
                paddingRight: '45px',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: '600',
                fontFamily: 'Lexend',
                color: '#d1d5db',
                border: '2px solid transparent',
                background: '#0f2419',
                backgroundImage: 'linear-gradient(135deg, #0a1a0f 0%, #0f2419 25%, #1a4d2e 50%, #0f2419 75%, #0a1a0f 100%)',
                boxShadow: `
                  0 0 0 2px #71FD08,
                  0 8px 25px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                `,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = `
                    0 0 0 2px #71FD08,
                    0 0 20px rgba(113, 253, 8, 0.3),
                    0 12px 35px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 rgba(255, 255, 255, 0.15),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                  `;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `
                  0 0 0 2px #71FD08,
                  0 8px 25px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                `;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {selectedOpponent ? getTeamDisplayName(selectedOpponent) : (upcomingOpponent ? (
                <span style={{ color: '#FF6B35' }}>
                  🔥 {getTeamDisplayName(upcomingOpponent)} (Tonight)
                </span>
              ) : 'Choose opponent...')}
            </div>

            <div style={{
              position: 'absolute',
              right: '-50px',
              top: '50%',
              transform: `translateY(-50%) ${opponentDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}`,
              width: '14px',
              height: '14px',
              background: 'linear-gradient(45deg, #71FD08, #5ce605)',
              borderRadius: '2px',
              clipPath: 'polygon(20% 35%, 50% 65%, 80% 35%, 70% 25%, 50% 45%, 30% 25%)',
              pointerEvents: 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'drop-shadow(0 2px 4px rgba(113, 253, 8, 0.3))'
            }}></div>

            {opponentDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '-2px',
                width: '186px',
                zIndex: 9999 as unknown as number,
                background: 'linear-gradient(135deg, #0a1a0f 0%, #0f2419 25%, #1a4d2e 50%, #0f2419 75%, #0a1a0f 100%)',
                border: '2px solid #71FD08',
                borderRadius: '12px',
                marginTop: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4), 0 0 20px rgba(113, 253, 8, 0.2)'
              }}>
                <div
                  onClick={() => {
                    setSelectedOpponent('');
                    setUpcomingOpponent(null);
                    setLogoAnimation(false);
                    setOpponentDropdownOpen(false);
                  }}
                  style={{
                    padding: '12px 18px',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    fontSize: '0.875rem',
                    fontFamily: 'Lexend',
                    fontWeight: '600',
                    borderBottom: '1px solid rgba(113, 253, 8, 0.2)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(113, 253, 8, 0.2)';
                    e.currentTarget.style.color = '#71FD08';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#9ca3af';
                  }}
                >
                  Choose opponent...
                </div>
                {upcomingOpponent && availableTeams.includes(upcomingOpponent) && (
                  <div
                    key={`upcoming-${upcomingOpponent}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedOpponent(upcomingOpponent);
                      setOpponentDropdownOpen(false);
                      setLogoAnimation(true);
                    }}
                    style={{
                      padding: '12px 18px',
                      cursor: 'pointer',
                      color: selectedOpponent === upcomingOpponent ? '#71FD08' : '#FF6B35',
                      fontSize: '0.875rem',
                      fontFamily: 'Lexend',
                      fontWeight: selectedOpponent === upcomingOpponent ? '700' : '700',
                      backgroundColor: selectedOpponent === upcomingOpponent ? 'rgba(113, 253, 8, 0.1)' : 'rgba(255, 107, 53, 0.15)',
                      borderBottom: '2px solid rgba(255, 107, 53, 0.4)',
                      transition: 'all 0.2s',
                      position: 'relative',
                      boxShadow: '0 0 8px rgba(255, 107, 53, 0.3)',
                      textShadow: '0 0 4px rgba(255, 107, 53, 0.5)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.25)';
                      e.currentTarget.style.color = '#FF6B35';
                      e.currentTarget.style.paddingLeft = '24px';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = selectedOpponent === upcomingOpponent ? 'rgba(113, 253, 8, 0.1)' : 'rgba(255, 107, 53, 0.15)';
                      e.currentTarget.style.color = selectedOpponent === upcomingOpponent ? '#71FD08' : '#FF6B35';
                      e.currentTarget.style.paddingLeft = '18px';
                    }}
                  >
                    <span style={{ marginRight: '8px' }}>🔥</span>
                    {getTeamDisplayName(upcomingOpponent)} (Tonight)
                  </div>
                )}
                {availableTeams
                  .filter(team => !upcomingOpponent || team !== upcomingOpponent)
                  .sort((a, b) => a.localeCompare(b))
                  .map(team => (
                    <div
                      key={team}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedOpponent(team);
                        setOpponentDropdownOpen(false);
                        setLogoAnimation(true);
                        if (upcomingOpponent && team !== upcomingOpponent) {
                          setUpcomingOpponent(null);
                        }
                      }}
                      style={{
                        padding: '12px 18px',
                        cursor: 'pointer',
                        color: selectedOpponent === team ? '#71FD08' : '#d1d5db',
                        fontSize: '0.875rem',
                        fontFamily: 'Lexend',
                        fontWeight: selectedOpponent === team ? '700' : '600',
                        backgroundColor: selectedOpponent === team ? 'rgba(113, 253, 8, 0.1)' : 'transparent',
                        borderBottom: '1px solid rgba(113, 253, 8, 0.1)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(113, 253, 8, 0.2)';
                        e.currentTarget.style.color = '#71FD08';
                        e.currentTarget.style.paddingLeft = '24px';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = selectedOpponent === team ? 'rgba(113, 253, 8, 0.1)' : 'transparent';
                        e.currentTarget.style.color = selectedOpponent === team ? '#71FD08' : '#d1d5db';
                        e.currentTarget.style.paddingLeft = '18px';
                      }}
                    >
                      {getTeamDisplayName(team)}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div style={{marginBottom: '24px'}}>
          <label className="block font-medium mb-2" style={{color: '#d1d5db', fontSize: '24px', marginBottom: '12px'}}>
            Venue
          </label>
          <div className="flex">
            <label className="flex items-center" style={{cursor: loading ? 'not-allowed' : 'pointer'}}>
              <input
                type="radio"
                value="home"
                checked={isHome}
                onChange={() => setIsHome(true)}
                disabled={loading}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  width: '20px',
                  height: '20px',
                  border: '2px solid #71FD08',
                  borderRadius: '50%',
                  backgroundColor: isHome ? '#71FD08' : '#14171F',
                  marginRight: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  position: 'relative',
                  opacity: loading ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow = '0 0 10px rgba(113, 253, 8, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <span style={{cursor: loading ? 'not-allowed' : 'pointer', color: isHome ? '#71FD08' : '#d1d5db', transition: 'all 0.3s'}}>Home</span>
            </label>
            <label className="flex items-center" style={{marginLeft: '15px', cursor: loading ? 'not-allowed' : 'pointer'}}>
              <input
                type="radio"
                value="away"
                checked={!isHome}
                onChange={() => setIsHome(false)}
                disabled={loading}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  width: '20px',
                  height: '20px',
                  border: '2px solid #71FD08',
                  borderRadius: '50%',
                  backgroundColor: !isHome ? '#71FD08' : '#14171F',
                  marginRight: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  position: 'relative',
                  opacity: loading ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow = '0 0 10px rgba(113, 253, 8, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <span style={{cursor: loading ? 'not-allowed' : 'pointer', color: !isHome ? '#71FD08' : '#d1d5db', transition: 'all 0.3s'}}>Away</span>
            </label>
          </div>
        </div>

        <div style={{marginBottom: '24px'}}>
          <label className="block font-medium mb-2" style={{color: '#d1d5db', fontSize: '24px', marginBottom: '12px'}}>
            Book Line
          </label>
          <div style={{ position: 'relative', width: '145px' }}>
            <input
              type="number"
              step="0.5"
              value={sportsbookLine}
              onChange={(e) => setSportsbookLine(e.target.value)}
              placeholder="e.g., 16.5"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: '600',
                fontFamily: 'Lexend',
                color: '#d1d5db',
                border: '2px solid transparent',
                background: '#0f2419',
                backgroundImage: 'linear-gradient(135deg, #0a1a0f 0%, #0f2419 25%, #1a4d2e 50%, #0f2419 75%, #0a1a0f 100%)',
                boxShadow: `
                  0 0 0 2px #71FD08,
                  0 8px 25px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                `,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                outline: 'none',
                cursor: loading ? 'not-allowed' : 'text',
                opacity: loading ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = `
                    0 0 0 2px #71FD08,
                    0 0 20px rgba(113, 253, 8, 0.3),
                    0 12px 35px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 rgba(255, 255, 255, 0.15),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                  `;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `
                  0 0 0 2px #71FD08,
                  0 8px 25px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                `;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            />
          </div>
        </div>

        <div className="flex items-end">
          <button
            onClick={onGenerate}
            disabled={loading || !selectedPlayer || !selectedOpponent}
            style={{
              width: '180px',
              padding: '8px 16px',
              backgroundColor: loading || !selectedPlayer || !selectedOpponent ? '#4B5563' : '#71FD08',
              color: '#000000',
              fontWeight: '900',
              fontSize: '14px',
              borderRadius: '8px',
              transition: 'all 0.3s',
              cursor: loading || !selectedPlayer || !selectedOpponent ? 'not-allowed' : 'pointer',
              border: 'none',
              outline: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.9)',
              opacity: loading || !selectedPlayer || !selectedOpponent ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading && selectedPlayer && selectedOpponent) {
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(113, 253, 8, 0.4), 0 4px 12px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.9)';
                e.currentTarget.style.transform = 'scale(1.02)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.9)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {loading ? 'Generating...' : 'Generate Projection'}
          </button>
        </div>
      </div>
    </div>
  );
}


