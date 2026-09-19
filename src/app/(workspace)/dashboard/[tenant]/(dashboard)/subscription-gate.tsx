"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Lock, Sparkles, ArrowRight, ShieldCheck, Database, Zap } from "lucide-react"

export function SubscriptionGate({ 
  isExpired, 
  tenantId, 
  children 
}: { 
  isExpired: boolean
  tenantId: string
  children: React.ReactNode 
}) {
  const pathname = usePathname()

  if (isExpired && !pathname.includes("/subscriptions")) {
    return (
      <div className="relative flex-1 flex flex-col items-center justify-center p-6 md:p-12 min-h-[calc(100vh-4rem)] w-full overflow-hidden bg-background text-foreground select-none">
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-md w-full rounded-3xl border border-border/80 bg-card/70 backdrop-blur-xl p-8 md:p-10 shadow-2xl shadow-black/5 dark:shadow-black/20 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge 
              variant="outline" 
              className="px-3 py-1 rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[11px] uppercase tracking-wider gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Masa Percobaan Berakhir
            </Badge>
          </div>

          {/* Minimalist Icon Badge */}
          <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-b from-muted/80 to-muted/30 border border-border/80 flex items-center justify-center shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
          </div>

          {/* Heading & Subtitle */}
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
              Workspace Dikunci
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              Masa uji coba gratis telah selesai. Pilih paket langganan untuk melanjutkan pengelolaan konten, media, dan integrasi API Anda.
            </p>
          </div>

          {/* Key Value Points */}
          <div className="grid grid-cols-1 gap-2 pt-1 text-left">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Seluruh data konten & aset media tersimpan aman</span>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <span>Akses langsung terbuka seketika setelah berlangganan</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col gap-2.5">
            <Button 
              asChild
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 transition-all cursor-pointer"
            >
              <Link href={`/dashboard/${tenantId}/subscriptions`} className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 fill-current" />
                <span>Pilih Paket Langganan</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              asChild 
              className="w-full h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground font-medium"
            >
              <Link href="/dashboard">
                Kembali ke Daftar Workspace
              </Link>
            </Button>
          </div>

        </div>

        {/* Footer Note */}
        <p className="relative z-10 text-[11px] text-muted-foreground/80 mt-6 text-center">
          Butuh bantuan khusus enterprise? Hubungi tim support kami.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
