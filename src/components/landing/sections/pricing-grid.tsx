import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { PricingPlan } from "../types"

interface PricingGridProps {
  plans: PricingPlan[]
  label: string
  title: string
  bgClass?: string
}

export function PricingGrid({ plans = [], title, label, bgClass = "bg-card" }: { plans?: PricingPlan[], title?: string, label?: string, bgClass?: string }) {
  if (!plans || plans.length === 0) return null

  return (
    <section id="pricing" className={`py-32 relative ${bgClass} border-t border-border/50 scroll-mt-24 overflow-hidden`}>
      {/* Background Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[600px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-blue-500/20 blur-[100px] rounded-full" />
      </div>

      <div className="container px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            {label}
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6 tracking-tight">
            {title}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
            Investasi cerdas untuk pertumbuhan bisnis Anda. Tanpa biaya tersembunyi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center max-w-5xl mx-auto w-full">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`group relative flex flex-col p-8 sm:p-10 rounded-[2rem] transition-all duration-500 hover:-translate-y-2 backdrop-blur-xl ${
                plan.isPopular
                  ? "bg-card/80 border-primary/50 shadow-2xl shadow-primary/20 scale-105 z-10"
                  : "bg-card/40 border-border/50 hover:border-primary/30 shadow-lg hover:shadow-xl"
              } border`}
            >
              {/* Card Glow */}
              <div className={`absolute inset-0 rounded-[2rem] transition-opacity duration-500 pointer-events-none ${plan.isPopular ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-[2rem]" />
              </div>

              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-blue-500 text-primary-foreground text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-primary/30">
                  Paling Populer
                </div>
              )}
              
              <div className="relative z-10 flex-1 flex flex-col">
                <h3 className="text-xl font-black text-foreground mb-2">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mb-6 min-h-[40px] font-medium leading-relaxed">{plan.description}</p>
                
                <div className="mb-6 pb-6 border-b border-border/50">
                  <div className="flex items-baseline">
                    <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Rp{plan.price.toLocaleString("id-ID")}</span>
                    <span className="text-xs text-muted-foreground font-semibold ml-1">/{plan.period || plan.interval}</span>
                  </div>
                  {!!plan.yearly_price && plan.yearly_price > 0 && (
                    <div className="text-xs font-medium text-muted-foreground mt-1.5 opacity-80">
                      atau Rp{plan.yearly_price.toLocaleString("id-ID")}/tahun
                    </div>
                  )}
                </div>
                
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features?.map((feat, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <div className="mt-0.5 bg-primary/10 p-0.5 rounded-full shrink-0">
                        <Check className="w-3 h-3 text-primary" strokeWidth={3} />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
                
                <Link href="/register" className="mt-auto">
                  <Button
                    className={`w-full h-12 rounded-full font-bold text-sm transition-all duration-300 ${
                      plan.isPopular
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02]"
                        : "bg-muted text-foreground hover:bg-primary/10 hover:text-primary hover:scale-[1.02]"
                    }`}
                  >
                    {plan.cta || "Mulai Sekarang"}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
