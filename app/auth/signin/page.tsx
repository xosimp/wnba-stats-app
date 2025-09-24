"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import SocialSignInButtons from "../../../components/auth/SocialSignInButtons";

export default function SignInPage() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  // Sign up state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  // Sign in state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInError, setSignInError] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  // Email validation state
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendStatus, setResendStatus] = useState<'' | 'loading' | 'success' | 'error'>('');
  const [resendMessage, setResendMessage] = useState('');
  const [showAnimation, setShowAnimation] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowAnimation(true);
    }
  }, []);

  // Email validation function
  function validateEmail(email: string) {
    // Simple regex for email validation
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Sign up handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Registration successful! You can now sign in.");
        setName("");
        setEmail("");
        setPassword("");
        setTab("signin");
      } else {
        setError(data.error || "Registration failed.");
      }
    } catch (err) {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Sign in handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSignInError("");
    setSignInLoading(true);
    if (!signInEmail || !signInPassword) {
      setSignInError("Please enter both email and password.");
      setSignInLoading(false);
      return;
    }
    const res = await signIn("credentials", {
      redirect: false,
      email: signInEmail,
      password: signInPassword,
    });
    if (res?.ok) {
      router.push("/dashboard");
    } else if (res?.error) {
      if (res.error === 'CredentialsSignIn' || res.error?.toLowerCase().includes('credentialssignin')) {
        setSignInError('Wrong Password!');
      } else {
        setSignInError(res.error);
      }
    } else {
      setSignInError("Invalid email or password.");
    }
    setSignInLoading(false);
  };

  // Handle key press in form inputs
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleSignIn(e as any);
    }
  };

  // Resend verification email handler
  const handleResendVerification = async () => {
    setResendStatus('loading');
    setResendMessage('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signInEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setResendStatus('success');
        setResendMessage('Verification email sent! Please check your inbox.');
      } else {
        setResendStatus('error');
        setResendMessage(data.error || 'Failed to resend verification email.');
      }
    } catch {
      setResendStatus('error');
      setResendMessage('Failed to resend verification email.');
    }
  };

  return (
    <div
      className="signin-page-override"
      data-page="signin"
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 'clamp(2rem, 8vw, 8rem)',
         background: 'transparent',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', height: '100vh', paddingLeft: 'clamp(3vw, 6vw, 8vw)' }}>
        {/* NextGenHoops Logo */}
         <div className={showAnimation ? 'fade-in-from-left' : ''} style={{
           position: 'absolute',
           top: 'clamp(120px, 18vh, 200px)',
           left: 'calc(clamp(3vw, 6vw, 8vw) + clamp(200px, 25vw, 350px) - clamp(100px, 15vw, 200px))',
           zIndex: 2
         }}>
          <Image
            src="/NGH_Logo_Black.PNG"
            alt="NextGenHoops Logo"
            width={400}
            height={400}
            style={{ 
              width: 'clamp(300px, 40vw, 500px)',
              height: 'clamp(300px, 40vw, 500px)',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 30px rgba(0, 0, 0, 0.4))'
            }}
          />
        </div>
        

          <div className={showAnimation ? 'fade-in-from-left' : ''} style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)', color: '#555', fontWeight: 700, textShadow: '0 3px 16px rgba(0,0,0,0.10), 0 1.5px 0 rgba(0,0,0,0.13)', marginTop: 'clamp(-15px, -2vh, -35px)', marginLeft: 'clamp(200px, 25vw, 350px)' }}>Sign in or create an account</div>
      </div>
      <div
        className="sign-in-card"
        style={{
          background: '#fff',
          borderRadius: '1rem',
          boxShadow: '0 12px 40px 0 rgba(0,0,0,0.32)',
          maxWidth: 'clamp(24rem, 35vw, 32rem)',
          minWidth: 'clamp(300px, 40vw, 450px)',
          width: '100%',
          padding: 'clamp(1.5rem, 3vw, 3rem)',
          border: '1px solid #e5e7eb',
          zIndex: 10,
          minHeight: 'clamp(25rem, 35vh, 35rem)',
          marginRight: 'clamp(3vw, 6vw, 8vw)',
        }}
      >
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)' }}>Sign in</h2>
        <p className="text-gray-600 mb-6 text-base" style={{ fontSize: 'clamp(0.9rem, 1.5vw, 1.1rem)' }}>New user? <a href="/auth/signup" className="text-blue-600 hover:underline font-semibold" onClick={e => { e.preventDefault(); router.push('/auth/signup'); }}>Create an account</a></p>
        
        {/* Email/password form */}
        <form onSubmit={handleSignIn} className="flex flex-col h-full">
          <div>
            <label className="block mb-1 font-semibold text-gray-700 flex items-center gap-2">
              {/* Email icon */}
              <svg width="clamp(16px, 2vw, 24px)" height="clamp(16px, 2vw, 24px)" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.5m-18 0A2 2 0 0 1 5 5.5h14a2 2 0 0 1 2 2m-18 0 9 6.5 9-6.5"/></svg>
              Email
            </label>
            <input
              type="email"
              value={signInEmail}
              onChange={e => {
                setSignInEmail(e.target.value);
                setIsEmailValid(validateEmail(e.target.value));
                if (!emailTouched) setEmailTouched(true);
              }}
              onKeyPress={handleKeyPress}
               className="w-full border px-6 py-6 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none bg-gray-50 text-gray-900 placeholder-gray-400"
              style={{
                fontSize: 'clamp(1rem, 2vw, 1.5rem)',
                height: 'clamp(3rem, 4vh, 4rem)',
                borderRadius: '0.5rem',
                border:
                  signInEmail.length === 0 || !emailTouched
                    ? '1.5px solid #111'
                    : isEmailValid
                      ? '1.5px solid #22c55e'
                      : '1.5px solid #ef4444', // Tailwind red-500
                boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)'
              }}
              placeholder="you@email.com"
              required
            />
          </div>
          <div style={{ marginTop: 'clamp(30px, 4vh, 50px)', position: 'relative' }}>
            <label className="block mb-1 font-semibold text-gray-700 flex items-center gap-2">
              {/* Lock icon */}
              <svg width="clamp(16px, 2vw, 24px)" height="clamp(16px, 2vw, 24px)" fill="none" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>
              Password
              {/* Eye icon moved above password input */}
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                style={{ 
                  position: 'absolute', 
                  top: 'clamp(-12px, -1.5vh, -16px)', 
                  right: 'clamp(-32px, -6vw, -48px)', 
                  background: 'none', 
                  border: 'none', 
                  padding: 'clamp(2px, 0.5vw, 4px)', 
                  cursor: 'pointer', 
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="eye-toggle-button"
                onMouseEnter={(e) => {
                  const tooltip = e.currentTarget.querySelector('.eye-tooltip') as HTMLElement;
                  if (tooltip) tooltip.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  const tooltip = e.currentTarget.querySelector('.eye-tooltip') as HTMLElement;
                  if (tooltip) tooltip.style.opacity = '0';
                }}
              >
                <span
                  className="eye-tooltip"
                  style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 500, 
                    position: 'absolute', 
                    top: '-32px', 
                    right: '-4px', 
                    zIndex: 20, 
                    opacity: 0, 
                    transition: 'opacity 0.2s', 
                    pointerEvents: 'none',
                    background: '#000',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {showPassword ? 'Hide password' : 'Show password'}
                </span>
                {showPassword ? (
                  // Eye-off icon
                  <svg width="clamp(20px, 2.5vw, 28px)" height="clamp(20px, 2.5vw, 28px)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  // Eye icon
                  <svg width="clamp(20px, 2.5vw, 28px)" height="clamp(20px, 2.5vw, 28px)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={signInPassword}
              onChange={e => setSignInPassword(e.target.value)}
              onKeyPress={handleKeyPress}
               className="w-full border px-6 py-6 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none bg-gray-50 text-gray-900 placeholder-gray-400 pr-12"
              style={{
                fontSize: 'clamp(1rem, 2vw, 1.5rem)',
                height: 'clamp(3rem, 4vh, 4rem)',
                borderRadius: '0.5rem',
                border: signInError === 'Wrong Password!' ? '2px solid #ef4444' : '1.5px solid #111',
                boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)'
              }}
              placeholder="Password"
              required
            />
          </div>
          {signInError && (
            <div className="text-red-500 font-bold mt-2 mb-4" style={{ textAlign: 'left' }}>
              {signInError === 'CredentialsSignIn' || signInError?.toLowerCase().includes('credentialssignin') ? 'Wrong Password!' : signInError}
              {signInError.toLowerCase().includes('verify your email') && (
                <div className="mt-2 flex flex-col items-start">
                  <button
                    type="button"
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
                    onClick={handleResendVerification}
                    disabled={resendStatus === 'loading'}
                  >
                    {resendStatus === 'loading' ? 'Resending...' : 'Resend Verification Email'}
                  </button>
                  {resendMessage && (
                    <div className={`mt-2 text-sm ${resendStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {resendMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Social Sign In Buttons */}
          <div style={{ marginTop: 'clamp(15px, 2vh, 25px)' }}>
            <SocialSignInButtons className="mb-4" />
          </div>
          
          <button
            type="submit"
            className="rounded-full font-extrabold transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg mx-auto hover:scale-105 animated-gradient shimmer-btn"
            style={{
              height: 'clamp(28px, 3vh, 35px)',
              minHeight: 'clamp(28px, 3vh, 35px)',
              width: 'clamp(90px, 12vw, 120px)',
              fontSize: 'clamp(1rem, 1.8vw, 1.3rem)',
              color: '#111',
              border: '1.5px solid #111',
              marginTop: 'clamp(25px, 3vh, 35px)',
              boxShadow: '0 6px 24px 0 rgba(0,0,0,0.35)',
              cursor: 'pointer'
            }}
            disabled={signInLoading}
          >
            {signInLoading && <svg className="animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="4" opacity=".2"/><path d="M22 12a10 10 0 0 1-10 10" stroke="#fff" strokeWidth="4"/></svg>}
            {signInLoading ? "Signing in..." : <span style={{ fontWeight: 800, color: '#111' }}>Login</span>}
          </button>
        </form>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: 'clamp(1.5rem, 2.5vh, 2.5rem)' }}>
          <a href="/auth/forgot-password" className="text-blue-600 hover:underline text-sm font-medium" style={{ fontSize: 'clamp(0.8rem, 1.3vw, 1rem)' }} onClick={e => { e.preventDefault(); router.push('/auth/forgot-password'); }}>Forgot password?</a>
        </div>
      </div>
      <style>{`
        @keyframes gradient-move {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fade-in-from-left {
          0% {
            opacity: 0;
            transform: translateX(-300px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .fade-in-from-left {
          animation: fade-in-from-left 1.5s ease-out forwards;
        }
        .animated-gradient {
          background: linear-gradient(90deg, #71FD08 0%, #3b82f6 100%);
          background-size: 200% 200%;
          animation: gradient-move 6s ease-in-out infinite;
        }
        .group:hover .group-tooltip { opacity: 1 !important; pointer-events: auto !important; }
        .sign-in-card {
          position: relative;
        }
        .sign-in-card::before {
          content: '';
          position: absolute;
          inset: 10px;
          border: 2.5px solid #f1f1f1;
          border-radius: 0.75rem;
          pointer-events: none;
          z-index: 2;
        }
      `}</style>
    </div>
  );
} 