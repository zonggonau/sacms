"use client"

import { Check, Sparkles, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { sanitizeHtml } from "@/lib/sanitize-html"

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
  if (!plans || plans.length === 0) return null

  const sectionLabel = label || "Paket Workspace"
  const sectionTitle = title || "Pilihan Paket Fleksibel & Transparan"
  const sectionSubtitle = "Mulai dari Cloud Ekonomis untuk UMKM hingga paket Business untuk perusahaan — semuanya dikelola penuh oleh SaCMS, tanpa server terpisah untuk diurus."

  const getPlanSlug = (plan: any) => {
    return (plan.plan_slug || plan.id || plan.name || "").toLowerCase()
  }

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
        </div>

        {/* Pricing Cards Grid */}
        <div className={`grid gap-6 sm:gap-8 items-stretch ${
          plans.length === 1
            ? 'max-w-md mx-auto grid-cols-1'
            : plans.length === 2
            ? 'max-w-4xl mx-auto grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {plans.map((plan: any, i: number) => {
            const slug = getPlanSlug(plan)
            const isPopular = plan.is_popular === true || plan.popular === true || plan.isPopular === true || slug === 'pro'
            const features = parseFeatures(plan.features)
            const price = typeof plan.price === 'number' ? plan.price : parseInt(String(plan.price || 0).replace(/[^\d]/g, ''), 10) || 0
            const yearlyPrice = plan.yearly_price !== undefined
              ? (typeof plan.yearly_price === 'number' ? plan.yearly_price : parseInt(String(plan.yearly_price).replace(/[^\d]/g, ''), 10) || price * 10)
              : price * 10

            return (
              <div
                key={plan.id || slug || i}
                className={`group relative flex flex-col p-6 sm:p-8 rounded-3xl transition-all duration-300 hover:-translate-y-1.5 backdrop-blur-xl border ${
                  isPopular
                    ? "bg-card/80 border-primary/50 shadow-xl shadow-primary/10 scale-100 sm:scale-[1.02] z-10 hover:border-primary"
                    : "bg-card/40 border-border/70 hover:border-primary/40 shadow-md hover:shadow-lg"
                }`}
              >
                {/* Glow Overlay */}
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-br from-primary/5 to-transparent" />

                {/* Badge */}
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-blue-500 text-primary-foreground text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Paling Populer
                  </div>
                )}

                <div className="relative z-10 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-black text-foreground mb-1.5 tracking-tight">{plan.name}</h3>
                    {plan.description && (
                      <div
                        className="text-xs text-muted-foreground mb-6 min-h-[36px] font-medium leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(plan.description) }}
                      />
                    )}

                    {/* Price Block */}
                    <div className="mb-6 pb-6 border-b border-border/60">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                          {yearlyPrice > 0 ? formatRupiah(yearlyPrice) : "Gratis"}
                        </span>
                        {yearlyPrice > 0 && (
                          <span className="text-xs text-muted-foreground font-semibold">/tahun</span>
                        )}
                      </div>
                      {price > 0 && (
                        <div className="text-[11px] font-semibold text-muted-foreground mt-1 text-primary/90 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                          Setara {formatRupiah(price)}/bln (Tagihan Tahunan)
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
                        isPopular
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01]"
                          : "bg-muted hover:bg-muted/80 text-foreground hover:text-primary hover:scale-[1.01]"
                      }`}
                    >
                      {plan.cta_text || plan.cta || (price === 0 ? "Mulai Gratis" : "Langganan Sekarang")}
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
