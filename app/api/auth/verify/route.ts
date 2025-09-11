import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json({ error: 'Verification token is required.' }, { status: 400 });
    }

    // Find user with verification token
    const { data: user, error: findError } = await supabase
      .from('User')
      .select('id, verificationToken, verificationTokenExpiry')
      .eq('verificationToken', token)
      .single();

    if (findError) {
      console.error('Database error finding user:', findError);
      return NextResponse.json({ error: 'Database error while verifying token.' }, { status: 500 });
    }

    if (!user) {
      console.error('No user found with token:', token);
      return NextResponse.json({ error: 'Invalid verification token.' }, { status: 400 });
    }

    // Check if token is expired
    if (user.verificationTokenExpiry && new Date() > new Date(user.verificationTokenExpiry)) {
      return NextResponse.json({ error: 'Verification token has expired.' }, { status: 400 });
    }

    // Update user to mark email as verified
    const { error: updateError } = await supabase
      .from('User')
      .update({
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExpiry: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json({ error: 'Failed to verify email.' }, { status: 500 });
    }

    // Redirect to signin page
    return NextResponse.redirect(new URL('/auth/signin?verified=true', req.url));
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json({ error: 'Failed to verify email.' }, { status: 500 });
  }
} 