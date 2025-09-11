const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Start with 1 second

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test database connection
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('regression_models')
      .select('count')
      .limit(1);
    
    if (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

// Retry wrapper for database operations
async function withRetry(operation, operationName, maxRetries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 ${operationName} (attempt ${attempt}/${maxRetries})`);
      
      // Test connection before each attempt
      if (attempt > 1) {
        const isConnected = await testConnection();
        if (!isConnected) {
          throw new Error('Database connection test failed');
        }
      }
      
      const result = await operation();
      
      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      console.error(`❌ ${operationName} failed on attempt ${attempt}:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }
  
  throw new Error(`${operationName} failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

// Robust model save function
async function saveModelToDatabase(modelData) {
  console.log('\n💾 Saving model to database with robust error handling...');
  console.log(`   Model ID: ${modelData.player_id}`);
  console.log(`   Stat Type: ${modelData.stat_type}`);
  console.log(`   Season: ${modelData.season}`);
  
  // First, try to delete existing model
  const deleteOperation = async () => {
    const { error: deleteError } = await supabase
      .from('regression_models')
      .delete()
      .eq('player_id', modelData.player_id)
      .eq('stat_type', modelData.stat_type)
      .eq('season', modelData.season);
    
    if (deleteError) {
      console.log('⚠️  Delete operation failed:', deleteError.message);
      // Don't throw here - we'll try upsert as fallback
    } else {
      console.log('🗑️  Deleted existing model successfully');
    }
    
    return { deleteError };
  };
  
  // Then, try to insert new model
  const insertOperation = async () => {
    const { error: insertError } = await supabase
      .from('regression_models')
      .insert(modelData);
    
    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`);
    }
    
    console.log('✅ Model saved using insert');
    return { success: true };
  };
  
  // Upsert fallback operation
  const upsertOperation = async () => {
    const { error: upsertError } = await supabase
      .from('regression_models')
      .upsert(modelData, { onConflict: 'player_id,stat_type,season' });
    
    if (upsertError) {
      throw new Error(`Upsert failed: ${upsertError.message}`);
    }
    
    console.log('✅ Model saved using upsert fallback');
    return { success: true };
  };
  
  try {
    // Step 1: Try delete + insert with retries
    console.log('🔄 Attempting delete + insert strategy...');
    
    const deleteResult = await withRetry(deleteOperation, 'Delete existing model', 2);
    
    // If delete succeeded or failed but we can continue, try insert
    const insertResult = await withRetry(insertOperation, 'Insert new model', 2);
    
    console.log('✅ Model saved successfully using delete + insert');
    return insertResult;
    
  } catch (insertError) {
    console.log('⚠️  Delete + insert strategy failed, trying upsert fallback...');
    
    try {
      // Step 2: Fallback to upsert with retries
      const upsertResult = await withRetry(upsertOperation, 'Upsert model', 3);
      console.log('✅ Model saved successfully using upsert fallback');
      return upsertResult;
      
    } catch (upsertError) {
      // Step 3: Final attempt - try direct insert without delete
      console.log('🔄 Final attempt: Direct insert without delete...');
      
      try {
        const directInsertResult = await withRetry(insertOperation, 'Direct insert', 2);
        console.log('✅ Model saved successfully using direct insert');
        return directInsertResult;
      } catch (directError) {
        throw new Error(`All save strategies failed. Last errors: Insert=${insertError.message}, Upsert=${upsertError.message}, Direct=${directError.message}`);
      }
    }
  }
}

// Validate model data before saving
function validateModelData(modelData) {
  const required = ['player_id', 'stat_type', 'season', 'model_data', 'created_at'];
  
  for (const field of required) {
    if (!modelData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  if (!modelData.model_data.r_squared && modelData.model_data.r_squared !== 0) {
    throw new Error('Missing r_squared in model_data');
  }
  
  if (!modelData.model_data.rmse && modelData.model_data.rmse !== 0) {
    throw new Error('Missing rmse in model_data');
  }
  
  console.log('✅ Model data validation passed');
}

// Main save function with full error handling
async function saveModel(modelData) {
  try {
    console.log('\n🔍 Validating model data...');
    validateModelData(modelData);
    
    console.log('💾 Attempting direct database save (skipping connection test)...');
    
    // Skip connection test and go straight to save with retries
    const result = await saveModelToDatabase(modelData);
    
    console.log('🎉 Model saved successfully to database!');
    return result;
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR: Failed to save model to database');
    console.error('Error details:', error.message);
    console.error('This is a critical failure that needs immediate attention!');
    
    // Log the model data for debugging
    console.error('Model data that failed to save:', JSON.stringify(modelData, null, 2));
    
    throw error;
  }
}

module.exports = {
  saveModel,
  testConnection,
  withRetry
};
