import { getIcon } from "../icon-map"
import type { WorkflowStep } from "../types"

export function WorkflowSection({ workflow }: { workflow: WorkflowStep[] }) {
  if (workflow.length === 0) return null

  return (
    <section id="workflow" className="py-20 relative bg-background border-t border-border/50 scroll-mt-24 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-l from-primary/30 to-transparent blur-3xl rounded-full translate-x-1/3 -translate-y-1/3" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            Cara Kerja
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4 tracking-tight">
            Dari Ide ke Realita dalam <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Hitungan Menit</span>
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto font-medium">
            Proses onboarding yang dirancang untuk kecepatan agensi. Tanpa ribet, langsung online.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connector Line (Desktop only) */}
          <div className="hidden lg:block absolute top-[3rem] left-[10%] right-[10%] h-px bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10 z-0" />

          {workflow.map((step, i) => {
            const Icon = getIcon(step.icon)
            return (
              <div key={i} className="group relative z-10">
                <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                  {/* Step Number Badge */}
                  <div className="relative mb-6">
                    <div className="relative w-12 h-12 rounded-xl bg-card border border-primary/20 shadow-md flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:-translate-y-1">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
                      <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-br from-primary to-blue-600">
                        {step.step || i + 1}
                      </span>
                    </div>
                  </div>

                  {/* Icon & Content */}
                  <div className="bg-card/40 backdrop-blur-md border border-border/50 p-5 rounded-2xl transition-all duration-300 group-hover:border-primary/30 group-hover:bg-card/80 group-hover:shadow-lg w-full">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto lg:mx-0 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">{step.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
