import { Sparkles } from "lucide-react"
import { TemplateGallery } from "../template-gallery"
import type { WebsiteTemplateItem } from "../types"

export function TemplatesSection({ templates = [] }: { templates?: WebsiteTemplateItem[] }) {
  if (!templates || templates.length === 0) return null

  return (
    <section id="template" className="py-20 sm:py-28 relative bg-card/40 border-t border-border/50 scroll-mt-24 overflow-hidden">
      <div className="container px-4 sm:px-6 max-w-6xl mx-auto relative z-10 space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold tracking-wide backdrop-blur-md shadow-xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Galeri Template</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
            Mulai dari Website Siap Pakai
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground font-medium leading-relaxed">
            Pilih template, lihat demonya langsung, lalu terapkan ke workspace kamu dalam sekali klik.
          </p>
        </div>

        {/* Exactly 6 cards (data layer already caps it) in a 3-column
            grid — 3 on top, 3 below, same proportions as vercel.com/templates'
            own homepage teaser. */}
        <TemplateGallery templates={templates} viewAllHref="/templates" />
      </div>
    </section>
  )
}
