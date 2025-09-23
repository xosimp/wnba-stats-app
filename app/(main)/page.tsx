"use client";
import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { TEAM_LOGOS } from '../../lib/constants/team-logos';
import React from 'react';
import FAQFooter from '../../components/home/FAQFooter';
import Link from 'next/link';


function AdminCacheClearButton() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    // Show button if ?admin=1 in URL or localStorage.admin=1
    if (typeof window !== 'undefined') {
      if (window.location.search.includes('admin=1') || localStorage.getItem('admin') === '1') {
        setShow(true);
      }
    }
  }, []);
  
  if (!mounted || !show) return null;
  const handleClearCache = async () => {
    const res = await fetch('/api/debug/players', {
      method: 'POST',
      headers: { 'x-admin-token': 'supersecret' },
    });
    const data = await res.json();
    alert(data.message || 'Cache cleared');
  };
  return <button style={{position:'fixed',bottom:20,right:20,zIndex:1000,padding:12,background:'#71FD08',color:'#222',borderRadius:8,fontWeight:700}} onClick={handleClearCache}>Clear WNBA Cache</button>;
}

function AdminCacheDashboard() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      if (window.location.search.includes('admin=1') || localStorage.getItem('admin') === '1') {
        setShow(true);
      }
    }
  }, []);
  
  const fetchStats = async () => {
    setLoading(true);
    const res = await fetch('/api/debug/players', {
      method: 'GET',
      headers: { 'x-admin-token': 'supersecret' },
    });
    const data = await res.json();
    setStats(data);
    setLoading(false);
  };
  if (!mounted || !show) return null;
  return (
    <div style={{position:'fixed',bottom:80,right:20,zIndex:1000,background:'#fff',border:'2px solid #71FD08',borderRadius:8,padding:16,maxHeight:400,overflowY:'auto',boxShadow:'0 2px 12px rgba(0,0,0,0.15)'}}>
      <button onClick={fetchStats} style={{marginBottom:8,padding:6,background:'#71FD08',color:'#222',borderRadius:6,fontWeight:700}}>Show Cache Stats</button>
      {loading && <div>Loading...</div>}
      {stats && (
        <div>
          <div style={{fontWeight:700,marginBottom:4}}>Cache Keys: {stats.count}</div>
          <table style={{fontSize:12}}>
            <thead><tr><th align="left">Key</th><th>TTL (s)</th><th>Size (bytes)</th></tr></thead>
            <tbody>
              {stats.stats.map((row:any) => (
                <tr key={row.key}><td>{row.key}</td><td align="center">{row.ttl}</td><td align="center">{row.size}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showFirstTime, setShowFirstTime] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isSelectHovered, setIsSelectHovered] = useState(false);
  const [isSelectFocused, setIsSelectFocused] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [showSecondExplainer, setShowSecondExplainer] = useState(false);
  const [showThirdExplainer, setShowThirdExplainer] = useState(false);
  const [showArrow, setShowArrow] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const [showFeatureBadge, setShowFeatureBadge] = useState(false);
  const [showAIBadge, setShowAIBadge] = useState(false);
  const projectionsRef = useRef<HTMLSpanElement | null>(null);
  
  // Player image preloading is now handled globally in the root layout



  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      const key = `ngh_first_time_${session.user.email}`;
      if (typeof window !== 'undefined' && !localStorage.getItem(key)) {
        setShowFirstTime(true);
      }
    }
  }, [status, session]);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    // Only proceed if authentication status is determined (not loading)
    if (status === 'loading') {
      return;
    }
    
    // Check if we're already on the dashboard to prevent infinite redirects
    if (typeof window !== 'undefined' && window.location.pathname === '/dashboard') {
      return;
    }
    
    if (status === 'authenticated' && session?.user && !isRedirecting) {
      console.log('User is authenticated, redirecting to dashboard...');
      setIsRedirecting(true);
      // Use window.location.replace for more reliable redirect
      if (typeof window !== 'undefined') {
        console.log('Using window.location.replace for redirect');
        window.location.replace('/dashboard');
        
        // Add a fallback check to ensure redirect worked
        setTimeout(() => {
          if (window.location.pathname === '/') {
            console.warn('Redirect failed, trying alternative method');
            window.location.href = '/dashboard';
          }
        }, 1000);
      }
    } else if (status === 'unauthenticated' && isRedirecting) {
      // Reset redirecting state when user signs out
      setIsRedirecting(false);
      // Clear any pending redirect timeout
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    }
    
    // Cleanup function
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, [status, session, isRedirecting, router]);

  // Add a timeout to prevent infinite redirecting state
  useEffect(() => {
    if (isRedirecting) {
      const maxRedirectTimeout = setTimeout(() => {
        console.warn('Redirect timeout reached, resetting redirect state');
        setIsRedirecting(false);
        if (redirectTimeoutRef.current) {
          clearTimeout(redirectTimeoutRef.current);
          redirectTimeoutRef.current = null;
        }
      }, 2000); // 2 second timeout

      return () => clearTimeout(maxRedirectTimeout);
    }
  }, [isRedirecting]);

  useEffect(() => {
    const timeout = setTimeout(() => setShowTagline(true), 200);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (showTagline) {
      const ctaTimeout = setTimeout(() => setShowCTA(true), 400);
      return () => clearTimeout(ctaTimeout);
    } else {
      setShowCTA(false);
      setShowFeatureBadge(false);
    }
  }, [showTagline]);

  useEffect(() => {
    if (showCTA) {
      // Show both badges and their content simultaneously
      setShowFeatureBadge(true);
      setShowAIBadge(true);
    } else {
      setShowFeatureBadge(false);
      setShowAIBadge(false);
    }
  }, [showCTA]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > window.innerHeight * 0.15) {
        setShowExplainer(true);
      } else {
        setShowExplainer(false);
        setShowSecondExplainer(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (showExplainer) {
      const timer = setTimeout(() => setShowSecondExplainer(true), 700);
      return () => clearTimeout(timer);
    } else {
      setShowSecondExplainer(false);
      setShowThirdExplainer(false);
    }
  }, [showExplainer]);

  useEffect(() => {
    if (showSecondExplainer) {
      const timer = setTimeout(() => setShowThirdExplainer(true), 700);
      return () => clearTimeout(timer);
    } else {
      setShowThirdExplainer(false);
    }
  }, [showSecondExplainer]);

  useEffect(() => {
    // Intersection Observer for columns
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        setShowColumns(!entry.isIntersecting);
      },
      { root: null, threshold: 0 }
    );
    if (projectionsRef.current) {
      observer.observe(projectionsRef.current);
    }
    return () => {
      if (projectionsRef.current) observer.unobserve(projectionsRef.current);
    };
  }, [projectionsRef]);

  const handleSelect = async (logo: string) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/account/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: `/logos/${logo}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update avatar');
      if (session?.user?.email && typeof window !== 'undefined') {
        localStorage.setItem(`ngh_first_time_${session.user.email}`, 'true');
      }
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setShowFirstTime(false);
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update avatar');
    } finally {
      setSaving(false);
    }
  };

  // Show loading state while redirecting authenticated users
  if (isRedirecting) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#181C24',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(113, 253, 8, 0.2)',
          borderTop: '4px solid #71FD08',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{
          color: '#71FD08',
          fontSize: '24px',
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
        }}>
          Redirecting to Dashboard...
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <div style={{ minHeight: '80vh', position: 'relative', background: '#181C24', zIndex: 0 }}>
        {/* Player image preloading is handled globally in the root layout */}
        
        <div className="home-bg-image" style={{ zIndex: 1 }} />
        <div className="home-bg-green-tint" style={{ zIndex: 2 }} />
        <div className="home-bg-darken" style={{ zIndex: 3 }} />
        <div style={{ position: 'relative', zIndex: 4 }}>
          {/* Home page content only for NOT signed in users */}
          {!session && (
            <>
              {showFirstTime && (
                <>
                  <div className="fixed inset-0 z-50" style={{ background: 'rgba(255,255,255,0.70)' }} />
                  <div
                    className="sign-in-card bg-white rounded-3xl shadow-2xl border border-zinc-200 flex flex-col items-center justify-center"
                    style={{
                      position: 'fixed',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 100,
                      maxWidth: '420px',
                      minWidth: '340px',
                      width: 'auto',
                      boxShadow: '0 12px 40px 0 rgba(0,0,0,0.32)',
                      borderRadius: '1.5rem',
                      border: '1px solid #e5e7eb',
                      background: 'rgba(255,255,255,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2.5rem',
                      fontFamily: 'Lexend, Arial, sans-serif',
                    }}
                  >
                    <h2 className="text-2xl font-extrabold text-gray-900 mb-2 tracking-tight text-center" style={{ marginTop: 0 }}>
                      What is your favorite basketball team?
                    </h2>
                    {error && <div className="text-red-600 mb-2 text-center">{error}</div>}
                    <div className="mb-6 text-center text-gray-600 text-base">This helps personalize your experience. You can always change it later in your profile.</div>
                    <div className="mb-6">
                      <div className="relative w-full">
                        <select
                          className="w-full border px-6 py-4 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none text-gray-900 placeholder-gray-400 text-lg font-semibold shadow-md"
                          style={{
                            fontSize: '1.18rem',
                            border: isSelectHovered || isSelectFocused ? '2px solid #71FD08' : '1.5px solid #111',
                            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)',
                            marginTop: '15px',
                            paddingRight: '3.5rem',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            appearance: 'none',
                            backgroundColor: '#f9fafb',
                            backgroundImage: 'none',
                            background: 'none',
                            transition: 'border 0.2s',
                            fontFamily: 'Lexend, Arial, sans-serif',
                          }}
                          value={selectedTeam}
                          onChange={e => setSelectedTeam(e.target.value)}
                          disabled={saving}
                          onMouseEnter={() => setIsSelectHovered(true)}
                          onMouseLeave={() => setIsSelectHovered(false)}
                          onFocus={() => setIsSelectFocused(true)}
                          onBlur={() => setIsSelectFocused(false)}
                        >
                          <option value="">Select a team...</option>
                          {(() => {
                            const options = TEAM_LOGOS.map(logo => {
                              let displayName = logo.replace(/_/g, ' ').replace(/(\s*[-_]?logo)?(\.svg\.png|\.png)/i, '').replace(/\s*\(\d{4}\)/, '').replace(/\s*\d{4}$/, '').trim();
                              if (/brooklyn.*nets/i.test(displayName)) displayName = 'Brooklyn Nets';
                              if (/new\s*las\s*vegas\s*aces/i.test(displayName)) displayName = 'Las Vegas Aces';
                              if (/detroit\s*pistons/i.test(displayName)) displayName = 'Detroit Pistons';
                              if (/utah\s*jazz/i.test(displayName)) displayName = 'Utah Jazz';
                              return { logo, displayName };
                            });
                            options.sort((a, b) => a.displayName.localeCompare(b.displayName));
                            return options.map(({ logo, displayName }) => (
                              <option key={logo} value={logo}>{displayName}</option>
                            ));
                          })()}
                        </select>
                        <span style={{ pointerEvents: 'none', position: 'absolute', right: 18, top: '50%', transform: 'translateY(calc(-50% + 10px))', zIndex: 10, background: 'transparent' }}>
                          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 8L10 12L14 8" stroke="#232323" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      </div>
                    </div>
                    {selectedTeam && (
                      <div style={{ marginTop: '32px', position: 'relative', minHeight: '48px' }}>
                        <button
                          className="rounded-full font-extrabold transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg mx-auto hover:scale-105 animated-gradient shimmer-btn px-6 py-2 text-base"
                          style={{
                            color: '#111',
                            border: '1.5px solid #111',
                            boxShadow: '0 6px 24px 0 rgba(0,0,0,0.35)',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            padding: '0.5rem 1.1rem',
                            minWidth: '90px',
                            lineHeight: 1.2,
                            fontWeight: 800,
                          }}
                          onClick={() => handleSelect(selectedTeam)}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        {showSuccess && (
                          <div style={{
                            position: 'absolute',
                            left: '50%',
                            top: '100%',
                            transform: 'translate(-50%, 0)',
                            marginTop: '12px',
                            color: '#22c55e',
                            fontWeight: 800,
                            fontSize: '1.2rem',
                            background: 'rgba(255,255,255,0.95)',
                            borderRadius: '1rem',
                            padding: '0.5rem 1.5rem',
                            boxShadow: '0 2px 12px 0 rgba(34,197,94,0.15)',
                            zIndex: 1000,
                            animation: 'fadeInOut 1.5s',
                          }}>
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}><circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="2" fill="#fff"/><path d="M8 12.5l2.5 2.5 5-5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Successful!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
              {!showFirstTime && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(20% + 370px)',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                    pointerEvents: 'auto',
                  }}
                >
                  <span
                    className={`home-tagline${showTagline ? ' fade-in' : ''}`}
                    style={{
                      fontSize: '3rem',
                      fontWeight: 700,
                      color: '#D1D5DB',
                      letterSpacing: '-0.5px',
                      textAlign: 'center',
                      opacity: showTagline ? 1 : 0,
                      transition: 'opacity 2.5s cubic-bezier(0.4,0,0.2,1)',
                      fontFamily: 'Lexend, Arial, sans-serif',
                      textShadow: `0 8px 36px rgba(0,0,0,0.65), 0 3px 12px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.45), 0 7px 24px rgba(0,0,0,0.35), 0 10px 32px rgba(0,0,0,0.25)`,
                      maxWidth: '90vw',
                      lineHeight: 1.18,
                      border: undefined,
                      borderRadius: undefined,
                      padding: 0,
                      background: 'none',
                      position: 'relative',
                      display: 'inline-block',
                    }}
                  >
                    The Future of Basketball <span style={{ color: '#71FD08' }}>Stats</span> &amp; <span style={{ color: '#71FD08' }}>Projections</span>
                  </span>
                  {/* Sportsbook Integration Feature Badge - Left Aligned */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '10%',
                      top: 'calc(20% - 50px + 2.5rem - 3.3125rem)',
                      opacity: showFeatureBadge ? 1 : 0,
                      transform: showFeatureBadge ? 'translateY(0)' : 'translateY(30px)',
                      transition: 'opacity 1.2s cubic-bezier(0.4,0,0.2,1), transform 1.2s cubic-bezier(0.4,0,0.2,1)',
                      pointerEvents: showFeatureBadge ? 'auto' : 'none',
                      zIndex: 100,
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(113, 253, 8, 0.1)',
                        border: '2px solid rgba(113, 253, 8, 0.3)',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontFamily: 'Lexend, Arial, sans-serif',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#71FD08',
                        boxShadow: '0 2px 8px 0 rgba(113, 253, 8, 0.15)',
                      }}
                    >
                      <Image
                        src="/logos/DK_Logo.png"
                        alt="DraftKings"
                        width={16}
                        height={16}
                        style={{ flexShrink: 0 }}
                      />
                      Sportsbook Integration
                    </div>
                    {/* Sportsbook Mini Odds Display - Positioned underneath the badge */}
                    <div
                      style={{
                        marginTop: '30px',
                        opacity: showFeatureBadge ? 1 : 0,
                        transform: showFeatureBadge ? 'translateY(0)' : 'translateY(20px)',
                        transition: 'opacity 1.4s cubic-bezier(0.4,0,0.2,1), transform 1.4s cubic-bezier(0.4,0,0.2,1)',
                        transitionDelay: '0.3s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {/* Mini Odds Board */}
                      <div
                        style={{
                          width: '200px',
                          height: '100px',
                          background: 'rgba(113, 253, 8, 0.08)',
                          border: '2px solid rgba(113, 253, 8, 0.2)',
                          borderRadius: '12px',
                          padding: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        {/* Over/Under Line */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.65rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          <span>O/U</span>
                          <span style={{ color: '#71FD08', fontWeight: 600 }}>18.5</span>
                        </div>
                        {/* Points Line */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.65rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          <span>PTS</span>
                          <span style={{ color: '#71FD08', fontWeight: 600 }}>16.5</span>
                        </div>
                        {/* Rebounds Line */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.65rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          <span>REB</span>
                          <span style={{ color: '#71FD08', fontWeight: 600 }}>6.5</span>
                        </div>
                        {/* Assists Line */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.65rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          <span>AST</span>
                          <span style={{ color: '#71FD08', fontWeight: 600 }}>4.2</span>
                        </div>
                        {/* Steals Line */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.65rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          <span>STL</span>
                          <span style={{ color: '#71FD08', fontWeight: 600 }}>1.8</span>
                        </div>
                      </div>
                      {/* Value Indicator */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '8px',
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: '#71FD08',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#181C24"/>
                          </svg>
                        </div>
                        <span
                          style={{
                            fontSize: '0.9rem',
                            color: 'rgba(113, 253, 8, 0.9)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 600,
                            textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          Value Bet
                        </span>
                      </div>
                      {/* Line Comparison */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          marginTop: '6px',
                          alignItems: 'center',
                        }}
                      >
                        {/* Our Line vs Sportsbook */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.8rem',
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                            textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          <span>Our Line:</span>
                          <span style={{ color: '#71FD08', fontWeight: 600, textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)' }}>18.5</span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.8rem',
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                            textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          <span>Sportsbook:</span>
                          <span style={{ color: '#FF6B6B', fontWeight: 600, textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)' }}>16.5</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Real-Time Analytics Feature Badge - Left Center */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 'calc(35% - 30px)',
                      top: 'calc(20% - 50px + 2.5rem - 3.3125rem)',
                      opacity: showFeatureBadge ? 1 : 0,
                      transform: showFeatureBadge ? 'translateY(0)' : 'translateY(30px)',
                      transition: 'opacity 1.2s cubic-bezier(0.4,0,0.2,1), transform 1.2s cubic-bezier(0.4,0,0.2,1)',
                      pointerEvents: showFeatureBadge ? 'auto' : 'none',
                      zIndex: 100,
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(113, 253, 8, 0.1)',
                        border: '2px solid rgba(113, 253, 8, 0.3)',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontFamily: 'Lexend, Arial, sans-serif',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#71FD08',
                        boxShadow: '0 2px 8px 0 rgba(113, 253, 8, 0.15)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" fill="#71FD08"/>
                      </svg>
                      Real-Time Analytics
                    </div>
                    {/* Real-Time Analytics Mini Content - Positioned underneath the badge */}
                    <div
                      style={{
                        marginTop: '30px',
                        opacity: showFeatureBadge ? 1 : 0,
                        transform: showFeatureBadge ? 'translateY(0)' : 'translateY(20px)',
                        transition: 'opacity 1.4s cubic-bezier(0.4,0,0.2,1), transform 1.4s cubic-bezier(0.4,0,0.2,1)',
                        transitionDelay: '0.3s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {/* Live Stats Display */}
                      <div
                        style={{
                          width: '175px',
                          height: '100px',
                          background: 'rgba(113, 253, 8, 0.08)',
                          border: '2px solid rgba(113, 253, 8, 0.2)',
                          borderRadius: '12px',
                          padding: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        {/* Live PPG */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.65rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          <span>PTS</span>
                          <span style={{ color: '#71FD08', fontWeight: 600 }}>22</span>
                        </div>
                        {/* Live FG% */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.65rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          <span>FG%</span>
                          <span style={{ color: '#71FD08', fontWeight: 600 }}>48.2</span>
                        </div>
                        {/* Live 3P% */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.65rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          <span>3P%</span>
                          <span style={{ color: '#71FD08', fontWeight: 600 }}>36.8</span>
                        </div>
                        {/* Live REB */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.65rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          <span>REB</span>
                          <span style={{ color: '#71FD08', fontWeight: 600 }}>8.4</span>
                        </div>
                        {/* Live AST */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.65rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          <span>AST</span>
                          <span style={{ color: '#71FD08', fontWeight: 600 }}>5.2</span>
                        </div>
                      </div>
                      {/* Live Indicator */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '8px',
                        }}
                      >
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#FF6B6B',
                            animation: 'pulse 1.5s ease-in-out infinite',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 107, 107, 0.9)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 600,
                            textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          LIVE
                        </span>
                      </div>
                      {/* Update Time */}
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'rgba(255, 255, 255, 0.6)',
                          fontFamily: 'Lexend, Arial, sans-serif',
                          fontWeight: 500,
                          textAlign: 'center',
                          textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                        }}
                      >
                        Updated 2m ago
                      </div>
                    </div>
                  </div>
                  {/* Player Comparison Tool Feature Badge - Right Center */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 'calc(65% - 155px)',
                      top: 'calc(20% - 50px + 2.5rem - 3.3125rem)',
                      opacity: showFeatureBadge ? 1 : 0,
                      transform: showFeatureBadge ? 'translateY(0)' : 'translateY(30px)',
                      transition: 'opacity 1.2s cubic-bezier(0.4,0,0.2,1), transform 1.2s cubic-bezier(0.4,0,0.2,1)',
                      pointerEvents: showFeatureBadge ? 'auto' : 'none',
                      zIndex: 100,
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(113, 253, 8, 0.1)',
                        border: '2px solid rgba(113, 253, 8, 0.3)',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontFamily: 'Lexend, Arial, sans-serif',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#71FD08',
                        boxShadow: '0 2px 8px 0 rgba(113, 253, 8, 0.15)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M16 12H8m0 0l4 4m-4-4l4-4" stroke="#71FD08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M8 12h8m0 0l-4-4m4 4l-4 4" stroke="#71FD08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Player Comparison
                    </div>
                    {/* Player Comparison Mini Content - Positioned underneath the badge */}
                    <div
                      style={{
                        marginTop: '30px',
                        opacity: showFeatureBadge ? 1 : 0,
                        transform: showFeatureBadge ? 'translateY(0)' : 'translateY(20px)',
                        transition: 'opacity 1.4s cubic-bezier(0.4,0,0.2,1), transform 1.4s cubic-bezier(0.4,0,0.2,1)',
                        transitionDelay: '0.3s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {/* Side-by-Side Player Cards */}
                      <div
                        style={{
                          width: '190px',
                          height: '100px',
                          background: 'rgba(113, 253, 8, 0.08)',
                          border: '2px solid rgba(113, 253, 8, 0.2)',
                          borderRadius: '12px',
                          padding: '8px',
                          display: 'flex',
                          gap: '8px',
                        }}
                      >
                        {/* Player A */}
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '13px',
                          }}
                        >
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.7rem',
                              color: 'white',
                              fontWeight: 600,
                            }}
                          >
                            A
                          </div>
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: 'rgba(255, 255, 255, 0.8)',
                              fontFamily: 'Lexend, Arial, sans-serif',
                              fontWeight: 500,
                              textAlign: 'center',
                              textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                            }}
                          >
                            PPG
                          </div>
                          <div
                            style={{
                              fontSize: '0.9rem',
                              color: '#71FD08',
                              fontFamily: 'Lexend, Arial, sans-serif',
                              fontWeight: 600,
                              background: 'linear-gradient(90deg, #71FD08, #5CD607, #71FD08)',
                              backgroundSize: '200% 100%',
                              backgroundClip: 'text',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              animation: 'textShimmer 2s ease-in-out infinite',
                            }}
                          >
                            24.2
                          </div>
                        </div>
                        {/* VS */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '0.7rem',
                            color: 'rgba(255, 255, 255, 0.6)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 600,
                            textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          VS
                        </div>
                        {/* Player B */}
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '13px',
                          }}
                        >
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #4ECDC4, #6EE7DF)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.7rem',
                              color: 'white',
                              fontWeight: 600,
                            }}
                          >
                            B
                          </div>
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: 'rgba(255, 255, 255, 0.8)',
                              fontFamily: 'Lexend, Arial, sans-serif',
                              fontWeight: 500,
                              textAlign: 'center',
                              textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                            }}
                          >
                            PPG
                          </div>
                          <div
                            style={{
                              fontSize: '0.9rem',
                              color: '#4ECDC4',
                              fontFamily: 'Lexend, Arial, sans-serif',
                              fontWeight: 600,
                            }}
                          >
                            21.8
                          </div>
                        </div>
                      </div>
                      {/* Comparison Advantage */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '8px',
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
                          </svg>
                        </div>
                        <span
                          style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 107, 107, 0.9)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 600,
                          }}
                        >
                          Player A Wins
                        </span>
                      </div>
                      {/* Head-to-Head Stats */}
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'rgba(255, 255, 255, 0.6)',
                          fontFamily: 'Lexend, Arial, sans-serif',
                          fontWeight: 500,
                          textAlign: 'center',
                          textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                        }}
                      >
                        +2.4 PPG advantage
                      </div>
                    </div>
                  </div>
                  {/* AI-Powered Predictions Feature Badge - Right Aligned */}
                  <div
                    style={{
                      position: 'absolute',
                      right: '10%',
                      top: 'calc(20% - 50px + 2.5rem - 3.3125rem)',
                      opacity: showAIBadge ? 1 : 0,
                      transform: showAIBadge ? 'translateY(0)' : 'translateY(30px)',
                      transition: 'opacity 1.2s cubic-bezier(0.4,0,0.2,1), transform 1.2s cubic-bezier(0.4,0,0.2,1)',
                      pointerEvents: showAIBadge ? 'auto' : 'none',
                      zIndex: 100,
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(113, 253, 8, 0.1)',
                        border: '2px solid rgba(113, 253, 8, 0.3)',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontFamily: 'Lexend, Arial, sans-serif',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#71FD08',
                        boxShadow: '0 2px 8px 0 rgba(113, 253, 8, 0.15)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9ZM19 21H5V3H13V9H19V21Z" fill="#71FD08"/>
                        <path d="M8 12H16V14H8V12ZM8 16H16V18H8V16Z" fill="#71FD08"/>
                      </svg>
                      AI-Powered Predictions
                    </div>
                    {/* AI Predictions Graphic - Positioned underneath the badge */}
                    <div
                      style={{
                        marginTop: '30px',
                        opacity: showAIBadge ? 1 : 0,
                        transform: showAIBadge ? 'translateY(0)' : 'translateY(20px)',
                        transition: 'opacity 1.4s cubic-bezier(0.4,0,0.2,1), transform 1.4s cubic-bezier(0.4,0,0.2,1)',
                        transitionDelay: '0.3s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {/* Prediction Chart Graphic */}
                      <div
                        style={{
                          width: '200px',
                          height: '100px',
                          background: 'rgba(113, 253, 8, 0.08)',
                          border: '2px solid rgba(113, 253, 8, 0.2)',
                          borderRadius: '12px',
                          padding: '8px 8px 2px 8px',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'space-between',
                          gap: '4px',
                        }}
                      >
                        {/* Bar 1 */}
                        <div
                          style={{
                            width: '8px',
                            height: '20px',
                            background: 'linear-gradient(180deg,rgb(240, 0, 0) 0%,rgb(154, 0, 0) 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite',
                          }}
                        />
                        {/* Bar 2 */}
                        <div
                          style={{
                            width: '8px',
                            height: '30px',
                            background: 'linear-gradient(180deg,rgb(240, 0, 0) 0%,rgb(154, 0, 0) 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite',
                          }}
                        />
                        {/* Bar 3 */}
                        <div
                          style={{
                            width: '8px',
                            height: '28px',
                            background: 'linear-gradient(180deg,rgb(240, 0, 0) 0%,rgb(154, 0, 0) 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite 0.3s',
                          }}
                        />
                        {/* Bar 4 */}
                        <div
                          style={{
                            width: '8px',
                            height: '45px',
                            background: 'linear-gradient(180deg, #71FD08 0%, #5CD607 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite 0.6s',
                          }}
                        />
                        {/* Bar 5 */}
                        <div
                          style={{
                            width: '8px',
                            height: '68px',
                            background: 'linear-gradient(180deg, #71FD08 0%, #5CD607 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite 0.9s',
                          }}
                        />
                        {/* Bar 6 */}
                        <div
                          style={{
                            width: '8px',
                            height: '58px',
                            background: 'linear-gradient(180deg, #71FD08 0%, #5CD607 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite 1.2s',
                          }}
                        />
                        {/* Bar 7 */}
                        <div
                          style={{
                            width: '8px',
                            height: '75px',
                            background: 'linear-gradient(180deg, #71FD08 0%, #5CD607 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite 1.5s',
                          }}
                        />
                        {/* Bar 8 */}
                        <div
                          style={{
                            width: '8px',
                            height: '52px',
                            background: 'linear-gradient(180deg, #71FD08 0%, #5CD607 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite 1.8s',
                          }}
                        />
                        {/* Bar 9 */}
                        <div
                          style={{
                            width: '8px',
                            height: '88px',
                            background: 'linear-gradient(180deg, #71FD08 0%, #5CD607 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite 2.1s',
                          }}
                        />
                        {/* Bar 10 */}
                        <div
                          style={{
                            width: '8px',
                            height: '65px',
                            background: 'linear-gradient(180deg, #71FD08 0%, #5CD607 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite 2.4s',
                          }}
                        />
                        {/* Bar 11 */}
                        <div
                          style={{
                            width: '8px',
                            height: '42px',
                            background: 'linear-gradient(180deg, #71FD08 0%, #5CD607 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite 2.7s',
                          }}
                        />
                        {/* Bar 12 */}
                        <div
                          style={{
                            width: '8px',
                            height: '78px',
                            background: 'linear-gradient(180deg, #71FD08 0%, #5CD607 100%)',
                            borderRadius: '2px',
                            animation: 'pulse 2s ease-in-out infinite 3.0s',
                          }}
                        />
                        {/* Prediction Line */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '65px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '219px',
                            height: '2px',
                            background: 'rgb(171, 171, 171)',
                            borderRadius: '1px',
                          }}
                        />
                      </div>
                      {/* Confidence Indicator */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '8px',
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: 'conic-gradient(from 0deg, #71FD08 0deg, #71FD08 270deg, rgba(113, 253, 8, 0.2) 270deg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: '#181C24',
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: '0.9rem',
                            color: 'rgba(113, 253, 8, 0.9)',
                            fontFamily: 'Lexend, Arial, sans-serif',
                            fontWeight: 600,
                            textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          95% confidence
                        </span>
                      </div>
                      {/* Mini Stats Preview */}
                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          marginTop: '6px',
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'rgba(255, 255, 255, 0.7)',
                              fontFamily: 'Lexend, Arial, sans-serif',
                              fontWeight: 500,
                              textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                            }}
                          >
                            PPG
                          </span>
                          <span
                            style={{
                              fontSize: '0.9rem',
                              color: '#71FD08',
                              fontFamily: 'Lexend, Arial, sans-serif',
                              fontWeight: 700,
                              textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                            }}
                          >
                            18.5
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'rgba(255, 255, 255, 0.7)',
                              fontFamily: 'Lexend, Arial, sans-serif',
                              fontWeight: 500,
                              textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                            }}
                          >
                            RPG
                          </span>
                          <span
                            style={{
                              fontSize: '0.9rem',
                              color: '#71FD08',
                              fontFamily: 'Lexend, Arial, sans-serif',
                              fontWeight: 700,
                              textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                            }}
                          >
                            6.2
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'rgba(255, 255, 255, 0.7)',
                              fontFamily: 'Lexend, Arial, sans-serif',
                              fontWeight: 500,
                              textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                            }}
                          >
                            APG
                          </span>
                          <span
                            style={{
                              fontSize: '0.9rem',
                              color: '#71FD08',
                              fontFamily: 'Lexend, Arial, sans-serif',
                              fontWeight: 700,
                              textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                            }}
                          >
                            4.1
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>
                  {/* Get Started CTA Button - Centered */}
                  <div
                    style={{
                      marginTop: '20.5rem',
                      opacity: showCTA ? 1 : 0,
                      transform: showCTA ? 'translateY(0)' : 'translateY(40px)',
                      transition: 'opacity 1.5s cubic-bezier(0.4,0,0.2,1), transform 1.5s cubic-bezier(0.4,0,0.2,1)',
                      pointerEvents: showCTA ? 'auto' : 'none',
                    }}
                  >
                    <Link href="/auth/signin" style={{ textDecoration: 'none', display: 'block' }}>
                      <button
                        className="rounded-full font-extrabold transition hover:scale-105 px-8 py-4 text-lg shadow-lg"
                        style={{
                          color: '#111',
                          border: '2px solid #71FD08',
                          cursor: 'pointer',
                          fontSize: '1.125rem',
                          padding: '1rem 2rem',
                          minWidth: '160px',
                          lineHeight: 1.2,
                          fontWeight: 800,
                          fontFamily: 'Lexend, Arial, sans-serif',
                          background: 'linear-gradient(135deg, #71FD08 0%, #5CD607 100%)',
                          position: 'relative',
                          overflow: 'hidden',
                          animation: 'buttonGlow 3s ease-in-out infinite',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textDecoration: 'none',
                          textAlign: 'center',
                          width: '100%',
                        }}
                        onMouseEnter={(e) => {
                          const textSpan = e.currentTarget.querySelector('.get-started-text') as HTMLElement;
                          const arrowSvg = e.currentTarget.querySelector('.get-started-arrow') as HTMLElement;
                          if (textSpan) {
                            textSpan.style.transform = 'translateX(-8px)';
                            textSpan.style.transition = 'transform 0.3s ease-in-out';
                          }
                          if (arrowSvg) {
                            arrowSvg.style.opacity = '1';
                            arrowSvg.style.transform = 'translateX(-5px)';
                            arrowSvg.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
                          }
                        }}
                        onMouseLeave={(e) => {
                          const textSpan = e.currentTarget.querySelector('.get-started-text') as HTMLElement;
                          const arrowSvg = e.currentTarget.querySelector('.get-started-arrow') as HTMLElement;
                          if (textSpan) {
                            textSpan.style.transform = 'translateX(0)';
                          }
                          if (arrowSvg) {
                            arrowSvg.style.opacity = '0';
                            arrowSvg.style.transform = 'translateX(-10px)';
                          }
                        }}
                      >
                        <div style={{ 
                          position: 'relative', 
                          width: '100%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            width: '100%',
                            position: 'relative'
                          }}>
                            <span 
                              className="get-started-text"
                              style={{ 
                                position: 'relative', 
                                zIndex: 2,
                                display: 'inline-block',
                                transition: 'transform 0.3s ease-in-out',
                                textDecoration: 'none',
                                textAlign: 'center',
                                width: '100%'
                              }}
                            >
                              Get Started
                            </span>
                            <svg 
                              className="get-started-arrow"
                              width="20" 
                              height="20" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              xmlns="http://www.w3.org/2000/svg"
                              style={{
                                position: 'absolute',
                                right: '-28px',
                                opacity: '0',
                                transform: 'translateX(-10px)',
                                transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
                                zIndex: 3,
                              }}
                            >
                              <path 
                                d="M5 12h14m0 0l-6-6m6 6l-6 6" 
                                stroke="#111" 
                                strokeWidth="2.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </div>
                      </button>
                    </Link>
                  </div>
                  {/* Subtext 1: Stats */}
                  <span
                    className={`explainer-text${showExplainer ? ' explainer-visible' : ''}`}
                    style={{
                      fontSize: '1.25rem',
                      color: '#fff',
                      background: 'rgba(35, 39, 47, 0.85)',
                      filter: showExplainer ? 'brightness(0.92)' : 'blur(5px) brightness(0.92)',
                      textAlign: 'center',
                      marginTop: 'calc(15rem - 120px)',
                      fontFamily: 'Lexend, Arial, sans-serif',
                      maxWidth: '80vw',
                      lineHeight: 1.4,
                      pointerEvents: 'auto',
                      display: 'inline-block',
                      opacity: showExplainer ? 1 : 0.5,
                      transform: showExplainer ? 'translateY(0)' : 'translateY(-12px)',
                      transition:
                        'opacity 1.4s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1), filter 0.5s cubic-bezier(0.4,0,0.2,1)',
                      padding: '12px 24px',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px 0 #181C24cc, 0 2px 8px 0 #181C2499',
                    }}
                  >
                    <span style={{ color: '#71FD08', fontWeight: 700 }}>Stats</span>
                    <svg style={{ display: 'inline', verticalAlign: 'middle', margin: '0 8px' }} width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 12h8m0 0l-4-4m4 4l-4 4" stroke="#71FD08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Advanced metrics sourced straight from the official WNBA API, SportsRadar.
                  </span>
                  {/* Subtext 2: Projections */}
                  <span
                    ref={projectionsRef}
                    className={`explainer-text${showSecondExplainer ? ' explainer-visible' : ''}`}
                    style={{
                      fontSize: '1.25rem',
                      color: '#fff',
                      background: 'rgba(35, 39, 47, 0.85)',
                      filter: showSecondExplainer ? 'brightness(0.92)' : 'blur(5px) brightness(0.92)',
                      textAlign: 'center',
                      marginTop: '1.5rem',
                      fontFamily: 'Lexend, Arial, sans-serif',
                      maxWidth: '80vw',
                      lineHeight: 1.4,
                      pointerEvents: 'auto',
                      display: 'inline-block',
                      opacity: showSecondExplainer ? 1 : 0,
                      transform: showSecondExplainer ? 'translateY(0)' : 'translateY(40px)',
                      transition: 'opacity 1.4s cubic-bezier(0.4,0,0.2,1), transform 1.4s cubic-bezier(0.4,0,0.2,1)',
                      padding: '12px 24px',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px 0 #181C24cc, 0 2px 8px 0 #181C2499',
                    }}
                  >
                    <span style={{ color: '#71FD08', fontWeight: 700 }}>Projections</span>
                    <svg style={{ display: 'inline', verticalAlign: 'middle', margin: '0 8px' }} width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 12h8m0 0l-4-4m4 4l-4 4" stroke="#71FD08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Powered by advanced analytics, algorithms and our highley trained models.
                  </span>
                  {/* Subtext 3: Value Betting */}
                  <span
                    className={`explainer-text${showThirdExplainer ? ' explainer-visible' : ''}`}
                    style={{
                      fontSize: '1.25rem',
                      color: '#fff',
                      background: 'rgba(35, 39, 47, 0.85)',
                      filter: showThirdExplainer ? 'brightness(0.92)' : 'blur(5px) brightness(0.92)',
                      textAlign: 'center',
                      marginTop: '1.5rem',
                      fontFamily: 'Lexend, Arial, sans-serif',
                      maxWidth: '80vw',
                      lineHeight: 1.4,
                      pointerEvents: 'auto',
                      display: 'inline-block',
                      opacity: showThirdExplainer ? 1 : 0,
                      transform: showThirdExplainer ? 'translateY(0)' : 'translateY(40px)',
                      transition: 'opacity 1.4s cubic-bezier(0.4,0,0.2,1), transform 1.4s cubic-bezier(0.4,0,0.2,1)',
                      padding: '12px 24px',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px 0 #181C24cc, 0 2px 8px 0 #181C2499',
                    }}
                  >
                    <span style={{ color: '#71FD08', fontWeight: 700 }}>Value Betting</span>
                    <svg style={{ display: 'inline', verticalAlign: 'middle', margin: '0 8px' }} width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 12h8m0 0l-4-4m4 4l-4 4" stroke="#71FD08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Compare our AI projections against sportsbook lines to find the best betting opportunities.
                  </span>
                </div>
              )}
            </>
          )}
          {/* Green bouncing arrow only for NOT signed in users */}
          {!session && (
            <div style={{
              position: 'absolute',
              left: '50%',
              top: 'calc(20% + 325px + 150px)',
              transform: 'translateX(-50%)',
              zIndex: 10,
              pointerEvents: 'none',
              animation: 'bounceDown 1.6s infinite',
              opacity: showCTA && !showExplainer ? 1 : 0,
              transition: 'opacity 0.7s cubic-bezier(0.4,0,0.2,1)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="#71FD08" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          <style>{`
            @keyframes bounceDown {
              0%, 100% { transform: translateX(-50%) translateY(0); }
              50% { transform: translateX(-50%) translateY(18px); }
            }
            
            @keyframes pulse {
              0%, 100% { opacity: 0.7; transform: scaleY(1); }
              50% { opacity: 1; transform: scaleY(1.1); }
            }
            
            @keyframes glow {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 1; }
            }
            
            @keyframes buttonGlow {
              0% { 
                box-shadow: 0 8px 32px 0 rgba(113, 253, 8, 0.3),
                           0 0 0 0 rgba(113, 253, 8, 0.5);
              }
              50% { 
                box-shadow: 0 8px 32px 0 rgba(113, 253, 8, 0.4),
                           0 0 12px 6px rgba(113, 253, 8, 0.2),
                           0 0 24px 12px rgba(113, 253, 8, 0.1);
              }
              100% { 
                box-shadow: 0 8px 32px 0 rgba(113, 253, 8, 0.3),
                           0 0 0 0 rgba(113, 253, 8, 0.5);
              }
            }
            
            @keyframes shimmer {
              0% {
                transform: translateX(-100%) translateY(-100%);
              }
              100% {
                transform: translateX(100%) translateY(100%);
              }
            }
            
            @keyframes textShimmer {
              0% {
                backgroundPosition: '0% 50%';
              }
              100% {
                backgroundPosition: '200% 50%';
              }
            }
          `}</style>
          <div style={{ minHeight: '120vh' }} />
        </div>
        {/* Only show FAQFooter for NOT signed in users */}
        {!session && <FAQFooter />}
        <AdminCacheDashboard />
        <AdminCacheClearButton />
      </div>
    </>
  );
} 