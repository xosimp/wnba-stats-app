import React, { useState, useEffect } from 'react';
import { injuryAPI, Injury } from '../../lib/api/injury-api';

interface TeamInjuryReportProps {
  team1Abbrev: string;
  team2Abbrev: string;
  team1Name: string;
  team2Name: string;
  team1Colors?: string[];
  team2Colors?: string[];
}

export default function TeamInjuryReport({ team1Abbrev, team2Abbrev, team1Name, team2Name, team1Colors, team2Colors }: TeamInjuryReportProps) {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchInjuries = async () => {
      try {
        setLoading(true);
        const data = await injuryAPI.fetchInjuries();
        
        // Filter injuries for the two teams in this game
        const teamInjuries = data.filter(injury => 
          injury.teamAbbrev === team1Abbrev || injury.teamAbbrev === team2Abbrev
        );
        
        setInjuries(teamInjuries);
      } catch (error) {
        console.error('Error fetching injuries:', error);
        setInjuries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInjuries();
  }, [team1Abbrev, team2Abbrev]);

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
      case 'Out': return '';
      case 'Questionable': return '';
      case 'Probable': return '';
      case 'Doubtful': return '';
      case 'Day-to-Day': return '';
      default: return '';
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

  const team1Injuries = injuries.filter(injury => injury.teamAbbrev === team1Abbrev);
  const team2Injuries = injuries.filter(injury => injury.teamAbbrev === team2Abbrev);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div>
      <p>Injury Report - {team1Name} vs {team2Name}</p>
      <p>Injuries: {injuries.length}</p>
    </div>
  );
}
