"use client"

import { useMemo } from "react"
import { 
  CheckCircle2, Circle, Database, FileText, 
  ImageIcon, Users, Key, ArrowRight, PartyPopper
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface OnboardingChecklistProps {
  tenantSlug: string
  stats: {
    contentTypeCount: number
    mediaCount: number
    memberCount: number
    apiTokenCount: number
    totalEntries: number
  }
}

export function OnboardingChecklist({ tenantSlug, stats }: OnboardingChecklistProps) {
  const steps = useMemo(() => [
    {
      id: "schema",
      title: "Define your data structure",
      description: "Create your first Content Type to start managing data.",
      icon: Database,
      completed: stats.contentTypeCount > 0,
      href: `/dashboard/${tenantSlug}/content-types`
    },
    {
      id: "media",
      title: "Setup your media library",
      description: "Upload images or files to use in your content.",
      icon: ImageIcon,
      completed: stats.mediaCount > 0,
      href: `/dashboard/${tenantSlug}/media`
    },
    {
      id: "content",
      title: "Create your first entry",
      description: "Fill in data for the content types you've created.",
      icon: FileText,
      completed: stats.totalEntries > 0,
      href: `/cms/${tenantSlug}`
    },
    {
      id: "team",
      title: "Invite your team",
      description: "Collaborate by adding editors or admins to your workspace.",
      icon: Users,
      completed: stats.memberCount > 1,
      href: `/dashboard/${tenantSlug}/users`
    },
    {
      id: "api",
      title: "Connect via API",
      description: "Generate an API key to consume content in your apps.",
      icon: Key,
      completed: stats.apiTokenCount > 0,
      href: `/dashboard/${tenantSlug}/api-keys`
    }
  ], [tenantSlug, stats])

  const completedCount = steps.filter(s => s.completed).length
  const progress = (completedCount / steps.length) * 100
  const isFinished = completedCount === steps.length

  if (isFinished) return null

  return (
    <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-[2rem] overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
      <CardContent className="p-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left: Progress Info */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight">Complete your Setup</h2>
              <p className="text-indigo-100 text-sm font-medium leading-relaxed">
                Follow these steps to unlock the full potential of SaCMS for your workspace.
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-indigo-200">
                <span>Workspace Readiness</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-400 transition-all duration-1000" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>

            <div className="pt-4">
              <div className="p-4 rounded-2xl bg-white/10 border border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-400 flex items-center justify-center shadow-lg">
                  <PartyPopper className="h-5 w-5 text-emerald-900" />
                </div>
                <p className="text-xs font-bold text-indigo-50">
                  {completedCount} of {steps.length} steps completed
                </p>
              </div>
            </div>
          </div>

          {/* Right: Steps Checklist */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {steps.map((step) => (
              <Link key={step.id} href={step.href}>
                <div className={cn(
                  "p-4 rounded-2xl border transition-all group cursor-pointer h-full",
                  step.completed 
                    ? "bg-white/5 border-emerald-500/30 opacity-60" 
                    : "bg-white/10 border-white/10 hover:bg-white/20 hover:border-white/30"
                )}>
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      step.completed ? "bg-emerald-500 text-white" : "bg-indigo-500 text-white"
                    )}>
                      {step.completed ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className={cn("text-sm font-black", step.completed && "line-through text-indigo-200")}>
                        {step.title}
                      </p>
                      <p className="text-[10px] font-medium text-indigo-100 leading-tight">
                        {step.description}
                      </p>
                    </div>
                    {!step.completed && (
                      <ArrowRight className="h-4 w-4 text-white/40 group-hover:translate-x-1 transition-transform" />
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
