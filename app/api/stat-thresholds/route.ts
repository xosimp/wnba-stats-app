import { NextResponse } from 'next/server';
import { PlayerLeagueAveragesService } from '../../../lib/services/PlayerLeagueAveragesService';

// Fallback thresholds in case the JSON file is not available
const fallbackThresholds = {
  points: {
    excellent: 20, // Top 10%
    good: 15,      // Top 25%
    average: 10,   // Average
    poor: 5        // Bottom 25%
  },
  rebounds: {
    excellent: 8,  // Top 10%
    good: 6,       // Top 25%
    average: 4,    // Average
    poor: 2        // Bottom 25%
  },
  assists: {
    excellent: 6,  // Top 10%
    good: 4,       // Top 25%
    average: 2,    // Average
    poor: 1        // Bottom 25%
  },
  steals: {
    excellent: 2,  // Top 10%
    good: 1.5,     // Top 25%
    average: 1,    // Average
    poor: 0.5      // Bottom 25%
  },
  blocks: {
    excellent: 2,  // Top 10%
    good: 1,       // Top 25%
    average: 0.5,  // Average
    poor: 0.2      // Bottom 25%
  },
  turnovers: {
    excellent: 1,  // Low turnovers (good)
    good: 2,       // Acceptable
    average: 3,    // Average
    poor: 4        // High turnovers (bad)
  },
  minutes: {
    excellent: 35, // High minutes (good)
    good: 28,      // Good minutes
    average: 20,   // Average minutes
    poor: 15       // Low minutes
  }
};

export async function GET() {
  try {
    // Try to get dynamic thresholds from the PlayerLeagueAveragesService
    try {
      const service = PlayerLeagueAveragesService.getInstance();
      
      // Check if we have dynamic values loaded, if not use fallback
      const hasDynamicValues = service.getLeagueAverage('points') !== 0 || 
                              service.getTop1PercentThreshold('points') !== 0;
      
      if (!hasDynamicValues) {
        console.warn('⚠️ No dynamic values loaded in service, attempting to calculate fresh values...');
        try {
          await service.updateLeagueAverages();
          
          // Check again after updating
          const hasDynamicValuesAfterUpdate = service.getLeagueAverage('points') !== 0 || 
                                            service.getTop1PercentThreshold('points') !== 0;
          
          if (!hasDynamicValuesAfterUpdate) {
            console.warn('⚠️ Still no dynamic values after updating, using fallback thresholds');
            return NextResponse.json(fallbackThresholds);
          }
        } catch (updateError) {
          console.warn('⚠️ Could not update league averages, using fallback thresholds:', updateError);
          return NextResponse.json(fallbackThresholds);
        }
      }
      
      // Get the current dynamic thresholds
      const leagueAvg = {
        points: service.getLeagueAverage('points'),
        rebounds: service.getLeagueAverage('rebounds'),
        assists: service.getLeagueAverage('assists'),
        steals: service.getLeagueAverage('steals'),
        blocks: service.getLeagueAverage('blocks'),
        turnovers: service.getLeagueAverage('turnovers'),
        minutes: service.getLeagueAverage('minutes')
      };
      
      const top1 = {
        points: service.getTop1PercentThreshold('points'),
        rebounds: service.getTop1PercentThreshold('rebounds'),
        assists: service.getTop1PercentThreshold('assists'),
        steals: service.getTop1PercentThreshold('steals'),
        blocks: service.getTop1PercentThreshold('blocks'),
        turnovers: service.getTop1PercentThreshold('turnovers'),
        minutes: service.getTop1PercentThreshold('minutes')
      };
      
      const bottom1 = {
        points: service.getBottom1PercentThreshold('points'),
        rebounds: service.getBottom1PercentThreshold('rebounds'),
        assists: service.getBottom1PercentThreshold('assists'),
        steals: service.getBottom1PercentThreshold('steals'),
        blocks: service.getBottom1PercentThreshold('blocks'),
        turnovers: service.getBottom1PercentThreshold('turnovers'),
        minutes: service.getBottom1PercentThreshold('minutes')
      };
      
      // Transform the dynamic thresholds to match the expected format
      const transformedThresholds = {
        points: {
          excellent: top1.points,
          good: leagueAvg.points * 1.5, // Good is 1.5x average
          average: leagueAvg.points,
          poor: bottom1.points
        },
        rebounds: {
          excellent: top1.rebounds,
          good: leagueAvg.rebounds * 1.5,
          average: leagueAvg.rebounds,
          poor: bottom1.rebounds
        },
        assists: {
          excellent: top1.assists,
          good: leagueAvg.assists * 1.5,
          average: leagueAvg.assists,
          poor: bottom1.assists
        },
        steals: {
          excellent: top1.steals,
          good: leagueAvg.steals * 1.5,
          average: leagueAvg.steals,
          poor: bottom1.steals
        },
        blocks: {
          excellent: top1.blocks,
          good: leagueAvg.blocks * 1.5,
          average: leagueAvg.blocks,
          poor: bottom1.blocks
        },
        turnovers: {
          excellent: bottom1.turnovers, // Low turnovers are good
          good: leagueAvg.turnovers * 0.8,
          average: leagueAvg.turnovers,
          poor: top1.turnovers // High turnovers are bad
        },
        minutes: {
          excellent: top1.minutes,
          good: leagueAvg.minutes * 1.3,
          average: leagueAvg.minutes,
          poor: bottom1.minutes
        }
      };
      
      console.log('✅ Using dynamic thresholds from PlayerLeagueAveragesService');
      return NextResponse.json(transformedThresholds);
      
    } catch (serviceError) {
      console.warn('⚠️ Could not get dynamic thresholds from service, using fallback thresholds:', serviceError);
      return NextResponse.json(fallbackThresholds);
    }
    
  } catch (error) {
    console.error('Error fetching stat thresholds:', error);
    return NextResponse.json({ error: 'Failed to fetch stat thresholds' }, { status: 500 });
  }
}
