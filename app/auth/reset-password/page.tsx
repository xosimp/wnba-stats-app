"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const token = params?.get("token");

  useEffect(() => {
    setError("");
    setSuccess("");
  }, [password, confirm]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!password || !confirm) {
      setError("Please fill out both fields.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Invalid or missing token.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Password reset! Redirecting to sign in...");
        setTimeout(() => router.push("/auth/signin"), 2000);
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', height: '100vh', paddingLeft: '6vw', marginBottom: '3vh' }}>
        <h1 className="beveled-embossed" style={{ fontSize: '2.8rem', fontWeight: 800, color: '#232323', marginBottom: '0.5rem', letterSpacing: '-1px' }}>
          <span style={{ color: '#111' }}>N</span>ext<span style={{ color: '#111' }}>G</span>en<span style={{ color: '#111' }}>H</span>oops
        </h1>
        <div style={{ fontSize: '1.25rem', color: '#555', fontWeight: 500, textShadow: '0 3px 16px rgba(0,0,0,0.10), 0 1.5px 0 rgba(0,0,0,0.13)' }}>Reset your password</div>
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
          minHeight: '24rem',
          marginRight: '6vw',
        }}
      >
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Set a new password</h2>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div>
            <label className="block mb-1 font-semibold text-gray-700 flex items-center gap-2">
              {/* Lock icon */}
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border px-6 py-6 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none bg-gray-50 text-gray-900 placeholder-gray-400 text-xl"
              style={{ fontSize: '1.35rem', height: '3.75rem', borderRadius: '0.5rem', border: '1.5px solid #111', boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)' }}
              placeholder="New password"
              required
            />
          </div>
          <div style={{ marginTop: '32px' }}>
            <label className="block mb-1 font-semibold text-gray-700 flex items-center gap-2">
              {/* Lock icon */}
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full border px-6 py-6 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none bg-gray-50 text-gray-900 placeholder-gray-400 text-xl"
              style={{ fontSize: '1.35rem', height: '3.75rem', borderRadius: '0.5rem', border: '1.5px solid #111', boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)' }}
              placeholder="Confirm password"
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
            disabled={loading}
          >
            {loading ? "Resetting..." : <span style={{ fontWeight: 800, color: '#111' }}>Reset</span>}
          </button>
        </form>
        <style>{`
          @keyframes gradient-move {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
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
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
} 