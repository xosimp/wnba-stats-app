require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkModels() {
  console.log('🔍 Checking Model Features');
  console.log('==========================');
  
  const models = [
    { name: 'Points', id: 'RANDOM_FOREST_POINTS', statType: 'points' },
    { name: 'Rebounds', id: 'GENERAL_REBOUNDS_RF', statType: 'rebounds' },
    { name: 'Assists', id: 'RANDOM_FOREST_ASSISTS', statType: 'assists' }
  ];
  
  for (const model of models) {
    console.log(`\n📊 ${model.name} Model:`);
    
    const { data, error } = await supabase
      .from('regression_models')
      .select('model_data')
      .eq('player_id', model.id)
      .eq('stat_type', model.statType)
      .eq('season', '2025')
      .single();
    
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      continue;
    }
    
    if (data?.model_data?.features) {
      const features = data.model_data.features;
      const hasLineupFeatures = features.some(f => f.includes('teammate_') || f.includes('lineup_'));
      console.log(`✅ Features: ${features.length} total`);
      console.log(`✅ Lineup features: ${hasLineupFeatures ? 'YES' : 'NO'}`);
      
      if (hasLineupFeatures) {
        const lineupFeatures = features.filter(f => f.includes('teammate_') || f.includes('lineup_'));
        console.log(`   Lineup features: ${lineupFeatures.join(', ')}`);
      }
      
      if (data.model_data?.performance) {
        console.log(`✅ Performance: R² = ${(data.model_data.performance.rSquared * 100).toFixed(1)}%`);
      }
    } else {
      console.log(`⚠️  No features found in model data`);
    }
  }
}

checkModels().catch(console.error);
