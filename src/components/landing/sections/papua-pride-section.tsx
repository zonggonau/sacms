"use client"

import { MapPin, Sparkle } from "lucide-react"
import type { LocalPrideData } from "../types"

/**
 * A repeating zigzag line motif evoking Papuan woodcarving line-art traditions
 * (not a literal reproduction of any specific tribal pattern), used only as a
 * subtle decorative border — two-tone terracotta/forest to echo Papua's soil
 * and highland forest without leaning on cliché iconography (bird-of-paradise,
 * koteka, etc).
 */
function CarvedLineMotif({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <pattern id="papua-zigzag" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M0 18 L6 6 L12 18 L18 6 L24 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="6" r="1.4" fill="currentColor" />
        <circle cx="18" cy="6" r="1.4" fill="currentColor" />
      </pattern>
      <rect width="240" height="24" fill="url(#papua-zigzag)" />
    </svg>
  )
}

export function LocalPrideSection({ data }: { data: LocalPrideData | null }) {
  const badge = data?.badge?.trim() || "Dibangun di Nabire, Papua Tengah"
  const title = data?.title?.trim() || "Lahir di Papua. Dibangun untuk Bersaing Secara Global."
  const description =
    data?.description?.trim() ||
    "SaCMS dirancang dan dikembangkan oleh talenta digital asli Papua di Nabire, Papua Tengah — bukti bahwa produk teknologi kelas dunia tidak harus lahir di Jakarta. Kami percaya UMKM, pemerintah daerah, kreator, dan startup di Papua berhak memakai infrastruktur digital yang sama cepat dan sekuat yang dipakai startup di kota besar, tanpa harus meninggalkan tanah sendiri."

  return (
    <section className="relative overflow-hidden bg-background border-t border-border/50">
      {/* Top carved-line border accent */}
      <CarvedLineMotif className="w-full h-3 text-amber-800/50 dark:text-amber-700/40" />

      <div className="py-16 sm:py-20 relative">
        {/* Faint corner watermark spiral, kept low-opacity so it reads as texture, not an illustration */}
        <div className="absolute -right-24 -top-24 w-[420px] h-[420px] pointer-events-none opacity-[0.06] dark:opacity-[0.09]">
          <svg viewBox="0 0 200 200" className="w-full h-full text-emerald-800 dark:text-emerald-400">
            <path
              d="M100 20 C140 20 160 50 160 85 C160 125 130 150 95 150 C68 150 50 132 50 108 C50 88 65 75 83 75 C98 75 108 85 108 98"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="container px-6 max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center">
            <div className="space-y-5 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-700/30 bg-amber-700/10 text-amber-800 dark:text-amber-400 text-xs font-bold tracking-wide">
                <MapPin className="h-3.5 w-3.5" />
                <span>{badge}</span>
              </div>

              <h2 className="text-3xl sm:text-4xl md:text-[2.75rem] font-black text-foreground tracking-tight leading-[1.1]">
                {title}
              </h2>

              <p className="text-sm sm:text-base text-muted-foreground font-medium leading-relaxed">
                {description}
              </p>

              <div className="flex items-center gap-2 pt-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <Sparkle className="h-4 w-4" />
                <span>Dibangun oleh talenta digital asli Papua</span>
              </div>
            </div>

            {/* Identity card: Papua Tengah -> Indonesia -> World, echoing the hero's cadence */}
            <div className="relative">
              <div className="rounded-3xl border border-border/70 bg-card/70 backdrop-blur-xl shadow-xl p-7 sm:p-8 space-y-6">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Asal</span>
                  <span>Melayani</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-lg font-black text-foreground">Nabire</p>
                    <p className="text-[11px] text-muted-foreground font-medium">Papua Tengah</p>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-amber-700/40 via-border to-emerald-700/40" />
                  <div className="space-y-1 text-right">
                    <p className="text-lg font-black text-foreground">Indonesia</p>
                    <p className="text-[11px] text-muted-foreground font-medium">&amp; seluruh dunia</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground leading-relaxed">
                  Satu platform, satu tim dari Papua Tengah — melayani agensi, instansi, dan pelaku usaha di mana pun mereka berada.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom carved-line border accent */}
      <CarvedLineMotif className="w-full h-3 text-emerald-800/50 dark:text-emerald-700/40" />
    </section>
  )
}
