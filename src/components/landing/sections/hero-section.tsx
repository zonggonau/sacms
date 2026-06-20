import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { HeroData } from "../types"

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
  const hero = data || { headline: "Loading API Data..." }

  return (
    <section className="min-h-[75vh] flex items-center justify-center pt-24 pb-16 relative overflow-hidden">
      {/* Abstract Background Blurs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] opacity-40 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent blur-3xl rounded-full mix-blend-screen" />
      </div>

      <div className="container px-6 max-w-5xl mx-auto text-center space-y-8 relative z-10">
        {hero.badge_text && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="inline-flex items-center px-4 py-1.5 bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-widest uppercase rounded-full backdrop-blur-md shadow-sm shadow-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
              {hero.badge_text}
            </span>
          </div>
        )}

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1] text-foreground animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150 fill-mode-both">
          <HighlightedHeadline text={hero.headline} />
        </h1>

        <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
          {hero.subheadline}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500 fill-mode-both">
          <Link href={hero.cta_href || "/register"}>
            <Button size="lg" className="h-11 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-bold text-sm shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:shadow-primary/40">
              {hero.cta_primary || "Mulai Gratis"}
            </Button>
          </Link>
          <Link href="/docs">
            <Button size="lg" variant="outline" className="h-11 px-8 rounded-full border-border/50 bg-background/50 backdrop-blur-md font-bold text-sm hover:bg-muted/50 hover:border-border transition-all hover:scale-105">
              {hero.cta_secondary || "Lihat Demo"}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
