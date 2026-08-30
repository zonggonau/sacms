"use client"

import React, { createContext, useContext } from "react"
import { DICTIONARY, Locale } from "./dictionaries"

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  dict: typeof DICTIONARY["id"]
  t: (path: string, fallback?: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  locale: "id",
  setLocale: () => {},
  dict: DICTIONARY["id"],
  t: (path: string, fallback?: string) => fallback || path,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale: Locale = "id"
  const setLocale = () => {}

  const dict = DICTIONARY["id"]

  // Helper to access nested keys like "hero.title" or "nav.pricing"
  const t = (path: string, fallback?: string): string => {
    const keys = path.split(".")
    let current: any = dict
    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key]
      } else {
        return fallback || path
      }
    }
    return typeof current === "string" ? current : fallback || path
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, dict, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
