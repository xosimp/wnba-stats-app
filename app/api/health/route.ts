import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Missing environment variables',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    // Test database connectivity
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('players')
      .select('count')
      .limit(1);

    if (error) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Database connection failed',
          error: error.message,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    // Health check passed
    return NextResponse.json({
      status: 'healthy',
      message: 'System is running normally',
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });

  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
