import { getIcon } from "../icon-map"
import { formatRupiah } from "@/lib/utils"
import type { AddonItem } from "../types"

export function AddonsSection({ addons = [] }: { addons?: AddonItem[] }) {
  if (!addons || addons.length === 0) return null

  return (
    <section id="addons" className="py-32 relative bg-card/50 border-t border-border/50 scroll-mt-24 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/30 to-transparent blur-3xl rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            Layanan Tambahan
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6 tracking-tight">
            Tingkatkan Kemampuan <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Website Anda</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
            Pilih fungsionalitas ekstra yang sesuai dengan kebutuhan spesifik bisnis Anda. Bayar hanya untuk yang Anda gunakan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {addons.map((addon, i) => {
            const Icon = getIcon(addon.icon)
            return (
              <div 
                key={i} 
                className="group relative flex items-start gap-6 p-8 rounded-3xl bg-background border border-border/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30"
              >
                {/* Glow Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent rounded-3xl" />
                </div>

                <div className="relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 group-hover:bg-primary/20">
                  <Icon className="w-6 h-6 text-primary" />
                </div>

                <div className="relative z-10 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h3 className="text-xl font-bold text-foreground">{addon.name}</h3>
                    {addon.price > 0 ? (
                      <span className="inline-flex items-center text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600 px-3 py-1 bg-primary/10 rounded-full">
                        {formatRupiah(addon.price)}
                        {addon.unit && <span className="text-xs text-muted-foreground font-medium ml-1">/{addon.unit}</span>}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-sm font-bold text-green-500 px-3 py-1 bg-green-500/10 rounded-full">
                        Gratis
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed font-medium">{addon.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
