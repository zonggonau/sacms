"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { LayoutTemplate, ExternalLink, ArrowRight } from "lucide-react"
import { getWebsitePreviewUrl, gradientFor } from "@/lib/website-preview"
import type { WebsiteTemplateItem } from "./types"

/**
 * Shared by the landing page's "Galeri Template" section (a 6-card teaser)
 * and the full /templates gallery — one grid+modal implementation instead
 * of two copies drifting apart.
 */
export function TemplateGallery({
  templates,
  viewAllHref,
}: {
  templates: WebsiteTemplateItem[]
  /** When set, shows a "Lihat Semua Template" CTA below the grid (the landing teaser passes "/templates"; the /templates page itself omits this — it IS "semua"). */
  viewAllHref?: string
}) {
  const [active, setActive] = useState<WebsiteTemplateItem | null>(null)

  if (!templates || templates.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t)}
            className="group text-left relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
          >
            {/* A live <iframe> here rendered blank — every deployed
                template's own frame-ancestors/X-Frame-Options header
                blocks third-party framing, even though the exact same
                URL opens fine in its own tab. A screenshot <img> isn't
                subject to that (only framing is), so it sidesteps the
                problem entirely; the gradient+icon tile stays underneath
                as the loading/error/no-demo fallback. */}
            <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border/60">
              <div className={`absolute inset-0 bg-gradient-to-br ${gradientFor(t.id)} bg-muted/40`} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-5xl drop-shadow-sm" aria-hidden>{t.icon}</span>
              </div>
              {t.demoUrl && (
                <img
                  src={getWebsitePreviewUrl(t.demoUrl)}
                  alt={`Pratinjau ${t.name}`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover object-top bg-white"
                  onError={(e) => { e.currentTarget.style.display = "none" }}
                />
              )}
              <div className="absolute inset-0 bg-background/0 group-hover:bg-background/70 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg">
                  Lihat Demo <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
            <div className="p-4 flex items-start gap-2.5">
              <span className="text-base shrink-0">{t.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{t.name}</p>
                {t.description && <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>}
              </div>
            </div>
          </button>
        ))}
      </div>

      {viewAllHref && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="lg" asChild className="rounded-full font-bold gap-2 border-border/70">
            <Link href={viewAllHref}>
              Lihat Semua Template <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 gap-0 rounded-2xl border border-border overflow-hidden">
          <DialogHeader className="p-4 pb-3 border-b border-border/60 text-left">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <span className="text-base">{active?.icon}</span> {active?.name}
            </DialogTitle>
            {active?.description && (
              <DialogDescription className="text-xs text-muted-foreground">{active.description}</DialogDescription>
            )}
          </DialogHeader>

          {/* Same reasoning as the grid card above — a screenshot here
              instead of a live iframe, which would render blank. */}
          <div className="relative aspect-video w-full overflow-hidden bg-muted/40">
            {active && (
              <>
                <div className={`absolute inset-0 bg-gradient-to-br ${gradientFor(active.id)}`} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl drop-shadow-sm" aria-hidden>{active.icon}</span>
                </div>
                {active.demoUrl ? (
                  <img
                    src={getWebsitePreviewUrl(active.demoUrl)}
                    alt={`Pratinjau ${active.name}`}
                    className="absolute inset-0 h-full w-full object-cover object-top bg-white"
                    onError={(e) => { e.currentTarget.style.display = "none" }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
                    <LayoutTemplate className="h-10 w-10" />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-4 border-t border-border/60 flex flex-wrap items-center justify-end gap-2">
            {active?.demoUrl && (
              <Button variant="outline" size="sm" asChild className="h-9 rounded-xl text-xs font-bold gap-1.5">
                <a href={active.demoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Buka di Tab Baru
                </a>
              </Button>
            )}
            <Button size="sm" asChild className="h-9 rounded-xl text-xs font-bold gap-1.5">
              <Link href="/register">
                <span>Daftar &amp; Gunakan Template Ini</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
