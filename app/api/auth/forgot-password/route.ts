import { NextResponse } from "next/server";
import { Resend } from 'resend';
import { supabase } from '../../../../lib/supabase';
import crypto from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from('User')
      .select('id, email')
      .eq('email', email)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    const { error: updateError } = await supabase
      .from('User')
      .update({
        resetToken,
        resetTokenExpiry,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json({ error: "Failed to generate reset token." }, { status: 500 });
    }

    const resetUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
    
    if (!resend) {
      console.log('Resend not configured, skipping email send');
      return NextResponse.json({ 
        message: "Password reset token generated. Check your email for reset instructions.",
        resetUrl: resetUrl // For development/testing
      });
    }
    
    const emailRes = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@nhoops.com',
      to: email,
      subject: 'Reset your password for NextGenHoops',
      html: `<p>You requested a password reset. Click the link below to reset your password. This link will expire in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
    });

    if (emailRes.error) {
      console.error('Error sending reset email:', emailRes.error);
      return NextResponse.json({ error: 'Failed to send reset email.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Reset email sent." });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: "Failed to process request." }, { status: 500 });
  }
} 