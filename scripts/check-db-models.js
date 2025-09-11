require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkModels() {
  try {
    console.log('🔍 Checking all models in database...\n');
    
    const { data: models, error } = await supabase
      .from('regression_models')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    console.log(`📊 Found ${models.length} models in database:\n`);
    
    models.forEach((model, index) => {
      console.log(`${index + 1}. Model ID: ${model.player_id}`);
      console.log(`   Stat Type: ${model.stat_type}`);
      console.log(`   Season: ${model.season}`);
      console.log(`   Created: ${model.created_at}`);
      
      if (model.model_data) {
        const data = model.model_data;
        console.log(`   Model Type: ${data.model_type || 'linear_regression'}`);
        console.log(`   R²: ${(data.r_squared * 100).toFixed(1)}%`);
        console.log(`   RMSE: ${data.rmse?.toFixed(2) || 'N/A'}`);
        console.log(`   MAE: ${data.mae?.toFixed(2) || 'N/A'}`);
        console.log(`   Training Samples: ${data.training_samples || data.sample_count || 'N/A'}`);
        
        if (data.n_estimators) {
          console.log(`   Trees: ${data.n_estimators}`);
        }
      }
      console.log('');
    });
    
    // Identify which models to keep
    const pointsModels = models.filter(m => m.stat_type === 'points');
    const reboundsModels = models.filter(m => m.stat_type === 'rebounds');
    
    console.log('🎯 Analysis:');
    console.log(`   Points models: ${pointsModels.length}`);
    console.log(`   Rebounds models: ${reboundsModels.length}`);
    
    // Find the best models
    const bestPointsModel = pointsModels.reduce((best, current) => {
      const currentR2 = current.model_data?.r_squared || 0;
      const bestR2 = best.model_data?.r_squared || 0;
      return currentR2 > bestR2 ? current : best;
    }, pointsModels[0]);
    
    const bestReboundsModel = reboundsModels.reduce((best, current) => {
      const currentR2 = current.model_data?.r_squared || 0;
      const bestR2 = best.model_data?.r_squared || 0;
      return currentR2 > bestR2 ? current : best;
    }, reboundsModels[0]);
    
    console.log('\n🏆 Best Models to Keep:');
    if (bestPointsModel) {
      console.log(`   Points: ${bestPointsModel.player_id} (R² = ${(bestPointsModel.model_data?.r_squared * 100).toFixed(1)}%)`);
    }
    if (bestReboundsModel) {
      console.log(`   Rebounds: ${bestReboundsModel.player_id} (R² = ${(bestReboundsModel.model_data?.r_squared * 100).toFixed(1)}%)`);
    }
    
  } catch (error) {
    console.error('❌ Error checking models:', error.message);
  }
}

checkModels();
