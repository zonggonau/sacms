import { Landmark } from "lucide-react"
import { getIcon } from "../icon-map"
import type { SectorItem } from "../types"

export function SectorsSection({ sectors }: { sectors: SectorItem[] }) {
  if (sectors.length === 0) return null

  return (
    <section id="sektor" className="py-20 relative bg-background border-t border-border/50 scroll-mt-24 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[800px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/40 via-transparent to-transparent blur-3xl rounded-full" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row items-start justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4 tracking-tight">
              Siap Membantu <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Model Bisnis Anda</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl font-medium">
              Dari Solo Developer hingga Digital Agency, CMS ini menyesuaikan dengan klien Anda.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sectors.map((item, i) => {
            const Icon = getIcon(item.icon, Landmark)
            return (
              <div 
                key={i} 
                className="group relative p-6 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 text-center overflow-hidden flex flex-col items-center justify-center min-h-[180px]"
              >
                <div className="relative z-10 w-12 h-12 rounded-xl mx-auto mb-4 bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="relative z-10 font-bold text-foreground text-base mb-1">{item.label}</h3>
                <p className="relative z-10 text-xs text-muted-foreground font-medium leading-relaxed">{item.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
