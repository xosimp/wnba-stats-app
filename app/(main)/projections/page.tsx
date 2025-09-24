'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ProjectionDataService } from '../../../lib/services/ProjectionDataService';
import { ProjectionRequest, ProjectionResult } from '../../../lib/algorithms/Algorithms';
import { ProjectionHistory, ProjectionHistoryRef } from '../../../components/projections/ProjectionHistory';
import { ProjectionInputForm } from '../../../components/projections/ProjectionInputForm';
import { TeamLogosStrip } from '../../../components/projections/TeamLogosStrip';
import { ProjectionResultsSidebar } from '../../../components/projections/ProjectionResultsSidebar';
import { getPlayerImageFilename } from '../../../lib/utils/completePlayerMapping';

// Define the stat types including combined stats
type StatType = string;

export default function ProjectionsPage() {
  // Add console log to see if function even runs
  console.log('🚨 ProjectionsPage function is running!');
  
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedStat, setSelectedStat] = useState<StatType>('points');
  const [selectedOpponent, setSelectedOpponent] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [sportsbookLine, setSportsbookLine] = useState('');
  const [projection, setProjection] = useState<ProjectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([]);
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [playerDropdownOpen, setPlayerDropdownOpen] = useState(false);
  const [statDropdownOpen, setStatDropdownOpen] = useState(false);
  const [opponentDropdownOpen, setOpponentDropdownOpen] = useState(false);
  const [upcomingOpponent, setUpcomingOpponent] = useState<string | null>(null);
  const [logoAnimation, setLogoAnimation] = useState(false);
  const [playerTeam, setPlayerTeam] = useState<string | null>(null);

  // Add CSS keyframes for animations and remove extra spacing
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      body, html {
        margin: 0 !important;
        padding: 0 !important;
      }
      .projections-page {
        margin-bottom: 0 !important;
        padding-bottom: 0 !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Ref for ProjectionHistory component to refresh after new projections
  const projectionHistoryRef = useRef<ProjectionHistoryRef>(null);
  
  const projectionService = ProjectionDataService.getInstance();

  const statTypes = [
    { value: 'points', label: 'Points', icon: '🏀' },
    { value: 'rebounds', label: 'Rebounds', icon: '📊' },
    { value: 'assists', label: 'Assists', icon: '🤝' },
    { value: 'pa', label: 'Points + Assists', icon: '🏀🤝' },
    { value: 'pr', label: 'Points + Rebounds', icon: '🏀📊' },
    { value: 'ra', label: 'Rebounds + Assists', icon: '📊🤝' },
    { value: 'pra', label: 'Points + Rebounds + Assists', icon: '🏀📊🤝' }
  ];

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
      'Golden State Valkyries': '/logos/Golden_State_Valkyries_logo.png',
      // Team abbreviations
      'LVA': '/logos/New_Las_Vegas_Aces_WNBA_logo_2024.png',
      'NYL': '/logos/New_York_Liberty_logo.png',
      'CON': '/logos/Connecticut_Sun_logo.png',
      'MIN': '/logos/Minnesota_Lynx_logo.png',
      'PHX': '/logos/Phoenix_Mercury_logo.png',
      'PHO': '/logos/Phoenix_Mercury_logo.png',
      'SEA': '/logos/Seattle_Storm_(2021)_logo.png',
      'WAS': '/logos/Washington_Mystics_logo.png',
      'ATL': '/logos/Atlanta_Dream_logo.png',
      'CHI': '/logos/Chicago_Sky_logo.png',
      'DAL': '/logos/Dallas_Wings_logo.png',
      'IND': '/logos/Indiana_Fever_logo.png',
      'LAS': '/logos/Los_Angeles_Sparks_logo.png',
      'GSV': '/logos/Golden_State_Valkyries_logo.png',
      'GV': '/logos/Golden_State_Valkyries_logo.png',
      'GS': '/logos/Golden_State_Valkyries_logo.png'
    };
    
    return logoMap[teamName] || null;
  };

  useEffect(() => {
    const loadAvailableData = async () => {
      setLoading(true);
      try {
        
        // Check what seasons are available
        const availableSeasons = await projectionService.getAvailableSeasons();
        
        const [players, teams] = await Promise.all([
          projectionService.getAvailablePlayers(),
          projectionService.getAvailableTeams()
        ]);
        
        setAvailablePlayers(players);
        setAvailableTeams(teams);
        setError('');
      } catch (error) {
        console.error('Error loading available data:', error);
        setError('Failed to load available data');
      } finally {
        setLoading(false);
      }
    };

    loadAvailableData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Check if click is inside any dropdown
      const isInsidePlayerDropdown = target.closest('[data-dropdown="player"]');
      const isInsideStatDropdown = target.closest('[data-dropdown="stat"]');
      const isInsideOpponentDropdown = target.closest('[data-dropdown="opponent"]');
      
      if (playerDropdownOpen && !isInsidePlayerDropdown) {
        setPlayerDropdownOpen(false);
      }
      if (statDropdownOpen && !isInsideStatDropdown) {
        setStatDropdownOpen(false);
      }
      if (opponentDropdownOpen && !isInsideOpponentDropdown) {
        setOpponentDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [playerDropdownOpen, statDropdownOpen, opponentDropdownOpen]);

  const generateProjection = async () => {
    console.log('🔄 Starting projection generation...');
    console.log('Selected player:', selectedPlayer);
    console.log('Selected opponent:', selectedOpponent);
    console.log('Selected stat:', selectedStat);
    
    if (!selectedPlayer || !selectedOpponent) {
      setError('Please select both a player and opponent');
      return;
    }

    setProjection(null);
    setLoading(true);
    setError('');

    try {
      console.log('Getting player team...');
      // Get player's actual team
      const playerTeam = await projectionService.getPlayerTeam(selectedPlayer);
      console.log('Player team result:', playerTeam);
      
      if (!playerTeam) {
        setError('Unable to determine player team. Please try again.');
        return;
      }

      // Generate a synthetic game ID for the projection (limited to 20 chars)
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      // Create a shorter game ID by using team abbreviations and limiting length
      const teamAbbr = playerTeam.substring(0, 3).toUpperCase();
      const oppAbbr = selectedOpponent.substring(0, 3).toUpperCase();
      const gameId = `${dateStr}_${teamAbbr}_${oppAbbr}`;
      
      // Fetch teammate injuries for the player's team
      console.log('Fetching teammate injuries for team:', playerTeam);
      let teammateInjuries: string[] = [];
      try {
        teammateInjuries = await projectionService.getTeammateInjuries(playerTeam, new Date().toISOString().split('T')[0]);
        console.log('Teammate injuries fetched successfully:', teammateInjuries);
      } catch (error) {
        console.error('Error fetching teammate injuries:', error);
        // Fallback: manually add Caitlin Clark for Indiana
        if (playerTeam === 'Indiana Fever' || playerTeam === 'IND') {
          teammateInjuries = ['Caitlin Clark'];
          console.log('Using fallback injury data for Indiana:', teammateInjuries);
        }
      }
      
      const request: ProjectionRequest = {
        playerName: selectedPlayer,
        team: playerTeam,
        opponent: selectedOpponent,
        statType: selectedStat as any, // Type assertion to handle assists
        isHome,
        gameDate: new Date().toISOString().split('T')[0],
        gameId: gameId,
        sportsbookLine: sportsbookLine ? parseFloat(sportsbookLine) : undefined,
        daysRest: 2, // This would be calculated from last game
        teammateInjuries: teammateInjuries
      };

      console.log('Projection request:', request);
      console.log('Calling projectionService.generateProjection...');
      
      let result;
      
      // Handle main stat types (points, rebounds, assists) using trained models
      if (['points', 'rebounds', 'assists'].includes(selectedStat)) {
        console.log(`🎯 Generating ${selectedStat} projection using trained model...`);
        try {
          const modelResponse = await fetch('/api/projections/stat-model', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              playerName: request.playerName,
              team: request.team,
              opponent: request.opponent,
              statType: selectedStat,
              isHome: request.isHome,
              gameDate: request.gameDate,
              daysRest: request.daysRest,
              sportsbookLine: request.sportsbookLine?.toString(),
              teammateInjuries: request.teammateInjuries
            }),
          });

          if (modelResponse.ok) {
            const modelData = await modelResponse.json();
            if (modelData.success) {
              result = modelData.result;
              console.log(`${selectedStat} projection result:`, result);
            } else {
              console.error(`${selectedStat} projection API error:`, modelData.message);
              setError(`Error generating ${selectedStat} projection: ${modelData.message}`);
              setLoading(false);
              return;
            }
          } else {
            console.error(`${selectedStat} projection API error:`, modelResponse.status);
            setError(`Error generating ${selectedStat} projection. Please try again.`);
            setLoading(false);
            return;
          }
        } catch (modelError) {
          console.error(`Error calling ${selectedStat} projection API:`, modelError);
          setError(`Error generating ${selectedStat} projection. Please try again.`);
          setLoading(false);
          return;
        }
      } else {
        // Use existing projection service for other stat types (combined stats)
        result = await projectionService.generateProjection(request);
      }
      
      console.log('Projection result:', result);
      
      if (result) {
              setProjection(result);
        
        // Check if a projection already exists for today
        const hasExistingProjection = await projectionService.hasProjectionToday(request.playerName, request.statType);
        
        if (hasExistingProjection) {
          // Show message that projection already exists for today
          setMessage(`A ${request.statType} projection for ${request.playerName} already exists for today. Generating a new projection will update the existing one.`);
          setError('');
        } else {
          setMessage(null);
        }
        
        // Save projection to database (will automatically handle daily deduplication)
        console.log('Saving projection to database...');
        await projectionService.saveProjection(result, request);
        console.log('Projection saved successfully');
        
        // Refresh history after generating a new projection
        if (projectionHistoryRef.current) {
          projectionHistoryRef.current.refreshHistory();
        }
      } else {
        setError('Unable to generate projection. Please check player data availability.');
      }
    } catch (error) {
      console.error('Error generating projection:', error);
      setError('Error generating projection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'OVER': return {color: '#71FD08'}; // project green
      case 'UNDER': return {color: '#f87171'}; // red-400
      case 'PASS': return {color: '#facc15'}; // yellow-400
      default: return {color: '#9ca3af'}; // gray-400
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return {color: '#71FD08'}; // project green
      case 'MEDIUM': return {color: '#FFD700'}; // gold/mustard from Top 1%
      case 'HIGH': return {color: '#f87171'}; // red-400
      default: return {color: '#9ca3af'}; // gray-400
    }
  };

    return (
    <>

      <div className="dashboard-page projections-page pt-24 px-8" style={{ 
        margin: 0, 
        paddingTop: 'clamp(80px, 8vh, 120px)',
        paddingBottom: 'clamp(20px, 3vh, 40px)',
        marginBottom: '0px',
        minHeight: '100vh',
        position: 'relative',
        zIndex: 1,
        background: 'linear-gradient(135deg, #111827 0%, #000000 50%, #111827 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}>
        <div className="max-w-7xl mx-auto" style={{ 
          minHeight: 'clamp(60vh, 70vh, 80vh)',
          paddingBottom: 'clamp(20px, 3vh, 40px)'
        }}>
        
        {/* NBA Projections Coming Soon Text */}
        <div className="text-center mb-4">
          <p style={{
            fontStyle: 'italic',
            color: '#9ca3af',
            fontSize: 'clamp(1rem, 1.5vw, 1.125rem)',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
          }}>
            NBA projections coming soon
          </p>
        </div>

        {/* Page Header */}
        <div className="text-center mb-8" style={{marginTop: '15px'}}>
          <div className="flex items-center justify-center mb-4">
            <div style={{
              flex: '1.3',
              height: '4px',
              backgroundColor: '#71FD08',
              borderRadius: '2px',
              marginLeft: 'clamp(1rem, 2vw, 2rem)'
            }}></div>
            <h2 className="font-bold text-gray-300 flex-shrink-0" style={{
              textShadow: '2px 2px 4px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.8)',
              color: '#d1d5db',
              marginLeft: 'clamp(1rem, 2vw, 2rem)',
              marginRight: 'clamp(1rem, 2vw, 2rem)',
              fontSize: 'clamp(2rem, 4vw, 3rem)'
            }}>
              Projections
            </h2>
            <div style={{
              flex: '1.3',
              height: '4px',
              backgroundColor: '#71FD08',
              borderRadius: '2px',
              marginRight: 'clamp(1rem, 2vw, 2rem)'
            }}></div>
          </div>
        </div>



        {/* Main Content and Projection Results */}
        <div className="flex gap-8 justify-between" style={{ minHeight: 'clamp(50vh, 60vh, 70vh)' }}>
          {/* Projection History - Left Side */}
          <div className="flex-shrink-0" style={{
            width: 'clamp(250px, 20vw, 290px)',
            paddingLeft: 'clamp(1rem, 2vw, 2rem)'
          }}>
            <div className="bg-gray-800/50 backdrop-blur-sm border-2 border-[#71FD08] shadow-xl relative" style={{
              borderRadius: 'clamp(12px, 1.5vw, 16px)',
              height: 'clamp(589px, 69vh, 735px)',
              padding: 'clamp(1rem, 2vw, 1.5rem)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.9), 0 0 20px rgba(113, 253, 8, 0.3)',
              backgroundImage: `
                radial-gradient(circle at 25% 25%, rgba(113, 253, 8, 0.03) 1px, transparent 1px),
                radial-gradient(circle at 75% 75%, rgba(113, 253, 8, 0.03) 1px, transparent 1px),
                linear-gradient(45deg, rgba(113, 253, 8, 0.02) 25%, transparent 25%, transparent 75%, rgba(113, 253, 8, 0.02) 75%),
                linear-gradient(-45deg, rgba(113, 253, 8, 0.02) 25%, transparent 25%, transparent 75%, rgba(113, 253, 8, 0.02) 75%)
              `,
              backgroundSize: '20px 20px, 20px 20px, 40px 40px, 40px 40px',
              backgroundPosition: '0 0, 10px 10px, 0 0, 20px 20px'
            }}>
              <h3 className="font-bold text-center" style={{
                color: '#71FD08',
                textShadow: '2px 2px 4px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.8), 2px -2px 4px rgba(0,0,0,0.8), -2px 2px 4px rgba(0,0,0,0.8)',
                backgroundColor: '#0A0718',
                padding: 'clamp(6px, 1vw, 8px) clamp(12px, 1.5vw, 16px)',
                borderRadius: 'clamp(8px, 1vw, 12px)',
                border: '1px solid #1F2937',
                width: 'fit-content',
                margin: '-16px auto 16px auto',
                fontSize: 'clamp(1rem, 1.5vw, 1.25rem)'
              }}>Projection History</h3>
              {selectedPlayer ? (
                <ProjectionHistory 
                  key={selectedPlayer} 
                  playerName={selectedPlayer} 
                  ref={projectionHistoryRef} 
                />
              ) : (
                <div className="text-center mt-8">
                  <p style={{color: '#d1d5db'}}>Select a player to view their projection history</p>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1" style={{
            marginLeft: '0px',
            maxWidth: 'clamp(600px, 50vw, 800px)'
          }}>
            {/* Projection Input Form */}
            <ProjectionInputForm
              selectedPlayer={selectedPlayer}
              setSelectedPlayer={setSelectedPlayer}
              selectedStat={selectedStat}
              setSelectedStat={(v) => setSelectedStat(v as any)}
              selectedOpponent={selectedOpponent}
              setSelectedOpponent={setSelectedOpponent}
              isHome={isHome}
              setIsHome={setIsHome}
              sportsbookLine={sportsbookLine}
              setSportsbookLine={setSportsbookLine}
              availablePlayers={availablePlayers}
              availableTeams={availableTeams}
              playerDropdownOpen={playerDropdownOpen}
              setPlayerDropdownOpen={setPlayerDropdownOpen}
              statDropdownOpen={statDropdownOpen}
              setStatDropdownOpen={setStatDropdownOpen}
              opponentDropdownOpen={opponentDropdownOpen}
              setOpponentDropdownOpen={setOpponentDropdownOpen}
              upcomingOpponent={upcomingOpponent}
              setUpcomingOpponent={setUpcomingOpponent}
              logoAnimation={logoAnimation}
              setLogoAnimation={setLogoAnimation}
              loading={loading}
              onGenerate={generateProjection}
              statTypes={statTypes}
              projectionService={projectionService}
            />

              {/* Team Logos Strip - Player and Opponent Images */}
              <TeamLogosStrip
                selectedPlayer={selectedPlayer}
                selectedOpponent={selectedOpponent}
                playerTeam={playerTeam}
                logoAnimation={logoAnimation}
                getTeamLogo={getTeamLogo}
                getPlayerImageFilename={getPlayerImageFilename}
              />

              {error && (
                <div className="mt-4 p-4 rounded-lg" style={{marginTop: 'calc(1rem + 7px)', color: '#dc2626'}}>
                  {error}
                </div>
              )}

              {message && (
                <div className="mt-4 p-4 bg-blue-900/50 border border-blue-500 rounded-lg text-blue-300">
                  {message}
                </div>
              )}

              {loading && (
                <div className="mt-4 p-4 bg-blue-900/50 border border-blue-500 rounded-lg text-blue-300">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                    Loading available data...
                  </div>
                </div>
              )}

          </div>

          {/* Projection Results Sidebar */}
          <ProjectionResultsSidebar
            projection={projection as any}
            sportsbookLine={sportsbookLine}
            getRecommendationColor={getRecommendationColor}
            getRiskLevelColor={getRiskLevelColor}
          />
        </div>

        </div>
      </div>

      {/* Notes positioned with proper viewport-based sizing */}
      {/* Center Information Section */}
      <div style={{
        position: 'absolute',
        top: 'calc(clamp(75vh, 80vh, 85vh))',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: 'clamp(6px, 1vw, 8px) clamp(8px, 1.5vw, 12px)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: 'clamp(6px, 1vw, 8px)',
        fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
        color: '#93c5fd',
        width: 'clamp(500px, 40vw, 620px)',
        textAlign: 'center',
        zIndex: 2
      }}>
        💡 <strong>Note:</strong> Projections are based on historical data, recent form, opponent analysis, and advanced statistical modeling.
        <br />
        Always use projections as one tool in your betting strategy, not as the sole decision maker.
      </div>

      {/* Note about projection limits */}
      <div style={{
        position: 'absolute',
        top: 'calc(clamp(75vh, 80vh, 85vh))',
        left: 'clamp(1rem, 2vw, 2rem)',
        padding: 'clamp(6px, 1vw, 8px) clamp(8px, 1.5vw, 12px)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: 'clamp(6px, 1vw, 8px)',
        fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
        color: '#93c5fd',
        width: 'clamp(200px, 18vw, 265px)',
        textAlign: 'center',
        zIndex: 2
      }}>
        💡 <strong>Note:</strong> Only one projection per player/stat per day is saved to prevent duplicate history entries.
      </div>

      {/* Note about hovering over i icons */}
      <div style={{
        position: 'absolute',
        top: 'calc(clamp(75vh, 80vh, 85vh))',
        right: 'clamp(1rem, 2vw, 2rem)',
        padding: 'clamp(6px, 1vw, 8px) clamp(8px, 1.5vw, 12px)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: 'clamp(6px, 1vw, 8px)',
        fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
        color: '#93c5fd',
        width: 'clamp(200px, 18vw, 265px)',
        textAlign: 'center',
        zIndex: 2
      }}>
        💡 <strong>Note:</strong> Hover over the &quot;i&quot; icons for detailed explanations of each metric and insight.
      </div>
    </>
  );
} 