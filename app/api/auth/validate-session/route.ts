import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]/authOptions';

export async function GET(request: NextRequest) {
  try {
    // Get the current session
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    // Return session validation status
    return NextResponse.json({ 
      valid: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 