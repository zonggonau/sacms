import type { AboutData } from "../types"

export function AboutSection({ about }: { about: AboutData | null }) {
  if (!about) return null

  return (
    <section id="about" className="py-32 relative bg-background border-t border-border/50 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-1/2 right-0 w-[600px] h-[600px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-l from-primary/30 to-blue-500/20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative z-10">
        <div className="flex-1 space-y-8">
          <div>
            <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
              Tentang Kami
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
              {about.title}
            </h2>
          </div>
          
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-medium">
            {about.description}
          </p>
          
          {about.mission && (
            <blockquote className="relative p-6 rounded-2xl bg-card/40 backdrop-blur-md border border-border/50 shadow-lg group hover:border-primary/30 transition-colors duration-300">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary to-blue-500 rounded-l-2xl" />
              <p className="text-base sm:text-lg italic text-foreground font-medium leading-relaxed ml-2">
                "{about.mission}"
              </p>
            </blockquote>
          )}
        </div>

        <div className="flex-1 w-full grid grid-cols-2 gap-4 sm:gap-6">
          {[
            { label: "Didirikan", value: about.founded || "2024", icon: "🚀" },
            { label: "Arsitektur", value: "Multi-Tenant", icon: "🏢" },
            { label: "Protokol API", value: "REST + GraphQL", icon: "⚡" },
            { label: "Penyimpanan", value: "Cloudflare R2", icon: "☁️" },
          ].map((item, i) => (
            <div 
              key={item.label} 
              className={`group relative p-6 sm:p-8 rounded-[2rem] bg-card/40 backdrop-blur-xl border border-border/50 shadow-lg hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-500 overflow-hidden ${i === 1 || i === 2 ? 'lg:translate-y-8' : ''}`}
            >
              {/* Subtle hover gradient */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              </div>

              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:bg-primary/20">
                  {item.icon}
                </div>
                <p className="text-2xl sm:text-3xl font-black text-foreground mb-2 tracking-tight group-hover:text-primary transition-colors">{item.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground font-bold uppercase tracking-wider mt-auto">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
