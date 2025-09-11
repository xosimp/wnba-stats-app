import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { Resend } from 'resend';
import { supabase } from '../../../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function generateToken(length = 48) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return [...Array(length)].map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('User')
      .select('id')
      .eq('email', email)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError);
      return NextResponse.json({ error: "Database error." }, { status: 500 });
    }
    
    if (existingUser) {
      return NextResponse.json({ error: "User already exists." }, { status: 409 });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate verification token and expiry (24 hours)
    const verificationToken = generateToken();
    const verificationTokenExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24);
    
    // Create user with explicit ID and timestamps
    const now = new Date();
    const { data: user, error: createError } = await supabase
      .from('User')
      .insert({
        id: uuidv4(),
        email,
        password: hashedPassword,
        name,
        createdAt: now,
        updatedAt: now,
        verificationToken,
        verificationTokenExpiry,
      })
      .select('id, email, name')
      .single();
    
    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
    }
    
    // Send verification email
    try {
      console.log('Attempting to send verification email to', email);
      const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/verify?token=${verificationToken}`;
      // For testing: always send to your Gmail
      const testEmail = 'wcavnar@hotmail.com'; // Your email for testing
      const emailRes = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@nhoops.com',
        to: testEmail, // Always send to your email for testing
        subject: 'Verify your email for NextGenHoops',
        html: `<p>Welcome! Please verify your email by clicking the link below. This link will expire in 24 hours.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p><strong>Original email: ${email}</strong></p>`
      });
      console.log('Verification email sent result:', emailRes);
      if (emailRes.error) {
        console.error('Error sending verification email:', emailRes.error);
        return NextResponse.json({ error: 'Failed to send verification email.' }, { status: 500 });
      }
    } catch (err) {
      console.error('Exception sending verification email:', err);
      return NextResponse.json({ error: 'Failed to send verification email.' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
} 