"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Check,
  ChevronDown,
  Layers,
  Sparkles,
  Server,
  Zap,
  Globe,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  FRAMEWORK_REGISTRY,
  type FrameworkId,
  type FrameworkConfig,
  getFrameworkConfig,
} from "@/lib/ai/framework-registry"

interface FrameworkPickerProps {
  selectedFrameworkId: FrameworkId
  onSelectFramework: (frameworkId: FrameworkId) => void
  recommendedFrameworkId?: FrameworkId
  disabled?: boolean
  compact?: boolean
}

export function FrameworkPicker({
  selectedFrameworkId,
  onSelectFramework,
  recommendedFrameworkId,
  disabled = false,
  compact = false,
}: FrameworkPickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentFramework = useMemo(
    () => getFrameworkConfig(selectedFrameworkId),
    [selectedFrameworkId]
  )

  const handleSelect = (fwId: FrameworkId) => {
    onSelectFramework(fwId)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-border/80 bg-background hover:bg-muted text-xs font-medium text-foreground transition-all cursor-pointer shadow-2xs hover:border-primary/40",
            compact ? "h-7 pl-2 pr-1.5 text-[10px]" : "h-8 pl-2.5 pr-2",
            disabled && "opacity-50 pointer-events-none cursor-not-allowed"
          )}
          title={`Framework Frontend: ${currentFramework.name} (${currentFramework.vercelSupport})`}
        >
          <span className="text-xs shrink-0">{currentFramework.icon}</span>
          <span className={cn("font-medium", compact ? "max-w-[85px] truncate" : "max-w-[120px] truncate")}>
            {currentFramework.shortName}
          </span>
          <ChevronDown
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden border border-border/80 shadow-2xl bg-card">
        <DialogHeader className="p-4 pb-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold flex items-center gap-2">
                  Pilih Framework Frontend
                  <Badge variant="outline" className="text-[10px] font-normal py-0 h-4 border-primary/30 text-primary">
                    Vercel Ready
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  AI Website Builder akan menyusun struktur folder, skrip build, dan API client SaCMS sesuai framework pilihan Anda.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Framework Grid */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[70vh] overflow-y-auto">
          {FRAMEWORK_REGISTRY.map((fw) => {
            const isSelected = fw.id === selectedFrameworkId
            const isRecommended = fw.id === recommendedFrameworkId

            return (
              <div
                key={fw.id}
                onClick={() => handleSelect(fw.id)}
                className={cn(
                  "relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer text-left select-none group",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                    : "border-border/70 bg-background hover:bg-muted/40 hover:border-border"
                )}
              >
                {/* Header: Icon + Name + Vercel Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">{fw.icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {fw.name}
                        </span>
                        {isRecommended && (
                          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-semibold flex items-center gap-0.5">
                            <Sparkles className="h-2.5 w-2.5" />
                            Rekomendasi
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground block font-mono">
                        {fw.category} • {fw.buildOutputDirectory}/
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Badge
                      variant="secondary"
                      className="text-[9px] font-mono px-1.5 py-0 h-4 bg-muted/80 text-muted-foreground border-border/50"
                    >
                      ▲ Vercel {fw.vercelSupport}
                    </Badge>
                    {isSelected && (
                      <div className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                  {fw.description}
                </p>

                {/* Recommended For Pills */}
                <div className="mt-2.5 flex flex-wrap gap-1 pt-1 border-t border-border/40">
                  {fw.recommendedFor.slice(0, 3).map((rec, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded bg-muted text-[9px] text-muted-foreground"
                    >
                      {rec}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-muted/20 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Server className="h-3 w-3 text-primary" />
            <span>Seluruh kode yang dihasilkan kompatibel 100% untuk deployment langsung ke Vercel.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
