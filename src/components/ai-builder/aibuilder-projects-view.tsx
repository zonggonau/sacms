"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Sparkles,
  Search,
  ExternalLink,
  Plus,
  Globe,
  Clock,
  Code2,
  Database,
  ArrowRight,
  Monitor,
  Layers,
  LayoutDashboard,
  CheckCircle2,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AiProjectItem } from "./aibuilder-sidebar"

interface AibuilderProjectsViewProps {
  projects: AiProjectItem[]
  onOpenProject: (slug: string) => void
  onNewProject: () => void
}

export function AibuilderProjectsView({
  projects = [],
  onOpenProject,
  onNewProject,
}: AibuilderProjectsViewProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "draft">("all")

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.prompt && p.prompt.toLowerCase().includes(searchQuery.toLowerCase()))

      if (!matchesSearch) return false

      if (statusFilter === "ready") {
        return Boolean(p.previewUrl || p.v0ChatId)
      }
      if (statusFilter === "draft") {
        return !p.previewUrl && !p.v0ChatId
      }
      return true
    })
  }, [projects, searchQuery, statusFilter])

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return "-"
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    } catch {
      return isoStr
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Koleksi Website AI</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Semua Proyek &amp; Website
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">
            Total {projects.length} website telah dirancang dan dibangun dengan SaCMS v0 Studio.
          </p>
        </div>

        <Button
          onClick={onNewProject}
          className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Website Baru</span>
        </Button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama website atau prompt..."
            className="h-9 pl-9 pr-4 rounded-xl text-xs bg-card/60 border-border/80 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0",
              statusFilter === "all"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-muted/70"
            )}
          >
            Semua ({projects.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ready")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0",
              statusFilter === "ready"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-muted/70"
            )}
          >
            Siap Preview
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("draft")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0",
              statusFilter === "draft"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-muted/70"
            )}
          >
            Draft
          </button>
        </div>
      </div>

      {/* Project Grid */}
      {filteredProjects.length === 0 ? (
        <div className="py-16 px-6 text-center rounded-3xl bg-card/40 border border-dashed border-border/80 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary mx-auto flex items-center justify-center">
            <Globe className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-foreground">
              {searchQuery ? "Tidak ada proyek yang sesuai" : "Belum Ada Proyek Website"}
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              {searchQuery
                ? `Tidak ditemukan proyek dengan kata kunci "${searchQuery}". Coba kata kunci lain.`
                : "Mulai buat website pertama Anda dengan mengetikkan prompt ide website pada AI Builder Studio."}
            </p>
          </div>
          <Button
            onClick={onNewProject}
            className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Mulai Buat Website</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => {
            const hasPreview = Boolean(p.previewUrl || p.v0ChatId)
            const isLiveHosted = Boolean(
              p.previewUrl?.includes(".vercel.app") || p.previewUrl?.includes(".v0.build")
            )

            return (
              <div
                key={p.id}
                className="group rounded-3xl bg-card/60 hover:bg-card/90 border border-border/70 hover:border-primary/40 transition-all duration-300 shadow-xs hover:shadow-xl hover:shadow-primary/5 flex flex-col justify-between overflow-hidden"
              >
                {/* Mock Browser Header */}
                <div className="p-3 bg-muted/40 border-b border-border/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="flex-1 mx-2 px-2.5 py-1 rounded-lg bg-background/70 border border-border/60 text-[10px] text-muted-foreground truncate font-mono text-center">
                    https://{p.slug}.sacms.cloud
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[9px] font-bold px-1.5 py-0.5 border-primary/30 text-primary uppercase"
                  >
                    {p.plan}
                  </Badge>
                </div>

                {/* Card Visual Banner / Preview Mockup */}
                <div
                  onClick={() => onOpenProject(p.slug)}
                  className="relative h-36 bg-gradient-to-br from-primary/10 via-background to-blue-500/5 flex items-center justify-center p-4 cursor-pointer overflow-hidden border-b border-border/40 group-hover:from-primary/15 transition-all"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

                  <div className="relative z-10 text-center space-y-2 p-3 rounded-2xl bg-card/80 backdrop-blur-md border border-border/70 max-w-[85%] shadow-xs group-hover:scale-105 transition-transform duration-300">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-foreground">
                      <Monitor className="w-4 h-4 text-primary" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5",
                          hasPreview
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {hasPreview ? (isLiveHosted ? "Live Vercel" : "Siap Preview") : "Draft"}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {p.model || "v0-pro"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        onClick={() => onOpenProject(p.slug)}
                        className="text-base font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer line-clamp-1"
                      >
                        {p.name}
                      </h3>
                    </div>

                    <p className="text-xs text-muted-foreground font-medium line-clamp-2 leading-relaxed">
                      {p.prompt || "Website interaktif Next.js 16 full-stack bertenaga SaCMS headless CMS."}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(p.createdAt)}
                    </span>
                    <span className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded-md text-muted-foreground">
                      {p.slug}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="p-3 bg-muted/30 border-t border-border/60 flex items-center gap-2">
                  <Button
                    onClick={() => onOpenProject(p.slug)}
                    className="flex-1 h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Buka di AI Builder</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>

                  {p.previewUrl && (
                    <Button
                      asChild
                      variant="outline"
                      size="icon"
                      title="Buka Live Preview"
                      className="h-9 w-9 rounded-xl border-border/80 hover:border-primary/40 hover:bg-muted"
                    >
                      <a href={p.previewUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  )}

                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    title="Buka CMS Studio"
                    className="h-9 w-9 rounded-xl border-border/80 hover:border-primary/40 hover:bg-muted"
                  >
                    <Link href={`/dashboard/${p.slug}/cms`}>
                      <Database className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
