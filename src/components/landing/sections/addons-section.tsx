"use client"

import { getIcon } from "../icon-map"
import { formatRupiah } from "@/lib/utils"
import type { AddonItem } from "../types"
import { useLanguage } from "@/lib/i18n/context"

export function AddonsSection({ addons = [] }: { addons?: AddonItem[] }) {
  const { dict, locale } = useLanguage()

  if (!addons || addons.length === 0) return null

  return (
    <section id="addons" className="py-24 sm:py-32 relative bg-card/50 border-t border-border/50 scroll-mt-24 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/30 to-transparent blur-3xl rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16 space-y-3">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            {dict.addons.badge}
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight max-w-2xl mx-auto">
            {dict.addons.title}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto font-medium">
            {dict.addons.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {addons.map((addon, i) => {
            const Icon = getIcon(addon.icon)
            return (
              <div 
                key={i} 
                className="group relative flex items-start gap-5 p-6 sm:p-8 rounded-3xl bg-background border border-border/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30"
              >
                {/* Glow Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent rounded-3xl" />
                </div>

                <div className="relative z-10 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 group-hover:bg-primary/20">
                  <Icon className="w-5 h-5 text-primary" />
                </div>

                <div className="relative z-10 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h3 className="text-lg font-bold text-foreground">{addon.name}</h3>
                    {addon.price_label ? (
                      <span className="inline-flex items-center text-xs font-bold text-primary px-3 py-1 bg-primary/10 rounded-full">
                        {addon.price_label}
                      </span>
                    ) : addon.price > 0 ? (
                      <span className="inline-flex items-center text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600 px-3 py-1 bg-primary/10 rounded-full">
                        {formatRupiah(addon.price)}
                        {addon.unit && <span className="text-[10px] text-muted-foreground font-medium ml-1">/{addon.unit}</span>}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-bold text-green-500 px-3 py-1 bg-green-500/10 rounded-full">
                        {locale === "en" ? "Free" : "Gratis"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed font-medium [&>p]:mb-0 [&_p]:mb-0" dangerouslySetInnerHTML={{ __html: addon.description || '' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
