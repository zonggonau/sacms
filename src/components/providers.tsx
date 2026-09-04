"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ThemeProvider } from "next-themes"



if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag while rendering React component')) {
      return;
    }
    originalError.call(console, ...args);
  };
}

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode
  session?: any
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NextAuthSessionProvider session={session ?? null} refetchOnWindowFocus={false}>
        {children}
      </NextAuthSessionProvider>
    </ThemeProvider>
  )
}
