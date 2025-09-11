"use client";

import { useEffect } from 'react';
import { SessionProvider } from "next-auth/react";
import { SessionManager } from "../components/SessionManager";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionManager />
      {children}
    </SessionProvider>
  );
} 