"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { gradientFor } from "@/lib/website-preview"
import { getIcon } from "@/components/landing/icon-map"
import {
  ArrowRight,
  Sparkles,
  Plug,
  Circle,
  CheckCircle2,
  Loader2,
} from "lucide-react"

/** Design preview only — see /landingbaru. The hero's typewriter/API-call
 *  animation is purely cosmetic (no real content), so it's split into its
 *  own client component; the page itself stays a server component so the
 *  real sections below it can fetch real getLandingData(). */

const TAGLINES = ["Build smarter.", "Manage easier.", "Scale faster."]

function useTypewriter(phrases: string[]) {
  const [index, setIndex] = useState(0)
  const [text, setText] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = phrases[index]
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
  }, [text, deleting, index, phrases])

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

const SAMPLE_TEMPLATES = [
  { name: "Portal Berita", category: "Media & Publishing", icon: "Newspaper" },
  { name: "Company Profile", category: "Korporat", icon: "Building2" },
  { name: "Toko Online", category: "E-Commerce", icon: "ShoppingBag" },
  { name: "Restoran & Kafe", category: "F&B", icon: "Coffee" },
  { name: "Blog Personal", category: "Konten", icon: "PenLine" },
  { name: "Landing Page SaaS", category: "Startup", icon: "Rocket" },
  { name: "Portofolio Kreatif", category: "Personal", icon: "Palette" },
  { name: "Sekolah & Kampus", category: "Pendidikan", icon: "GraduationCap" },
  { name: "Klinik & Kesehatan", category: "Kesehatan", icon: "HeartPulse" },
] as const

export function HeroPreviewClient() {
  const typed = useTypewriter(TAGLINES)
  const { phase, typedQuery, typedResponse } = useApiDemo()

  const statusText =
    phase === "query" ? "Mengetik query..." :
    phase === "sending" ? "Mengirim request lewat MCP..." :
    phase === "response" ? "Menerima respons..." :
    "Respons diterima"

  return (
    <>
      {/* ===================== HERO ===================== */}
      <section className="relative min-h-screen flex items-center overflow-hidden border-b border-border/50">
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container relative z-10 px-6 sm:px-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-24">
          {/* ---- LEFT: typewriter headline ---- */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold tracking-wide">
              <Sparkles className="h-3.5 w-3.5" />
              <span>SaCMS — Smart Content Management System</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] min-h-[3.3em] sm:min-h-[2.4em]">
              {typed}
              <span className="inline-block w-[3px] h-[0.9em] bg-primary ml-1 align-middle animate-pulse" />
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground font-medium max-w-lg leading-relaxed">
              Satu platform Headless CMS multi-tenant untuk membangun, mengelola, dan menskalakan website &amp; produk digital klien Anda — lengkap dengan integrasi AI IDE lewat MCP.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild className="h-12 px-7 rounded-full font-bold text-sm gap-2">
                <Link href="/register">
                  Mulai Gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 px-7 rounded-full font-bold text-sm border-border/80">
                <Link href="#templates">Lihat Template</Link>
              </Button>
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

      {/* ===================== TEMPLATE GALLERY (9 cards) ===================== */}
      <section id="templates" className="py-20 sm:py-28 relative">
        <div className="container px-6 sm:px-10 max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="outline" className="px-3.5 py-1 text-xs font-bold border-primary/30 bg-primary/10 text-primary">
              Galeri Template
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Mulai dari Template Siap Pakai</h2>
            <p className="text-sm sm:text-base text-muted-foreground font-medium">
              Contoh tata letak kartu template — pratinjau desain, belum terhubung ke data template sungguhan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SAMPLE_TEMPLATES.map((t) => {
              const Icon = getIcon(t.icon)
              return (
                <div
                  key={t.name}
                  className="group relative border border-border/60 bg-card/60 overflow-hidden hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
                >
                  <div className={`aspect-[16/10] relative bg-gradient-to-br ${gradientFor(t.name)} flex items-center justify-center`}>
                    <Icon className="h-10 w-10 text-foreground/40" />
                  </div>
                  <div className="p-5 space-y-1">
                    <Badge variant="outline" className="text-[10px] font-bold mb-1">{t.category}</Badge>
                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{t.name}</h3>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
