"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { LayoutTemplate, ExternalLink, ArrowRight, Sparkles } from "lucide-react"
import type { WebsiteTemplateItem } from "../types"

export function TemplatesSection({ templates = [] }: { templates?: WebsiteTemplateItem[] }) {
  const [active, setActive] = useState<WebsiteTemplateItem | null>(null)

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t)}
              className="group text-left relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[4/3] w-full bg-muted/40 border-b border-border/60 overflow-hidden">
                {t.demoUrl ? (
                  <iframe
                    src={t.demoUrl}
                    className="w-full h-full border-0 pointer-events-none bg-white scale-[1.01]"
                    loading="lazy"
                    tabIndex={-1}
                    title={`Pratinjau ${t.name}`}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                    <LayoutTemplate className="h-8 w-8" />
                  </div>
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
      </div>

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

          <div className="aspect-video w-full bg-muted/40">
            {active?.demoUrl ? (
              <iframe
                src={active.demoUrl}
                className="w-full h-full border-0 bg-white"
                loading="lazy"
                title={`Demo ${active.name}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
                <LayoutTemplate className="h-10 w-10" />
              </div>
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
    </section>
  )
}
