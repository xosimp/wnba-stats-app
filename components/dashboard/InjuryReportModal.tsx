"use client";

import React, { useState, useEffect } from 'react';
import { injuryAPI, Injury } from '../../lib/api/injury-api';
import { TEAMS } from '../../lib/constants/team-data';

interface InjuryReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  team1Abbrev: string;
  team2Abbrev: string;
  team1Name: string;
  team2Name: string;
  gameDate: string;
}

export default function InjuryReportModal({ 
  isOpen, 
  onClose, 
  team1Abbrev, 
  team2Abbrev, 
  team1Name, 
  team2Name,
  gameDate 
}: InjuryReportModalProps) {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchInjuries();
    }
  }, [isOpen, team1Abbrev, team2Abbrev]);

  const fetchInjuries = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await injuryAPI.fetchInjuries();
      
      // Filter injuries for the two teams in this game
      const teamInjuries = data.filter(injury => 
        injury.teamAbbrev === team1Abbrev || injury.teamAbbrev === team2Abbrev
      );
      
      setInjuries(teamInjuries);
    } catch (error) {
      console.error('Error fetching injuries:', error);
      setError('Failed to load injury data');
      setInjuries([]);
    } finally {
      setLoading(false);
    }
  };

  const getTeamInfo = (teamAbbrev: string) => {
    const normalizedAbbrev = teamAbbrev.toLowerCase();
    let team = TEAMS.find(t => t.abbreviation?.toLowerCase() === normalizedAbbrev);
    
    // Handle specific variations
    if (!team) {
      if (normalizedAbbrev === 'conn') {
        team = TEAMS.find(t => t.abbreviation === 'CON');
      } else if (normalizedAbbrev === 'gsv') {
        team = TEAMS.find(t => t.abbreviation === 'GSV');
      } else if (normalizedAbbrev === 'val') {
        team = TEAMS.find(t => t.abbreviation === 'GSV');
      } else if (normalizedAbbrev === 'gsw') {
        team = TEAMS.find(t => t.abbreviation === 'GSV');
      } else if (normalizedAbbrev === 'gs') {
        team = TEAMS.find(t => t.abbreviation === 'GSV');
      } else if (normalizedAbbrev === 'wsh') {
        team = TEAMS.find(t => t.abbreviation === 'WAS');
      } else if (normalizedAbbrev === 'las' || normalizedAbbrev === 'la') {
        team = TEAMS.find(t => t.abbreviation === 'LAS');
      } else if (normalizedAbbrev === 'lva' || normalizedAbbrev === 'lv') {
        team = TEAMS.find(t => t.abbreviation === 'LVA');
      } else if (normalizedAbbrev === 'nyl' || normalizedAbbrev === 'ny') {
        team = TEAMS.find(t => t.abbreviation === 'NYL');
      }
    }
    
    return team || null;
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Out': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'Questionable': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'Probable': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'Doubtful': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'Day-to-Day': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Out': return '🚫';
      case 'Questionable': return '❓';
      case 'Probable': return '✅';
      case 'Doubtful': return '⚠️';
      case 'Day-to-Day': return '📅';
      default: return '❓';
    }
  };

  const formatDate = (dateString: string) => {
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatGameDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const team1Injuries = injuries.filter(injury => injury.teamAbbrev === team1Abbrev);
  const team2Injuries = injuries.filter(injury => injury.teamAbbrev === team2Abbrev);
  const team1Info = getTeamInfo(team1Abbrev);
  const team2Info = getTeamInfo(team2Abbrev);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        padding: '2vh 2vw'
      }}
      onClick={onClose}
    >
      
          {/* Modal */}
          <div
            className="relative overflow-hidden"
            style={{
              position: 'relative',
              backgroundColor: '#0F172A',
              borderRadius: '1.5vh',
              boxShadow: '0 4vh 8vh -2vh rgba(0, 0, 0, 0.9), 0 0 0 0.2vh rgba(113, 253, 8, 0.3), inset 0 0.2vh 0 rgba(255, 255, 255, 0.1)',
              border: '0.3vh solid #71FD08',
              width: 'min(95vw, 65vh)',
              maxWidth: '65vh',
              maxHeight: '65vh',
              minHeight: '45vh',
              overflow: 'hidden',
              zIndex: 1000000,
              display: 'flex',
              flexDirection: 'column',
              backdropFilter: 'blur(1vh)',
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)'
            }}
            onClick={(e) => e.stopPropagation()}
          >

        {/* Content */}
        <div 
          className="overflow-y-auto flex-grow"
          style={{
            padding: '2vh',
            background: 'rgba(0, 0, 0, 0.1)',
            flex: 1
          }}
        >
          {loading ? (
            <div 
              className="flex justify-center items-center"
              style={{ padding: '3vh 0' }}
            >
              <div 
                className="animate-spin rounded-full border-b-2 border-green-500"
                style={{
                  width: '3vh',
                  height: '3vh',
                  borderWidth: '0.3vh'
                }}
              ></div>
              <span 
                className="ml-2vh text-gray-300"
                style={{
                  fontSize: '1.6vh',
                  textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)'
                }}
              >
                Loading...
              </span>
            </div>
          ) : error ? (
            <div 
              className="text-center"
              style={{ padding: '3vh 0' }}
            >
              <div 
                className="text-red-400 mb-2vh"
                style={{
                  fontSize: '1.6vh',
                  textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)'
                }}
              >
                {error}
              </div>
              <button 
                onClick={fetchInjuries}
                className="bg-green-600 text-white rounded transition-colors hover:bg-green-700"
                style={{
                  padding: '1vh 2vh',
                  fontSize: '1.4vh',
                  border: '0.1vh solid rgba(255, 255, 255, 0.2)',
                  textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)'
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2vh' }}>
              {/* Team 1 Injuries */}
              <div>
                <div 
                  className="flex items-center"
                  style={{
                    gap: '1vh',
                    marginBottom: '1.5vh',
                    padding: '1vh',
                    background: 'rgba(113, 253, 8, 0.05)',
                    borderRadius: '0.8vh',
                    border: '0.1vh solid rgba(113, 253, 8, 0.2)'
                  }}
                >
                  {team1Info?.logo && (
                    <img 
                      src={team1Info.logo} 
                      alt={`${team1Name} logo`}
                      style={{
                        width: '5vh',
                        height: '5vh',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 0.2vh 0.4vh rgba(0, 0, 0, 0.5))'
                      }}
                    />
                  )}
                  <h3 
                    className="font-bold truncate"
                    style={{
                      fontSize: '1.8vh',
                      textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                      flex: 1,
                      color: '#d1d5db',
                      fontWeight: 'bold'
                    }}
                  >
                    {team1Name}
                  </h3>
                  <span 
                    className="text-gray-400 font-medium"
                    style={{
                      fontSize: '1.4vh',
                      background: 'rgba(113, 253, 8, 0.2)',
                      padding: '0.3vh 0.8vh',
                      borderRadius: '0.5vh',
                      border: '0.1vh solid rgba(113, 253, 8, 0.3)'
                    }}
                  >
                    {team1Injuries.length}
                  </span>
                </div>
                
                {team1Injuries.length === 0 ? (
                    <div 
                      className="text-center rounded"
                      style={{
                        padding: '2vh',
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '0.1vh solid rgba(34, 197, 94, 0.3)',
                        borderRadius: '0.8vh',
                        fontSize: '1.6vh',
                        textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                        color: '#fbbf24',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}
                    >
                      NO INJURIES ✅
                    </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1vh' }}>
                    {team1Injuries.map((injury) => (
                      <div 
                        key={injury.id}
                        className="rounded border"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          padding: '1.5vh',
                          border: '0.1vh solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '0.8vh',
                          backdropFilter: 'blur(0.5vh)'
                        }}
                      >
                        <div className="flex items-center" style={{ gap: '1.5vh' }}>
                          {/* Player Image */}
                            <div className="flex-shrink-0">
                              <img 
                                src={`/api/images/player/${encodeURIComponent(injury.playerName)}`}
                                alt={injury.playerName}
                                style={{
                                  width: '5vh',
                                  height: '5vh',
                                  borderRadius: '50%',
                                  border: '0.2vh solid rgba(113, 253, 8, 0.5)',
                                  objectFit: 'cover',
                                  filter: 'drop-shadow(0 0.2vh 0.4vh rgba(0, 0, 0, 0.5))'
                                }}
                              />
                            </div>
                          
                            {/* Player Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center" style={{ gap: '1vh', marginBottom: '-0.5vh' }}>
                                <h4 
                                  className="font-semibold truncate"
                                  style={{
                                    fontSize: '1.6vh',
                                    textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                                    color: '#d1d5db',
                                    fontWeight: '600'
                                  }}
                                >
                                  {injury.playerName}
                                </h4>
                                <span 
                                  className=""
                                  style={{
                                    fontSize: '1.2vh',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    padding: '0.2vh 0.6vh',
                                    borderRadius: '0.3vh',
                                    color: '#d1d5db'
                                  }}
                                >
                                  {injury.position}
                                </span>
                              </div>
                              <div className="flex items-center" style={{ gap: '0vh', marginTop: '-1vh' }}>
                                <p 
                                  className="truncate"
                                  style={{
                                    fontSize: '1.6vh',
                                    textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                                    color: '#ef4444',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {injury.injury}
                                </p>
                                {/* Status Badge */}
                                <div 
                                  className={`rounded font-bold ${getStatusClass(injury.status)}`}
                                  style={{
                                    padding: '0.4vh 0.8vh',
                                    fontSize: '1.4vh',
                                    textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                                    border: 'none'
                                  }}
                                >
                                  {getStatusIcon(injury.status)}
                                </div>
                              </div>
                              {injury.expectedReturn && (
                                <div 
                                  className="text-xs"
                                  style={{
                                    fontSize: '1.3vh',
                                    color: '#d1d5db',
                                    marginTop: '-1.5vh'
                                  }}
                                >
                                  Expected Return: {formatDate(injury.expectedReturn)}
                                </div>
                              )}
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Team 2 Injuries */}
              <div>
                <div 
                  className="flex items-center"
                  style={{
                    gap: '1vh',
                    marginBottom: '1.5vh',
                    padding: '1vh',
                    background: 'rgba(113, 253, 8, 0.05)',
                    borderRadius: '0.8vh',
                    border: '0.1vh solid rgba(113, 253, 8, 0.2)'
                  }}
                >
                  {team2Info?.logo && (
                    <img 
                      src={team2Info.logo} 
                      alt={`${team2Name} logo`}
                      style={{
                        width: '5vh',
                        height: '5vh',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 0.2vh 0.4vh rgba(0, 0, 0, 0.5))'
                      }}
                    />
                  )}
                  <h3 
                    className="font-bold truncate"
                    style={{
                      fontSize: '1.8vh',
                      textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                      flex: 1,
                      color: '#d1d5db',
                      fontWeight: 'bold'
                    }}
                  >
                    {team2Name}
                  </h3>
                  <span 
                    className="text-gray-400 font-medium"
                    style={{
                      fontSize: '1.4vh',
                      background: 'rgba(113, 253, 8, 0.2)',
                      padding: '0.3vh 0.8vh',
                      borderRadius: '0.5vh',
                      border: '0.1vh solid rgba(113, 253, 8, 0.3)'
                    }}
                  >
                    {team2Injuries.length}
                  </span>
                </div>
                
                {team2Injuries.length === 0 ? (
                    <div 
                      className="text-center rounded"
                      style={{
                        padding: '2vh',
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '0.1vh solid rgba(34, 197, 94, 0.3)',
                        borderRadius: '0.8vh',
                        fontSize: '1.6vh',
                        textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                        color: '#fbbf24',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}
                    >
                      NO INJURIES ✅
                    </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1vh' }}>
                    {team2Injuries.map((injury) => (
                      <div 
                        key={injury.id}
                        className="rounded border"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          padding: '1.5vh',
                          border: '0.1vh solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '0.8vh',
                          backdropFilter: 'blur(0.5vh)'
                        }}
                      >
                        <div className="flex items-center" style={{ gap: '1.5vh' }}>
                          {/* Player Image */}
                            <div className="flex-shrink-0">
                              <img 
                                src={`/api/images/player/${encodeURIComponent(injury.playerName)}`}
                                alt={injury.playerName}
                                style={{
                                  width: '5vh',
                                  height: '5vh',
                                  borderRadius: '50%',
                                  border: '0.2vh solid rgba(113, 253, 8, 0.5)',
                                  objectFit: 'cover',
                                  filter: 'drop-shadow(0 0.2vh 0.4vh rgba(0, 0, 0, 0.5))'
                                }}
                              />
                            </div>
                          
                            {/* Player Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center" style={{ gap: '1vh', marginBottom: '-0.5vh' }}>
                                <h4 
                                  className="font-semibold truncate"
                                  style={{
                                    fontSize: '1.6vh',
                                    textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                                    color: '#d1d5db',
                                    fontWeight: '600'
                                  }}
                                >
                                  {injury.playerName}
                                </h4>
                                <span 
                                  className=""
                                  style={{
                                    fontSize: '1.2vh',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    padding: '0.2vh 0.6vh',
                                    borderRadius: '0.3vh',
                                    color: '#d1d5db'
                                  }}
                                >
                                  {injury.position}
                                </span>
                              </div>
                              <div className="flex items-center" style={{ gap: '0vh', marginTop: '-1vh' }}>
                                <p 
                                  className="truncate"
                                  style={{
                                    fontSize: '1.6vh',
                                    textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                                    color: '#ef4444',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {injury.injury}
                                </p>
                                {/* Status Badge */}
                                <div 
                                  className={`rounded font-bold ${getStatusClass(injury.status)}`}
                                  style={{
                                    padding: '0.4vh 0.8vh',
                                    fontSize: '1.4vh',
                                    textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                                    border: 'none'
                                  }}
                                >
                                  {getStatusIcon(injury.status)}
                                </div>
                              </div>
                              {injury.expectedReturn && (
                                <div 
                                  className="text-xs"
                                  style={{
                                    fontSize: '1.3vh',
                                    color: '#d1d5db',
                                    marginTop: '-1.5vh'
                                  }}
                                >
                                  Expected Return: {formatDate(injury.expectedReturn)}
                                </div>
                              )}
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="border-t"
          style={{
            padding: '1.5vh 2vh',
            borderTop: '0.1vh solid rgba(113, 253, 8, 0.2)',
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(0.5vh)'
          }}
        >
          <div className="flex justify-between items-center">
              <div 
                className=""
                style={{
                  fontSize: '1.2vh',
                  textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                  color: '#d1d5db'
                }}
              >
                Updated: {injuries.length > 0 ? formatDate(injuries[0].lastUpdated) : 'N/A'}
              </div>
            <button
              onClick={onClose}
              className="rounded transition-colors hover:bg-gray-600"
              style={{
                padding: '0.8vh 1.5vh',
                fontSize: '1.4vh',
                background: 'rgba(55, 65, 81, 0.8)',
                border: '0.1vh solid rgba(255, 255, 255, 0.2)',
                textShadow: '0 0.1vh 0.2vh rgba(0, 0, 0, 0.8)',
                color: '#d1d5db',
                cursor: 'pointer',
                borderRadius: '0.8vh'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
