import { getIcon } from "../icon-map"
import type { FeatureItem } from "../types"

export function FeaturesBento({ features }: { features: FeatureItem[] }) {
  if (features.length === 0) return null

  const spanClasses = [
    "md:col-span-2 md:row-span-2 flex flex-col min-h-[400px]", // 0: Large feature
    "md:col-span-2 min-h-[220px]",               // 1: Top right
    "md:col-span-2 min-h-[220px]",               // 2: Bottom right
    "md:col-span-4 min-h-[200px] flex flex-col md:flex-row items-center md:items-center gap-6", // 3: Full width banner
    "md:col-span-2 min-h-[250px]",               // 4: Half width
    "md:col-span-2 min-h-[250px]",               // 5: Half width
  ]

  // Add subtle gradient backgrounds to some cards for visual variety
  const bgGradients = [
    "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent",
    "bg-gradient-to-bl from-blue-500/10 to-transparent",
    "bg-gradient-to-tr from-emerald-500/10 to-transparent",
    "bg-gradient-to-r from-orange-500/10 via-background to-purple-500/10",
    "bg-gradient-to-tl from-pink-500/10 to-transparent",
    "bg-gradient-to-br from-indigo-500/10 to-transparent",
  ]

  return (
    <section id="features" className="py-32 relative bg-background overflow-hidden scroll-mt-24">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[600px] opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-24">
          <div className="inline-flex items-center justify-center px-5 py-2 mb-8 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold uppercase tracking-widest backdrop-blur-sm shadow-sm shadow-primary/20">
            Solusi Digital Papua
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground tracking-tight mb-8 leading-tight">
            Layanan Website <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 drop-shadow-sm">
              untuk Semua Sektor
            </span>
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            Transformasi digital untuk setiap lini. Dari instansi pemerintahan hingga wirausaha lokal, kami menyediakan platform modern dan andal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 auto-rows-auto">
          {features.map((feature, i) => {
            const Icon = getIcon(feature.icon)
            const spanClass = spanClasses[i] ?? "md:col-span-1"
            const bgGradient = bgGradients[i] ?? ""

            return (
              <div 
                key={i} 
                className={`group relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/30 backdrop-blur-xl shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/30 ${spanClass}`}
              >
                {/* Background Gradient & Glow Effect */}
                <div className={`absolute inset-0 ${bgGradient} opacity-40 transition-opacity duration-500 group-hover:opacity-80 pointer-events-none`} />
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="relative z-10 p-8 sm:p-10 h-full flex flex-col">
                  {i === 3 ? (
                     // Special layout for full width banner
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-primary/30 mb-6 md:mb-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                        <Icon className="w-8 h-8 text-primary-foreground" />
                      </div>
                      <div className="flex-1 md:ml-10">
                        <h3 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mb-4 group-hover:text-primary transition-colors duration-300">{feature.title}</h3>
                        <p className="text-muted-foreground leading-relaxed text-lg">{feature.description}</p>
                      </div>
                    </>
                  ) : (
                    // Default layout
                    <>
                      <div className={`w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-auto transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3 ${i === 0 ? 'mb-10 w-16 h-16 rounded-3xl' : 'mb-8'}`}>
                        <Icon className={`text-primary-foreground ${i === 0 ? 'w-8 h-8' : 'w-7 h-7'}`} />
                      </div>
                      <div className={i === 0 ? "mt-auto" : ""}>
                        <h3 className={`${i === 0 ? 'text-3xl lg:text-4xl mb-5' : 'text-2xl mb-4'} font-black tracking-tight text-foreground group-hover:text-primary transition-colors duration-300`}>{feature.title}</h3>
                        <p className={`text-muted-foreground leading-relaxed ${i === 0 ? 'text-lg' : 'text-base'}`}>{feature.description}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
