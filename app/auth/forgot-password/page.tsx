"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess("");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("If an account with that email exists, a password reset link has been sent.");
        setTimeout(() => router.push('/auth/signin'), 2000);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
          

          <div className={showAnimation ? 'fade-in-from-left' : ''} style={{ fontSize: '1.25rem', color: '#555', fontWeight: 700, textShadow: '0 3px 16px rgba(0,0,0,0.10), 0 1.5px 0 rgba(0,0,0,0.13)', marginTop: '-25px', marginLeft: '310px' }}>Forgot your password?</div>
        </div>
        <div
          className="sign-in-card"
          style={{
            background: '#fff',
            borderRadius: '1rem',
            boxShadow: '0 12px 40px 0 rgba(0,0,0,0.22)',
            maxWidth: '28rem',
            minWidth: '400px',
            width: '100%',
            padding: '2.5rem',
            border: '1px solid #e5e7eb',
            zIndex: 10,
            minHeight: '24rem',
            marginRight: '6vw',
          }}
        >
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Reset your password</h2>
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div>
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
            {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded flex items-center gap-2 mt-4"><svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" d="M12 8v4m0 4h.01"/></svg>{error}</div>}
            {success && <div className="bg-green-100 text-green-700 px-4 py-2 rounded flex items-center gap-2 mt-4"><svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" d="M12 8v4m0 4h.01"/></svg>{success}</div>}
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
                marginTop: '50px',
                boxShadow: '0 6px 24px 0 rgba(0,0,0,0.35)',
                cursor: 'pointer'
              }}
              disabled={loading || !isEmailValid}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="4" opacity=".2"/><path d="M22 12a10 10 0 0 1-10 10" stroke="#fff" strokeWidth="4"/></svg>
                  <span style={{ marginLeft: 8 }}>Sending...</span>
                </>
              ) : <span style={{ fontWeight: 800, color: '#111' }}>Send</span>}
            </button>
          </form>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem' }}>
            <a href="/auth/signin" className="text-blue-600 hover:underline text-sm font-medium" onClick={e => { e.preventDefault(); router.push('/auth/signin'); }}>Back to sign in</a>
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