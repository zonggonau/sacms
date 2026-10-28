"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { HeroData } from "../types"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard, Shield, Sparkles, Bot, Github, Workflow,
  Rocket, MousePointer2, Wind, Terminal, MessageSquare, Hand,
  FlaskConical, Sprout, Braces, LayoutTemplate
} from "lucide-react"
import { sanitizeHtml } from "@/lib/sanitize-html"

// Every AI IDE/agent SaCMS's MCP server is advertised as working with
// across the marketing site (see src/app/docs/page.tsx's metadata and
// src/app/docs/docs-client.tsx's PLATFORMS setup guides) — no raster brand
// logos are vendored in this repo, so each gets a themed lucide icon
// instead of a real logo image.
const AI_DEV_TOOLS = [
  { icon: Rocket, label: "Antigravity", color: "text-amber-500" },
  { icon: Github, label: "VS Code + Copilot", color: "text-foreground" },
  { icon: MousePointer2, label: "Cursor", color: "text-violet-500" },
  { icon: Wind, label: "Windsurf", color: "text-sky-500" },
  { icon: Sparkles, label: "Claude", color: "text-orange-500" },
  { icon: Terminal, label: "Cline", color: "text-emerald-500" },
  { icon: MessageSquare, label: "ChatGPT", color: "text-green-500" },
  { icon: Hand, label: "Manus", color: "text-rose-500" },
  { icon: FlaskConical, label: "Google AI Studio", color: "text-red-500" },
  { icon: Sprout, label: "Emergent", color: "text-lime-500" },
  { icon: Braces, label: "Qoder", color: "text-indigo-500" },
  { icon: LayoutTemplate, label: "v0.dev", color: "text-muted-foreground" },
  { icon: Workflow, label: "Model Context Protocol", color: "text-blue-500" },
  { icon: Bot, label: "AI Agent Apa Pun", color: "text-primary" },
] as const

function HighlightedHeadline({ text }: { text: string }) {
  const words = (text || "").split(" ")
  const main = words.slice(0, -2).join(" ")
  const accent = words.slice(-2).join(" ")
  return (
    <>
      {main}{" "}
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 drop-shadow-sm">{accent}</span>
    </>
  )
}

export function HeroSection({ data }: { data: HeroData | null }) {
  const { data: session, status } = useSession()

  const defaultTenantSlug = session?.user?.tenants?.[0]?.slug || session?.user?.tenants?.[0]?.id
  const dashboardUrl = defaultTenantSlug ? `/dashboard/${defaultTenantSlug}` : "/dashboard"
  const isAuthenticated = status === "authenticated" && session?.user

  const badgeText = data?.badge_text || ""
  const headlineText = data?.headline || "Build smarter. Manage easier. Scale faster."
  const subheadlineText = data?.subheadline || "Platform Smart Content Management System (SaCMS) modern dengan Dedicated PostgreSQL 17 Appliance, MCP Tools untuk AI IDE, Edge Custom DNS, Dynamic GraphQL, dan Billing Midtrans otomatis."
  const ctaPrimary = data?.cta_primary || "Coba Gratis Sekarang"
  const ctaSecondary = data?.cta_secondary || "Dokumentasi API"

  return (
    <section className="min-h-[80vh] flex items-center justify-center pt-24 pb-16 relative overflow-hidden">
      {/* Abstract Background Blurs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] opacity-40 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent blur-3xl rounded-full mix-blend-screen" />
      </div>

      <div className="container px-6 max-w-5xl mx-auto text-center space-y-8 relative z-10">
        {badgeText && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="inline-flex items-center px-4 py-1.5 bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-widest uppercase rounded-full backdrop-blur-md shadow-sm shadow-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
              {badgeText}
            </span>
          </div>
        )}

        <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] text-foreground animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150 fill-mode-both">
          <HighlightedHeadline text={headlineText} />
        </h1>

        <div 
          className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both [&>p]:mb-0 [&_p]:mb-0"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(subheadlineText) }}
        />

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500 fill-mode-both">
          {isAuthenticated ? (
            <Link href={dashboardUrl}>
              <Button size="lg" className="h-11 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-bold text-sm shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:shadow-primary/40 gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Buka Dashboard
              </Button>
            </Link>
          ) : (
            <Link href={data?.cta_href || "/register"}>
              <Button size="lg" className="h-11 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-bold text-sm shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:shadow-primary/40">
                {ctaPrimary}
              </Button>
            </Link>
          )}
          <Link href="/docs">
            <Button size="lg" variant="outline" className="h-11 px-8 rounded-full border-border/50 bg-background/50 backdrop-blur-md font-bold text-sm hover:bg-muted/50 hover:border-border transition-all hover:scale-105">
              {ctaSecondary}
            </Button>
          </Link>
        </div>

        {/* Frontend dev happens in your own AI IDE/agent via MCP — no
            in-dashboard site builder (see src/lib/mcp — removed 2026-10-20).
            This row used to advertise backend infra (DB/DNS/billing); it now
            leads with what actually differentiates frontend development on
            SaCMS: bring your own AI coding agent. Runs as an infinite
            marquee (duplicated once for a seamless loop) since there are
            more tools than comfortably fit a static row. */}
        <div className="pt-8 border-t border-border/40 space-y-4 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-700 fill-mode-both">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Kembangkan Frontend dengan AI Agent &amp; IDE Favorit Anda
          </p>
          <div className="relative w-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <div className="flex w-max gap-4 animate-marquee">
              {[...AI_DEV_TOOLS, ...AI_DEV_TOOLS].map((tool, i) => (
                <div
                  key={`${tool.label}-${i}`}
                  className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-card/40 border border-border/50 text-sm font-bold text-foreground backdrop-blur-sm shrink-0"
                >
                  <tool.icon className={`w-6 h-6 shrink-0 ${tool.color}`} />
                  <span className="whitespace-nowrap">{tool.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
