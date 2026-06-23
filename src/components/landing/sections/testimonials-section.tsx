import { Quote } from "lucide-react"
import type { TestimonialItem } from "../types"

export function TestimonialsSection({ testimonials = [] }: { testimonials?: TestimonialItem[] }) {
  if (!testimonials || testimonials.length === 0) return null

  return (
    <section id="testimonials" className="py-32 relative bg-background border-t border-border/50 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1000px] h-[500px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 to-purple-500/40 blur-3xl rounded-full" />
      </div>

      <div className="container px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            Testimoni
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground tracking-tight mb-6">
            Dipercaya oleh <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Papua</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
            Dengar langsung dari mereka yang telah bertransformasi secara digital bersama kami.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div 
              key={i} 
              className="group relative p-8 rounded-[2rem] bg-card/40 backdrop-blur-xl border border-border/50 hover:border-primary/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 flex flex-col justify-between"
            >
              {/* Subtle hover gradient */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2rem] pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-[2rem]" />
              </div>

              <div className="relative z-10">
                <Quote className="w-10 h-10 text-primary/20 mb-6 group-hover:text-primary/40 transition-colors duration-300" />
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-8 italic font-medium">"{t.content}"</p>
              </div>
              
              <div className="relative z-10 flex items-center gap-4 pt-6 border-t border-border/50">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-blue-600/80 flex items-center justify-center font-black text-white text-lg shrink-0 shadow-lg shadow-primary/20 border border-white/10">
                  {t.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{t.name}</p>
                  <p className="text-sm text-muted-foreground font-medium">{t.role}{t.company ? <span className="text-primary/60"> • {t.company}</span> : ""}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
