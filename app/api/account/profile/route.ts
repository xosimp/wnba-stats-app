import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/authOptions';
import { supabase } from '../../../../lib/supabase';

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json();
  const { name, plan, favoriteTeam } = data;

  try {
    // Update user name and avatar (favorite team)
    const updateData: any = {};
    if (name) updateData.name = name;
    if (favoriteTeam) updateData.avatar = favoriteTeam;

    const { data: userUpdate, error: userError } = await supabase
      .from('User')
      .update(updateData)
      .eq('email', session.user.email)
      .select('id, email, name, avatar')
      .single();

    if (userError) {
      console.error('Error updating user:', userError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Update subscription plan if provided
    if (plan && userUpdate) {
      const { error: subscriptionError } = await supabase
        .from('Subscription')
        .upsert({
          userId: userUpdate.id,
          plan: plan,
        }, {
          onConflict: 'userId'
        });

      if (subscriptionError) {
        console.error('Error updating subscription:', subscriptionError);
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
} 