"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { HeroData } from "../types"
import { useSession } from "next-auth/react"
import { LayoutDashboard, Database, Shield, Zap, CreditCard, Sparkles } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"

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
  const { dict, locale } = useLanguage()

  const defaultTenantSlug = session?.user?.tenants?.[0]?.slug || session?.user?.tenants?.[0]?.id
  const dashboardUrl = defaultTenantSlug ? `/dashboard/${defaultTenantSlug}` : "/dashboard"
  const isAuthenticated = status === "authenticated" && session?.user

  const badgeText = data?.badge_text || ""
  const headlineText = data?.headline || dict.hero.title
  const subheadlineText = data?.subheadline || dict.hero.subtitle
  const ctaPrimary = data?.cta_primary || dict.hero.ctaPrimary
  const ctaSecondary = data?.cta_secondary || dict.hero.ctaSecondary

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
          dangerouslySetInnerHTML={{ __html: subheadlineText }}
        />

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500 fill-mode-both">
          {isAuthenticated ? (
            <Link href={dashboardUrl}>
              <Button size="lg" className="h-11 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-bold text-sm shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:shadow-primary/40 gap-2">
                <LayoutDashboard className="w-4 h-4" />
                {dict.nav.dashboard}
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

        {/* Tech Trust Badges / Quick Highlights */}
        <div className="pt-8 border-t border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-12 duration-700 delay-700 fill-mode-both">
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-2xl bg-card/40 border border-border/50 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
            <Database className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">PostgreSQL 17 Appliance</span>
          </div>
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-2xl bg-card/40 border border-border/50 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">Vercel Custom DNS</span>
          </div>
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-2xl bg-card/40 border border-border/50 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">AI Schema Generator</span>
          </div>
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-2xl bg-card/40 border border-border/50 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
            <CreditCard className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Midtrans QRIS Billing</span>
          </div>
        </div>
      </div>
    </section>
  )
}
