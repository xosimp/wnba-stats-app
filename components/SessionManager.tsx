"use client";
import { useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useSessionTimeout } from '../hooks/useSessionTimeout';

export function SessionManager() {
  const { session, status } = useSessionTimeout();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCheckRef = useRef<NodeJS.Timeout | null>(null);
  const hasUnloaded = useRef(false);

  useEffect(() => {
    // Only run on client side and when session is loaded
    if (typeof window === 'undefined' || status === 'loading' || !session) {
      return;
    }

    // Strategy 1: Heartbeat system to keep session alive
    const startHeartbeat = () => {
      heartbeatRef.current = setInterval(() => {
        // Send a heartbeat to keep session alive while tab is open
        fetch('/api/auth/heartbeat', { 
          method: 'POST',
          credentials: 'include'
        }).catch(() => {
          // Don't sign out on heartbeat failure - just log it
          console.log('Heartbeat failed, but not signing out');
        });
      }, 30000); // Every 30 seconds
    };

    // Strategy 2: Periodic session validation
    const startSessionCheck = () => {
      sessionCheckRef.current = setInterval(() => {
        // Check if session is still valid on server
        fetch('/api/auth/validate-session', {
          method: 'GET',
          credentials: 'include'
        }).then(response => {
          if (!response.ok) {
            // Don't sign out on validation failure - just log it
            console.log('Session validation failed, but not signing out');
          }
        }).catch(() => {
          // Don't sign out on network error - just log it
          console.log('Session validation network error, but not signing out');
        });
      }, 60000); // Every minute
    };

    // Strategy 3: Before unload event - this fires when tab/browser is closing
    const handleBeforeUnload = () => {
      hasUnloaded.current = true;
      console.log('Page unloading - tab/browser is closing');
    };

    // Strategy 4: Storage event to detect if session was cleared in another tab
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'next-auth.session-token' && e.newValue === null) {
        signOut({ redirect: false });
      }
    };

    // Strategy 5: Check if page was unloaded and reopened
    const checkForUnload = () => {
      // This is a simple check: if we have a session but the page was unloaded,
      // it means the tab was closed and reopened
      if (hasUnloaded.current) {
        console.log('Page was unloaded and reopened - signing out');
        signOut({ redirect: false });
        return;
      }
    };

    // Reset the unload flag on mount
    hasUnloaded.current = false;

    // Start heartbeat and session check
    startHeartbeat();
    startSessionCheck();

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('storage', handleStorageChange);

    // Check for unload after a short delay
    const checkInterval = setInterval(() => {
      checkForUnload();
    }, 1000); // Check every second

    // Cleanup function
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (sessionCheckRef.current) {
        clearInterval(sessionCheckRef.current);
        sessionCheckRef.current = null;
      }
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [session?.user?.id, status]); // Use session user ID instead of entire session object

  return null; // This component doesn't render anything
} 