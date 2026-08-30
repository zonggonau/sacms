"use client"

import type { AboutData } from "../types"
import { useLanguage } from "@/lib/i18n/context"

export function AboutSection({ about }: { about: AboutData | null }) {
  const { dict, locale } = useLanguage()

  const title = locale === "en" ? dict.about.title : (about?.title || dict.about.title)
  const description = locale === "en" 
    ? `<p>${dict.about.desc1}</p><p class="mt-3">${dict.about.desc2}</p>` 
    : (about?.description || `<p>${dict.about.desc1}</p>`)

  return (
    <section id="about" className="py-24 sm:py-32 relative bg-background border-t border-border/50 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-1/2 right-0 w-[600px] h-[600px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-l from-primary/30 to-blue-500/20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16 relative z-10">
        <div className="flex-1 space-y-6">
          <div>
            <div className="inline-flex items-center justify-center px-4 py-1.5 mb-4 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
              {dict.about.badge}
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
              {title}
            </h2>
          </div>
          
          <div 
            className="text-base sm:text-lg text-muted-foreground leading-relaxed font-medium [&>p]:mb-0 [&_p]:mb-0"
            dangerouslySetInnerHTML={{ __html: description }}
          />
          
          {about?.mission && (
            <blockquote className="relative p-5 rounded-2xl bg-card/40 backdrop-blur-md border border-border/50 shadow-md group hover:border-primary/30 transition-colors">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary to-blue-500 rounded-l-2xl" />
              <p className="text-sm sm:text-base italic text-foreground font-medium leading-relaxed ml-2">
                &quot;{about.mission}&quot;
              </p>
            </blockquote>
          )}
        </div>

        <div className="flex-1 w-full grid grid-cols-2 gap-4 sm:gap-6">
          {[
            { label: locale === "en" ? "Founded" : "Didirikan", value: about?.founded || "2026", icon: "🚀" },
            { label: locale === "en" ? "Architecture" : "Arsitektur", value: "Multi-Tenant", icon: "🏢" },
            { label: locale === "en" ? "API Protocol" : "Protokol API", value: "REST + GraphQL", icon: "⚡" },
            { label: locale === "en" ? "Storage" : "Penyimpanan", value: "Cloudflare R2 / S3", icon: "☁️" },
          ].map((item, i) => (
            <div 
              key={item.label} 
              className={`group relative p-6 rounded-3xl bg-card/40 backdrop-blur-xl border border-border/50 shadow-md hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden ${i === 1 || i === 2 ? 'lg:translate-y-6' : ''}`}
            >
              {/* Subtle hover gradient */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              </div>

              <div className="relative z-10 flex flex-col h-full">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform group-hover:bg-primary/20">
                  {item.icon}
                </div>
                <p className="text-xl sm:text-2xl font-black text-foreground mb-1 tracking-tight group-hover:text-primary transition-colors">{item.value}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mt-auto">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
