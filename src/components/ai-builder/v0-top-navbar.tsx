"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sparkles, Layers, ArrowUpRight, Zap, ArrowLeft } from "lucide-react"
import { DashboardModeSwitcher } from "@/components/dashboard/dashboard-mode-switcher"
import { Logo } from "@/components/ui/logo"

export interface WorkspaceOption {
  id: string
  name: string
  slug: string
  plan: string
}

interface V0TopNavbarProps {
  workspaces: WorkspaceOption[]
  activeTenant: {
    id: string
    name: string
    slug: string
    plan: string
  }
  credits: {
    remaining: number
    total: number
    isUnlimited: boolean
  }
}

export function V0TopNavbar({
  workspaces,
  activeTenant,
  credits,
}: V0TopNavbarProps) {
  const router = useRouter()

  const handleWorkspaceChange = (newSlug: string) => {
    if (newSlug !== activeTenant.slug) {
      router.push(`/aibuilder?workspace=${newSlug}`)
    }
  }

  return (
    <header className="h-14 border-b border-border/70 bg-card/95 backdrop-blur-md px-4 flex items-center justify-between gap-3 shrink-0 z-30">
      {/* Left: Logo & Mode Switcher */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-black text-sm text-foreground">
          <Logo className="h-6 w-auto" />
        </Link>
        <span className="hidden sm:inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
          Studio
        </span>

        <div className="h-4 w-px bg-border/80 hidden sm:block" />

        {/* Mode Switcher: AI Builder vs Developer */}
        <DashboardModeSwitcher currentMode="aibuilder" />
      </div>

      {/* Center: Target Workspace Selector */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-muted-foreground hidden md:inline">
          Workspace:
        </span>
        <Select value={activeTenant.slug} onValueChange={handleWorkspaceChange}>
          <SelectTrigger className="h-8 text-xs font-bold rounded-xl border-border/80 bg-background/80 w-[160px] sm:w-[200px]">
            <SelectValue placeholder="Pilih Workspace" />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.slug || ws.id} className="text-xs font-semibold">
                {ws.name} ({ws.slug})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 capitalize border-primary/30 text-primary bg-primary/5 hidden lg:inline-flex">
          {activeTenant.plan}
        </Badge>
      </div>

      {/* Right: Credits Status & Quick Links */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="h-8 px-2.5 rounded-xl font-bold border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-xs shadow-2xs"
        >
          <Zap className="h-3.5 w-3.5 fill-amber-500" />
          {credits.isUnlimited ? (
            <span>Unlimited</span>
          ) : (
            <span>{credits.remaining} Kredit</span>
          )}
        </Badge>

        <Button asChild size="sm" variant="ghost" className="h-8 px-2.5 text-xs font-bold rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground hidden sm:inline-flex gap-1">
          <Link href={`/cms/${activeTenant.slug}`}>
            <Layers className="h-3.5 w-3.5" />
            <span>CMS Studio</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </header>
  )
}
