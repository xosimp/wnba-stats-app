"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

interface SocialSignInButtonsProps {
  className?: string;
}

export default function SocialSignInButtons({ className = "" }: SocialSignInButtonsProps) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const isSignup = className.includes('signup-social-buttons');

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("Google sign-in error:", error);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsAppleLoading(true);
    try {
      await signIn("apple", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("Apple sign-in error:", error);
    } finally {
      setIsAppleLoading(false);
    }
  };

  if (isSignup) {
    return (
      <div className={`flex flex-row justify-center ${className}`} style={{ marginTop: '25px', gap: '15px' }}>
        <button
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="flex items-center justify-center rounded-full border border-gray-300 bg-white hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            width: 64, 
            height: 64, 
            padding: 0, 
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)', 
            background: '#fff', 
            border: '1.5px solid #e5e7eb',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#000'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
        >
          {isGoogleLoading ? (
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="#111" strokeWidth="4" opacity=".2"/>
              <path d="M22 12a10 10 0 0 1-10 10" stroke="#111" strokeWidth="4"/>
            </svg>
          ) : (
            <svg width="36" height="36" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
        </button>
        <button
          onClick={handleAppleSignIn}
          disabled={isAppleLoading}
          className="flex items-center justify-center rounded-full border border-gray-300 bg-white hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            width: 64, 
            height: 64, 
            padding: 0, 
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)', 
            background: '#fff', 
            border: '1.5px solid #e5e7eb',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#000'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
        >
          {isAppleLoading ? (
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="#111" strokeWidth="4" opacity=".2"/>
              <path d="M22 12a10 10 0 0 1-10 10" stroke="#111" strokeWidth="4"/>
            </svg>
          ) : (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#000">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
          )}
        </button>
      </div>
    );
  }

  // Default rendering for other forms
  return (
    <div className={`space-y-5 ${className}`}>
      {/* Divider */}
      <div className="flex items-center justify-center my-4">
        <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db', minHeight: '1px' }}></div>
        <span style={{ paddingLeft: '24px', paddingRight: '24px', color: '#6b7280', fontWeight: 'bold', fontSize: '0.875rem' }}>OR</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db', minHeight: '1px' }}></div>
      </div>
      {/* Google Sign In Button */}
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="w-full flex items-center justify-center px-6 py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontSize: '1.1rem',
            height: '3.75rem',
            borderRadius: '1.5rem',
            border: '1.5px solid #e5e7eb',
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)',
            fontWeight: 600,
            color: '#111',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease',
            gap: '17px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#000'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
      >
        {isGoogleLoading ? (
          <svg className="animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="#111" strokeWidth="4" opacity=".2"/>
            <path d="M22 12a10 10 0 0 1-10 10" stroke="#111" strokeWidth="4"/>
          </svg>
        ) : (
          <svg width="30" height="30" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        {isGoogleLoading ? "Signing in..." : "Continue with Google"}
      </button>
      </div>
      {/* Apple Sign In Button */}
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={handleAppleSignIn}
          disabled={isAppleLoading}
          className="w-full flex items-center justify-center px-6 py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontSize: '1.1rem',
            height: '3.75rem',
            borderRadius: '1.5rem',
            border: '1.5px solid #e5e7eb',
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)',
            fontWeight: 600,
            color: '#111',
            marginTop: '20px',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease',
            gap: '17px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#000'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
      >
        {isAppleLoading ? (
          <svg className="animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="#111" strokeWidth="4" opacity=".2"/>
            <path d="M22 12a10 10 0 0 1-10 10" stroke="#111" strokeWidth="4"/>
          </svg>
        ) : (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="#000">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
        )}
        {isAppleLoading ? "Signing in..." : "Continue with Apple"}
      </button>
      </div>
    </div>
  );
} 