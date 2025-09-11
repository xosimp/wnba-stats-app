import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  try {
    // Get user
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('id')
      .eq('email', email)
      .single();

    if (userError) {
      console.error('Error finding user:', userError);
      return NextResponse.json({ plan: 'free' });
    }

    // Get subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('Subscription')
      .select('plan')
      .eq('userId', user.id)
      .single();

    if (subscriptionError) {
      console.error('Error finding subscription:', subscriptionError);
      return NextResponse.json({ plan: 'free' });
    }

    return NextResponse.json({ plan: subscription?.plan || 'free' });
  } catch (error) {
    console.error('Error getting plan:', error);
    return NextResponse.json({ plan: 'free' });
  }
} 