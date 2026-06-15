import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { CtaData } from "../types"

export function CtaBanner({ cta }: { cta: CtaData | null }) {
  if (!cta) return null

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden bg-background">
      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="relative rounded-[3rem] overflow-hidden bg-primary px-6 py-16 sm:px-16 sm:py-24 text-center shadow-2xl shadow-primary/30">
          {/* Intense Gradient Background inside the banner */}
          <div className="absolute inset-0 opacity-80 pointer-events-none">
            <div className="absolute -top-[50%] -left-[10%] w-[120%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/20 via-primary to-blue-900/80 blur-2xl" />
          </div>
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/30 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2 pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight leading-[1.1]">
              {cta.title}
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/90 font-medium mb-10 leading-relaxed max-w-2xl mx-auto">
              {cta.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-5 justify-center">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto h-14 px-10 bg-white text-primary hover:bg-white/90 rounded-full font-black text-lg shadow-xl shadow-black/10 transition-all hover:scale-105">
                  {cta.button_primary_text || "Mulai Gratis Sekarang"}
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-10 rounded-full border-white/30 text-white bg-white/10 backdrop-blur-md hover:bg-white/20 hover:border-white/50 font-bold text-lg transition-all hover:scale-105">
                  {cta.button_secondary_text || "Baca Dokumentasi"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
