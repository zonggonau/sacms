"use client"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles,
  Loader2,
  Zap,
  ArrowUp,
  Cpu,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  History,
  Square,
  Code2,
  Monitor,
  LayoutGrid,
  FileCode,
  Check,
  User,
  Bot,
  Copy,
  ExternalLink,
  RotateCcw,
  Brain,
  Database,
  Layers,
  ShieldCheck,
  CircleDot,
  CircleCheck,
  CircleAlert,
  CircleDashed,
  FileText,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { AiModelConfig } from "@/lib/ai/model-registry"
import { ModelPicker } from "./model-picker"
import { FrameworkPicker } from "./framework-picker"
import { type FrameworkId, getFrameworkConfig } from "@/lib/ai/framework-registry"
import type { AgentPhaseId, AgentPhaseStatus } from "@/lib/ai/agent-types"

export interface ChatArtifact {
  title: string
  files: Array<{ name: string; description?: string }>
  version?: number
  framework?: FrameworkId
}

export interface ChatMessage {
  id?: string
  role: "user" | "assistant"
  content: string
  reasoning?: string
  artifact?: ChatArtifact
  createdAt?: Date | string
}

/** Live agent phase state for the timeline */
export interface AgentPhaseState {
  phaseId: AgentPhaseId
  status: AgentPhaseStatus
  message: string
  details?: string
  itemsProcessed?: number
}

/** Structured Application Plan from the Planner phase */
export interface ApplicationPlanSummary {
  projectName: string
  summary: string
  domain: string
  framework: string
  contentTypeCount: number
  singleTypeCount: number
  pageCount: number
  designNotes: string
}

interface VersionEntry {
  version: number
  prompt: string
  timestamp: string
}

interface ChatPanelProps {
  tenantSlug: string
  messages: ChatMessage[]
  isLoading: boolean
  loadingStep: string
  iterationPrompt: string
  onIterationPromptChange: (prompt: string) => void
  onIterate: (prompt?: string) => void
  onStop?: () => void
  reasoningText?: string
  creditsRemaining: number
  isUnlimited: boolean
  models: AiModelConfig[]
  selectedModelId: string
  onSelectModel: (modelId: string) => void
  hasUpgradedPlan: boolean
  versionHistory: VersionEntry[]
  activeVersionNumber: number
  onSelectVersion: (version: number) => void
  /** Agentic reasoning steps visibility */
  isReasoningOpen: boolean
  onToggleReasoning: () => void
  /** Quick iteration suggestions */
  quickSuggestions: Array<{ label: string; prompt: string }>
  /** Quick switch to viewer tab */
  onSelectTab?: (tab: "preview" | "code" | "console", fileIndex?: number) => void
  /** Current user metadata */
  currentUser?: {
    name: string
    email?: string
    image?: string | null
  }
  /** Selected frontend framework (Next.js, Vite, Astro, Remix, Vue, SvelteKit) */
  selectedFrameworkId?: FrameworkId
  onSelectFramework?: (frameworkId: FrameworkId) => void
  /** Live agent phase timeline */
  agentPhases?: AgentPhaseState[]
  /** Structured application plan from planner phase */
  applicationPlan?: ApplicationPlanSummary | null
}

// ────────────────────────────────────────────────────────────────────────────
// Phase Pipeline Metadata
// ────────────────────────────────────────────────────────────────────────────

const PHASE_META: Record<AgentPhaseId, { label: string; icon: typeof Brain; color: string }> = {
  planning: { label: "Perencanaan", icon: Brain, color: "text-blue-500" },
  schema_provisioning: { label: "Provisi Skema", icon: Database, color: "text-violet-500" },
  data_seeding: { label: "Injeksi Data", icon: Layers, color: "text-amber-500" },
  coding: { label: "Kompilasi Frontend", icon: Code2, color: "text-emerald-500" },
  qa_validation: { label: "Validasi QA", icon: ShieldCheck, color: "text-cyan-500" },
  completed: { label: "Selesai", icon: CheckCircle2, color: "text-emerald-500" },
  error: { label: "Error", icon: XCircle, color: "text-destructive" },
}

function PhaseStatusIcon({ status }: { status: AgentPhaseStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
    case "completed":
      return <CircleCheck className="h-3.5 w-3.5 text-emerald-500" />
    case "skipped":
      return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />
    case "error":
      return <CircleAlert className="h-3.5 w-3.5 text-destructive" />
    default:
      return <CircleDot className="h-3.5 w-3.5 text-muted-foreground/40" />
  }
}

/**
 * Modern Studio Left-Side Chat Panel aligned with Vercel AI SDK standards.
 * Supports:
 * - Clear User & AI sender identities (Avatar, Name, Role badge, Timestamp)
 * - Full Chat History persistence
 * - Real-time Agent Phase Timeline with 5-phase progress indicators
 * - Live Agentic Reasoning stream (thinking tokens)
 * - Stop Generation control (AbortController)
 * - Interactive Generative Artifact Cards with direct jump to Code Viewer & Live Preview
 */
export function ChatPanel({
  tenantSlug,
  messages,
  isLoading,
  loadingStep,
  iterationPrompt,
  onIterationPromptChange,
  onIterate,
  onStop,
  reasoningText,
  creditsRemaining,
  isUnlimited,
  models,
  selectedModelId,
  onSelectModel,
  hasUpgradedPlan,
  versionHistory,
  activeVersionNumber,
  onSelectVersion,
  isReasoningOpen,
  onToggleReasoning,
  quickSuggestions,
  onSelectTab,
  currentUser,
  selectedFrameworkId = "nextjs",
  onSelectFramework,
  agentPhases,
  applicationPlan,
}: ChatPanelProps) {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [copiedMsgId, setCopiedMsgId] = useState<string | number | null>(null)
  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0]

  // Auto-scroll to latest message when message list, reasoning, or loading step changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, isLoading, reasoningText, loadingStep, agentPhases])

  const handleCopy = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text)
    setCopiedMsgId(id)
    setTimeout(() => setCopiedMsgId(null), 2000)
  }

  const formatTime = (date?: Date | string) => {
    if (!date) return ""
    try {
      const d = typeof date === "string" ? new Date(date) : date
      if (isNaN(d.getTime())) return ""
      return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false })
    } catch {
      return ""
    }
  }

  const userInitial = (currentUser?.name || "Anda").charAt(0).toUpperCase()

  // Determine if we have active phase tracking
  const hasActivePhases = agentPhases && agentPhases.length > 0

  return (
    <div className="w-80 lg:w-[360px] border-r border-border/60 flex flex-col min-h-0 h-full bg-card shrink-0 overflow-hidden">
      {/* ── Header: AI Assistant & Model Info ── */}
      <div className="border-b border-border/60 px-3 py-2.5 shrink-0 bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0 shadow-2xs">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
              AI Agent
              {isLoading && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </h3>
            <span className="text-[10px] text-muted-foreground truncate block font-mono">
              {selectedModel.name}
            </span>
          </div>
        </div>

        {/* Reasoning thoughts toggle */}
        <button
          onClick={onToggleReasoning}
          className="flex items-center gap-1 text-[10.5px] px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="Tampilkan / Sembunyikan Proses Berpikir Agen"
        >
          <Cpu className={cn("h-3 w-3", isLoading ? "text-primary animate-pulse" : "")} />
          <span className="hidden sm:inline">Phases</span>
          {isReasoningOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* ── Agent Phase Timeline (replaces static reasoning drawer) ── */}
      {isReasoningOpen && (
        <div className="border-b border-border/60 px-3 py-2.5 shrink-0 bg-muted/20 space-y-1.5 max-h-64 overflow-y-auto">
          {hasActivePhases ? (
            <>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-primary" />
                Agent Pipeline
              </div>

              {/* Phase Steps */}
              <div className="space-y-0.5">
                {agentPhases!.map((phase, idx) => {
                  const meta = PHASE_META[phase.phaseId] || PHASE_META.completed
                  const PhaseIcon = meta.icon

                  return (
                    <div
                      key={phase.phaseId}
                      className={cn(
                        "flex items-start gap-2 px-2 py-1.5 rounded-lg transition-all text-[11px]",
                        phase.status === "running" && "bg-primary/5 border border-primary/15",
                        phase.status === "completed" && "opacity-80",
                        phase.status === "pending" && "opacity-40"
                      )}
                    >
                      {/* Status Icon with Connector Line */}
                      <div className="flex flex-col items-center shrink-0 pt-0.5">
                        <PhaseStatusIcon status={phase.status} />
                        {idx < agentPhases!.length - 1 && (
                          <div
                            className={cn(
                              "w-px h-3 mt-0.5",
                              phase.status === "completed" ? "bg-emerald-500/30" : "bg-border"
                            )}
                          />
                        )}
                      </div>

                      {/* Phase Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <PhaseIcon className={cn("h-3 w-3 shrink-0", meta.color)} />
                          <span className={cn(
                            "font-semibold truncate",
                            phase.status === "running" ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {meta.label}
                          </span>
                          {phase.itemsProcessed && phase.itemsProcessed > 0 && (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 font-mono">
                              {phase.itemsProcessed}
                            </Badge>
                          )}
                        </div>
                        {phase.message && phase.status !== "pending" && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">
                            {phase.message}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Application Plan Card (shown after planner phase completes) */}
              {applicationPlan && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 mt-1.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                    <FileText className="h-3 w-3" />
                    <span>{applicationPlan.projectName}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {applicationPlan.summary}
                  </p>
                  <div className="flex flex-wrap gap-1 text-[9px]">
                    <Badge variant="outline" className="text-[8px] px-1.5 py-0 border-violet-500/30 text-violet-500 bg-violet-500/10">
                      {applicationPlan.contentTypeCount} Content Types
                    </Badge>
                    <Badge variant="outline" className="text-[8px] px-1.5 py-0 border-amber-500/30 text-amber-500 bg-amber-500/10">
                      {applicationPlan.singleTypeCount} Single Types
                    </Badge>
                    <Badge variant="outline" className="text-[8px] px-1.5 py-0 border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                      {applicationPlan.pageCount} Halaman
                    </Badge>
                  </div>
                </div>
              )}
            </>
          ) : reasoningText ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 space-y-1 font-mono text-[10.5px] max-h-36 overflow-y-auto">
              <div className="flex items-center gap-1 text-primary text-[10px] font-bold">
                <Sparkles className="h-3 w-3" />
                <span>Pemikiran Model ({selectedModel.name}):</span>
              </div>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {reasoningText}
              </p>
            </div>
          ) : (
            <div className="space-y-1 text-[10.5px] text-muted-foreground">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                <Sparkles className="h-3 w-3 text-primary" />
                Agent Pipeline — Menunggu Instruksi
              </div>
              {(["planning", "schema_provisioning", "data_seeding", "coding", "qa_validation"] as AgentPhaseId[]).map((id) => {
                const meta = PHASE_META[id]
                const Icon = meta.icon
                return (
                  <div key={id} className="flex items-center gap-2 px-2 py-1 opacity-40">
                    <CircleDot className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    <Icon className={cn("h-3 w-3 shrink-0", meta.color)} />
                    <span className="text-[10.5px]">{meta.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Chat Messages Stream (History & Active Turns) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 space-y-4 overscroll-contain">
        {messages.length === 0 && (
          <div className="space-y-2 text-[12px] text-muted-foreground bg-muted/30 p-3.5 rounded-xl border border-border/60">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <Sparkles className="h-3 w-3" />
              </div>
              <span>SaCMS Agentic AI Studio</span>
            </div>
            <p className="leading-relaxed text-[11.5px]">
              AI Agent akan menjalankan 5 fase secara otomatis: Perencanaan → Provisi Skema → Injeksi Data → Kompilasi Frontend → Validasi QA. Tuliskan instruksi website Anda di bawah.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === "user"
          const msgKey = msg.id || i

          return (
            <div key={msgKey} className="flex gap-2.5 items-start group">
              {/* Avatar */}
              {isUser ? (
                <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {userInitial}
                </div>
              ) : (
                <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
              )}

              {/* Message Body & Header */}
              <div className="flex-1 min-w-0 space-y-1">
                {/* Sender Title Bar */}
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-foreground truncate">
                    {isUser ? currentUser?.name || "Anda" : selectedModel.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] px-1.5 py-0 rounded font-mono font-normal",
                      isUser
                        ? "bg-muted text-muted-foreground border-border/80"
                        : "bg-primary/10 text-primary border-primary/20"
                    )}
                  >
                    {isUser ? "Pengirim" : "AI Agent"}
                  </Badge>
                  {msg.createdAt && (
                    <span
                      className="text-[10px] text-muted-foreground/60 ml-auto shrink-0 font-mono"
                      suppressHydrationWarning
                    >
                      {formatTime(msg.createdAt)}
                    </span>
                  )}
                </div>

                {/* Reasoning Thought Collapsible (if message contains thinking) */}
                {msg.reasoning && (
                  <details className="text-[10.5px] rounded-lg border border-primary/20 bg-primary/5 p-2 space-y-1 cursor-pointer">
                    <summary className="font-semibold text-primary select-none flex items-center gap-1">
                      <Cpu className="h-3 w-3" />
                      <span>Pemikiran Model ({msg.reasoning.length} karakter)</span>
                    </summary>
                    <p className="mt-1 text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {msg.reasoning}
                    </p>
                  </details>
                )}

                {/* Conversational Text Bubble */}
                {msg.content && (
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-[12px] leading-relaxed break-words shadow-2xs transition-all",
                      isUser
                        ? "bg-primary/10 border border-primary/20 text-foreground rounded-tr-xs"
                        : "bg-background border border-border/80 text-foreground/90 rounded-tl-xs"
                    )}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                )}

                {/* Interactive Generative Artifact Card */}
                {msg.artifact && (
                  <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2 shadow-xs mt-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                          <LayoutGrid className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-foreground block">
                            {msg.artifact.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {msg.artifact.files.length} berkas {msg.artifact.framework ? getFrameworkConfig(msg.artifact.framework).shortName : "Next.js 16"}
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0.5 border border-primary/20">
                        {msg.artifact.framework ? getFrameworkConfig(msg.artifact.framework).shortName : "Kompilasi Siap"}
                      </Badge>
                    </div>

                    {/* File list pills */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {msg.artifact.files.slice(0, 6).map((file, fIdx) => (
                        <button
                          key={fIdx}
                          type="button"
                          onClick={() => onSelectTab?.("code", fIdx)}
                          className="px-2 py-0.5 rounded-md bg-background border border-border/70 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center gap-1 cursor-pointer"
                          title={`Buka ${file.name} di Code Viewer`}
                        >
                          <FileCode className="h-2.5 w-2.5 text-primary" />
                          <span className="truncate max-w-[130px]">{file.name}</span>
                        </button>
                      ))}
                      {msg.artifact.files.length > 6 && (
                        <span className="text-[10px] text-muted-foreground self-center px-1">
                          +{msg.artifact.files.length - 6} lainnya
                        </span>
                      )}
                    </div>

                    {/* Direct Action triggers */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectTab?.("preview")}
                        className="h-6.5 text-[11px] gap-1 px-2 rounded-md border-border/80 cursor-pointer hover:bg-primary/10"
                      >
                        <Monitor className="h-3 w-3 text-primary" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelectTab?.("code")}
                        className="h-6.5 text-[11px] gap-1 px-2 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <Code2 className="h-3 w-3" />
                        Buka Kode
                      </Button>
                    </div>
                  </div>
                )}

                {/* Message Actions (Copy & Quick re-use) */}
                <div className="flex items-center gap-2 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.content, msgKey)}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                    title="Salin teks pesan"
                  >
                    {copiedMsgId === msgKey ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-500 font-medium">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {/* ── Live Streaming Agent Card (when AI is working) ── */}
        {isLoading && (
          <div className="flex gap-2.5 items-start animate-in fade-in-50 duration-200">
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xs relative">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-ping" />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-semibold text-xs text-foreground">
                  {selectedModel.name}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Sedang Mengerjakan...
                </span>
              </div>

              {/* Progress Stage Tracker — now reads from agentPhases */}
              <div className="rounded-xl border border-primary/25 bg-muted/40 p-2.5 space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                  <span className="truncate">
                    {loadingStep || "AI Agent sedang menjalankan pipeline agentic..."}
                  </span>
                </div>

                {/* Show active phase sub-steps if available */}
                {hasActivePhases && (
                  <div className="pl-5 space-y-1 text-[10px] text-muted-foreground">
                    {agentPhases!.filter((p) => p.status === "completed" || p.status === "running").slice(-3).map((phase) => {
                      const meta = PHASE_META[phase.phaseId]
                      return (
                        <div key={phase.phaseId} className="flex items-center gap-1.5">
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            phase.status === "completed" ? "bg-emerald-500" : "bg-primary animate-pulse"
                          )} />
                          <span>{meta?.label}: {phase.message}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {!hasActivePhases && (
                  <div className="pl-5 space-y-1 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Inspeksi context SaCMS MCP Server</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                      <span>Streaming modul & layout App Router</span>
                    </div>
                  </div>
                )}

                {onStop && (
                  <div className="pt-1 border-t border-border/40 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onStop}
                      className="h-6 text-[10.5px] gap-1 px-2 text-destructive hover:bg-destructive/10 border-destructive/30 rounded-md cursor-pointer"
                    >
                      <Square className="h-2.5 w-2.5 fill-current" />
                      Hentikan
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Version History trail */}
        {versionHistory.length > 1 && (
          <div className="border-t border-border/60 pt-2 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block px-1">
              Riwayat Versi Proyek:
            </span>
            {versionHistory.map((ver) => (
              <button
                key={ver.version}
                onClick={() => onSelectVersion(ver.version)}
                className={cn(
                  "flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer",
                  activeVersionNumber === ver.version
                    ? "bg-muted text-foreground font-medium border border-border/80"
                    : "text-muted-foreground hover:bg-muted/60"
                )}
              >
                <History className="h-3 w-3 shrink-0" />
                <span className="truncate flex-1">
                  v{ver.version} — {ver.prompt.substring(0, 36)}
                  {ver.prompt.length > 36 ? "…" : ""}
                </span>
                <span className="text-[9.5px] opacity-60 font-mono">{ver.timestamp}</span>
              </button>
            ))}
          </div>
        )}

        {/* Out of credit banner */}
        {!isUnlimited && creditsRemaining <= 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
            <div className="space-y-1">
              <h4 className="text-[12px] font-bold text-destructive">Credit AI Habis</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Tambahkan credit untuk melanjutkan generasi atau iterasi website.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions`)}
              className="w-full h-7 text-xs font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
            >
              Tambah Credit
            </Button>
          </div>
        )}

        <div ref={messagesEndRef} className="h-px" />
      </div>

      {/* ── Quick Iteration Chips ── */}
      <div className="p-2 border-t border-border/60 shrink-0 overflow-x-auto bg-card">
        <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
          {quickSuggestions.map((item, idx) => (
            <button
              key={idx}
              onClick={() => onIterate(item.prompt)}
              disabled={isLoading || (creditsRemaining < 5 && !isUnlimited)}
              className="px-2.5 py-1 rounded-full bg-muted/60 border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 text-[10px] font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Follow-up Prompt Composer ── */}
      <div className="p-3 border-t border-border/60 shrink-0 space-y-2 bg-card">
        {/* Model & Framework Selectors outside Textarea */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <ModelPicker
              models={models}
              selectedModelId={selectedModelId}
              onSelectModel={onSelectModel}
              hasUpgradedPlan={hasUpgradedPlan}
              disabled={isLoading}
            />

            {onSelectFramework && (
              <FrameworkPicker
                selectedFrameworkId={selectedFrameworkId}
                onSelectFramework={onSelectFramework}
                disabled={isLoading}
              />
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0">
            <Zap className="h-3 w-3 text-amber-500" />
            <span>{isUnlimited ? "Unlimited" : `${creditsRemaining.toLocaleString()} CR`}</span>
          </div>
        </div>

        {/* Textarea container */}
        <div className="relative rounded-xl border border-border/80 bg-background focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 transition-all">
          <Textarea
            value={iterationPrompt}
            onChange={(e) => onIterationPromptChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (iterationPrompt.trim() && !isLoading) {
                  onIterate()
                }
              }
            }}
            placeholder="Ketik revisi (misal: 'Tambahkan dark mode' atau 'Hubungkan SaCMS API')..."
            className="min-h-[64px] max-h-32 resize-none border-0 bg-transparent text-xs p-2.5 focus-visible:ring-0 focus-visible:ring-offset-0 leading-relaxed placeholder:text-muted-foreground/60"
            disabled={isLoading}
          />

          <div className="flex items-center justify-between p-2 pt-0">
            <span className="text-[10px] text-muted-foreground/60">
              Shift + Enter untuk baris baru
            </span>

            {isLoading ? (
              <Button
                type="button"
                size="icon"
                onClick={onStop}
                className="h-7 w-7 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer shadow-xs animate-pulse"
                title="Hentikan respons model"
              >
                <Square className="h-3 w-3 fill-current" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={() => onIterate()}
                disabled={!iterationPrompt.trim() || (!isUnlimited && creditsRemaining < 5)}
                className="h-7 w-7 rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 cursor-pointer shadow-xs"
                title="Kirim revisi"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

