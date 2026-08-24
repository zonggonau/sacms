"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
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

const STORAGE_KEY = "sacms_lang"

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("id")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
      if (stored === "id" || stored === "en") {
        setLocaleState(stored)
      } else {
        // Check browser language
        const browserLang = navigator.language.toLowerCase()
        if (browserLang.startsWith("en")) {
          setLocaleState("en")
        }
      }
    } catch {
      // localStorage may be unavailable in some private browsing modes
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
      document.cookie = `${STORAGE_KEY}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`
    } catch {}
  }

  const dict = DICTIONARY[locale] || DICTIONARY["id"]

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
