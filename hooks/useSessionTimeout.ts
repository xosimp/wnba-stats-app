import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';

export function useSessionTimeout() {
  const { data: session, status } = useSession();

  useEffect(() => {
    // Only run when session is loaded and user is authenticated
    if (status === 'loading' || !session) {
      return;
    }

    // This hook now just provides session data
    // Session management is handled by SessionManager component

    // Cleanup function
    return () => {
      // No cleanup needed
    };
  }, [session?.user?.id, status]); // Use session user ID instead of entire session object

  return { session, status };
} 