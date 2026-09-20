"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  ChevronRight,
  Sparkles,
  ArrowRight,
  Zap,
  ShieldAlert,
  Search,
  Cpu,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AiModelConfig, AiProviderId } from "@/lib/ai/model-registry"

interface ModelPickerProps {
  models: AiModelConfig[]
  selectedModelId: string
  onSelectModel: (modelId: string) => void
  hasUpgradedPlan?: boolean
  /** Whether the picker shows in a compact inline mode (inside composer) */
  compact?: boolean
}

interface ProviderMeta {
  id: AiProviderId
  name: string
  icon: string
  tagline: string
}

const PROVIDERS: ProviderMeta[] = [
  { id: "google", name: "Google", icon: "🔵", tagline: "Gemini 2.5 / 2.0 / 1.5" },
  { id: "anthropic", name: "Claude", icon: "🟤", tagline: "Claude 3.7 / 3.5 / Opus" },
  { id: "openai", name: "OpenAI", icon: "🟢", tagline: "GPT-4o / o3-mini / o1" },
  { id: "deepseek", name: "DeepSeek", icon: "🟣", tagline: "V3 / R1 Reasoner" },
  { id: "groq", name: "Groq LPU", icon: "⚡", tagline: "Llama 3.3 / 300+ t/s" },
  { id: "mistral", name: "Mistral", icon: "🟠", tagline: "Codestral / Large 2" },
  { id: "xai", name: "xAI (Grok)", icon: "⬛", tagline: "Grok 2 / Vision" },
  { id: "openrouter", name: "OpenRouter", icon: "🌐", tagline: "Auto SOTA / Qwen 72B" },
]

/**
 * Enterprise Multi-Provider AI Model Selector Dialog
 *
 * Rendered using a Radix UI Portal Dialog to ensure the modal opens
 * completely OUTSIDE any narrow sidebar, chat drawer, or overflow-hidden
 * composer textarea.
 */
export function ModelPicker({
  models,
  selectedModelId,
  onSelectModel,
  hasUpgradedPlan = false,
  compact = false,
}: ModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0]

  // Track active provider on the left pane
  const [activeProvider, setActiveProvider] = useState<AiProviderId>(
    (selectedModel?.provider as AiProviderId) || "google"
  )

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, AiModelConfig[]> = {}
    for (const p of PROVIDERS) {
      grouped[p.id] = []
    }
    for (const model of models) {
      if (!grouped[model.provider]) {
        grouped[model.provider] = []
      }
      grouped[model.provider].push(model)
    }
    return grouped
  }, [models])

  // Filter providers with models
  const availableProviders = useMemo(() => {
    return PROVIDERS.filter((p) => (modelsByProvider[p.id]?.length || 0) > 0)
  }, [modelsByProvider])

  // Active models (filtered by search if query exists)
  const displayedModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (query) {
      return models.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query) ||
          m.provider.toLowerCase().includes(query) ||
          (m.badge && m.badge.toLowerCase().includes(query))
      )
    }
    return modelsByProvider[activeProvider] || []
  }, [models, modelsByProvider, activeProvider, searchQuery])

  const activeProviderMeta =
    availableProviders.find((p) => p.id === activeProvider) || availableProviders[0] || PROVIDERS[0]

  const handleSelectModel = (modelId: string) => {
    onSelectModel(modelId)
    setIsOpen(false)
    setSearchQuery("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Trigger Button inside composer/header */}
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-border/80 bg-background hover:bg-muted text-xs font-medium text-foreground transition-all cursor-pointer shadow-2xs hover:border-primary/40",
            compact ? "h-7 pl-2 pr-1.5 text-[10px]" : "h-8 pl-2.5 pr-2"
          )}
          title={`Model AI Aktif: ${selectedModel?.name} (${selectedModel?.credits} Credits)`}
        >
          <span className="text-xs shrink-0">{selectedModel?.providerIcon || "🤖"}</span>
          <span className={cn("font-medium", compact ? "max-w-[110px] truncate" : "max-w-[160px] truncate")}>
            {selectedModel?.name}
          </span>
          <ChevronDown
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </DialogTrigger>

      {/* Portal Dialog Modal — rendered outside chat/textarea at body level */}
      <DialogContent className="sm:max-w-3xl md:max-w-4xl p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card gap-0">
        {/* Dialog Header */}
        <div className="px-5 py-3.5 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Katalog Model AI (Vercel AI SDK)
              </DialogTitle>
              <Badge variant="outline" className="text-[10px] font-bold bg-primary/5 text-primary border-primary/20">
                {models.length} Model • {availableProviders.length} Provider
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Didukung <strong>Vercel AI Gateway</strong>: 1 API Key untuk mengakses semua model AI secara terpadu.
            </DialogDescription>
          </div>

          {/* Quick Search Input */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari model (mis: claude, gemini)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs rounded-xl bg-background border-border/80"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Dialog Body */}
        <div className="flex divide-x divide-border/60 h-[460px] max-h-[70vh]">
          {/* ── LEFT PANE: Provider Categories ── */}
          <div className="w-[180px] sm:w-[200px] shrink-0 p-2 space-y-1 bg-muted/15 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-0.5">
              <div className="px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground/80">
                Provider AI ({availableProviders.length})
              </div>

              {availableProviders.map((provider) => {
                const isActive = !searchQuery && activeProvider === provider.id
                const count = modelsByProvider[provider.id]?.length || 0
                const hasCurrentSelection = modelsByProvider[provider.id]?.some(
                  (m) => m.id === selectedModelId
                )

                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => {
                      setActiveProvider(provider.id)
                      setSearchQuery("")
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition-all cursor-pointer group",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-foreground hover:bg-muted/80"
                    )}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-sm shrink-0">{provider.icon}</span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold leading-tight">
                          {provider.name}
                        </div>
                        <div
                          className={cn(
                            "text-[9px] truncate",
                            isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}
                        >
                          {count} Model
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {hasCurrentSelection && (
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isActive ? "bg-primary-foreground" : "bg-primary"
                          )}
                          title="Model aktif berada di provider ini"
                        />
                      )}
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 transition-transform",
                          isActive
                            ? "opacity-100 translate-x-0.5"
                            : "opacity-40 group-hover:opacity-80"
                        )}
                      />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Left pane footer info */}
            <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 text-[10px] text-muted-foreground mt-2 shrink-0 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-foreground text-[10px]">
                <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                Vercel AI Gateway
              </div>
              <p className="text-[9px] leading-relaxed text-muted-foreground">
                1 Kunci API terpadu untuk semua model tanpa restart server.
              </p>
            </div>
          </div>

          {/* ── RIGHT PANE: Models Grid / List ── */}
          <div className="flex-1 flex flex-col min-w-0 bg-card">
            {/* Subheader */}
            <div className="px-4 py-2 border-b border-border/40 bg-muted/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                {searchQuery ? (
                  <>
                    <Search className="h-3.5 w-3.5 text-primary" />
                    <span>Hasil Pencarian: "{searchQuery}"</span>
                  </>
                ) : (
                  <>
                    <span>{activeProviderMeta.icon}</span>
                    <span>{activeProviderMeta.name}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/70" />
                    <span className="text-muted-foreground font-normal">Pilih Model</span>
                  </>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {displayedModels.length} model ditemukan
              </span>
            </div>

            {/* Scrollable Model Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {displayedModels.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">Tidak ada model yang cocok</p>
                  <p className="text-[11px] text-muted-foreground max-w-xs">
                    Coba kata kunci lain atau pilih provider di panel sebelah kiri.
                  </p>
                </div>
              ) : (
                displayedModels.map((model) => {
                  const isSelected = selectedModelId === model.id
                  const isLocked = model.requiresUpgrade && !hasUpgradedPlan

                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        if (isLocked) return
                        handleSelectModel(model.id)
                      }}
                      disabled={isLocked}
                      className={cn(
                        "w-full flex items-start justify-between gap-3 p-3 rounded-xl text-left transition-all group",
                        isSelected
                          ? "bg-primary/10 border-2 border-primary text-foreground shadow-xs"
                          : isLocked
                          ? "opacity-50 cursor-not-allowed bg-muted/20 border border-transparent"
                          : "hover:bg-muted/70 border border-border/50 hover:border-border cursor-pointer"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs shrink-0">{model.providerIcon}</span>
                          <span className={cn("font-bold text-xs", isSelected && "text-primary")}>
                            {model.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({model.id})
                          </span>

                          {model.badge && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-extrabold px-2 py-0 rounded-full shrink-0",
                                model.isPopular
                                  ? "border-primary/40 text-primary bg-primary/10"
                                  : "border-border text-muted-foreground bg-muted/40"
                              )}
                            >
                              {model.badge}
                            </Badge>
                          )}

                          {isLocked && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-bold border-amber-500/40 text-amber-500 bg-amber-500/10 px-2 py-0 rounded-full shrink-0"
                            >
                              PRO PLAN
                            </Badge>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          {model.description}
                        </p>

                        {/* Cost & Capabilities row */}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                            <strong>{model.credits}</strong> kredit awal
                          </span>
                          <span>•</span>
                          <span>+{model.iterationCredits} kredit per iterasi chat</span>
                          {model.providerModelId && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-muted-foreground/80">
                                {model.providerModelId}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Selected Checkmark or Pro Lock */}
                      <div className="shrink-0 pt-0.5">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        ) : isLocked ? (
                          <ShieldAlert className="h-4 w-4 text-amber-500" />
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-border/80 group-hover:border-primary/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Right Pane Footer */}
            <div className="px-4 py-2 border-t border-border/40 bg-muted/15 text-[11px] text-muted-foreground flex items-center justify-between">
              <div>
                Model terpilih: <strong className="text-foreground">{selectedModel?.name}</strong>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Klik model untuk langsung menerapkan
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
