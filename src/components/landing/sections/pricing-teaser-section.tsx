import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { formatRupiah } from "@/lib/utils"
import type { PricingPlan } from "../types"

/**
 * Compact pricing teaser for the homepage — framing copy (badge/title/
 * description/CTAs) is static, but the plan names/prices themselves are
 * real data from pricingWorkspaces (never fabricated numbers). Full detail
 * lives on /harga (PricingGrid); this just shows the first 3 plans as a
 * quick reference row.
 */
export function PricingTeaserSection({ plans = [] }: { plans?: PricingPlan[] }) {
  if (!plans || plans.length === 0) return null

  const shown = plans.slice(0, 3)

  return (
    <section className="py-20 sm:py-28 relative bg-card/40 border-t border-border/50 overflow-hidden">
      <div className="container px-4 sm:px-6 max-w-6xl mx-auto relative z-10 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="outline" className="px-3.5 py-1 text-xs font-bold border-primary/40 bg-primary/10 text-primary">
            Paket &amp; Langganan
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Mulai Gratis, Tingkatkan Saat Butuh Lebih
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground font-medium">
            Pilih paket workspace yang sesuai skala Anda — semua pembayaran otomatis lewat Midtrans.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {shown.map((plan) => (
            <div
              key={plan.name}
              className={`relative p-6 rounded-2xl border bg-card/70 backdrop-blur-xl flex flex-col gap-3 ${
                plan.isPopular ? "border-primary shadow-lg shadow-primary/10" : "border-border/60"
              }`}
            >
              {plan.isPopular && (
                <Badge className="absolute -top-3 left-6 text-[10px] font-bold">Paling Populer</Badge>
              )}
              <p className="text-sm font-bold text-foreground">{plan.name}</p>
              <p className="text-2xl font-black text-foreground">
                {formatRupiah(plan.price)}
                {plan.price > 0 && <span className="text-xs font-semibold text-muted-foreground">/bulan</span>}
              </p>
              {plan.description && (
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">{plan.description}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild className="h-11 px-6 rounded-full font-bold text-xs gap-2">
            <Link href="/harga">
              Lihat Semua Paket &amp; Harga
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 px-6 rounded-full font-bold text-xs border-border/80">
            <Link href="/register">
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Daftar Gratis
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
