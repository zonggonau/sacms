"use client"

import { Quote } from "lucide-react"
import type { TestimonialItem } from "../types"
import { useLanguage } from "@/lib/i18n/context"

export function TestimonialsSection({ testimonials = [] }: { testimonials?: TestimonialItem[] }) {
  const { dict } = useLanguage()

  if (!testimonials || testimonials.length === 0) return null

  return (
    <section id="testimonials" className="py-24 sm:py-32 relative bg-background border-t border-border/50 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1000px] h-[500px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 to-purple-500/40 blur-3xl rounded-full" />
      </div>

      <div className="container px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16 space-y-3">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            {dict.testimonials.badge}
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight max-w-2xl mx-auto">
            {dict.testimonials.title}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto font-medium">
            {dict.testimonials.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {testimonials.map((t, i) => (
            <div 
              key={i} 
              className="group relative p-6 sm:p-8 rounded-3xl bg-card/40 backdrop-blur-xl border border-border/50 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/5 flex flex-col justify-between"
            >
              {/* Subtle hover gradient */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-3xl" />
              </div>

              <div className="relative z-10">
                <Quote className="w-8 h-8 text-primary/20 mb-4 group-hover:text-primary/40 transition-colors duration-300" />
                <div className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6 italic font-medium [&>p]:mb-0 [&_p]:mb-0">
                  &quot;<span dangerouslySetInnerHTML={{ __html: t.content || '' }} />&quot;
                </div>
              </div>
              
              <div className="relative z-10 flex items-center gap-3.5 pt-4 border-t border-border/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-blue-600/80 flex items-center justify-center font-black text-white text-base shrink-0 shadow-md shadow-primary/20 border border-white/10">
                  {t.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{t.name}</p>
                  <p className="text-xs text-muted-foreground font-medium">{t.role}{t.company ? <span className="text-primary/60"> • {t.company}</span> : ""}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
