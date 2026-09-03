"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { DICTIONARY, Locale, LOCALES, DEFAULT_LOCALE, isLocale } from "./dictionaries"

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  dict: (typeof DICTIONARY)["id"]
  /** Access a nested key by path, e.g. t("hero.title"). Falls back to the path (or the given fallback) when missing. */
  t: (path: string, fallback?: string) => string
  /** Substitute {placeholders} in a string, e.g. fmt(dict.members.subtitle, { count: 3 }). */
  fmt: (template: string, vars: Record<string, string | number>) => string
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}

const LOCALE_COOKIE = "locale"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/)
  const value = match?.[1]
  return value && isLocale(value) ? value : null
}

function writeLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

const LanguageContext = createContext<LanguageContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  dict: DICTIONARY[DEFAULT_LOCALE],
  t: (path: string, fallback?: string) => fallback || path,
  fmt: interpolate,
})

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  /** SSR-provided locale (from the request cookie) so the first paint matches. */
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE)

  // On mount, reconcile with the cookie in case SSR didn't pass one.
  useEffect(() => {
    if (initialLocale) return
    const fromCookie = readLocaleCookie()
    if (fromCookie) setLocaleState((prev) => (fromCookie !== prev ? fromCookie : prev))
  }, [initialLocale])

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return
    setLocaleState(next)
    writeLocaleCookie(next)
    if (typeof document !== "undefined") {
      document.documentElement.lang = next
    }
  }, [])

  const dict = DICTIONARY[locale] ?? DICTIONARY[DEFAULT_LOCALE]

  const t = useCallback(
    (path: string, fallback?: string): string => {
      const keys = path.split(".")
      let current: unknown = dict
      for (const key of keys) {
        if (current && typeof current === "object" && key in current) {
          current = (current as Record<string, unknown>)[key]
        } else {
          return fallback ?? path
        }
      }
      return typeof current === "string" ? current : fallback ?? path
    },
    [dict],
  )

  const value = useMemo<LanguageContextType>(
    () => ({ locale, setLocale, dict, t, fmt: interpolate }),
    [locale, setLocale, dict, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}

/** Preferred name going forward; `useLanguage` stays as an alias for existing call sites. */
export const useI18n = useLanguage

export { LOCALE_COOKIE, LOCALES, DEFAULT_LOCALE }
export type { Locale }
