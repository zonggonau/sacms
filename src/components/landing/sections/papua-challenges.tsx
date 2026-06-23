import { getIcon } from "../icon-map"
import type { ChallengeData } from "../types"

export function PapuaChallengesSection({ data }: { data: ChallengeData[] }) {
  if (!data || data.length === 0) return null

  return (
    <section id="solusi" className="py-24 bg-background relative overflow-hidden">
      <div className="container px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold uppercase tracking-widest">
            Tantangan & Solusi
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4 tracking-tight">
            Menjawab Masalah Nyata di Lapangan
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Infrastruktur kami didesain khusus untuk mengatasi hambatan geografis dan teknis di Tanah Papua.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {data.map((item, idx) => {
            const Icon = getIcon(item.icon || "AlertTriangle")
            return (
              <div key={idx} className="group relative bg-card border border-border/50 rounded-3xl p-8 hover:border-primary/50 transition-colors shadow-sm hover:shadow-lg">
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6 text-destructive" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Tantangan Lapangan</h3>
                  </div>
                  <p className="text-muted-foreground mb-8 pb-8 border-b border-border/50 line-clamp-3">
                    {item.challenge}
                  </p>
                  <div className="mt-auto">
                    <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">Solusi SaCMS</h4>
                    <p className="text-foreground font-medium leading-relaxed">
                      {item.solution}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
