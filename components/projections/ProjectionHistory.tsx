'use client';

import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { ProjectionDataService } from '../../lib/services/ProjectionDataService';

interface ProjectionHistoryProps {
  playerName?: string;
}

export interface ProjectionHistoryRef {
  refreshHistory: () => Promise<void>;
}

const ProjectionHistory = forwardRef<ProjectionHistoryRef, ProjectionHistoryProps>(({ playerName }, ref) => {
  const [recentProjections, setRecentProjections] = useState<any[]>([]);
  const [todayProjections, setTodayProjections] = useState<any[]>([]);
  const [accuracyStats, setAccuracyStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const projectionService = ProjectionDataService.getInstance();


  // Helper function to get team logo path
  const getTeamLogo = (teamName: string | null): string | null => {
    if (!teamName) return null;
    
    const logoMap: { [key: string]: string } = {
      // Full team names
      'Las Vegas Aces': '/logos/New_Las_Vegas_Aces_WNBA_logo_2024.png',
      'New York Liberty': '/logos/New_York_Liberty_logo.png',
      'Connecticut Sun': '/logos/Connecticut_Sun_logo.png',
      'Minnesota Lynx': '/logos/Minnesota_Lynx_logo.png',
      'Phoenix Mercury': '/logos/Phoenix_Mercury_logo.png',
      'Seattle Storm': '/logos/Seattle_Storm_(2021)_logo.png',
      'Washington Mystics': '/logos/Washington_Mystics_logo.png',
      'Atlanta Dream': '/logos/Atlanta_Dream_logo.png',
      'Chicago Sky': '/logos/Chicago_Sky_logo.png',
      'Dallas Wings': '/logos/Dallas_Wings_logo.png',
      'Indiana Fever': '/logos/Indiana_Fever_logo.png',
      'Los Angeles Sparks': '/logos/Los_Angeles_Sparks_logo.png',
      // Team abbreviations
      'LVA': '/logos/New_Las_Vegas_Aces_WNBA_logo_2024.png',
      'NYL': '/logos/New_York_Liberty_logo.png',
      'CON': '/logos/Connecticut_Sun_logo.png',
      'MIN': '/logos/Minnesota_Lynx_logo.png',
      'PHX': '/logos/Phoenix_Mercury_logo.png',
      'SEA': '/logos/Seattle_Storm_(2021)_logo.png',
      'WAS': '/logos/Washington_Mystics_logo.png',
      'ATL': '/logos/Atlanta_Dream_logo.png',
      'CHI': '/logos/Chicago_Sky_logo.png',
      'DAL': '/logos/Dallas_Wings_logo.png',
      'IND': '/logos/Indiana_Fever_logo.png',
      'LAS': '/logos/Los_Angeles_Sparks_logo.png'
    };
    
    return logoMap[teamName] || null;
  };

  // Helper function to get stat type abbreviation
  const getStatTypeAbbreviation = (statType: string | null): string => {
    if (!statType) return '';
    
    const abbreviationMap: { [key: string]: string } = {
      'points': 'PTS',
      'rebounds': 'REB',
      'assists': 'AST',
      'points_rebounds': 'PR',
      'points_assists': 'PA',
      'rebounds_assists': 'RA',
      'points_rebounds_assists': 'PRA'
    };
    
    return abbreviationMap[statType.toLowerCase()] || statType.toUpperCase();
  };

  // Helper function to get team abbreviation
  const getTeamAbbreviation = (teamName: string | null): string => {
    if (!teamName) return '';
    
    const abbreviationMap: { [key: string]: string } = {
      'Las Vegas Aces': 'LVA',
      'New York Liberty': 'NYL',
      'Connecticut Sun': 'CON',
      'Minnesota Lynx': 'MIN',
      'Phoenix Mercury': 'PHX',
      'Seattle Storm': 'SEA',
      'Washington Mystics': 'WAS',
      'Atlanta Dream': 'ATL',
      'Chicago Sky': 'CHI',
      'Dallas Wings': 'DAL',
      'Indiana Fever': 'IND',
      'Los Angeles Sparks': 'LAS',
      'Golden State Valkyries': 'GSV'
    };
    
    return abbreviationMap[teamName] || teamName;
  };

  // Expose refresh function to parent component
  useImperativeHandle(ref, () => ({
    refreshHistory: async () => {
      await loadProjectionHistory();
    }
  }));

  useEffect(() => {
    if (playerName) {
      // Reset state when player changes
      setRecentProjections([]);
      setTodayProjections([]);
      setAccuracyStats(null);
      setError(null);
      
      // Load new player's history
      loadProjectionHistory();
      loadAccuracyStats();
    }
  }, [playerName]);

  const loadProjectionHistory = async () => {
    if (!playerName) return;
    
    setLoading(true);
    try {
      console.log(`Loading projection history for ${playerName}...`);
      // Get all projections for this player (not just recent 10)
      const projections = await projectionService.getRecentProjections(playerName, 50);
      console.log(`Received ${projections.length} projections:`, projections);
      
      // Check outcomes for each projection that doesn't have one yet
      const projectionsWithOutcomes = await Promise.all(
        projections.map(async (projection) => {
          // If projection already has an outcome, keep it
          if (projection.outcome && projection.actual_value) {
            return projection;
          }
          
                      try {
              // Check the outcome for this projection using the API
              const response = await fetch('/api/projections/outcome', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  playerName: projection.player_name,
                  projectionDate: projection.created_at,
                  statType: projection.stat_type,
                  projectedValue: projection.projected_value,
                  gameId: projection.game_id,
                  gameDate: projection.game_date,
                  playerTeam: projection.team,
                  opponent: projection.opponent,
                  sportsbookLine: projection.sportsbook_line
                }),
              });

              if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
              }

              const { outcome } = await response.json();
              
              // Return projection with outcome data
              return {
                ...projection,
                outcome: outcome.outcome,
                actual_value: outcome.actualValue,
                sportsbook_line: outcome.sportsbookLine || projection.sportsbook_line
              };
            } catch (error) {
              console.error(`Error checking outcome for projection ${projection.id}:`, error);
              return projection;
            }
        })
      );
      
      setRecentProjections(projectionsWithOutcomes);
      console.log(`Loaded ${projectionsWithOutcomes.length} projections for ${playerName} with outcomes`);
      
      // Filter today's projections
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      const todayProjs = projectionsWithOutcomes.filter(projection => {
        const projectionDate = new Date(projection.created_at).toISOString().split('T')[0];
        return projectionDate === todayString;
      });
      setTodayProjections(todayProjs);
    } catch (error) {
      console.error('Error loading projection history:', error);
      setError('Failed to load projection history');
    } finally {
      setLoading(false);
    }
  };

  const loadAccuracyStats = async () => {
    if (!playerName) return;
    
    try {
      console.log('Loading accuracy stats for player:', playerName);
      const stats = await projectionService.getProjectionAccuracy(playerName);
      console.log('Received accuracy stats:', stats);
      
      if (stats && typeof stats === 'object' && stats.hasOwnProperty('total')) {
        setAccuracyStats(stats);
        setError(null);
      } else {
        console.error('Invalid accuracy stats format:', stats);
        setAccuracyStats({ total: 0, accurate: 0, accuracy: 0 });
        // Don't set error for invalid format - just use defaults
        setError(null);
      }
    } catch (error) {
      console.error('Error loading accuracy stats:', error);
      setAccuracyStats({ total: 0, accurate: 0, accuracy: 0 });
      // Don't show error for expected empty states
      setError(null);
    }
  };

  const formatDate = (dateString: string) => {
    // Extract just the date part (YYYY-MM-DD) to avoid timezone issues
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    
    // Create date using local timezone to avoid day shift
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!playerName) {
    return null;
  }

  // Always show the component, but with appropriate messaging
  return (
    <>
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1F2937;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #71FD08;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #65D800;
        }
      `}</style>
      <div style={{
        backgroundColor: '#0A0718',
        border: '1px solid #1F2937',
        borderRadius: '12px',
        padding: '-13px 16px 4px 16px',
        marginTop: '10px',
        marginBottom: '8px',
        marginLeft: '40px',
        marginRight: '40px',
        animation: 'fadeInUp 0.8s ease-out'
      }}>
        
        {/* Player Name Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '12px',
          padding: '4px 8px',
          marginTop: '3px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{
              color: '#E6E6FA',
              fontSize: '16px',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)'
            }}>
              {playerName}
            </span>
            {recentProjections.length > 0 && recentProjections[0].team && getTeamLogo(recentProjections[0].team) && (
              <img 
                src={getTeamLogo(recentProjections[0].team)!} 
                alt={`${recentProjections[0].team} logo`}
                style={{
                  width: '24px',
                  height: '24px',
                  objectFit: 'contain'
                }}
              />
            )}
          </div>
        </div>
      
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
      
      {/* Accuracy Statistics */}
      {accuracyStats && accuracyStats.total > 0 && (
        <div className="mb-6 p-4 bg-gray-700/50 rounded-lg">
          <h4 className="text-lg font-semibold text-white mb-3">Accuracy Statistics</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{accuracyStats.total}</div>
              <div className="text-sm text-gray-400">Total Projections</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{accuracyStats.accurate}</div>
              <div className="text-sm text-gray-400">Accurate</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{accuracyStats.accuracy.toFixed(1)}%</div>
              <div className="text-sm text-gray-400">Accuracy Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Projections */}
      <div style={{
        maxHeight: '400px',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: '#71FD08 #1F2937'
      }} className="custom-scrollbar">
        {/* Projection count removed for cleaner UI */}
        
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
            <p style={{color: '#d1d5db'}} className="mt-2">Loading...</p>
          </div>
        ) : recentProjections.length > 0 ? (
          <div className="space-y-3">
            {recentProjections.map((projection, index) => (
              <div key={index} style={{
                backgroundColor: 'transparent',
                padding: '16px 24px 5px 24px',
                borderRadius: '12px',
                marginBottom: '16px'
              }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm" style={{color: '#FFB366', transform: 'translateY(-15px)'}}>
                      {formatDate(projection.created_at)}
                    </div>
                    {projection.opponent && (
                      <div className="text-xs" style={{color: '#d1d5db'}}>
                        Matchup:
                      </div>
                    )}
                    <div className="text-xs" style={{color: '#d1d5db'}}>
                      Stat:
                    </div>
                  </div>
                  <div className="text-right">
                    {projection.opponent && (
                      <div className="text-xs" style={{color: '#d1d5db', transform: 'translateY(20px)'}}>
                        {getTeamAbbreviation(projection.opponent)}
                      </div>
                    )}
                    <div className="text-xs" style={{color: '#d1d5db', transform: 'translateY(20px)'}}>
                      {getStatTypeAbbreviation(projection.stat_type)}
                    </div>
                  </div>
                </div>
                
                {/* Recommendation and Edge */}
                {projection.recommendation && (
                  <div className="mt-2 pt-2">
                    {/* Line first */}
                    {projection.sportsbook_line !== undefined && (
                      <div className="flex justify-between items-center">
                        <div className="text-xs" style={{color: '#d1d5db'}}>Line:</div>
                        <div className="text-xs" style={{color: '#d1d5db'}}>{projection.sportsbook_line}</div>
                      </div>
                    )}
                    
                    {/* Edge and Pick */}
                    {projection.edge !== undefined && (
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs" style={{color: '#d1d5db'}}>Edge:</div>
                        <div className="text-sm font-semibold" style={{
                          color: projection.edge > 0 ? '#71FD08' :  // green for positive edge
                                 projection.edge < 0 ? '#f87171' : // red for negative edge
                                 '#d1d5db'  // light gray for zero edge
                        }}>
                          {projection.edge > 0 ? '+' : ''}{projection.edge.toFixed(1)}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-xs" style={{color: '#d1d5db'}}>Pick:</div>
                      <div className="text-sm font-semibold" style={{
                        color: projection.recommendation === 'PASS' ? '#FFD700' :  // yellow/mustard for PASS
                               projection.recommendation === 'OVER' ? '#71FD08' :  // green for OVER
                               projection.recommendation === 'UNDER' ? '#f87171' : // red for UNDER
                               '#d1d5db'  // fallback to light gray
                      }}>
                        {projection.recommendation}
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-xs" style={{color: '#d1d5db'}}>Result:</div>
                      <div className="text-xs font-semibold" style={{
                        color: projection.outcome === 'OVER' ? '#71FD08' :  // green for OVER
                               projection.outcome === 'UNDER' ? '#f87171' : // red for UNDER
                               projection.outcome === 'PUSH' ? '#FFD700' :  // yellow for PUSH
                               '#d1d5db'  // light gray for no outcome yet
                      }}>
                        {projection.outcome && projection.actual_value ? (
                          <div className="flex items-center" style={{ gap: '5px' }}>
                            <span className="text-xs">{projection.outcome}</span>
                            <span className="py-1 text-xs font-bold" style={{
                              backgroundColor: projection.outcome === 'OVER' ? '#71FD08' : 
                                             projection.outcome === 'UNDER' ? '#f87171' : 
                                             projection.outcome === 'PUSH' ? '#FFD700' : 
                                             '#d1d5db',
                              color: '#000000',
                              borderRadius: '4px',
                              paddingLeft: '4px',
                              paddingRight: '4px'
                            }}>
                              {projection.actual_value}
                            </span>
                          </div>
                        ) : (
                          projection.outcome || '-'
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Key Factors section removed for cleaner UI */}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6" style={{color: '#d1d5db', paddingLeft: '24px', paddingRight: '24px'}}>
            <p>No projection history available for this player yet</p>
          </div>
        )}
      </div>
    </div>
    
    {/* Duplicate Projection Notice */}




    </>
  );
});

ProjectionHistory.displayName = 'ProjectionHistory';

export { ProjectionHistory };
