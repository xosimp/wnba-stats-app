import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../../lib/supabase';

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe secret key not configured.' }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json({ error: 'Webhook signature verification failed.' }, { status: 400 });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.metadata?.userEmail || session.customer_email;
    const plan = session.metadata?.plan;
    
    if (email && plan) {
      try {
        // Get user by email
        const { data: user, error: userError } = await supabase
          .from('User')
          .select('id')
          .eq('email', email)
          .single();

        if (userError || !user) {
          console.error('User not found for email:', email);
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Update or create subscription
        const { error: subscriptionError } = await supabase
          .from('Subscription')
          .upsert({
            userId: user.id,
            plan,
            stripeCustomerId: session.customer?.toString() || undefined,
            stripeSubId: session.subscription?.toString() || undefined,
          }, {
            onConflict: 'userId'
          });

        if (subscriptionError) {
          console.error('Error updating subscription:', subscriptionError);
          return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
        }
      } catch (error) {
        console.error('Error processing webhook:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
} 