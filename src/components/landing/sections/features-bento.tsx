import { getIcon } from "../icon-map"
import type { FeatureItem } from "../types"

export function FeaturesBento({ features }: { features: FeatureItem[] }) {
  if (features.length === 0) return null

  return (
    <section id="features" className="py-20 relative bg-background overflow-hidden scroll-mt-24">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[600px] opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm shadow-sm shadow-primary/20">
            Fitur Utama
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight mb-4 leading-tight">
            Infrastruktur CMS Tanpa <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 drop-shadow-sm">
              Rasa Pusing
            </span>
          </h2>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto font-medium leading-relaxed">
            Template dan fitur lengkap untuk membangun website pemerintah, portal berita, katalog UMKM, dan pariwisata dengan cepat.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {features.map((feature, i) => {
            const Icon = getIcon(feature.icon)

            return (
              <div 
                key={i} 
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 flex flex-col p-6 min-h-[220px]"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-foreground mb-2 group-hover:text-primary transition-colors duration-300">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">{feature.description}</p>
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
