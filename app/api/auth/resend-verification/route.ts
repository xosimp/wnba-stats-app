import { NextResponse } from "next/server";
import { Resend } from 'resend';
import { supabase } from '../../../../lib/supabase';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function generateToken(length = 48) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return [...Array(length)].map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from('User')
      .select('id, email, emailVerified')
      .eq('email', email)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "Email is already verified." }, { status: 400 });
    }

    const verificationToken = generateToken();
    const verificationTokenExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

    const { error: updateError } = await supabase
      .from('User')
      .update({
        verificationToken,
        verificationTokenExpiry,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json({ error: "Failed to generate verification token." }, { status: 500 });
    }

    const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/verify?token=${verificationToken}`;
    
    // For testing: always send to your email
    const testEmail = 'wcavnar@hotmail.com'; // Your email for testing
    const emailRes = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@nhoops.com',
      to: testEmail, // Always send to your email for testing
      subject: 'Verify your email for NextGenHoops',
      html: `<p>Please verify your email by clicking the link below. This link will expire in 24 hours.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p><strong>Original email: ${email}</strong></p>`
    });

    if (emailRes.error) {
      console.error('Error sending verification email:', emailRes.error);
      return NextResponse.json({ error: 'Failed to send verification email.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Verification email sent." });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json({ error: "Failed to process request." }, { status: 500 });
  }
} 