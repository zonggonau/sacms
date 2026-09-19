"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Layers,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Clock,
  ChevronRight,
  Zap,
  Globe,
  LayoutDashboard,
  ExternalLink,
  Code2,
  Folder,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/utils"

export interface AiProjectItem {
  id: string
  tenantId: string
  name: string
  slug: string
  plan: string
  status: string
  prompt?: string | null
  previewUrl?: string | null
  v0ChatId?: string | null
  model?: string | null
  createdAt: string
  updatedAt: string
}

interface AiBuilderSidebarProps {
  activeView: "builder" | "projects"
  onSelectView: (view: "builder" | "projects") => void
  projects: AiProjectItem[]
  activeTenantSlug: string
  credits: {
    remaining: number
    total: number
    isUnlimited: boolean
  }
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string | null
  }
  isCollapsed: boolean
  onToggleCollapse: () => void
  onNewProject: () => void
  onSelectProject: (slug: string) => void
}

export function AiBuilderSidebar({
  activeView,
  onSelectView,
  projects = [],
  activeTenantSlug,
  credits,
  user,
  isCollapsed,
  onToggleCollapse,
  onNewProject,
  onSelectProject,
}: AiBuilderSidebarProps) {
  const router = useRouter()
  const isDeveloper =
    user.role === "developer" ||
    user.role === "super_admin" ||
    user.role === "owner" ||
    user.role === "admin"

  const userInitial = (user.name || user.email || "U").charAt(0).toUpperCase()
  const recentProjects = projects.slice(0, 6)

  if (isCollapsed) {
    return (
      <aside className="w-16 border-r border-border/70 bg-card/95 backdrop-blur-xl flex flex-col items-center py-4 px-2 select-none shrink-0 transition-all duration-300 z-30 justify-between">
        <div className="flex flex-col items-center gap-4 w-full">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Buka Sidebar"
            className="w-10 h-10 rounded-xl hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <PanelLeft className="w-5 h-5" />
          </button>

          <Button
            size="icon"
            onClick={onNewProject}
            title="Buat Proyek Baru"
            className="w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </Button>

          <div className="w-8 h-px bg-border/70 my-1" />

          <button
            type="button"
            onClick={() => onSelectView("builder")}
            title="AI Builder Studio"
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer",
              activeView === "builder"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            )}
          >
            <Sparkles className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => onSelectView("projects")}
            title={`Semua Proyek (${projects.length})`}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer relative",
              activeView === "projects"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            )}
          >
            <Folder className="w-5 h-5" />
            {projects.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            )}
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 w-full">
          <div
            title={credits.isUnlimited ? "Kredit: Unlimited" : `Kredit: ${credits.remaining}`}
            className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-xs font-bold"
          >
            <Zap className="w-4 h-4 fill-amber-500" />
          </div>

          <div
            title={`${user.name || user.email} (${user.role || "user"})`}
            className="w-9 h-9 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center text-xs font-black shadow-xs"
          >
            {userInitial}
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-64 sm:w-72 border-r border-border/70 bg-card/95 backdrop-blur-xl flex flex-col justify-between py-4 px-3.5 select-none shrink-0 transition-all duration-300 z-30 h-full overflow-hidden shadow-xs">
      {/* Top Header & New Project Button */}
      <div className="space-y-4 overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-1">
          <Link href="/" className="flex items-center gap-2 font-black text-sm text-foreground group">
            <Logo className="h-6 w-auto" />
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              v0 Studio
            </span>
          </Link>

          <button
            type="button"
            onClick={onToggleCollapse}
            title="Tutup Sidebar"
            className="p-1.5 rounded-lg hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Action: New Project Button */}
        <Button
          onClick={onNewProject}
          className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
        >
          <Plus className="w-4 h-4" />
          <span>Proyek Baru</span>
        </Button>

        {/* Navigation Menu (AI Builder vs Projects) */}
        <div className="space-y-1 pt-1">
          <button
            type="button"
            onClick={() => onSelectView("builder")}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeView === "builder"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4" />
              <span>AI Builder Studio</span>
            </div>
            {activeView === "builder" && (
              <span className="w-2 h-2 rounded-full bg-primary-foreground/90" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectView("projects")}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeView === "projects"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Folder className="w-4 h-4" />
              <span>Semua Proyek</span>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                activeView === "projects"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {projects.length}
            </Badge>
          </button>
        </div>

        {/* Recent Projects Section */}
        <div className="flex-1 overflow-hidden flex flex-col pt-3 min-h-0">
          <div className="flex items-center justify-between px-2 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Proyek Terkini
            </span>
            <button
              type="button"
              onClick={() => onSelectView("projects")}
              className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
            >
              Lihat Semua
            </button>
          </div>

          <div className="overflow-y-auto space-y-1 pr-1 flex-1 scrollbar-thin">
            {recentProjects.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-muted/20 border border-dashed border-border/60">
                <p className="text-xs text-muted-foreground font-medium">Belum ada proyek dibuat</p>
                <button
                  type="button"
                  onClick={onNewProject}
                  className="text-[11px] font-bold text-primary hover:underline mt-1 cursor-pointer block mx-auto"
                >
                  + Buat sekarang
                </button>
              </div>
            ) : (
              recentProjects.map((p) => {
                const isActive = activeTenantSlug === p.slug
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectProject(p.slug)}
                    className={cn(
                      "w-full text-left p-2 rounded-xl text-xs transition-all flex items-center justify-between group cursor-pointer",
                      isActive && activeView === "builder"
                        ? "bg-primary/10 border border-primary/30 text-foreground font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <div className="overflow-hidden pr-2">
                      <p className="truncate font-semibold group-hover:text-primary transition-colors">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {p.slug}.sacms.cloud
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer / Account / Credits / Navigation */}
      <div className="pt-3 border-t border-border/70 space-y-2.5">
        {/* Credits Status */}
        <div className="p-2.5 rounded-xl bg-muted/40 border border-border/70 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span className="font-bold text-foreground">Saldo AI:</span>
          </div>
          <span className="text-xs font-black text-amber-600 dark:text-amber-400">
            {credits.isUnlimited ? "Unlimited" : `${credits.remaining} Kredit`}
          </span>
        </div>

        {/* User Card */}
        <div className="p-2 rounded-xl bg-card/60 border border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/25 text-primary flex items-center justify-center text-xs font-black shrink-0">
              {userInitial}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-foreground truncate">
                {user.name || user.email?.split("@")[0] || "User"}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize truncate">
                {user.role === "developer" ? "Developer" : user.role === "super_admin" ? "Super Admin" : "AI Creator"}
              </p>
            </div>
          </div>

          {isDeveloper && (
            <Link
              href="/dashboard"
              title="Ke Dashboard Developer"
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </aside>
  )
}
