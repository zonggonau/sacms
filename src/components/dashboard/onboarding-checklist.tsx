"use client"

import { useMemo } from "react"
import { 
  CheckCircle2, Circle, ArrowRight, Database, 
  ImageIcon, Sparkles, Users, Key, Rocket
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface OnboardingChecklistProps {
  tenantId: string
  stats: {
    contentTypeCount: number
    mediaCount: number
    memberCount: number
    apiTokenCount: number
    totalEntries: number
  }
}

export function OnboardingChecklist({ tenantId, stats }: OnboardingChecklistProps) {
  const steps = useMemo(() => [
    {
      id: "schemas",
      title: "Create Content Schemas",
      description: "Define the structure for your content collections.",
      isCompleted: stats.contentTypeCount > 0,
      icon: Database,
      href: `/dashboard/${tenantId}/content-types`
    },
    {
      id: "media",
      title: "Upload Assets",
      description: "Add images and files to your media library.",
      isCompleted: stats.mediaCount > 0,
      icon: ImageIcon,
      href: `/dashboard/${tenantId}/media`
    },
    {
      id: "content",
      title: "Publish First Entry",
      description: "Create and publish your first content item in the Studio.",
      isCompleted: stats.totalEntries > 0,
      icon: Sparkles,
      href: `/dashboard/${tenantId}/cms`
    },
    {
      id: "team",
      title: "Invite Your Team",
      description: "Add collaborators to your workspace.",
      isCompleted: stats.memberCount > 1,
      icon: Users,
      href: `/dashboard/${tenantId}/users`
    },
    {
      id: "api",
      title: "Connect via API",
      description: "Generate a token to fetch content in your app.",
      isCompleted: stats.apiTokenCount > 0,
      icon: Key,
      href: `/dashboard/${tenantId}/api-keys`
    }
  ], [tenantId, stats])

  const completedCount = steps.filter(s => s.isCompleted).length
  const progress = (completedCount / steps.length) * 100

  if (progress === 100) return null

  return (
    <div className="bg-card border-none shadow-sm rounded-3xl p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-black uppercase tracking-tight">Quick Start Guide</h3>
          </div>
          <p className="text-sm text-muted-foreground">Follow these steps to launch your content ecosystem.</p>
        </div>
        <div className="flex items-center gap-4 bg-muted/30 px-4 py-2 rounded-2xl">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Overall Progress</p>
            <p className="text-lg font-black text-primary leading-none">{Math.round(progress)}%</p>
          </div>
          <div className="w-24">
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {steps.map((step) => (
          <Link 
            key={step.id} 
            href={step.href}
            className={cn(
              "group relative p-4 rounded-2xl border-2 transition-all flex flex-col h-full",
              step.isCompleted 
                ? "bg-primary/5 border-primary/20" 
                : "bg-card border-muted hover:border-primary/30"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={cn(
                "p-2 rounded-xl",
                step.isCompleted ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
              )}>
                <step.icon className="h-4 w-4" />
              </div>
              {step.isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/30" />
              )}
            </div>
            
            <div className="flex-1 space-y-1">
              <p className={cn("text-xs font-black uppercase tracking-tight", step.isCompleted ? "text-primary" : "text-foreground")}>
                {step.title}
              </p>
              <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                {step.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t flex items-center justify-between group-hover:translate-x-1 transition-transform">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Go to Setup</span>
              <ArrowRight className="h-3 w-3 text-primary/70" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
