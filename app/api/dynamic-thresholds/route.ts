import { NextResponse } from 'next/server';
import { PlayerLeagueAveragesService } from '../../../lib/services/PlayerLeagueAveragesService';

// This endpoint returns the current dynamic thresholds calculated from the database
// These values are updated by the daily automation script
export async function GET() {
  try {
    // Get dynamic thresholds from the PlayerLeagueAveragesService
    const service = PlayerLeagueAveragesService.getInstance();
    
    // Check if we have dynamic values loaded, if not use fallback
    const hasDynamicValues = service.getLeagueAverage('points') !== 0 || 
                            service.getTop1PercentThreshold('points') !== 0;
    
    if (!hasDynamicValues) {
      console.warn('⚠️ No dynamic values loaded in service, attempting to calculate fresh values...');
      try {
        await service.updateLeagueAverages();
      } catch (updateError) {
        console.warn('⚠️ Could not update league averages:', updateError);
      }
    }
    
    // Get the current dynamic thresholds
    const dynamicThresholds = {
      leagueAvg: {
        points: service.getLeagueAverage('points'),
        rebounds: service.getLeagueAverage('rebounds'),
        assists: service.getLeagueAverage('assists'),
        turnovers: service.getLeagueAverage('turnovers'),
        steals: service.getLeagueAverage('steals'),
        blocks: service.getLeagueAverage('blocks'),
        minutes: service.getLeagueAverage('minutes')
      },
      top1: {
        points: service.getTop1PercentThreshold('points'),
        rebounds: service.getTop1PercentThreshold('rebounds'),
        assists: service.getTop1PercentThreshold('assists'),
        turnovers: service.getTop1PercentThreshold('turnovers'),
        steals: service.getTop1PercentThreshold('steals'),
        blocks: service.getTop1PercentThreshold('blocks'),
        minutes: service.getTop1PercentThreshold('minutes')
      },
      bottom1: {
        points: service.getBottom1PercentThreshold('points'),
        rebounds: service.getBottom1PercentThreshold('rebounds'),
        assists: service.getBottom1PercentThreshold('assists'),
        turnovers: service.getBottom1PercentThreshold('turnovers'),
        steals: service.getBottom1PercentThreshold('steals'),
        blocks: service.getBottom1PercentThreshold('blocks'),
        minutes: service.getBottom1PercentThreshold('minutes')
      }
    };
    
    // Transform to match the expected format for the UI
    const transformedThresholds = {
      points: {
        excellent: dynamicThresholds.top1.points,
        good: dynamicThresholds.leagueAvg.points * 1.5, // Good is 1.5x average
        average: dynamicThresholds.leagueAvg.points,
        poor: dynamicThresholds.bottom1.points
      },
      rebounds: {
        excellent: dynamicThresholds.top1.rebounds,
        good: dynamicThresholds.leagueAvg.rebounds * 1.5,
        average: dynamicThresholds.leagueAvg.rebounds,
        poor: dynamicThresholds.bottom1.rebounds
      },
      assists: {
        excellent: dynamicThresholds.top1.assists,
        good: dynamicThresholds.leagueAvg.assists * 1.5,
        average: dynamicThresholds.leagueAvg.assists,
        poor: dynamicThresholds.bottom1.assists
      },
      steals: {
        excellent: dynamicThresholds.top1.steals,
        good: dynamicThresholds.leagueAvg.steals * 1.5,
        average: dynamicThresholds.leagueAvg.steals,
        poor: dynamicThresholds.bottom1.steals
      },
      blocks: {
        excellent: dynamicThresholds.top1.blocks,
        good: dynamicThresholds.leagueAvg.blocks * 1.5,
        average: dynamicThresholds.leagueAvg.blocks,
        poor: dynamicThresholds.bottom1.blocks
      },
      turnovers: {
        excellent: dynamicThresholds.bottom1.turnovers, // Low turnovers are good
        good: dynamicThresholds.leagueAvg.turnovers * 0.8,
        average: dynamicThresholds.leagueAvg.turnovers,
        poor: dynamicThresholds.top1.turnovers // High turnovers are bad
      },
      minutes: {
        excellent: dynamicThresholds.top1.minutes,
        good: dynamicThresholds.leagueAvg.minutes * 1.3,
        average: dynamicThresholds.leagueAvg.minutes,
        poor: dynamicThresholds.bottom1.minutes
      }
    };
    
    // Check if we got valid values, if not use fallback
    if (dynamicThresholds.top1.steals === 0 || dynamicThresholds.leagueAvg.steals === 0) {
      console.warn('⚠️ Invalid dynamic values, using fallback thresholds');
      const fallbackThresholds = {
        points: { excellent: 20, good: 15, average: 10, poor: 5 },
        rebounds: { excellent: 8, good: 6, average: 4, poor: 2 },
        assists: { excellent: 6, good: 4, average: 2, poor: 1 },
        steals: { excellent: 2, good: 1.5, average: 1, poor: 0.5 },
        blocks: { excellent: 2, good: 1, average: 0.5, poor: 0.2 },
        turnovers: { excellent: 1, good: 2, average: 3, poor: 4 },
        minutes: { excellent: 35, good: 28, average: 20, poor: 15 }
      };
      return NextResponse.json(fallbackThresholds);
    }
    
    console.log('✅ Returning dynamic thresholds from database');
    return NextResponse.json(transformedThresholds);
    
  } catch (error) {
    console.error('Error fetching dynamic thresholds:', error);
    
    // Return fallback thresholds on error
    const fallbackThresholds = {
      points: { excellent: 20, good: 15, average: 10, poor: 5 },
      rebounds: { excellent: 8, good: 6, average: 4, poor: 2 },
      assists: { excellent: 6, good: 4, average: 2, poor: 1 },
      steals: { excellent: 2, good: 1.5, average: 1, poor: 0.5 },
      blocks: { excellent: 2, good: 1, average: 0.5, poor: 0.2 },
      turnovers: { excellent: 1, good: 2, average: 3, poor: 4 },
      minutes: { excellent: 35, good: 28, average: 20, poor: 15 }
    };
    return NextResponse.json(fallbackThresholds);
  }
}
