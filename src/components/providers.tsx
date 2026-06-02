"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ThemeProvider } from "next-themes"



export function Providers({ 
  children,
  session 
}: { 
  children: React.ReactNode
  session?: any 
}) {
  // Suppress the React 19 + next-themes hydration warning in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const originalError = console.error;
      console.error = (...args: any[]) => {
        if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag while rendering React component')) {
          return;
        }
        originalError.call(console, ...args);
      };
      
      return () => {
        console.error = originalError;
      }
    }
  }, []);
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NextAuthSessionProvider session={session}>
        {children}
      </NextAuthSessionProvider>
    </ThemeProvider>
  )
}
