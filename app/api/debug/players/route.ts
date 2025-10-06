import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const adminToken = request.headers.get('x-admin-token');
    
    if (adminToken !== 'supersecret') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return some basic debug info
    return NextResponse.json({
      message: 'Debug endpoint working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.headers.get('x-admin-token');
    
    if (adminToken !== 'supersecret') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clear cache logic would go here
    return NextResponse.json({
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
