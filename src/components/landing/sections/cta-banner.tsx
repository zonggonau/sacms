"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { CtaData } from "../types"
import { useSession } from "next-auth/react"
import { LayoutDashboard } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"

export function CtaBanner({ cta }: { cta: CtaData | null }) {
  const { data: session, status } = useSession()
  const { dict, locale } = useLanguage()

  const defaultTenantSlug = session?.user?.tenants?.[0]?.slug || session?.user?.tenants?.[0]?.id
  const dashboardUrl = defaultTenantSlug ? `/dashboard/${defaultTenantSlug}` : "/dashboard"
  const isAuthenticated = status === "authenticated" && session?.user

  const title = locale === "en" ? dict.cta.title : (cta?.title || dict.cta.title)
  const description = locale === "en" ? dict.cta.description : (cta?.description || dict.cta.description)
  const buttonPrimary = locale === "en" ? dict.cta.buttonPrimary : (cta?.button_primary_text || dict.cta.buttonPrimary)
  const buttonSecondary = locale === "en" ? dict.cta.buttonSecondary : (cta?.button_secondary_text || dict.cta.buttonSecondary)

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden bg-background">
      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="relative rounded-[2.5rem] overflow-hidden bg-primary px-6 py-12 sm:px-12 sm:py-20 text-center shadow-2xl shadow-primary/20">
          {/* Intense Gradient Background inside the banner */}
          <div className="absolute inset-0 opacity-80 pointer-events-none">
            <div className="absolute -top-[50%] -left-[10%] w-[120%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/20 via-primary to-blue-900/80 blur-2xl" />
          </div>
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/30 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2 pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
              {title}
            </h2>
            <div 
              className="text-sm sm:text-base md:text-lg text-primary-foreground/90 font-medium mb-8 leading-relaxed max-w-2xl mx-auto [&>p]:mb-0 [&_p]:mb-0"
              dangerouslySetInnerHTML={{ __html: description }}
            />
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              {isAuthenticated ? (
                <Link href={dashboardUrl}>
                  <Button size="lg" className="w-full sm:w-auto h-11 px-8 bg-white text-primary hover:bg-white/90 rounded-full font-bold text-sm shadow-xl shadow-black/10 transition-all hover:scale-105 gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    {dict.nav.dashboard}
                  </Button>
                </Link>
              ) : (
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto h-11 px-8 bg-white text-primary hover:bg-white/90 rounded-full font-bold text-sm shadow-xl shadow-black/10 transition-all hover:scale-105">
                    {buttonPrimary}
                  </Button>
                </Link>
              )}
              <Link href="/docs">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-11 px-8 rounded-full border-white/30 text-white bg-white/10 backdrop-blur-md hover:bg-white/20 hover:border-white/50 font-bold text-sm transition-all hover:scale-105">
                  {buttonSecondary}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
