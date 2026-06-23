import { getIcon } from "../icon-map"
import type { TechConceptData } from "../types"

export function PapuaTechStackSection({ data }: { data: TechConceptData[] }) {
  if (!data || data.length === 0) return null

  return (
    <section id="tech" className="py-24 bg-card relative overflow-hidden border-t border-border/50">
      <div className="container px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold uppercase tracking-widest">
            Keunggulan Infrastruktur
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4 tracking-tight">
            Arsitektur Masa Depan
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Dibangun dengan standar enterprise untuk skalabilitas tak terbatas dan keamanan tingkat tinggi.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {data.map((item, idx) => {
            const Icon = getIcon(item.icon || "Cpu")
            return (
              <div key={idx} className="bg-background border border-border/50 rounded-3xl p-8 hover:-translate-y-1 transition-transform duration-300 shadow-sm hover:shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-primary/10 flex items-center justify-center mb-6">
                  <Icon className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{item.concept}</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {item.description}
                </p>
                {item.benefits && (
                  <div className="pt-6 border-t border-border/50">
                    <p className="text-sm font-semibold text-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">✓</span>
                      <span>{item.benefits}</span>
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
