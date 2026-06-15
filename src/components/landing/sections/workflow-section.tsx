import { getIcon } from "../icon-map"
import type { WorkflowStep } from "../types"

export function WorkflowSection({ workflow }: { workflow: WorkflowStep[] }) {
  if (workflow.length === 0) return null

  return (
    <section id="workflow" className="py-32 relative bg-background border-t border-border/50 scroll-mt-24 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-l from-primary/30 to-transparent blur-3xl rounded-full translate-x-1/3 -translate-y-1/3" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-24">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            Cara Kerja
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6 tracking-tight">
            Dari Ide ke Realita dalam <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Hitungan Menit</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
            Proses onboarding yang dirancang untuk kecepatan dan kemudahan. Tanpa ribet, langsung online.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 relative">
          {/* Connector Line (Desktop only) */}
          <div className="hidden lg:block absolute top-[4.5rem] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10 z-0" />

          {workflow.map((step, i) => {
            const Icon = getIcon(step.icon)
            return (
              <div key={i} className="group relative z-10">
                <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                  {/* Step Number Badge */}
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover:bg-primary/40 transition-colors duration-500" />
                    <div className="relative w-16 h-16 rounded-2xl bg-card border border-primary/20 shadow-lg flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:-translate-y-1">
                      {/* Inner glow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
                      <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-primary to-blue-600">
                        {step.step || i + 1}
                      </span>
                    </div>
                  </div>

                  {/* Icon & Content */}
                  <div className="bg-card/40 backdrop-blur-md border border-border/50 p-6 rounded-3xl transition-all duration-500 group-hover:border-primary/30 group-hover:bg-card/80 group-hover:shadow-xl w-full">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-5 mx-auto lg:mx-0 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-500">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-medium">{step.description}</p>
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
