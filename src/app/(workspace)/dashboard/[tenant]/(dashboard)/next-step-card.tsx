import Link from "next/link"
import { ArrowRight, Bot, LayoutTemplate, Circle, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { NextStep, NextStepAction } from "@/lib/workspace-next-step"

const STAGE_LABELS = ["Rancang", "Isi konten", "Deploy", "Live"]

function ActionRow({ action }: { action: NextStepAction }) {
  const body = (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          {action.via === "mcp" ? <Bot className="h-3.5 w-3.5 text-muted-foreground" /> : <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-sm font-semibold text-foreground">{action.label}</span>
          {action.via === "mcp" && (
            <code className="text-[10px] font-mono text-muted-foreground">{action.tool}</code>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
      </div>
      {action.via === "dashboard" && <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
    </div>
  )

  if (action.via === "dashboard") {
    return <Link href={action.href} className="block">{body}</Link>
  }
  return body
}

export function NextStepCard({ nextStep }: { nextStep: NextStep }) {
  return (
    <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-bold">Langkah berikutnya</CardTitle>
          <Badge variant="outline" className="text-[10px] font-bold">
            Tahap {nextStep.stageNumber} / {nextStep.stageCount}
          </Badge>
        </div>
        <CardDescription className="text-xs">{nextStep.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="flex flex-wrap items-center gap-2" aria-label="Tahapan workspace">
          {STAGE_LABELS.map((label, i) => {
            const n = i + 1
            const done = n < nextStep.stageNumber
            const current = n === nextStep.stageNumber
            return (
              <li key={label} className="flex items-center gap-1.5 text-xs">
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Circle className={current ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5 text-muted-foreground/50"} />
                )}
                <span className={current ? "font-bold text-foreground" : "text-muted-foreground"}>{label}</span>
                {n < STAGE_LABELS.length && <span className="mx-1 text-muted-foreground/40">→</span>}
              </li>
            )
          })}
        </ol>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">{nextStep.title}</p>
          {nextStep.actions.map((action) => (
            <ActionRow key={action.id} action={action} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
