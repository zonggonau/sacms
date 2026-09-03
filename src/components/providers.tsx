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

import { LanguageProvider } from "@/lib/i18n/context"
import type { Locale } from "@/lib/i18n/dictionaries"

export function Providers({
  children,
  session,
  locale,
}: {
  children: React.ReactNode
  session?: any
  locale?: Locale
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NextAuthSessionProvider session={session ?? null} refetchOnWindowFocus={false}>
        <LanguageProvider initialLocale={locale}>
          {children}
        </LanguageProvider>
      </NextAuthSessionProvider>
    </ThemeProvider>
  )
}
