import React, { useState, useEffect } from 'react';
import styles from './InjuryReport.module.css';
import { injuryAPI, Injury } from '../../lib/api/injury-api';

interface TeamInfo {
  name: string;
  abbrev: string;
  logo: string;
  colors: string[];
}

interface InjuryReportProps {
  onLoadingChange?: (loading: boolean) => void;
}

export default function InjuryReport({ onLoadingChange }: InjuryReportProps) {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'out' | 'questionable' | 'probable' | 'day-to-day'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Notify parent component when loading state changes
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    const fetchInjuries = async () => {
      try {
        setLoading(true);
        // Ensure we bypass any stale cache on first load
        if (typeof injuryAPI.clearCache === 'function') {
          injuryAPI.clearCache();
        }
        const data = await injuryAPI.fetchInjuries();
        console.log('🔍 Fetched injuries from API:', data);
        console.log('🔍 Number of injuries:', data.length);
        setInjuries(data);
        setLastUpdated(new Date());
        // Write to localStorage so PlayerStatsGraph can mark injured players
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('injury_cache_latest', JSON.stringify(data));
            console.log('🔍 Updated localStorage with injuries:', data);
          }
        } catch (error) {
          console.error('❌ Error updating localStorage:', error);
        }
      } catch (error) {
        console.error('Error fetching injuries:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInjuries();

    // Set up auto-refresh every 4 hours
    const interval = setInterval(fetchInjuries, 4 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const getTeamInfo = (teamAbbrev: string): TeamInfo => {
    const teamData: Record<string, TeamInfo> = {
      'NYL': { name: 'New York Liberty', abbrev: 'NYL', logo: '/team-logos/liberty.png', colors: ['#006BB6', '#F58426'] },
      'LVA': { name: 'Las Vegas Aces', abbrev: 'LVA', logo: '/team-logos/aces.png', colors: ['#000000', '#C8102E'] },
      'PHX': { name: 'Phoenix Mercury', abbrev: 'PHX', logo: '/team-logos/mercury.png', colors: ['#E56020', '#63727A'] },
      'MIN': { name: 'Minnesota Lynx', abbrev: 'MIN', logo: '/team-logos/lynx.png', colors: ['#236192', '#78BE20'] },
      // Exceptions and additional teams used in injury report
      'WAS': { name: 'Washington Mystics', abbrev: 'WAS', logo: '/team-logos/mystics.png', colors: ['#002B5C', '#E21836'] },
      'CONN': { name: 'Connecticut Sun', abbrev: 'CONN', logo: '/team-logos/sun.png', colors: ['#F37021', '#2C234D'] },
      'GV': { name: 'Golden State Valkyries', abbrev: 'GV', logo: '/team-logos/valkyries.png', colors: ['#1D428A', '#FFC72C'] }
    };
    return teamData[teamAbbrev] || { name: 'Unknown', abbrev: teamAbbrev, logo: '', colors: ['#71FD08'] };
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Out': return styles.statusOut;
      case 'Questionable': return styles.statusQuestionable;
      case 'Probable': return styles.statusProbable;
      case 'Doubtful': return styles.statusDoubtful;
      case 'Day-to-Day': return styles.statusDayToDay;
      default: return styles.statusDefault;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Out': return '❌';
      case 'Questionable': return '❓';
      case 'Probable': return '✅';
      case 'Doubtful': return '⚠️';
      case 'Day-to-Day': return '🔄';
      default: return '❓';
    }
  };

  const filteredInjuries = injuries.filter(injury => {
    if (filter === 'all') return true;
    if (filter === 'day-to-day') return injury.status === 'Day-to-Day';
    return injury.status.toLowerCase() === filter;
  });

  // Debug logging
  console.log('🔍 Current injuries state:', injuries);
  console.log('🔍 Filtered injuries:', filteredInjuries);
  console.log('🔍 Current filter:', filter);

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

  if (loading) {
    return (
      <div className={styles.injuryReportContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <span className={styles.loadingText}>Loading injury report...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.injuryReportContainer}>
      {/* Header */}
      <div className="flex items-center mb-12" style={{ gap: '32px' }}>
        <div style={{
          flex: '1.3',
          height: '4px',
          backgroundColor: '#71FD08',
          borderRadius: '2px',
          marginLeft: '10px'
        }}></div>
        <h1 className="text-7xl font-bold dashboard-heading flex-shrink-0" style={{
          textShadow: '2px 2px 4px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.8), 2px -2px 4px rgba(0,0,0,0.8), -2px 2px 4px rgba(0,0,0,0.8)'
        }}>
          Injury Report
        </h1>
        <div style={{
          flex: '1.3',
          height: '4px',
          backgroundColor: '#71FD08',
          borderRadius: '2px',
          marginRight: '10px'
        }}></div>
      </div>

      {/* Filter Buttons */}
      <div className={styles.filterButtons}>
        <button
          onClick={() => setFilter('all')}
          className={`${styles.filterButton} ${
            filter === 'all' ? styles.filterButtonAll : styles.filterButtonInactive
          }`}
        >
          All ({injuries.length})
        </button>
        <button
          onClick={() => setFilter('out')}
          className={`${styles.filterButton} ${
            filter === 'out' ? styles.filterButtonOut : styles.filterButtonInactive
          }`}
        >
          Out ({injuries.filter(i => i.status === 'Out').length})
        </button>
        <button
          onClick={() => setFilter('questionable')}
          className={`${styles.filterButton} ${
            filter === 'questionable' ? styles.filterButtonQuestionable : styles.filterButtonInactive
          }`}
        >
          Questionable ({injuries.filter(i => i.status === 'Questionable').length})
        </button>
        <button
          onClick={() => setFilter('probable')}
          className={`${styles.filterButton} ${
            filter === 'probable' ? styles.filterButtonProbable : styles.filterButtonInactive
          }`}
        >
          Probable ({injuries.filter(i => i.status === 'Probable').length})
        </button>
        <button
          onClick={() => setFilter('day-to-day')}
          className={`${styles.filterButton} ${
            filter === 'day-to-day' ? styles.filterButtonDayToDay : styles.filterButtonInactive
          }`}
        >
          Day-to-Day ({injuries.filter(i => i.status === 'Day-to-Day').length})
        </button>
      </div>

      {/* Injury List */}
      <div className={styles.injuryList}>
        {filteredInjuries.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateTitle}>No Player Injuries</div>
            <div className={styles.emptyStateSubtitle}>All players are healthy!</div>
          </div>
        ) : (
          filteredInjuries.map((injury) => {
            const teamInfo = getTeamInfo(injury.teamAbbrev);
            return (
              <div
                key={injury.id}
                className={styles.injuryCard}
              >
                <div className={styles.injuryCardContent}>
                  {/* Player Info */}
                  <div className={styles.playerInfo}>
                    {/* Player Image */}
                    <div className={styles.teamLogo}>
                      <img
                        src={`/api/images/player/${encodeURIComponent(injury.playerName)}`}
                        alt={injury.playerName}
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          e.currentTarget.src = '/player_images/jewell_loyd_2987869.png';
                        }}
                      />
                    </div>
                    
                    {/* Player Details */}
                    <div className={styles.playerDetails}>
                      <div className={styles.playerName} style={{color: '#ffffff'}}>
                        {injury.playerName}
                      </div>
                      <div className={styles.playerPosition}>
                        {injury.position}
                      </div>
                      <div className={styles.teamName}>
                        {injury.team}
                      </div>
                    </div>
                  </div>

                  {/* Injury Status */}
                  <div className={styles.injuryStatus}>
                    <div className={styles.statusInfo}>
                      <div className={`${styles.statusDisplay} ${getStatusClass(injury.status)}`}>
                        <span>{getStatusIcon(injury.status)}</span>
                        <span>{injury.status}</span>
                      </div>
                      <div className={styles.injuryDescription}>
                        {injury.injury}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className={styles.additionalInfo}>
                  <div className={styles.additionalInfoContent}>
                    <div className={styles.expectedReturn}>
                      <span className={styles.expectedReturnLabel}>Expected Return:</span>{' '}
                      {injury.expectedReturn ? formatDate(injury.expectedReturn) : 'TBD'}
                    </div>
                    <div className={styles.lastUpdated}>
                      Updated: {formatDate(injury.lastUpdated)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className={styles.injuryReportFooter}>
        <div className={styles.footerContent}>
          <div className={styles.totalInjuries}>
            <span>Total Injuries:</span> {injuries.length}
          </div>
          <div className={styles.injuryCounts}>
            <span>❌ Out: {injuries.filter(i => i.status === 'Out').length}</span>
            <span>❓ Questionable: {injuries.filter(i => i.status === 'Questionable').length}</span>
            <span>✅ Probable: {injuries.filter(i => i.status === 'Probable').length}</span>
            <span>🔄 Day-to-Day: {injuries.filter(i => i.status === 'Day-to-Day').length}</span>
          </div>
        </div>
        <div className={styles.lastUpdated}>
          Last updated: {lastUpdated.toLocaleDateString()} at {lastUpdated.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
} 