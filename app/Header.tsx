"use client";
import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { UserCircle2, Lock, XCircle } from 'lucide-react';
import { useSession, signOut, signIn } from 'next-auth/react';
import Link from "next/link";
import Image from 'next/image';
import { TEAM_LOGOS } from '../lib/constants/team-logos';


// Universal external link arrow SVG
const ExternalArrow = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#71FD08"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline', verticalAlign: 'middle' }}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// Helper to convert logo filename to readable team name
function getTeamDisplayName(logo: string) {
  return logo
    .replace(/_logo.*|\.svg\.png|\.png/g, '')
    .replace(/_/g, ' ')
    .replace(/\(\d{4}\)/g, '') // Remove (2021)
    .replace(/\d{4}$/, '')       // Remove trailing 2024
    .replace(/\s+/g, ' ')        // Collapse whitespace
    .replace(/^New Las Vegas Aces WNBA$/i, 'Las Vegas Aces') // Fix for this specific case
    .trim();
}

export function Header() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [placeholderActive, setPlaceholderActive] = useState(true);
  const { data: session, status, update } = useSession();
  const [currentPlan, setCurrentPlan] = useState('free');
  const [isPaid, setIsPaid] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('free');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planLoading, setPlanLoading] = useState<string | null>(null);
  const [favoriteTeam, setFavoriteTeam] = useState('Las Vegas Aces');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Placeholder for user avatar (default NBA/WNBA logo)
  const defaultAvatar = '/logos/WNBA_Logo.png'; // Use the new fallback image with no spaces
  const [currentAvatar, setCurrentAvatar] = useState<string>(defaultAvatar);
  
  // Update local avatar state when session changes
  useEffect(() => {
    if (session?.user?.image) {
      setCurrentAvatar(session.user.image);
    }
  }, [session?.user?.image]);
  
  // Helper function to ensure avatar path is valid
  const getAvatarPath = (avatar: string) => {
    if (!avatar) return defaultAvatar;
    
    // If it's a team name (not a file path), convert to logo path
    if (avatar && !avatar.includes('/') && !avatar.includes('.png') && !avatar.includes('.svg')) {
      // Convert team name to logo filename
      const teamNameToLogo: Record<string, string> = {
        'Las Vegas Aces': '/logos/New_Las_Vegas_Aces_WNBA_logo_2024.svg.png',
        'New York Liberty': '/logos/New_York_Liberty_logo.svg.png',
        'Connecticut Sun': '/logos/Connecticut_Sun_logo.svg.png',
        'Washington Mystics': '/logos/Washington_Mystics_logo.svg.png',
        'Dallas Wings': '/logos/Dallas_Wings_logo.svg.png',
        'Phoenix Mercury': '/logos/Phoenix_Mercury_logo.svg.png',
        'Minnesota Lynx': '/logos/Minnesota_Lynx_logo.svg.png',
        'Seattle Storm': '/logos/Seattle_Storm_(2021)_logo.svg.png',
        'Chicago Sky': '/logos/Chicago_Sky_logo.svg.png',
        'Indiana Fever': '/logos/Indiana_Fever_logo.svg.png',
        'Atlanta Dream': '/logos/Atlanta_Dream_logo.svg.png',
        'Los Angeles Sparks': '/logos/Los_Angeles_Sparks_logo.svg.png',
      };
      
      const logoPath = teamNameToLogo[avatar];
      if (logoPath) return logoPath;
      
      // If no mapping found, return default avatar
      return defaultAvatar;
    }
    
    // If it already has /logos/ prefix, use as is
    if (avatar.startsWith('/logos/')) return avatar;
    // If it's just a filename, add the prefix
    if (avatar.includes('.png') || avatar.includes('.svg')) return `/logos/${avatar}`;
    // Otherwise, assume it's a full path
    return avatar;
  };
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [initialProfile, setInitialProfile] = useState({
    name: '',
    plan: 'free',
    favoriteTeam: 'Las Vegas Aces',
  });
  const [nameFocused, setNameFocused] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamModalLoading, setTeamModalLoading] = useState(false);

  // Custom placeholder as a scrolling marquee
  const placeholderText = 'Search Players...';

  // Update session-dependent state when session loads
  useEffect(() => {
    if (session?.user) {
      const plan = session.user.plan || 'free';
      const isPaidUser = plan === 'monthly' || plan === 'lifetime';
      
      setCurrentPlan(plan);
      setIsPaid(isPaidUser);
      setProfileName(session.user.name || '');
      setInitialProfile({
        name: session.user.name || '',
        plan: plan,
        favoriteTeam: session.user.image || 'Las Vegas Aces',
      });
      
      // Fetch real subscription status from Stripe
      fetchSubscriptionStatus();
      
      if (session.user.image) {
        const avatarPath = session.user.image;
        const filename = avatarPath.includes('/logos/') ? avatarPath.replace('/logos/', '') : avatarPath;
        setFavoriteTeam(filename);
        setInitialProfile(prev => ({ ...prev, favoriteTeam: filename }));
      }
    }
  }, [session]);

  // Detect if any changes have been made
  const isChanged =
    profileName !== initialProfile.name ||
    currentPlan !== initialProfile.plan ||
    favoriteTeam !== initialProfile.favoriteTeam;

  function capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Save handler
  const handleSave = async () => {
    setSaveLoading(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          plan: currentPlan,
          favoriteTeam,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setInitialProfile({ name: profileName, plan: currentPlan, favoriteTeam });
        // Refresh session so avatar updates immediately
        if (typeof update === 'function') {
          await update();
        }
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } finally {
      setSaveLoading(false);
    }
  };

  // Fetch user's subscription status
  const fetchSubscriptionStatus = async () => {
    if (!session?.user?.email) return;
    
    try {
      const response = await fetch('/api/stripe/subscription-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.subscription) {
          const status = data.subscription.status;
          const plan = data.subscription.items?.data?.[0]?.price?.id;
          
          if (status === 'trialing') {
            setSubscriptionStatus('trial');
            setCurrentPlan('Monthly (Trial)');
          } else if (status === 'active' && plan === 'price_1S5aIhLzfRu4d31NkVIAkBed') {
            setSubscriptionStatus('monthly');
            setCurrentPlan('Monthly');
          } else if (status === 'active' && plan === 'price_1S5aJuLzfRu4d31NzQnybX3Y') {
            setSubscriptionStatus('lifetime');
            setCurrentPlan('Lifetime');
          } else {
            setSubscriptionStatus('free');
            setCurrentPlan('Free');
          }
          setIsPaid(data.subscription.status !== 'canceled');
        } else {
          setSubscriptionStatus('free');
          setCurrentPlan('Free');
          setIsPaid(false);
        }
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    }
  };

  // Handle plan upgrade arrow click - show plan modal
  const handlePlanArrowClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowPlanModal(true);
  };

  // Handle plan selection
  const handlePlanSelect = async (plan: 'monthly' | 'lifetime') => {
    setPlanLoading(plan);
    
    const endpoint = plan === 'monthly' ? '/api/stripe/checkout/monthly' : '/api/stripe/checkout/lifetime';
    
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      const data = await res.json();
      
      if (data.url) {
        // Go directly to Stripe checkout
        window.location.href = data.url;
      } else {
        alert(data.error || "Could not start checkout. Please try again.");
      }
    } catch (err) {
      alert("Could not start checkout. Please try again.");
    } finally {
      setPlanLoading(null);
    }
  };


  // Handle sign out with redirect to home page
  const handleSignOut = async () => {
    setAvatarMenuOpen(false);
    await signOut({ redirect: false });
    router.push('/');
  };

  return (
    // Use position: fixed for guaranteed sticky header
    <header className="w-full bg-darkheader font-bold fixed top-0 left-0 z-50 pb-4 pt-0" style={{ 
      width: '100%', 
      backgroundColor: '#14171F', 
      margin: 0, 
      paddingTop: 0,
      minHeight: 'clamp(80px, 8vh, 120px)'
    }}>
      <div className="flex w-full items-center" style={{ 
        overflow: 'visible',
        paddingLeft: 'clamp(0.75rem, 2vw, 1.5rem)',
        paddingRight: 'clamp(0.75rem, 2vw, 1.5rem)'
      }}>
        <span
          className="nextgenhoops-title font-extrabold font-sans text-secondary select-none"
          style={{
            position: 'relative',
            fontFamily: 'Lexend, Arial, Helvetica, sans-serif',
            fontSize: 'clamp(2rem, 4vw, 4rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.04em',
            margin: 0,
            padding: 'clamp(0.25rem, 0.5vw, 0.5rem)',
            border: 'none',
            display: 'block',
            marginRight: 'clamp(0.25rem, 0.5vw, 0.5rem)',
            marginLeft: 'clamp(0.25rem, 0.5vw, 0.5rem)',
            marginTop: 'clamp(1px, 0.1vh, 4px)',
            overflow: 'visible',
            flexShrink: 0,
            minWidth: 'fit-content',
            width: 'auto',
          }}
        >
          {/* NGH Logo */}
          <Image
            src="/NGH_Logo_White.PNG"
            alt="NGH Logo"
            width={100}
            height={100}
            style={{
              display: 'inline-block',
              verticalAlign: 'middle',
              marginRight: 'clamp(0.5rem, 1vw, 1rem)',
              marginBottom: 'clamp(1px, 0.2vh, 4px)',
              marginTop: 'clamp(-4px, -0.5vh, -2px)',
              marginLeft: 'clamp(-4px, -0.5vw, -2px)',
              width: 'clamp(40px, 6vw, 80px)',
              height: 'clamp(40px, 6vw, 80px)',
              filter: 'drop-shadow(0 0 12px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 6px rgba(0, 0, 0, 1)) drop-shadow(0 0 3px rgba(0, 0, 0, 1))'
            }}
          />
          <span style={{ color: '#e5e5e5', textShadow: '2px 2px 4px #000, 1px 1px 2px #000' }}>NextGen</span>
          <span style={{ color: '#71FD08', textShadow: '2px 2px 4px #000, 1px 1px 2px #000' }}>Hoops</span>
        </span>
        <span
          className="flex items-center"
          style={{ height: 'clamp(4rem, 6vh, 5.5rem)', alignSelf: 'center' }}
        >
        </span>
        {/*Nav Border*/}
        <div className="flex-1 flex items-center">
          <nav className="flex items-end justify-between w-full" style={{ 
            paddingRight: 'clamp(0.125rem, 0.5vw, 0.5rem)', 
            marginTop: 'clamp(4px, 0.5vh, 8px)',
            marginRight: 'clamp(0.0625rem, 0.25vw, 0.25rem)',
            marginLeft: 'clamp(0.5rem, 1.5vw, 1rem)',
            padding: 'clamp(0.375rem, 0.75vw, 0.5rem) clamp(0.125rem, 0.5vw, 0.375rem)',
            backgroundColor: '#1A1E28',
            borderRadius: 'clamp(6px, 0.8vw, 10px)',
            border: '1px solid #2A2F3A',
            justifyContent: 'space-between'
          }}>
            <Link
              href={session ? "/dashboard" : "/"}
              className="text-lg font-bold text-white hover:text-[#71FD08] cursor-pointer px-2 py-1 whitespace-nowrap"
              style={{ 
                userSelect: 'none', 
                whiteSpace: 'nowrap', 
                textShadow: '0 1px 4px rgba(0,0,0,0.45)', 
                marginLeft: 'clamp(0.75rem, 2vw, 1.5rem)', 
                transform: session ? 'translateY(-7px)' : 'none',
                transition: 'all 0.2s ease-in-out !important',
                fontSize: 'clamp(0.875rem, 1.2vw, 1rem)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = session ? 'translateY(-7px) scale(1.15)' : 'scale(1.15)';
                e.currentTarget.style.textShadow = '0 4px 12px rgba(0,0,0,0.8)';
                e.currentTarget.style.color = '#71FD08';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = session ? 'translateY(-7px)' : 'none';
                e.currentTarget.style.textShadow = '0 1px 4px rgba(0,0,0,0.45)';
                e.currentTarget.style.color = '#fff';
              }}
              title={session ? "Dashboard" : "Home"}
            >
              {session ? "Dashboard" : "Home"}
            </Link>
            <Link
              href="/players"
              className="text-lg font-bold text-white hover:text-[#71FD08] cursor-pointer px-2 py-1 whitespace-nowrap"
              style={{ 
                userSelect: 'none', 
                whiteSpace: 'nowrap', 
                textShadow: '0 1px 4px rgba(0,0,0,0.45)', 
                marginLeft: 'clamp(0.0625rem, 0.3vw, 0.25rem)', 
                transform: session ? 'translateY(-7px)' : 'none',
                transition: 'all 0.2s ease-in-out !important',
                fontSize: 'clamp(0.875rem, 1.2vw, 1rem)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = session ? 'translateY(-7px) scale(1.15)' : 'scale(1.15)';
                e.currentTarget.style.textShadow = '0 4px 12px rgba(0,0,0,0.8)';
                e.currentTarget.style.color = '#71FD08';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = session ? 'translateY(-7px)' : 'none';
                e.currentTarget.style.textShadow = '0 1px 4px rgba(0,0,0,0.45)';
                e.currentTarget.style.color = '#fff';
              }}
              title="Player Stats"
            >
              Player Stats
            </Link>
            {/* Projections Link - Only accessible to paid users or whitelisted emails */}
            {(isPaid || session?.user?.email === 'wcavnar@hotmail.com' || session?.user?.email === 'ryancavnar@gmail.com') ? (
              <Link
                href="/projections"
                className="text-lg font-bold text-white hover:text-[#71FD08] cursor-pointer px-2 py-1 whitespace-nowrap"
                style={{ 
                  userSelect: 'none', 
                  whiteSpace: 'nowrap', 
                  textShadow: '0 1px 4px rgba(0,0,0,0.45)', 
                  marginLeft: 'clamp(0.0625rem, 0.3vw, 0.25rem)', 
                  transform: session ? 'translateY(-7px)' : 'none',
                  transition: 'all 0.2s ease-in-out !important',
                  fontSize: 'clamp(0.875rem, 1.2vw, 1rem)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = session ? 'translateY(-7px) scale(1.15)' : 'scale(1.15)';
                  e.currentTarget.style.textShadow = '0 4px 12px rgba(0,0,0,0.8)';
                  e.currentTarget.style.color = '#71FD08';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = session ? 'translateY(-7px)' : 'none';
                  e.currentTarget.style.textShadow = '0 1px 4px rgba(0,0,0,0.45)';
                  e.currentTarget.style.color = '#fff';
                }}
                title="Projections"
              >
                Projections
              </Link>
            ) : (
              <div className="relative group flex items-center">
                <a
                  href="#"
                  tabIndex={-1}
                  className="text-lg font-bold text-white cursor-not-allowed px-2 py-1 whitespace-nowrap"
                  style={{ 
                    userSelect: 'none', 
                    whiteSpace: 'nowrap', 
                    marginLeft: 'clamp(0.0625rem, 0.3vw, 0.25rem)', 
                    transform: session ? 'translateY(-7px)' : 'none',
                    transition: 'all 0.2s ease-in-out !important',
                    fontSize: 'clamp(0.875rem, 1.2vw, 1rem)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = session ? 'translateY(-7px) scale(1.15)' : 'scale(1.15)';
                    e.currentTarget.style.textShadow = 'none';
                    e.currentTarget.style.color = '#ff4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = session ? 'translateY(-7px)' : 'none';
                    e.currentTarget.style.textShadow = '0 1px 4px rgba(0,0,0,0.45)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  title={session ? "Upgrade to NBA + WNBA plan ($25/month) to unlock projections" : "Sign in and upgrade to access projections"}
                  aria-disabled="true"
                  onClick={(e) => e.preventDefault()}
                >
                  Projections
                  <XCircle 
                    size={16} 
                    style={{ 
                      display: 'inline', 
                      marginLeft: '4px', 
                      verticalAlign: 'middle',
                      color: '#ff4444',
                      opacity: 0,
                      transition: 'opacity 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0';
                    }}
                  />
                </a>
              </div>
            )}
            {/* User-specific elements - only show after session loads */}
            {status === 'loading' ? (
              // Show a subtle loading indicator for user area
              <div className="flex items-center" style={{ marginLeft: '5px' }}>
                <div className="animate-pulse bg-gray-600 h-8 w-20 rounded" style={{ marginRight: '20px' }}></div>
              </div>
            ) : session ? (
              <div className="relative flex flex-col items-center" style={{ marginLeft: 'clamp(-1rem, -2vw, -0.5rem)' }}>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Open profile menu"
                  onClick={() => setAvatarMenuOpen((open) => !open)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setAvatarMenuOpen(open => !open); }}
                  style={{
                    display: 'inline-block',
                    borderRadius: '50%',
                    boxShadow: '0 0 8px 2px #71FD08',
                    outline: 'none',
                    background: 'transparent',
                    width: 'clamp(32px, 4vw, 40px)',
                    height: 'clamp(32px, 4vw, 40px)',
                    minWidth: 0,
                    minHeight: 0,
                    cursor: 'pointer',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { 
                    e.currentTarget.style.transform = 'scale(1.15)'; 
                    e.currentTarget.style.boxShadow = '0 0 12px 4px #71FD08';
                  }}
                  onMouseLeave={e => { 
                    e.currentTarget.style.transform = 'scale(1)'; 
                    e.currentTarget.style.boxShadow = '0 0 8px 2px #71FD08';
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '-25px',
                      transform: 'translateX(-50%)',
                      background: 'transparent',
                      color: '#71FD08',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      padding: 0,
                      borderRadius: 0,
                      boxShadow: 'none',
                      opacity: 0,
                      pointerEvents: 'none',
                      transition: 'opacity 0.18s',
                      zIndex: 100,
                      whiteSpace: 'nowrap',
                      textShadow: '0 1px 4px rgba(0,0,0,0.45)',
                    }}
                    className="avatar-tooltip"
                  >
                    {!avatarMenuOpen && 'Profile'}
                  </span>
                  <Image
                    src={getAvatarPath(currentAvatar)}
                    alt="User avatar"
                    width={36}
                    height={36}
                    style={{ 
                      borderRadius: '50%', 
                      objectFit: 'cover', 
                      display: 'block',
                      width: 'clamp(32px, 4vw, 40px)',
                      height: 'clamp(32px, 4vw, 40px)'
                    }}
                    onError={e => { e.currentTarget.src = defaultAvatar; }}
                  />
                  <style>{`
                    .avatar-tooltip {
                      opacity: 0;
                      transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    [role='button']:hover .avatar-tooltip,
                    [role='button']:focus .avatar-tooltip {
                      opacity: 1 !important;
                    }
                  `}</style>
                </span>
                {avatarMenuOpen && (
                  <div className="fixed z-50" style={{
                    left: '50%',
                    top: 'calc(50% + 40px)',
                    transform: 'translate(-50%, -50%)',
                    minWidth: 320,
                    minHeight: 420,
                    background: '#181C24',
                    border: '1.5px solid #71FD08',
                    borderRadius: '1rem',
                    boxShadow: '0 8px 32px 0 rgba(0,0,0,0.18)',
                    padding: '2.2rem 2.2rem 1.5rem 2.2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'space-between',
                    zIndex: 9999,
                  }}>
                    {/* Green X close button */}
                    <button
                      aria-label="Close profile menu"
                      onClick={() => setAvatarMenuOpen(false)}
                      style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        background: 'none',
                        border: 'none',
                        color: '#71FD08',
                        fontSize: '1.75rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        zIndex: 10001,
                        lineHeight: 1,
                        padding: '0.75rem',
                        borderRadius: '0.25rem',
                      }}
                    >
                      ×
                    </button>
                    <div style={{ color: '#71FD08', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', textAlign: 'center', letterSpacing: '0.01em', textShadow: '0 2px 8px rgba(0,0,0,0.65)' }}>Profile</div>
                    <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, height: '100%' }}>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.98rem', marginBottom: '0.18rem', marginTop: 0, textShadow: '0 2px 8px rgba(0,0,0,0.65)' }}>
                        Name
                      </div>
                      <input
                        type="text"
                        value={profileName}
                        onChange={e => setProfileName(capitalizeFirstLetter(e.target.value))}
                        onFocus={() => setNameFocused(true)}
                        onBlur={() => setNameFocused(false)}
                        style={{
                          width: '100%',
                          padding: '0.7rem 1rem',
                          borderRadius: '0.5rem',
                          border: nameFocused ? '2px solid #71FD08' : '1.5px solid #333',
                          background: '#23272F',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '1.05rem',
                          marginBottom: '0.7rem',
                          letterSpacing: '0.01em',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.98rem', marginBottom: '0.18rem', marginTop: 0, textShadow: '0 2px 8px rgba(0,0,0,0.65)' }}>
                        Email
                      </div>
                      <input
                        type="email"
                        value={session?.user?.email || ''}
                        disabled
                        style={{
                          width: '100%',
                          padding: '0.7rem 1rem',
                          borderRadius: '0.5rem',
                          border: '1.5px solid #333',
                          background: '#23272F',
                          color: '#888',
                          fontWeight: 700,
                          fontSize: '1.05rem',
                          marginBottom: '0.7rem',
                          letterSpacing: '0.01em',
                          outline: 'none',
                          boxSizing: 'border-box',
                          cursor: 'not-allowed',
                          opacity: 0.7,
                        }}
                      />
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '1.01rem', letterSpacing: '0.01em', marginBottom: '0.18rem', marginTop: 0, textShadow: '0 2px 8px rgba(0,0,0,0.65)' }}>
                        Current Plan
                      </div>
                      <div style={{
                        position: 'relative',
                        background: '#23272F',
                        border: '1.5px solid #333',
                        borderRadius: '0.5rem',
                        padding: '0.7rem 1rem',
                        color: currentPlan === 'free' ? '#71FD08' : '#71FD08',
                        fontWeight: 700,
                        fontSize: '1.05rem',
                        marginBottom: '0.7rem',
                        letterSpacing: '0.01em',
                        cursor: 'default',
                        userSelect: 'none',
                        textTransform: currentPlan === 'free' ? 'uppercase' : 'none',
                      }}
                      >
                        {currentPlan === 'free' ? 'FREE' : currentPlan}
                        {subscriptionStatus === 'free' && (
                          <a
                            href="#"
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 10,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              zIndex: 2,
                              textDecoration: 'none',
                              color: 'transparent',
                              fontSize: 0,
                              lineHeight: 0,
                            }}
                            title="Upgrade Plan"
                            tabIndex={0}
                            onClick={handlePlanArrowClick}
                          >
                            <ExternalArrow />
                          </a>
                        )}
                      </div>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '1.01rem', letterSpacing: '0.01em', marginBottom: '0.18rem', marginTop: 0, textShadow: '0 2px 8px rgba(0,0,0,0.65)' }}>
                        Favorite Team
                      </div>
                      <div
                        style={{
                          background: '#23272F',
                          border: '1.5px solid #333',
                          borderRadius: '0.5rem',
                          padding: '0.7rem 1rem',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '1.05rem',
                          marginBottom: '0.7rem',
                          letterSpacing: '0.01em',
                          cursor: 'pointer',
                          userSelect: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.7rem',
                          transition: 'border 0.18s, background 0.18s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.border = '2px solid #71FD08';
                          e.currentTarget.style.background = '#1a2e13';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.border = '1.5px solid #333';
                          e.currentTarget.style.background = '#23272F';
                        }}
                        onClick={() => setShowTeamModal(true)}
                        title="Click to change favorite team"
                      >
                        <Image
                          src={getAvatarPath(favoriteTeam)}
                          alt={getTeamDisplayName(favoriteTeam)}
                          width={32}
                          height={32}
                          onError={e => { e.currentTarget.src = defaultAvatar; }}
                          style={{ borderRadius: '50%', objectFit: 'cover', background: '#fff', border: '2px solid #e5e7eb' }}
                        />
                        {getTeamDisplayName(favoriteTeam)}
                      </div>
                      {showTeamModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                          <div className="bg-[#181C24] rounded-lg p-6 max-w-2xl w-full shadow-lg relative">
                            <button
                              className="absolute top-2 right-2 text-2xl font-bold"
                              onClick={() => setShowTeamModal(false)}
                              aria-label="Close"
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                cursor: 'pointer',
                                color: '#71FD08',
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                padding: '0.5rem',
                                borderRadius: '0.25rem',
                                position: 'absolute',
                                top: '0.3125rem',
                                right: '0.375rem',
                              }}
                            >
                              ×
                            </button>
                            <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem', marginBottom: '1rem', textAlign: 'center' }}>
                              Pick Your Favorite Team
                              {teamModalLoading && <span style={{ color: '#71FD08', marginLeft: '0.5rem' }}>Saving...</span>}
                            </h2>
                            <div className="grid grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
                              {TEAM_LOGOS.map((logo) => (
                                <button
                                  key={logo}
                                  className="p-2 rounded hover:bg-blue-100 focus:outline-none disabled:opacity-50"
                                  onClick={async () => {
                                    setTeamModalLoading(true);
                                    try {
                                      // Update local state immediately for instant feedback
                                      setFavoriteTeam(logo);
                                      
                                      const res = await fetch("/api/account/avatar", {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ avatar: `/logos/${logo}` }),
                                      });
                                      const data = await res.json();
                                      if (!res.ok) throw new Error(data.error || "Failed to update avatar");
                                      
                                      // Update session to reflect the new avatar
                                      if (typeof update === 'function') {
                                        await update();
                                      }
                                      
                                      setShowTeamModal(false);
                                    } catch (err: any) {
                                      console.error("Failed to update avatar:", err);
                                      // Keep the local state update for immediate feedback
                                      setShowTeamModal(false);
                                    } finally {
                                      setTeamModalLoading(false);
                                    }
                                  }}
                                  disabled={teamModalLoading}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                  <Image
                                    src={`/logos/${logo}`}
                                    alt={getTeamDisplayName(logo)}
                                    width={60}
                                    height={60}
                                    onError={e => { e.currentTarget.src = defaultAvatar; }}
                                    style={{ borderRadius: '50%', objectFit: 'cover', background: '#fff', border: '2px solid #e5e7eb' }}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: 'auto', minHeight: '2.5rem', position: 'relative' }}>
                        <div style={{ flex: 1 }} />
                        <button
                          type="button"
                          disabled={!isChanged || saveLoading}
                          onClick={handleSave}
                          style={{
                            background: isChanged && !saveLoading ? 'linear-gradient(90deg, #71FD08 0%, #3b82f6 100%)' : '#23272F',
                            color: isChanged && !saveLoading ? '#181C24' : '#888',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            border: 'none',
                            borderRadius: '0.5rem',
                            padding: '0.38rem 1.1rem',
                            cursor: isChanged && !saveLoading ? 'pointer' : 'not-allowed',
                            opacity: isChanged && !saveLoading ? 1 : 0.7,
                            minWidth: 0,
                            margin: '0 auto',
                            position: 'relative',
                          }}
                        >
                          {saveLoading ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}
                          {saveSuccess && (
                            <span style={{ marginLeft: 8, color: '#71FD08', fontWeight: 700, fontSize: '1.1em' }}>✔</span>
                          )}
                        </button>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={handleSignOut}
                            style={{
                              color: '#fff',
                              background: 'none',
                              border: 'none',
                              fontWeight: 700,
                              fontSize: '1rem',
                              cursor: 'pointer',
                              minWidth: 0,
                              padding: '0.38rem 1.1rem',
                              transition: 'color 0.2s',
                            }}
                            onMouseOver={e => e.currentTarget.style.color = '#71FD08'}
                            onMouseOut={e => e.currentTarget.style.color = '#fff'}
                          >
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <Link 
                href="/auth/signin" 
                className="text-lg font-bold text-white hover:text-[#71FD08] cursor-pointer px-2 py-1 whitespace-nowrap"
                style={{ 
                  userSelect: 'none', 
                  whiteSpace: 'nowrap', 
                  textShadow: '0 1px 4px rgba(0,0,0,0.45)',
                  transition: 'all 0.2s ease-in-out !important',
                  fontSize: 'clamp(0.875rem, 1.2vw, 1rem)',
                  marginLeft: 'clamp(0.0625rem, 0.3vw, 0.25rem)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.15)';
                  e.currentTarget.style.textShadow = '0 4px 12px rgba(0,0,0,0.8)';
                  e.currentTarget.style.color = '#71FD08';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.textShadow = '0 1px 4px rgba(0,0,0,0.45)';
                  e.currentTarget.style.color = '#fff';
                }}
                title="Sign In"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </div>

      {/* Plan Selection Modal */}
      {showPlanModal && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-40"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div 
            className="rounded-lg p-6 shadow-lg relative mx-4"
            style={{
              background: '#181C24',
              border: '2px solid #71FD08',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '320px',
              width: '100%',
              position: 'relative',
              margin: '0 auto',
            }}
          >
            <button
              className="absolute top-2 right-2 text-2xl font-bold"
              onClick={() => setShowPlanModal(false)}
              aria-label="Close"
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                color: '#71FD08',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                padding: '0.5rem',
                borderRadius: '0.25rem',
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
              }}
            >
              ×
            </button>
            
            <h2 className="text-xl font-bold text-white mb-6" style={{ color: '#fff', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.5rem', textAlign: 'center' }}>
              Choose Your Plan
            </h2>
            
            <p className="text-sm text-gray-400 mb-4" style={{ color: '#9CA3AF', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
              You will be taken to Stripe checkout upon choosing
            </p>
            
            <div>
              {/* Monthly Plan Button */}
              <button
                onClick={() => handlePlanSelect('monthly')}
                disabled={planLoading === 'monthly'}
                style={{
                  background: planLoading === 'monthly' ? '#23272F' : 'linear-gradient(90deg, #71FD08 0%, #10b981 100%)',
                  color: planLoading === 'monthly' ? '#888' : '#181C24',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.6rem 1rem',
                  cursor: planLoading === 'monthly' ? 'not-allowed' : 'pointer',
                  opacity: planLoading === 'monthly' ? 0.7 : 1,
                  width: '100%',
                  transition: 'all 0.2s ease-in-out',
                  textAlign: 'center',
                  marginBottom: '1rem',
                }}
                onMouseEnter={(e) => {
                  if (planLoading !== 'monthly') {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(113, 253, 8, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (planLoading !== 'monthly') {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {planLoading === 'monthly' ? 'Processing...' : 'Monthly - 3 days free, then $29.99/mo'}
              </button>

              {/* Lifetime Plan Button */}
              <button
                onClick={() => handlePlanSelect('lifetime')}
                disabled={planLoading === 'lifetime'}
                style={{
                  background: planLoading === 'lifetime' ? '#23272F' : 'linear-gradient(90deg, #71FD08 0%, #10b981 100%)',
                  color: planLoading === 'lifetime' ? '#888' : '#181C24',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.6rem 1rem',
                  cursor: planLoading === 'lifetime' ? 'not-allowed' : 'pointer',
                  opacity: planLoading === 'lifetime' ? 0.7 : 1,
                  width: '100%',
                  transition: 'all 0.2s ease-in-out',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  if (planLoading !== 'lifetime') {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(113, 253, 8, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (planLoading !== 'lifetime') {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {planLoading === 'lifetime' ? 'Processing...' : 'Lifetime - $199.99 one time'}
              </button>
            </div>

            <div className="text-xs text-center" style={{ color: '#888', fontSize: '0.75rem', marginTop: '1.75rem' }}>
              Secure payment powered by Stripe
            </div>
          </div>
        </div>
      )}

    </header>
  );
}

// Add to globals.css:
// .animate-marquee {
//   display: inline-block;
//   animation: marquee 6s linear infinite;
// }
// @keyframes marquee {
//   0% { transform: translateX(100%); }
//   100% { transform: translateX(-100%); }
// }

/* Add to your globals.css or in a <style jsx global> block:
.animate-fade-in-out {
  animation: fadeInOut 3s ease-in-out;
}
@keyframes fadeInOut {
  0% { opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { opacity: 0; }
}
*/ 