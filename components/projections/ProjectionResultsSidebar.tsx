'use client';

import React from 'react';
import type { ProjectionResult } from '../../lib/algorithms/Algorithms';

type ProjectionResultsSidebarProps = {
  projection: ProjectionResult | null;
  sportsbookLine: string;
  getRecommendationColor: (recommendation: string) => { color: string };
  getRiskLevelColor: (riskLevel: string) => { color: string };
};

// Fallback type import for environments without shared types
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ProjectionResultFallback = any;

export function ProjectionResultsSidebar(props: ProjectionResultsSidebarProps) {
  const { projection, sportsbookLine, getRecommendationColor, getRiskLevelColor } = props;

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

  // Debug logging for projection data
  React.useEffect(() => {
    if (projection) {
      console.log('🔍 ProjectionResultsSidebar: Full projection object:', projection);
      console.log('🔍 ProjectionResultsSidebar: recentFormPercentage =', projection.recentFormPercentage);
      console.log('🔍 ProjectionResultsSidebar: matchupAnalysis =', projection.matchupAnalysis);
    }
  }, [projection]);

  return (
    <div className="w-[290px] flex-shrink-0" style={{paddingRight: '32px'}}>
      <div className="bg-gray-800/50 backdrop-blur-sm border-2 border-[#71FD08] p-6 shadow-xl flex flex-col" style={{
        borderRadius: '16px',
        minHeight: '636.2px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.9), 0 0 20px rgba(113, 253, 8, 0.3)',
        backgroundImage: `
          radial-gradient(circle at 30% 30%, rgba(113, 253, 8, 0.03) 1px, transparent 1px),
          radial-gradient(circle at 70% 70%, rgba(113, 253, 8, 0.03) 1px, transparent 1px),
          linear-gradient(60deg, rgba(113, 253, 8, 0.02) 25%, transparent 25%, transparent 75%, rgba(113, 253, 8, 0.02) 75%),
          linear-gradient(-60deg, rgba(113, 253, 8, 0.02) 25%, transparent 25%, transparent 75%, rgba(113, 253, 8, 0.02) 75%)
        `,
        backgroundSize: '22px 22px, 22px 22px, 44px 44px, 44px 44px',
        backgroundPosition: '0 0, 11px 11px, 0 0, 22px 22px'
      }}>
        <h3 className="text-xl font-bold mb-4 text-center" style={{
          color: '#71FD08',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.8), 2px -2px 4px rgba(0,0,0,0.8), -2px 2px 4px rgba(0,0,0,0.8)',
          backgroundColor: '#0A0718',
          padding: '8px 16px',
          borderRadius: '12px',
          border: '1px solid #1F2937',
          width: 'fit-content',
          margin: '10px auto 0 auto'
        }}>Projection Results</h3>

        {projection ? (
          <div style={{
            marginBottom: '0px', 
            position: 'relative', 
            minHeight: '500px',
            animation: 'fadeInUp 0.8s ease-out'
          }}>
            <div className="bg-gray-700/50 rounded-xl p-4 mb-6" style={{paddingLeft: '16px', paddingRight: '16px', marginTop: '20px'}}>
              {sportsbookLine && (
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-4" style={{color: '#d1d5db', marginTop: '-9.5px'}}>
                    <span>Book Line</span>
                    <svg 
                      style={{ 
                        display: 'inline', 
                        verticalAlign: 'middle', 
                        margin: '0 12px',
                        width: '100px',
                        height: '16px',
                        marginTop: '2px'
                      }} 
                      viewBox="0 0 120 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        d="M8 12h104m0 0l-4-4m4 4l-4 4" 
                        stroke="#71FD08" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="font-semibold" style={{color: '#d1d5db'}}>{sportsbookLine}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between" style={{marginTop: '-1.5px'}}>
                <span className="text-sm font-normal" style={{color: '#d1d5db'}}>Projection</span>
                <svg 
                  style={{ 
                    display: 'inline', 
                    verticalAlign: 'middle', 
                    margin: '0 12px',
                    width: '100px',
                    height: '16px',
                    marginTop: '2px'
                  }} 
                  viewBox="0 0 120 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M8 12h104m0 0l-4-4m4 4l-4 4" 
                    stroke="#71FD08" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-2xl font-bold" style={{color: '#d1d5db'}}>
                  {projection.projectedValue.toFixed(1)}
                </span>
              </div>

              <div className="flex justify-between text-sm" style={{color: '#d1d5db', marginTop: '-1.5px'}}>
                <span>Edge</span>
                <svg 
                  style={{ 
                    display: 'inline', 
                    verticalAlign: 'middle', 
                    margin: '0 12px',
                    width: '100px',
                    height: '16px',
                    marginTop: '2px'
                  }} 
                  viewBox="0 0 120 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M8 12h104m0 0l-4-4m4 4l-4 4" 
                    stroke="#71FD08" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-semibold" style={{color: projection.edge > 0 ? '#71FD08' : projection.edge < 0 ? '#f87171' : '#d1d5db'}}>
                  {projection.edge > 0 ? '+' : ''}{projection.edge.toFixed(1)}
                </span>
              </div>
              
              {/* Model Quality Warning */}
              {projection.modelWarning && (
                <div className="mt-3 p-2 rounded text-center" style={{
                  backgroundColor: '#fef3c7',
                  border: '1px solid #f59e0b',
                  color: '#92400e'
                }}>
                  <span className="text-xs font-medium">{projection.modelWarning}</span>
                </div>
              )}
            </div>

            <div style={{position: 'absolute', bottom: '-75px', left: '0', right: '0'}}>
              <div style={{
                backgroundColor: '#0A0718',
                padding: '16px 24px',
                borderRadius: '12px',
                border: '1px solid #1F2937',
                marginTop: '5px',
                marginBottom: '16px',
                marginLeft: '16px',
                marginRight: '16px'
              }}>
                <div className="text-center mb-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span 
                    className="text-sm font-semibold" 
                    style={{
                      color: '#71FD08',
                      transform: 'translateY(-7px)',
                      display: 'inline-block',
                      fontWeight: 'bold',
                      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), -2px -2px 4px rgba(0, 0, 0, 0.8), 2px -2px 4px rgba(0, 0, 0, 0.8), -2px 2px 4px rgba(0, 0, 0, 0.8)'
                    }}
                  >Breakdown</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#71FD08',
                      color: '#000',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      cursor: 'help',
                      transform: 'translateY(-7px)'
                    }}
                    title="Analyzes key factors that influence this player's performance: recent form trends, matchup advantages, and role within the team. Higher scores indicate more favorable conditions for the player to exceed expectations."
                  >i</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm" style={{marginTop: '8px'}}>
                    <span style={{color: '#d1d5db'}}>Recent Form:</span>
                    <span style={{color: '#d1d5db'}}>
                      {(() => {
                        console.log(`🔍 ProjectionResultsSidebar: recentFormPercentage = ${projection.recentFormPercentage}`);
                        if (!projection.recentFormPercentage) return <span style={{color: '#d1d5db'}}>N/A</span> as unknown as string;
                        const recentForm = parseFloat(projection.recentFormPercentage.toString());
                        if (recentForm >= 108) return <span style={{color: '#71FD08'}}>Strong ↗️</span> as unknown as string;
                        if (recentForm >= 100) return <span style={{color: '#71FD08'}}>Good ↗️</span> as unknown as string;
                        if (recentForm >= 90) return <span style={{color: '#9CA3AF'}}>Average</span> as unknown as string;
                        return <span style={{color: '#f87171'}}>Poor</span> as unknown as string;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm" style={{marginTop: '8px'}}>
                    <span style={{color: '#d1d5db'}}>Matchup:</span>
                    <span style={{color: '#d1d5db'}}>
                      {(() => {
                        console.log(`🔍 ProjectionResultsSidebar: matchupAnalysis = ${projection.matchupAnalysis}`);
                        if (!projection.matchupAnalysis) return <span style={{color: '#d1d5db'}}>N/A</span> as unknown as string;
                        // Convert matchup rating to percentage (e.g., 0.35 = 35%)
                        const matchup = projection.matchupAnalysis * 100;
                        if (matchup >= 60) return <span style={{color: '#71FD08'}}>Favorable</span> as unknown as string;
                        if (matchup >= 40) return <span style={{color: '#9CA3AF'}}>Neutral</span> as unknown as string;
                        return <span style={{color: '#f87171'}}>Unfavorable</span> as unknown as string;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm" style={{marginTop: '8px'}}>
                    <span style={{color: '#d1d5db'}}>Injury Impact:</span>
                    <span style={{color: '#d1d5db'}}>
                      {(() => {
                        const hasInjuries = projection.teammateInjuries && projection.teammateInjuries.length > 0;
                        if (!hasInjuries) return <span style={{color: '#9CA3AF'}}>None</span> as unknown as string;
                        const injuryCount = projection.teammateInjuries!.length;
                        if (injuryCount >= 2) return <span style={{color: '#71FD08'}}>High</span> as unknown as string;
                        if (injuryCount === 1) return <span style={{color: '#FFD700'}}>Moderate</span> as unknown as string;
                        return <span style={{color: '#9CA3AF'}}>Low</span> as unknown as string;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm" style={{marginTop: '8px'}}>
                    <span style={{color: '#d1d5db'}}>Usage Rate:</span>
                    <span style={{color: '#d1d5db'}}>
                      {(() => {
                        // Get actual usage rate from features (from advanced stats table)
                        const actualUsageRate = (projection as any).features?.usage_rate || 0;
                        const lineupShift = projection.factors?.lineupShiftMultiplier || 1.0;
                        const hasInjuries = projection.teammateInjuries && projection.teammateInjuries.length > 0;
                        
                        // DEFAULT: Base usage assessment from advanced stats table
                        let usageLevel = 'Average';
                        if (actualUsageRate >= 25) usageLevel = 'High';
                        else if (actualUsageRate >= 20) usageLevel = 'Above Avg';
                        else if (actualUsageRate >= 15) usageLevel = 'Average';
                        else if (actualUsageRate >= 10) usageLevel = 'Below Avg';
                        else usageLevel = 'Low';
                        
                        // INJURY BOOST: Only apply when significant injuries present AND player already has high usage
                        if (hasInjuries && lineupShift >= 1.05 && actualUsageRate >= 20) {
                          // Only boost players who already have high usage (20%+)
                          // Kelsey Mitchell (high usage) gets boosted when CC is out
                          // Damiris Dantas (low usage) doesn't get boosted
                          if (usageLevel === 'Above Avg') usageLevel = 'High';
                          // Don't boost Average or Below Avg players - they don't get more usage
                        }
                        
                        if (usageLevel === 'High') return <span style={{color: '#71FD08'}}>High</span> as unknown as string;
                        if (usageLevel === 'Above Avg') return <span style={{color: '#71FD08'}}>Above Avg</span> as unknown as string;
                        if (usageLevel === 'Average') return <span style={{color: '#9CA3AF'}}>Average</span> as unknown as string;
                        if (usageLevel === 'Below Avg') return <span style={{color: '#FFD700'}}>Below Avg</span> as unknown as string;
                        return <span style={{color: '#f87171'}}>Low</span> as unknown as string;
                      })()}
                    </span>
                  </div>
                  
                  {/* Model Quality Indicator */}
                  {projection.modelQuality && (
                    <div className="flex justify-between text-sm" style={{marginTop: '8px'}}>
                      <span style={{color: '#d1d5db'}}>Model Quality:</span>
                      <span style={{color: '#d1d5db'}}>
                        {(() => {
                          const quality = projection.modelQuality;
                          if (quality === 'Excellent') return <span style={{color: '#71FD08'}}>Excellent</span> as unknown as string;
                          if (quality === 'Good') return <span style={{color: '#71FD08'}}>Good</span> as unknown as string;
                          if (quality === 'Fair') return <span style={{color: '#FFD700'}}>Fair</span> as unknown as string;
                          if (quality === 'Poor') return <span style={{color: '#f87171'}}>Poor</span> as unknown as string;
                          return <span style={{color: '#d1d5db'}}>{quality}</span> as unknown as string;
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                backgroundColor: '#0A0718',
                padding: '16px 24px',
                borderRadius: '12px',
                border: '1px solid #1F2937',
                marginTop: '12px',
                marginBottom: '16px',
                marginLeft: '16px',
                marginRight: '16px'
              }}>
                <div className="text-center mb-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span 
                    className="text-sm font-semibold" 
                    style={{
                      color: '#71FD08',
                      transform: 'translateY(-7px)',
                      display: 'inline-block',
                      fontWeight: 'bold',
                      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), -2px -2px 4px rgba(0, 0, 0, 0.8), 2px -2px 4px rgba(0, 0, 0, 0.8), -2px 2px 4px rgba(0, 0, 0, 0.8)'
                    }}
                  >Risk Assessment</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#71FD08',
                      color: '#000',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      cursor: 'help',
                      transform: 'translateY(-7px)'
                    }}
                    title="Assesses how confident we can be in this projection based on the amount of data available and how consistent the player's performance has been. More games and steady performance = higher confidence."
                  >i</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{color: '#d1d5db'}}>Data Quality:</span>
                    <span style={{color: '#d1d5db'}}>
                      {(() => {
                        const totalGames = projection.seasonGamesCount || 0;
                        return (
                          <>
                            {totalGames >= 20 ? <span style={{color: '#71FD08'}}>Strong</span> : 
                              totalGames >= 10 ? <span style={{color: '#FFD700'}}>Moderate</span> : 
                              <span style={{color: '#f87171'}}>Weak</span>}
                          </>
                        ) as unknown as string;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm" style={{marginTop: '8px'}}>
                    <span style={{color: '#d1d5db'}}>Performance Stability:</span>
                    <span style={{color: '#d1d5db'}}>
                      {(() => {
                        const recentForm = parseFloat(String(projection.recentFormPercentage)) || 100;
                        const variance = Math.abs(recentForm - 100);
                        if (variance <= 5) return <span style={{color: '#71FD08'}}>Consistent →</span> as unknown as string;
                        if (variance <= 15) return <span style={{color: '#FFD700'}}>Moderate →</span> as unknown as string;
                        return <span style={{color: '#f87171'}}>Volatile →</span> as unknown as string;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: '#0A0718',
                padding: '16px 24px',
                borderRadius: '12px',
                border: '1px solid #1F2937',
                marginTop: '12px',
                marginBottom: '16px',
                marginLeft: '16px',
                marginRight: '16px'
              }}>
                <div className="text-center mb-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span 
                    className="text-sm font-semibold" 
                    style={{
                      color: '#71FD08',
                      transform: 'translateY(-7px)',
                      display: 'inline-block',
                      fontWeight: 'bold',
                      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), -2px -2px 4px rgba(0, 0, 0, 0.8), 2px -2px 4px rgba(0, 0, 0, 0.8), -2px 2px 4px rgba(0, 0, 0, 0.8)'
                    }}
                  >Betting Insight</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#71FD08',
                      color: '#000',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      cursor: 'help',
                      transform: 'translateY(-7px)'
                    }}
                    title="Gives betting recommendations by comparing our projection to the sportsbook line. OVER means we expect the player to exceed the line, UNDER means we expect them to fall short, and PASS means the edge isn't strong enough for a confident recommendation."
                  >i</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{color: '#d1d5db'}}>Pick:</span>
                    <span style={{fontWeight: '600', ...getRecommendationColor(projection.recommendation)}}>
                      {projection.recommendation}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm" style={{marginTop: '8px'}}>
                    <span style={{color: '#d1d5db'}}>Confidence:</span>
                    <span style={{color: '#d1d5db'}}>{(projection.confidenceScore * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between text-sm" style={{marginTop: '8px'}}>
                    <span style={{color: '#d1d5db'}}>Risk Level:</span>
                    <span style={{fontWeight: '600', ...getRiskLevelColor(projection.riskLevel)}}>
                      {projection.riskLevel}
                    </span>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center mt-8" style={{paddingLeft: '24px', paddingRight: '24px'}}>
            <p style={{color: '#d1d5db'}}>Generate a projection to see results here</p>
          </div>
        )}
      </div>
    </div>
  );
}


