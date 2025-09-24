'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { StatAlgorithms } from '../../lib/algorithms/Algorithms';

interface PlayerStats {
  points?: number;
  rebounds?: number;
  assists?: number;
  turnovers?: number;
  steals?: number;
  blocks?: number;
  minutes?: number;
}

interface AnimatedStatsProps {
  stats: PlayerStats | null;
  playerName: string;
  playerId?: string;
  onLoadingChange?: (loading: boolean) => void;
}

const statConfig = [
  { key: 'points', label: 'Points' },
  { key: 'rebounds', label: 'Rebounds' },
  { key: 'assists', label: 'Assists' },
  { key: 'turnovers', label: 'Turnovers' },
  { key: 'steals', label: 'Steals' },
  { key: 'blocks', label: 'Blocks' },
  { key: 'minutes', label: 'Minutes' },
];

// Global cache for thresholds since they don't change often
let globalThresholds: any = null;
let thresholdsLoaded = false;

export function AnimatedStats({ stats, playerName, playerId, onLoadingChange }: AnimatedStatsProps) {
  const [thresholds, setThresholds] = useState<any>(globalThresholds);
  const [loading, setLoading] = useState(!thresholdsLoaded);

  useEffect(() => {
    // If thresholds are already loaded globally, use them immediately
    if (thresholdsLoaded && globalThresholds) {
      setThresholds(globalThresholds);
      setLoading(false);
      console.log('✅ Using cached thresholds for player:', playerId);
      return;
    }
    
    // Only fetch if not already loaded
    if (!thresholdsLoaded) {
      console.log('🔄 Fetching thresholds for first time...');
      setLoading(true);
      
      fetch('/api/dynamic-thresholds')
        .then(res => res.json())
        .then(data => {
          // Transform the API data to match StatAlgorithms expected format
          const transformedThresholds = {
            top1: {
              points: data.points.excellent,
              rebounds: data.rebounds.excellent,
              assists: data.assists.excellent,
              steals: data.steals.excellent,
              blocks: data.blocks.excellent,
              minutes: data.minutes.excellent,
              turnovers: data.turnovers.excellent
            },
            bottom1: {
              points: data.points.poor,
              rebounds: data.rebounds.poor,
              assists: data.assists.poor,
              steals: data.steals.poor,
              blocks: data.blocks.poor,
              minutes: data.minutes.poor,
              turnovers: data.turnovers.poor
            },
            leagueAvg: {
              points: data.points.average,
              rebounds: data.rebounds.average,
              assists: data.assists.average,
              steals: data.steals.average,
              blocks: data.blocks.average,
              minutes: data.minutes.average,
              turnovers: data.turnovers.average
            }
          };
          
          // Cache globally for future use
          globalThresholds = transformedThresholds;
          thresholdsLoaded = true;
          setThresholds(transformedThresholds);
          setLoading(false);
          console.log('✅ Loaded and cached thresholds:', transformedThresholds);
        })
        .catch(error => {
          console.error('Error fetching dynamic thresholds:', error);
          // Fallback to built-in thresholds
          setThresholds(null);
          setLoading(false);
        });
    }
  }, [playerId]);

  // Notify parent component when loading state changes
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  if (!stats) return null;

  return (
    <div 
      className="z-50 flex flex-col items-center justify-center w-full"
      style={{ 
        maxWidth: '265px', 
        margin: '-60px auto 0 auto', 
        zIndex: 50, 
        position: 'relative', 
        left: '5px'
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="space-y-3 w-full"
        key={`stats-${playerName}`}
      >


        {/* Stats Grid */}
        <div style={{ background: '#181B23', border: '3px solid black', borderRadius: '12px', boxShadow: '0 0 20px rgba(0,0,0,0.7)', padding: '13px' }}>
          <div style={{ background: '#181B23', border: '3px solid rgb(35, 35, 35)', borderRadius: '9px', padding: '20px 20px 10.5px 20px', boxShadow: '0 0 16px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '35px', marginTop: '-2px', paddingBottom: '9px' }}>
              {statConfig.map((stat, index) => {
                const value = stats[stat.key as keyof PlayerStats];
                if (value === undefined || value === null || value === 0) {
                  return null;
                }

                const color = thresholds
                  ? StatAlgorithms.getStatColor(stat.key as keyof PlayerStats, value, thresholds)
                  : StatAlgorithms.getStatColor(stat.key as keyof PlayerStats, value);
                  
                console.log(`🎨 ${playerName}: ${stat.key} = ${value}, color = ${color}, hasThresholds = ${!!thresholds}`);

                return (
                  <motion.div
                    key={`${playerName}-${stat.key}`}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 1.0, 
                      delay: 0.3 + (index * 0.2),
                      ease: "easeOut"
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span 
                          className="text-sm"
                          style={{ color: '#D1D5DB', fontWeight: 'bold' }}
                        >
                          {stat.label}
                        </span>
                        <svg 
                          style={{ 
                            display: 'inline', 
                            verticalAlign: 'middle', 
                            margin: '0 20px',
                            width: '40px',
                            height: '24px'
                          }} 
                          viewBox="0 0 40 24" 
                          fill="none" 
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path 
                            d="M8 12h24m0 0l-4-4m4 4l-4 4" 
                            stroke="#71FD08" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <div className="text-right">
                        <div className="flex flex-col items-end">
                          <span 
                            className="text-xl"
                            style={{ 
                              color: color,
                              fontWeight: 'bold'
                            }}
                          >
                            {typeof value === 'number' ? value.toFixed(1) : value}
                          </span>
                          
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Legend */}
        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#FFD700', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}></div>
                <span style={{ color: '#FFD700', textShadow: '0 2px 4px rgba(0,0,0,0.8)', fontWeight: 'bold' }}>Top 1%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#FF6B6B', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}></div>
                <span style={{ color: '#FF6B6B', textShadow: '0 2px 4px rgba(0,0,0,0.8)', fontWeight: 'bold' }}>Bottom 1%</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#71FD08', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}></div>
                <span style={{ color: '#71FD08', textShadow: '0 2px 4px rgba(0,0,0,0.8)', fontWeight: 'bold' }}>Above Average</span>
              </div>
            </div>
          </div>
        </div>

        {/* No stats message */}
        {Object.keys(stats).length === 0 && (
          <motion.div
            key={`${playerName}-no-stats`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-center text-gray-400 text-sm"
          >
            No stats available
          </motion.div>
        )}
      </motion.div>
    </div>
  );
} 