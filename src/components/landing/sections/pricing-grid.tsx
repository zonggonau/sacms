"use client"

import { useState } from "react"
import { Check, Server, Zap, Sparkles, Layers, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useLanguage } from "@/lib/i18n/context"

interface PricingGridProps {
  plans?: any[]
  label?: string
  title?: string
  bgClass?: string
}

export function PricingGrid({ 
  plans = [], 
  title, 
  label, 
  bgClass = "bg-card" 
}: PricingGridProps) {
  const { dict, locale } = useLanguage()
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'cloud' | 'business_vps' | 'gov_vds'>('all')

  if (!plans || plans.length === 0) return null

  const sectionLabel = label || dict.pricing.badge
  const sectionTitle = title || dict.pricing.title
  const sectionSubtitle = dict.pricing.subtitle

  // Helper to normalize plan slug/id
  const getPlanSlug = (plan: any) => {
    return (plan.plan_slug || plan.id || plan.name || "").toLowerCase()
  }

  // Check if this pricing collection has VPS/VDS plans
  const hasInfraPlans = plans.some((p: any) => {
    const slug = getPlanSlug(p)
    return slug.includes('vps') || slug.includes('vds')
  })

  // Filter plans based on category
  const filteredPlans = plans.filter((plan: any) => {
    if (!hasInfraPlans || selectedCategory === 'all') return true
    const slug = getPlanSlug(plan)
    const isVps = slug.includes('vps')
    const isVds = slug.includes('vds')
    const isCloud = !isVps && !isVds

    if (selectedCategory === 'cloud') return isCloud
    if (selectedCategory === 'business_vps') return isVps
    if (selectedCategory === 'gov_vds') return isVds
    return true
  })

  const parseFeatures = (val: any): string[] => {
    if (Array.isArray(val)) return val
    if (typeof val === 'string' && val.trim().length > 0) {
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          const parsed = JSON.parse(val)
          if (Array.isArray(parsed)) return parsed
        } catch (e) {}
      }
      return val.split(',').map(s => s.trim())
    }
    return []
  }

  const formatRupiah = (val: any) => {
    const num = typeof val === 'number' ? val : parseInt(String(val).replace(/[^\d]/g, ''), 10) || 0
    return `Rp ${num.toLocaleString('id-ID')}`
  }

  return (
    <section id="pricing" className={`py-24 sm:py-32 relative ${bgClass} border-t border-border/50 scroll-mt-24 overflow-hidden`}>
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl h-[600px] opacity-25 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-blue-500/10 to-amber-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="container px-4 sm:px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12 sm:mb-16 space-y-4">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            {sectionLabel}
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight max-w-3xl mx-auto">
            {sectionTitle}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto font-medium">
            {sectionSubtitle}
          </p>

          {/* Category Tabs Switcher */}
          {hasInfraPlans && (
            <div className="pt-4 flex justify-center">
              <div className="inline-flex flex-wrap items-center justify-center p-1.5 bg-card/80 border border-border rounded-2xl shadow-sm backdrop-blur-md gap-1 max-w-full">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedCategory === 'all'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" /> {dict.pricing.tabs.all} ({plans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('cloud')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedCategory === 'cloud'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" /> {dict.pricing.tabs.cloud}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('business_vps')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedCategory === 'business_vps'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Server className="h-3.5 w-3.5 text-primary" /> {dict.pricing.tabs.businessVps}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('gov_vds')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedCategory === 'gov_vds'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5 text-amber-500" /> {dict.pricing.tabs.govVds}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pricing Cards Grid */}
        <div className={`grid gap-6 sm:gap-8 items-stretch ${
          filteredPlans.length === 1 
            ? 'max-w-md mx-auto grid-cols-1' 
            : filteredPlans.length === 2 
            ? 'max-w-4xl mx-auto grid-cols-1 md:grid-cols-2' 
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {filteredPlans.map((plan: any, i: number) => {
            const slug = getPlanSlug(plan)
            const isVps = slug.includes('vps')
            const isVds = slug.includes('vds')
            const isPopular = plan.is_popular === true || plan.popular === true || plan.isPopular === true || slug === 'pro' || slug === 'vds-s'
            const features = parseFeatures(plan.features)
            const price = typeof plan.price === 'number' ? plan.price : parseInt(String(plan.price || 0).replace(/[^\d]/g, ''), 10) || 0
            const yearlyPrice = plan.yearly_price !== undefined 
              ? (typeof plan.yearly_price === 'number' ? plan.yearly_price : parseInt(String(plan.yearly_price).replace(/[^\d]/g, ''), 10) || price * 10)
              : price * 10

            return (
              <div
                key={plan.id || slug || i}
                className={`group relative flex flex-col p-6 sm:p-8 rounded-3xl transition-all duration-300 hover:-translate-y-1.5 backdrop-blur-xl border ${
                  isCurrentHighlight(isPopular, isVds, isVps)
                }`}
              >
                {/* Glow Overlay */}
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-br from-primary/5 to-transparent" />

                {/* Badges */}
                {isVds ? (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
                    <Zap className="h-3 w-3" /> {dict.pricing.badges.dedicatedVds}
                  </div>
                ) : isVps ? (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-blue-600 text-white text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
                    <Server className="h-3 w-3" /> {dict.pricing.badges.dedicatedVps}
                  </div>
                ) : isPopular ? (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-blue-500 text-primary-foreground text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> {dict.pricing.badges.popular}
                  </div>
                ) : null}

                <div className="relative z-10 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-black text-foreground mb-1.5 tracking-tight">{plan.name}</h3>
                    {plan.description && (
                      <div 
                        className="text-xs text-muted-foreground mb-6 min-h-[36px] font-medium leading-relaxed" 
                        dangerouslySetInnerHTML={{ __html: plan.description }} 
                      />
                    )}

                    {/* Price Block */}
                    <div className="mb-6 pb-6 border-b border-border/60">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                          {yearlyPrice > 0 ? formatRupiah(yearlyPrice) : dict.pricing.period.freeForever}
                        </span>
                        {yearlyPrice > 0 && (
                          <span className="text-xs text-muted-foreground font-semibold">{dict.pricing.period.yearly}</span>
                        )}
                      </div>
                      {price > 0 && (
                        <div className="text-[11px] font-semibold text-muted-foreground mt-1 text-primary/90 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                          {dict.pricing.period.monthlyEquivalent} {formatRupiah(price)}/bln {dict.pricing.period.yearlyBilling}
                        </div>
                      )}
                    </div>

                    {/* Features List */}
                    <ul className="space-y-2.5 mb-8">
                      {features.map((feat: string, j: number) => (
                        <li key={j} className="flex items-start gap-2.5">
                          <div className="mt-0.5 bg-primary/10 p-0.5 rounded-full shrink-0">
                            <Check className="w-3.5 h-3.5 text-primary" strokeWidth={3} />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                            {feat}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA Button */}
                  <Link href={`/register?plan=${slug}`} className="mt-auto block">
                    <Button
                      className={`w-full h-11 rounded-2xl font-bold text-xs transition-all duration-300 shadow-sm ${
                        isPopular || isVds || isVps
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01]"
                          : "bg-muted hover:bg-muted/80 text-foreground hover:text-primary hover:scale-[1.01]"
                      }`}
                    >
                      {plan.cta_text || plan.cta || (price === 0 ? dict.pricing.cta.free : dict.pricing.cta.paid)}
                    </Button>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function isCurrentHighlight(isPopular: boolean, isVds: boolean, isVps: boolean): string {
  if (isVds) return "bg-card/80 border-amber-500/40 shadow-xl shadow-amber-500/5 hover:border-amber-500"
  if (isVps) return "bg-card/80 border-primary/40 shadow-xl shadow-primary/5 hover:border-primary"
  if (isPopular) return "bg-card/80 border-primary/50 shadow-xl shadow-primary/10 scale-[1.02] z-10 hover:border-primary"
  return "bg-card/40 border-border/70 hover:border-primary/40 shadow-md hover:shadow-lg"
}
