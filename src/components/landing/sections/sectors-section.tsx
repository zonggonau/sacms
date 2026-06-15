import { Landmark } from "lucide-react"
import { getIcon } from "../icon-map"
import type { SectorItem } from "../types"

export function SectorsSection({ sectors }: { sectors: SectorItem[] }) {
  if (sectors.length === 0) return null

  return (
    <section id="sektor" className="py-32 relative bg-background border-t border-border/50 scroll-mt-24 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[800px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/40 via-transparent to-transparent blur-3xl rounded-full" />
      </div>

      <div className="container px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            Sektor Layanan
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6 tracking-tight">
            Dibangun untuk <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Berbagai Kebutuhan</span> di Papua
          </h2>
          <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto font-medium">
            Dari instansi pemerintah hingga UMKM, SaCMS siap mendukung digitalisasi di seluruh sektor.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sectors.map((item, i) => {
            const Icon = getIcon(item.icon, Landmark)
            return (
              <div 
                key={i} 
                className="group relative p-8 rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-xl hover:border-primary/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 text-center overflow-hidden flex flex-col items-center justify-center min-h-[220px]"
              >
                {/* Subtle hover gradient */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
                </div>

                <div className="relative z-10 w-16 h-16 rounded-2xl mx-auto mb-6 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-500 shadow-lg shadow-primary/5 group-hover:shadow-primary/30">
                  <Icon className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500" />
                </div>
                <h3 className="relative z-10 font-black text-foreground text-lg mb-2 group-hover:text-primary transition-colors">{item.label}</h3>
                <p className="relative z-10 text-sm text-muted-foreground font-medium leading-relaxed">{item.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
