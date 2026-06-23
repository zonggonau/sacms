import { Globe, MonitorSmartphone, Airplay, Link as LinkIcon } from "lucide-react"
import type { ConnectedSiteData } from "../types"

export function PapuaConnectedSitesSection({ data }: { data: ConnectedSiteData[] }) {
  if (!data || data.length === 0) return null

  return (
    <section id="showcase" className="py-24 bg-background relative overflow-hidden">
      <div className="container px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold uppercase tracking-widest">
            Showcase Integrasi
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4 tracking-tight">
            Portal & Layanan yang Terhubung
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Satu CMS, disalurkan ke berbagai macam antarmuka (Omnichannel) untuk menjangkau masyarakat lebih luas.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {data.map((site, idx) => {
            const isWeb = site.platformType === "Web"
            const isApp = site.platformType === "Mobile App"
            
            return (
              <div key={idx} className="bg-card border border-border/50 rounded-3xl p-8 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-xl group">
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isWeb ? 'bg-blue-500/10 text-blue-500' : isApp ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    {isWeb ? <Globe className="w-6 h-6" /> : isApp ? <MonitorSmartphone className="w-6 h-6" /> : <Airplay className="w-6 h-6" />}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${site.status === 'Active' ? 'bg-green-500/10 text-green-600' : 'bg-orange-500/10 text-orange-600'}`}>
                    {site.status}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{site.siteName}</h3>
                
                {site.domain && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 font-mono">
                    <LinkIcon className="w-3 h-3" />
                    {site.domain}
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {site.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
