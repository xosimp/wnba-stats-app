import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/authOptions';
import { supabase } from '../../../../lib/supabase';

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  console.log('PATCH /api/account/avatar session:', session);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { avatar } = await req.json();
  if (typeof avatar !== 'string' || !avatar) {
    return NextResponse.json({ error: 'Invalid avatar' }, { status: 400 });
  }

  try {
    const { data: user, error } = await supabase
      .from('User')
      .update({ avatar })
      .eq('email', session.user.email)
      .select('id, email, name, avatar')
      .single();

    if (error) {
      console.error('PATCH /api/account/avatar Supabase error:', error);
      return NextResponse.json({ error: 'Failed to update avatar' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('PATCH /api/account/avatar error:', error);
    return NextResponse.json({ error: 'Failed to update avatar' }, { status: 500 });
  }
} 