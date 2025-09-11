import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/authOptions';
import { supabase } from '../../../../lib/supabase';

const PRICE_IDS = {
  monthly: 'price_1S5aIhLzfRu4d31NkVIAkBed',
  lifetime: 'price_1S5aJuLzfRu4d31NzQnybX3Y',
};

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe secret key not configured.' }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'You must be signed in to upgrade.' }, { status: 401 });
    }
    
    // Create a simple plan selection - we'll create separate checkout sessions
    // For now, let's default to monthly and let user change on Stripe
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_IDS.monthly,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?success=1`,
      cancel_url: `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?canceled=1`,
      customer_email: session.user.email,
      metadata: {
        userEmail: session.user.email,
        plan: 'monthly',
      },
    });
    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Could not create Stripe Checkout session.' }, { status: 500 });
  }
} 