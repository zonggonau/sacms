"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import type { HeroData } from "../types"
import { useSession } from "next-auth/react"
import { LayoutDashboard, ArrowRight, Plug, Circle, CheckCircle2, Loader2 } from "lucide-react"
import { sanitizeHtml } from "@/lib/sanitize-html"

/** Splits the admin's own headline into sentences to drive the typewriter
 *  below ("Build smarter. Manage easier. Scale faster." -> 3 phrases) —
 *  so the animation stays tied to real, editable content instead of a
 *  hardcoded phrase list. A headline with no ". " at all just types once. */
function splitIntoPhrases(headline: string): string[] {
  const parts = headline
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts : [headline]
}

function useTypewriter(phrases: string[]) {
  const [index, setIndex] = useState(0)
  const [text, setText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const phrasesKey = phrases.join("|")

  useEffect(() => {
    setIndex(0)
    setText("")
    setDeleting(false)
  }, [phrasesKey])

  useEffect(() => {
    const current = phrases[index] || ""
    let timeout: ReturnType<typeof setTimeout>

    if (!deleting) {
      if (text.length < current.length) {
        timeout = setTimeout(() => setText(current.slice(0, text.length + 1)), 65)
      } else {
        timeout = setTimeout(() => setDeleting(true), 1700)
      }
    } else {
      if (text.length > 0) {
        timeout = setTimeout(() => setText(current.slice(0, text.length - 1)), 32)
      } else {
        setDeleting(false)
        setIndex((i) => (i + 1) % phrases.length)
      }
    }
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, deleting, index])

  return text
}

const QUERY_TEXT = `query {
  posts(limit: 3) {
    title
    status
  }
}`

const RESPONSE_TEXT = `{
  "data": {
    "posts": [
      { "title": "Peluncuran SaCMS v2", "status": "published" },
      { "title": "Panduan MCP untuk AI IDE", "status": "published" },
      { "title": "Dedicated Database Appliance", "status": "draft" }
    ]
  }
}`

type ApiPhase = "query" | "sending" | "response" | "hold"

function useApiDemo() {
  const [phase, setPhase] = useState<ApiPhase>("query")
  const [typedQuery, setTypedQuery] = useState("")
  const [typedResponse, setTypedResponse] = useState("")

  useEffect(() => {
    let cancelled = false
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

    async function run() {
      while (!cancelled) {
        setPhase("query")
        setTypedQuery("")
        setTypedResponse("")
        for (let i = 1; i <= QUERY_TEXT.length; i++) {
          if (cancelled) return
          setTypedQuery(QUERY_TEXT.slice(0, i))
          await sleep(13)
        }
        await sleep(450)
        if (cancelled) return
        setPhase("sending")
        await sleep(1100)
        if (cancelled) return
        setPhase("response")
        for (let i = 1; i <= RESPONSE_TEXT.length; i++) {
          if (cancelled) return
          setTypedResponse(RESPONSE_TEXT.slice(0, i))
          await sleep(6)
        }
        if (cancelled) return
        setPhase("hold")
        await sleep(2600)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  return { phase, typedQuery, typedResponse }
}

/** Crude line-level syntax coloring — good enough for a short, known query
 *  and JSON response, no real parser needed. */
function colorizeLine(line: string) {
  if (/^\s*(query|mutation)\b/.test(line)) {
    return <span className="text-sky-400">{line}</span>
  }
  const keyMatch = line.match(/^(\s*)"?([a-zA-Z_][\w]*)"?(\s*:?\s*)(.*)$/)
  if (keyMatch) {
    const [, indent, key, sep, rest] = keyMatch
    return (
      <>
        {indent}
        <span className="text-violet-400">{key}</span>
        <span className="text-muted-foreground/70">{sep}</span>
        <span className="text-emerald-400">{rest}</span>
      </>
    )
  }
  return <span className="text-foreground/80">{line}</span>
}

export function HeroSection({ data }: { data: HeroData | null }) {
  const { data: session, status } = useSession()

  const defaultTenantSlug = session?.user?.tenants?.[0]?.slug || session?.user?.tenants?.[0]?.id
  const dashboardUrl = defaultTenantSlug ? `/dashboard/${defaultTenantSlug}` : "/dashboard"
  const isAuthenticated = status === "authenticated" && session?.user

  const badgeText = data?.badge_text || "SaCMS — Smart Content Management System"
  const headlineText = data?.headline || "Build smarter. Manage easier. Scale faster."
  const subheadlineText = data?.subheadline || "Platform Smart Content Management System (SaCMS) modern dengan Dedicated PostgreSQL 17 Appliance, MCP Tools untuk AI IDE, Edge Custom DNS, Dynamic GraphQL, dan Billing Midtrans otomatis."
  const ctaPrimary = data?.cta_primary || "Coba Gratis Sekarang"
  const ctaSecondary = data?.cta_secondary || "Dokumentasi API"

  const phrases = splitIntoPhrases(headlineText)
  const typed = useTypewriter(phrases)
  const { phase, typedQuery, typedResponse } = useApiDemo()

  const statusText =
    phase === "query" ? "Mengetik query..." :
    phase === "sending" ? "Mengirim request lewat MCP..." :
    phase === "response" ? "Menerima respons..." :
    "Respons diterima"

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden border-b border-border/50">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container relative z-10 px-6 sm:px-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-24 pt-32">
        {/* ---- LEFT: typewriter headline ---- */}
        <div className="space-y-6">
          {badgeText && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>{badgeText}</span>
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] min-h-[3.3em] sm:min-h-[2.4em]">
            {typed}
            <span className="inline-block w-[3px] h-[0.9em] bg-primary ml-1 align-middle animate-pulse" />
          </h1>

          <div
            className="text-base sm:text-lg text-muted-foreground font-medium max-w-lg leading-relaxed [&>p]:mb-0 [&_p]:mb-0"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(subheadlineText) }}
          />

          <div className="flex flex-wrap gap-3 pt-2">
            {isAuthenticated ? (
              <Link href={dashboardUrl}>
                <Button className="h-12 px-7 rounded-full font-bold text-sm gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Buka Dashboard
                </Button>
              </Link>
            ) : (
              <Link href={data?.cta_href || "/register"}>
                <Button className="h-12 px-7 rounded-full font-bold text-sm gap-2">
                  {ctaPrimary}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href="/docs">
              <Button variant="outline" className="h-12 px-7 rounded-full font-bold text-sm border-border/80">
                {ctaSecondary}
              </Button>
            </Link>
          </div>
        </div>

        {/* ---- RIGHT: live GraphQL/MCP request animation ---- */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 to-blue-500/10 rounded-[2rem] blur-2xl pointer-events-none" />
          <div className="relative rounded-2xl border border-border/70 bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Terminal top bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/40">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Plug className="h-3 w-3" />
                <span>MCP → GraphQL</span>
              </div>
            </div>

            {/* Query block */}
            <div className="px-5 py-4 font-mono text-[12.5px] sm:text-[13px] leading-relaxed min-h-[128px]">
              {typedQuery.split("\n").map((line, i) => (
                <div key={i}>{colorizeLine(line) || " "}</div>
              ))}
              {phase === "query" && <span className="inline-block w-[2px] h-[1em] bg-primary align-middle animate-pulse ml-0.5" />}
            </div>

            {/* Status strip */}
            <div className="flex items-center gap-2 px-5 py-2.5 border-t border-border/60 bg-muted/30 text-xs font-semibold">
              {phase === "sending" ? (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              ) : phase === "hold" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/50 fill-current animate-pulse" />
              )}
              <span className="text-muted-foreground">{statusText}</span>
              {phase === "hold" && (
                <Badge variant="outline" className="ml-auto text-[10px] font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  200 OK · 42ms
                </Badge>
              )}
            </div>

            {/* Response block */}
            {(phase === "response" || phase === "hold") && (
              <div className="px-5 py-4 font-mono text-[12px] sm:text-[12.5px] leading-relaxed border-t border-border/60 bg-background/60 min-h-[140px]">
                {typedResponse.split("\n").map((line, i) => (
                  <div key={i}>{colorizeLine(line) || " "}</div>
                ))}
                {phase === "response" && <span className="inline-block w-[2px] h-[1em] bg-primary align-middle animate-pulse ml-0.5" />}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
