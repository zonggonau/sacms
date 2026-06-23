import type { VisionMissionData } from "../types"

export function PapuaVisionMissionSection({ data }: { data: VisionMissionData | null }) {
  if (!data) return null

  const missions = data.mission.split(",").map(m => m.trim()).filter(Boolean)

  return (
    <section className="py-24 bg-card relative overflow-hidden border-t border-border/50">
      <div className="container px-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
              Visi Kami
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-6 leading-tight">
              Mewujudkan Keadilan Digital di Tanah Papua
            </h2>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed">
              {data.vision}
            </p>
          </div>
          
          <div className="bg-background/50 backdrop-blur-sm border border-border/50 rounded-3xl p-8 md:p-10 shadow-lg">
            <h3 className="text-2xl font-bold mb-6 text-foreground">Misi Utama</h3>
            <ul className="space-y-6">
              {missions.map((mission, idx) => (
                <li key={idx} className="flex gap-4 items-start">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-black shrink-0">
                    {idx + 1}
                  </div>
                  <p className="text-muted-foreground font-medium leading-relaxed pt-1">
                    {mission}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
