"use client"

import { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles, Loader2, Zap, ArrowUp, Plus, Cpu,
  CheckCircle2, ChevronUp, ChevronDown, History,
} from "lucide-react"
import { useRouter } from "next/navigation"
import type { AiModelConfig } from "@/lib/ai/model-registry"
import { ModelPicker } from "./model-picker"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
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
}

/**
 * Left-side chat panel for the AI Builder studio.
 * Shows conversation history, agentic reasoning steps, version history,
 * quick iteration chips, and the follow-up composer.
 */
export function ChatPanel({
  tenantSlug,
  messages,
  isLoading,
  loadingStep,
  iterationPrompt,
  onIterationPromptChange,
  onIterate,
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
}: ChatPanelProps) {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedModel = models.find(m => m.id === selectedModelId) || models[0]

  // Auto-scroll to latest message when count or loading changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, isLoading])

  return (
    <div className="w-80 lg:w-[340px] border-r border-border/60 flex flex-col min-h-0 h-full bg-card shrink-0 overflow-hidden">

      {/* Agentic Reasoning Pipeline */}
      <div className="border-b border-border/60 px-3 py-2 shrink-0">
        <button
          onClick={onToggleReasoning}
          className="flex items-center gap-1.5 w-full text-left text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Cpu className="h-3 w-3 shrink-0" />
          <span className="flex-1">Agentic Reasoning Pipeline</span>
          {isReasoningOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {isReasoningOpen && (
          <div className="mt-2 space-y-1.5 pl-4.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              <span>Analisis Kebutuhan Prompt & Scope</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              <span>Query Skema Database via MCP Server</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              <span>Scaffold Next.js 16 App Router & Tailwind</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              <span>Live Sandbox Verification</span>
            </div>
          </div>
        )}
      </div>

      {/* Commentary Log / Chat History */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 space-y-3.5 overscroll-contain">
        {messages.length === 0 && (
          <p className="text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
            Halo! Saya adalah SaCMS AI Assistant. Ketik kebutuhan website Anda di bawah, dan saya akan otomatis merancang skema database, mock content, serta mengompilasi frontend Next.js App Router.
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="space-y-1">
            {msg.role === "user" ? (
              <div className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide">Anda</div>
            ) : (
              <div className="text-[11px] font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                SaCMS AI
              </div>
            )}
            <div className="text-[13px] leading-relaxed text-foreground/85 whitespace-pre-wrap break-words">
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground py-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-primary" />
            <span>{loadingStep || "Menyesuaikan kode frontend..."}</span>
          </div>
        )}

        {/* Version history */}
        {versionHistory.length > 0 && (
          <div className="space-y-1 pt-1">
            {versionHistory.map((ver) => (
              <button
                key={ver.version}
                onClick={() => onSelectVersion(ver.version)}
                className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                  activeVersionNumber === ver.version
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <History className="h-3 w-3 shrink-0" />
                <span className="truncate flex-1">
                  v{ver.version} — {ver.prompt.substring(0, 40)}{ver.prompt.length > 40 ? "…" : ""}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Out of credit */}
        {!isUnlimited && creditsRemaining <= 0 && (
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2.5">
            <div className="space-y-1">
              <h4 className="text-[13px] font-bold text-foreground">Out of Credit</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Saldo AI Anda habis. Tambahkan credit untuk melanjutkan.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions`)}
              className="w-full h-8 text-xs font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
            >
              Buy Credit
            </Button>
          </div>
        )}

        <div ref={messagesEndRef} className="h-px" />
      </div>

      {/* Quick Iteration Chips */}
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

      {/* Follow-up Composer */}
      <div className="p-3 border-t border-border/60 shrink-0 space-y-1.5 bg-card">
        <div className="rounded-xl border border-border/80 overflow-hidden bg-background">
          <Textarea
            placeholder={creditsRemaining <= 0 && !isUnlimited ? "Saldo AI habis. Silakan top up..." : "Ask a follow-up…"}
            value={iterationPrompt}
            onChange={e => onIterationPromptChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                onIterate()
              }
            }}
            disabled={isLoading || (creditsRemaining <= 0 && !isUnlimited)}
            className="min-h-[52px] max-h-[140px] resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent px-3 pt-2.5 pb-1 text-xs"
          />
          <div className="flex items-center justify-between px-2 pb-1.5">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" disabled className="h-7 w-7 rounded-full text-muted-foreground">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <ModelPicker
                models={models}
                selectedModelId={selectedModelId}
                onSelectModel={onSelectModel}
                hasUpgradedPlan={hasUpgradedPlan}
                compact
              />
            </div>
            <Button
              size="icon"
              className="h-7 w-7 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
              onClick={() => onIterate()}
              disabled={isLoading || !iterationPrompt.trim() || (creditsRemaining <= 0 && !isUnlimited)}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
          {!isUnlimited && creditsRemaining <= 0 ? (
            <span>
              You are out of credits.{" "}
              <button
                type="button"
                onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions`)}
                className="text-primary font-semibold hover:underline cursor-pointer"
              >
                Buy credits
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-1 font-medium">
              <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
              Biaya iterasi: {selectedModel.iterationCredits} Credits
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
