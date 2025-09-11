import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/authOptions';
import { supabase } from '../../../../lib/supabase';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe secret key not configured.' }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    console.log('Step 1: Getting server session');
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      console.error('Step 1 failed: Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('Step 2: Session found', session.user.email);

    // Get user
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('id, email, name')
      .eq('email', session.user.email)
      .single();

    if (userError || !user) {
      console.error('Step 2 failed: User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('Subscription')
      .select('stripeCustomerId')
      .eq('userId', user.id)
      .single();

    let customerId = subscription?.stripeCustomerId;
    let customerExists = false;
    
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
        customerExists = true;
      } catch (err: any) {
        if (err.code === 'resource_missing') {
          console.warn('Stripe customer ID in DB is invalid, will create a new one.');
          customerId = undefined;
        } else {
          throw err;
        }
      }
    }
    
    if (!customerId) {
      // Create a new Stripe customer for this user
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
      });
      
      // Update the user's subscription with the new customer ID
      const { error: upsertError } = await supabase
        .from('Subscription')
        .upsert({
          id: uuidv4(),
          userId: user.id,
          plan: 'free', // or your default plan
          stripeCustomerId: customer.id,
          updatedAt: new Date().toISOString(),
        }, {
          onConflict: 'userId'
        });

      if (upsertError) {
        console.error('Error upserting subscription:', upsertError);
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
      }
      
      customerId = customer.id;
      console.log('Step 2b: Created new Stripe customer and updated subscription', customerId);
    }
    console.log('Step 3: Stripe customer ID found', customerId);

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.NEXT_PUBLIC_BASE_URL + '/account',
    });
    console.log('Step 4: Stripe portal session created', portalSession.url);

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Error in /api/account/portal:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
} 