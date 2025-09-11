import { 
  ProjectionEngine, 
  ProjectionRequest, 
  PlayerGameLog, 
  TeamDefensiveStats,
  PROJECTION_WEIGHTS 
} from './Algorithms';

// Mock data for testing
const mockPlayerStats: PlayerGameLog[] = [
  {
    playerName: 'Test Player',
    team: 'Test Team',
    gameId: '1',
    gameDate: '2025-01-01',
    opponent: 'Opponent A',
    points: 15,
    rebounds: 5,
    assists: 3,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    minutes: 30,
    isHome: true
  },
  {
    playerName: 'Test Player',
    team: 'Test Team',
    gameId: '2',
    gameDate: '2025-01-03',
    opponent: 'Opponent B',
    points: 18,
    rebounds: 6,
    assists: 4,
    steals: 2,
    blocks: 1,
    turnovers: 1,
    minutes: 32,
    isHome: false
  },
  {
    playerName: 'Test Player',
    team: 'Test Team',
    gameId: '3',
    gameDate: '2025-01-05',
    opponent: 'Opponent A',
    points: 12,
    rebounds: 4,
    assists: 2,
    steals: 0,
    blocks: 0,
    turnovers: 3,
    minutes: 28,
    isHome: true
  },
  {
    playerName: 'Test Player',
    team: 'Test Team',
    gameId: '4',
    gameDate: '2025-01-07',
    opponent: 'Opponent C',
    points: 20,
    rebounds: 7,
    assists: 5,
    steals: 1,
    blocks: 1,
    turnovers: 1,
    minutes: 35,
    isHome: false
  },
  {
    playerName: 'Test Player',
    team: 'Test Team',
    gameId: '5',
    gameDate: '2025-01-09',
    opponent: 'Opponent B',
    points: 16,
    rebounds: 5,
    assists: 3,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    minutes: 31,
    isHome: true
  }
];

const mockTeamDefensiveStats: TeamDefensiveStats[] = [
  {
    team: 'Opponent A',
    season: '2025',
    statType: 'points',
    homeAvgAllowed: 16.0,
    awayAvgAllowed: 15.5,
    overallAvgAllowed: 15.75,
    lastUpdated: new Date()
  },
  {
    team: 'Opponent B',
    season: '2025',
    statType: 'points',
    homeAvgAllowed: 14.0,
    awayAvgAllowed: 13.5,
    overallAvgAllowed: 13.75,
    lastUpdated: new Date()
  },
  {
    team: 'Opponent C',
    season: '2025',
    statType: 'points',
    homeAvgAllowed: 18.0,
    awayAvgAllowed: 17.5,
    overallAvgAllowed: 17.75,
    lastUpdated: new Date()
  }
];

const mockProjectionRequest: ProjectionRequest = {
  playerName: 'Test Player',
  team: 'Test Team',
  opponent: 'Opponent A',
  statType: 'points',
  isHome: true,
  gameDate: '2025-01-11',
  gameId: '20250111_TES_OPP',
  sportsbookLine: 16.5,
  daysRest: 2,
  teammateInjuries: []
};

describe('ProjectionEngine', () => {
  
  describe('Basic Projection Calculation', () => {
    it('should calculate projection with all factors', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      expect(result).toBeDefined();
      expect(result.projectedValue).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
      expect(result.factors).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.edge).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });
    
    it('should handle empty player stats gracefully', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        [],
        mockTeamDefensiveStats
      );
      
      expect(result.projectedValue).toBe(0);
      expect(result.confidenceScore).toBeLessThan(0.5);
    });
  });
  
  describe('Factor Calculations', () => {
    it('should calculate season average correctly', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      // Expected season average: (15+18+12+20+16)/5 = 16.2
      expect(result.factors.seasonAverage).toBeCloseTo(16.2, 1);
    });
    
    it('should calculate recent form with exponential weighting', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      // Recent form should be weighted average of last 10 games (we have 5)
      expect(result.factors.recentForm).toBeGreaterThan(0);
      expect(result.factors.recentForm).toBeCloseTo(16.2, 1); // Should be close to season average
    });
    
    it('should calculate opponent defense factor correctly', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      // Opponent A allows 15.75 points, league average is 13.2
      // Factor should be 15.75/13.2 ≈ 1.19
      expect(result.factors.opponentDefense).toBeCloseTo(1.19, 2);
    });
    
    it('should calculate home/away factor correctly', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      // Player is home, so factor should be home/away ratio
      expect(result.factors.homeAway).toBeGreaterThan(0);
    });
    
    it('should calculate rest factor correctly', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      // 2 days rest should give factor of 1.0 (baseline)
      expect(result.factors.restFactor).toBe(1.0);
    });
    
    it('should calculate injury impact factor correctly', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      // No injuries should give factor of 1.0 (neutral)
      expect(result.factors.injuryImpact).toBe(1.0);
    });
    
    it('should calculate head-to-head factor correctly', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      // Should have head-to-head data vs Opponent A
      expect(result.factors.headToHead).toBeGreaterThan(0);
    });
  });
  
  describe('Advanced Analytics', () => {
    it('should calculate trend analysis correctly', () => {
      const trend = ProjectionEngine.calculateTrendAnalysis(mockPlayerStats, 'points', 5);
      
      expect(trend.slope).toBeDefined();
      expect(trend.rSquared).toBeGreaterThanOrEqual(0);
      expect(trend.rSquared).toBeLessThanOrEqual(1);
      expect(trend.trend).toBeDefined();
    });
    
    it('should calculate moving averages correctly', () => {
      const movingAverages = ProjectionEngine.calculateMovingAverages(mockPlayerStats, 'points');
      
      expect(movingAverages.threeGame).toBeGreaterThan(0);
      expect(movingAverages.fiveGame).toBeGreaterThan(0);
      expect(movingAverages.tenGame).toBeGreaterThan(0);
      expect(movingAverages.twentyGame).toBeGreaterThan(0);
    });
    
    it('should calculate volatility correctly', () => {
      const volatility = ProjectionEngine.calculateVolatility(mockPlayerStats, 'points');
      
      expect(volatility).toBeGreaterThanOrEqual(0);
    });
    
    it('should calculate consistency score correctly', () => {
      const consistency = ProjectionEngine.calculateConsistencyScore(mockPlayerStats, 'points');
      
      expect(consistency).toBeGreaterThanOrEqual(0);
      expect(consistency).toBeLessThanOrEqual(1);
    });
    
    it('should calculate momentum score correctly', () => {
      const momentum = ProjectionEngine.calculateMomentumScore(mockPlayerStats, 'points');
      
      expect(momentum).toBeGreaterThanOrEqual(0);
      expect(momentum).toBeLessThanOrEqual(1);
    });
    
    it('should calculate matchup strength correctly', () => {
      const matchupStrength = ProjectionEngine.calculateMatchupStrength(
        mockPlayerStats, 
        'Opponent A', 
        'points'
      );
      
      expect(matchupStrength).toBeGreaterThanOrEqual(0);
      expect(matchupStrength).toBeLessThanOrEqual(1);
    });
  });
  
  describe('Confidence Scoring', () => {
    it('should calculate basic confidence score correctly', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
    });
    
    it('should calculate enhanced confidence score correctly', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      const enhancedConfidence = ProjectionEngine.calculateEnhancedConfidence(
        result.factors,
        mockPlayerStats,
        'points'
      );
      
      expect(enhancedConfidence).toBeGreaterThanOrEqual(0);
      expect(enhancedConfidence).toBeLessThanOrEqual(1);
    });
  });
  
  describe('Risk Assessment', () => {
    it('should determine risk level based on confidence', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.riskLevel);
    });
    
    it('should calculate edge vs sportsbook line correctly', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      const expectedEdge = result.projectedValue - mockProjectionRequest.sportsbookLine!;
      expect(result.edge).toBeCloseTo(expectedEdge, 2);
    });
    
    it('should generate appropriate betting recommendation', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      expect(['OVER', 'UNDER', 'PASS']).toContain(result.recommendation);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle zero values gracefully', () => {
      const zeroStats: PlayerGameLog[] = [
        {
          ...mockPlayerStats[0],
          points: 0,
          rebounds: 0,
          assists: 0
        }
      ];
      
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        zeroStats,
        mockTeamDefensiveStats
      );
      
      expect(result.projectedValue).toBe(0);
    });
    
    it('should handle missing defensive stats gracefully', () => {
      const result = ProjectionEngine.calculateProjection(
        mockProjectionRequest,
        mockPlayerStats,
        []
      );
      
      expect(result.factors.opponentDefense).toBe(1.0); // Neutral factor
    });
    
    it('should handle different stat types', () => {
      const reboundsRequest = { ...mockProjectionRequest, statType: 'rebounds' as const };
      
      const result = ProjectionEngine.calculateProjection(
        reboundsRequest,
        mockPlayerStats,
        mockTeamDefensiveStats
      );
      
      expect(result.projectedValue).toBeGreaterThan(0);
    });
  });
  
  describe('Weight System', () => {
    it('should use correct projection weights', () => {
      expect(PROJECTION_WEIGHTS.seasonAverage).toBe(0.25);
      expect(PROJECTION_WEIGHTS.recentForm).toBe(0.20);
      expect(PROJECTION_WEIGHTS.opponentDefense).toBe(0.18);
      expect(PROJECTION_WEIGHTS.homeAway).toBe(0.12);
      expect(PROJECTION_WEIGHTS.restFactor).toBe(0.08);
      expect(PROJECTION_WEIGHTS.injuryImpact).toBe(0.07);
      expect(PROJECTION_WEIGHTS.headToHead).toBe(0.05);
      expect(PROJECTION_WEIGHTS.otherFactors).toBe(0.05);
      
      // Weights should sum to 1.0
      const totalWeight = Object.values(PROJECTION_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);
    });
  });
});

// Performance test
describe('ProjectionEngine Performance', () => {
  it('should handle large datasets efficiently', () => {
    const largePlayerStats: PlayerGameLog[] = Array.from({ length: 100 }, (_, i) => ({
      ...mockPlayerStats[0],
      gameId: i.toString(),
      gameDate: new Date(2025, 0, i + 1).toISOString().split('T')[0],
      points: Math.floor(Math.random() * 30) + 5,
      rebounds: Math.floor(Math.random() * 10) + 2,
      assists: Math.floor(Math.random() * 8) + 1
    }));
    
    const startTime = performance.now();
    
    const result = ProjectionEngine.calculateProjection(
      mockProjectionRequest,
      largePlayerStats,
      mockTeamDefensiveStats
    );
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    expect(result).toBeDefined();
    expect(executionTime).toBeLessThan(100); // Should complete in under 100ms
  });
});
