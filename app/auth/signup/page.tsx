"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import SocialSignInButtons from "../../../components/auth/SocialSignInButtons";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowAnimation(true);
    }
  }, []);

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
        setSuccess("Registration successful! Redirecting to sign in...");
        setTimeout(() => router.push("/auth/signin"), 1500);
      } else {
        setError(data.error || "Registration failed.");
      }
    } catch (err) {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      <div
        className="signin-page-override"
        style={{
          minHeight: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: '8rem',
          background: '#fff !important',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', height: '100vh', paddingLeft: '6vw' }}>
          {/* NextGenHoops Logo */}
          <div className={showAnimation ? 'fade-in-from-left' : ''} style={{
            position: 'absolute',
            top: '180px',
            left: 'calc(6vw - 60px)',
            zIndex: 2
          }}>
            <Image
              src="/NGH_Logo_Black.PNG"
              alt="NextGenHoops Logo"
              width={400}
              height={400}
              style={{ 
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 30px rgba(0, 0, 0, 0.4))'
              }}
            />
          </div>
          

          <div className={showAnimation ? 'fade-in-from-left' : ''} style={{ fontSize: '1.25rem', color: '#555', fontWeight: 700, textShadow: '0 3px 16px rgba(0,0,0,0.10), 0 1.5px 0 rgba(0,0,0,0.13)', marginTop: '-25px', marginLeft: '310px' }}>Sign in or create an account</div>
        </div>
        <div
          className="sign-in-card"
          style={{
            background: '#fff',
            borderRadius: '1rem',
            boxShadow: '0 12px 40px 0 rgba(0,0,0,0.32)',
            maxWidth: '28rem',
            minWidth: '400px',
            width: '100%',
            padding: '2.5rem',
            border: '1px solid #e5e7eb',
            zIndex: 10,
            minHeight: '28rem',
            marginRight: '6vw',
          }}
        >
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Sign up</h2>
          <p className="text-gray-600 mb-6 text-base">Already have an account? <button onClick={() => router.push('/auth/signin')} className="text-blue-600 hover:underline font-semibold bg-transparent border-none cursor-pointer p-0">Sign in</button></p>
          
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div>
              <label className="block mb-1 font-semibold text-gray-700 flex items-center gap-2">
                {/* User icon */}
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" d="M4 20c0-2.21 3.58-4 8-4s8 1.79 8 4"/></svg>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border px-6 py-6 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none bg-gray-50 text-gray-900 placeholder-gray-400 text-xl"
                style={{ fontSize: '1.35rem', height: '3.75rem', borderRadius: '0.5rem', border: '1.5px solid #111', boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)' }}
                placeholder="Your name"
                required
              />
            </div>
            <div style={{ marginTop: '44px' }}>
              <label className="block mb-1 font-semibold text-gray-700 flex items-center gap-2">
                {/* Email icon */}
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.5m-18 0A2 2 0 0 1 5 5.5h14a2 2 0 0 1 2 2m-18 0 9 6.5 9-6.5"/></svg>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setIsEmailValid(validateEmail(e.target.value));
                  if (!emailTouched) setEmailTouched(true);
                }}
                className="w-full border px-6 py-6 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none bg-gray-50 text-gray-900 placeholder-gray-400 text-xl"
                style={{
                  fontSize: '1.35rem',
                  height: '3.75rem',
                  borderRadius: '0.5rem',
                  border:
                    email.length === 0 || !emailTouched
                      ? '1.5px solid #111'
                      : isEmailValid
                        ? '1.5px solid #22c55e'
                        : '1.5px solid #ef4444',
                  boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)'
                }}
                placeholder="you@email.com"
                required
              />
            </div>
            <div style={{ marginTop: '40px', position: 'relative' }}>
              <label className="block mb-1 font-semibold text-gray-700 flex items-center gap-2">
                {/* Lock icon */}
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>
                Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 px-6 py-6 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none bg-gray-50 text-gray-900 placeholder-gray-400 text-xl pr-12"
                style={{ fontSize: '1.35rem', height: '3.75rem', borderRadius: '0.5rem', border: '1.5px solid #111', boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)' }}
                placeholder="Password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                style={{ position: 'absolute', top: '50%', right: '18px', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="group"
              >
                <span
                  className="group-tooltip px-2 py-1 text-xs rounded bg-black text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
                  style={{ fontSize: '0.75rem', fontWeight: 500, position: 'absolute', top: '-44px', right: '-8px', zIndex: 10, opacity: 0, transition: 'opacity 0.2s', pointerEvents: 'none' }}
                >
                  {showPassword ? 'Hide password' : 'Show password'}
                </span>
                {showPassword ? (
                  // Eye-off icon
                  <svg width="24" height="24" fill="none" stroke="#111" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.09-2.86 3.09-5.18 5.66-6.53M1 1l22 22" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9.53 9.53A3.5 3.5 0 0 0 12 15.5a3.5 3.5 0 0 0 2.47-5.97" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : (
                  // Eye icon
                  <svg width="24" height="24" fill="none" stroke="#111" strokeWidth="2" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="6" stroke="#111" strokeWidth="2"/><circle cx="12" cy="12" r="2.5" fill="#111"/></svg>
                )}
              </button>
            </div>
            {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded flex items-center gap-2 mt-4"><svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" d="M12 8v4m0 4h.01"/></svg>{error}</div>}
            {success && <div className="bg-green-100 text-green-700 px-4 py-2 rounded flex items-center gap-2 mt-4"><svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" d="M12 8v4m0 4h.01"/></svg>{success}</div>}
            
            {/* Social Sign In Buttons */}
            <SocialSignInButtons className="signup-social-buttons mt-12 mb-8" />
            
            <button
              type="submit"
              className="rounded-full font-extrabold transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg mx-auto hover:scale-105 animated-gradient shimmer-btn"
              style={{
                height: '30px',
                minHeight: '30px',
                width: '100px',
                fontSize: '1.1rem',
                color: '#111',
                border: '1.5px solid #111',
                marginTop: '30px',
                boxShadow: '0 6px 24px 0 rgba(0,0,0,0.35)',
                cursor: 'pointer'
              }}
              disabled={loading}
            >
              {loading ? "Signing up..." : <span style={{ fontWeight: 800, color: '#111' }}>Sign Up</span>}
            </button>
          </form>
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
      </div>
    </div>
  );
} 