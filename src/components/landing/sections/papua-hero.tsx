import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Globe } from "lucide-react"
import type { PapuaHeroData } from "../types"

export function PapuaHeroSection({ data }: { data: PapuaHeroData | null }) {
  if (!data) return null

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-background">
      {/* Dynamic Background Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1200px] h-[800px] opacity-40 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-blue-500/10 to-transparent blur-[120px] rounded-full animate-pulse-slow" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10 text-center">
        <div className="inline-flex items-center justify-center px-4 py-1.5 mb-8 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm shadow-sm shadow-primary/20">
          <Globe className="w-3.5 h-3.5 mr-2" />
          Transformasi Digital Papua
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tight mb-8 leading-[1.1]">
          {data.title}
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 font-medium leading-relaxed">
          {data.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {data.primaryCtaText && (
            <Link href={data.primaryCtaLink || "#"}>
              <Button size="lg" className="h-14 px-8 rounded-full font-bold text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300 w-full sm:w-auto group">
                {data.primaryCtaText}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          )}
          
          {data.secondaryCtaText && (
            <Link href={data.secondaryCtaLink || "#"}>
              <Button size="lg" variant="outline" className="h-14 px-8 rounded-full font-bold text-base bg-background/50 backdrop-blur-sm border-border hover:bg-accent hover:text-accent-foreground shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 w-full sm:w-auto">
                {data.secondaryCtaText}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
