import type { DigitalInitiativeData } from "../types"

export function PapuaInitiativesSection({ data }: { data: DigitalInitiativeData[] }) {
  if (!data || data.length === 0) return null

  return (
    <section className="py-24 bg-card relative overflow-hidden border-t border-border/50">
      <div className="container px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-500 text-xs font-bold uppercase tracking-widest">
            Inisiatif Digital
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4 tracking-tight">
            Program Transformasi Daerah
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Langkah-langkah strategis yang diakselerasi melalui implementasi platform terpusat.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {data.map((item, idx) => (
            <div key={idx} className="bg-background border border-border/50 rounded-3xl p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-foreground">{item.name}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${item.status === 'Completed' ? 'bg-green-500/10 text-green-600' : item.status === 'Ongoing' ? 'bg-blue-500/10 text-blue-600' : 'bg-orange-500/10 text-orange-600'}`}>
                  {item.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-primary mb-4">{item.region}</p>
              <p className="text-muted-foreground leading-relaxed">
                {item.impact}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
