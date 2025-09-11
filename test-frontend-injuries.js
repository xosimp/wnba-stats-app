require('dotenv').config({ path: '.env.local' });
const { ProjectionDataService } = require('./lib/services/ProjectionDataService.js');

async function testFrontendInjuries() {
  try {
    console.log('🔍 Testing frontend injury service...');
    
    const projectionService = ProjectionDataService.getInstance();
    const result = await projectionService.getTeammateInjuries('IND', '2025-09-09');
    console.log('📋 Frontend injury result:', result);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testFrontendInjuries();
