const axios = require('axios');

async function testAllModels() {
  console.log('🔍 Testing All Models with Lineup Adjustments');
  console.log('======================================================================');
  
  const baseUrl = 'http://localhost:3000';
  
  // Test data
  const testCases = [
    {
      statType: 'points',
      player: 'Kelsey Mitchell',
      team: 'IND',
      opponent: 'MIN',
      isHome: true,
      description: 'Points with Caitlin Clark out'
    },
    {
      statType: 'rebounds',
      player: 'Kelsey Mitchell', 
      team: 'IND',
      opponent: 'MIN',
      isHome: true,
      description: 'Rebounds with Caitlin Clark out'
    },
    {
      statType: 'assists',
      player: 'Kelsey Mitchell',
      team: 'IND', 
      opponent: 'MIN',
      isHome: true,
      description: 'Assists with Caitlin Clark out'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📊 Test: ${testCase.description}`);
    console.log('─'.repeat(50));
    
    try {
      // Test with Caitlin Clark out
      const responseWithInjury = await axios.post(`${baseUrl}/api/projections/stat-model`, {
        statType: testCase.statType,
        player: testCase.player,
        team: testCase.team,
        opponent: testCase.opponent,
        isHome: testCase.isHome,
        gameDate: '2025-09-09',
        daysRest: 2,
        sportsbookLine: 19.5,
        teammateInjuries: ['Caitlin Clark']
      });
      
      const projectionWithInjury = responseWithInjury.data.projection;
      console.log(`   ✅ With Caitlin Clark out: ${projectionWithInjury.projectedValue.toFixed(1)} ${testCase.statType}`);
      
      // Test without injuries
      const responseWithoutInjury = await axios.post(`${baseUrl}/api/projections/stat-model`, {
        statType: testCase.statType,
        player: testCase.player,
        team: testCase.team,
        opponent: testCase.opponent,
        isHome: testCase.isHome,
        gameDate: '2025-09-09',
        daysRest: 2,
        sportsbookLine: 19.5,
        teammateInjuries: []
      });
      
      const projectionWithoutInjury = responseWithoutInjury.data.projection;
      console.log(`   ✅ Without injuries: ${projectionWithoutInjury.projectedValue.toFixed(1)} ${testCase.statType}`);
      
      const difference = projectionWithInjury.projectedValue - projectionWithoutInjury.projectedValue;
      const percentChange = ((projectionWithInjury.projectedValue / projectionWithoutInjury.projectedValue) - 1) * 100;
      
      console.log(`   📈 Difference: ${difference > 0 ? '+' : ''}${difference.toFixed(1)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%)`);
      
      if (Math.abs(difference) < 0.1) {
        console.log('   ⚠️  WARNING: No significant difference detected - lineup adjustments may not be working');
      } else {
        console.log('   ✅ Lineup adjustments are working correctly');
      }
      
    } catch (error) {
      console.error(`   ❌ Error testing ${testCase.statType}:`, error.response?.data?.error || error.message);
    }
  }
  
  console.log('\n🎯 All Models Test Complete!');
}

testAllModels().catch(console.error);
