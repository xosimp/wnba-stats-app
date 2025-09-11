import { createClient } from '@supabase/supabase-js'

// Only create client if we're not in build mode
const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = !isBuildTime && supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null 