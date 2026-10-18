"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowUp, Loader2, Sparkles, Cpu, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAiSiteModels } from "@/hooks/use-ai-site-models"
import { AiCreditsBadge } from "./ai-credits-badge"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  "Landing page untuk toko kopi dengan menu, lokasi, dan form kontak",
  "Portofolio pribadi dengan galeri proyek dan halaman tentang saya",
  "Halaman promosi produk dengan harga, testimoni, dan CTA pendaftaran",
]

/** v0-style prompt landing — shown only until this workspace's one AI Site project exists. */
export function AiSiteLanding({
  tenantSlug,
  tenantId,
  existingProjectId,
  initialPrompt,
}: {
  tenantSlug: string
  tenantId: string
  existingProjectId: string | null
  /** Auto-built from the tenant's already-finalized CMS schema (src/lib/ai-site/schema-prompt.ts) — pre-fills the brief so the user can just review and click generate instead of writing one from scratch. Still a plain editable draft. */
  initialPrompt?: string
}) {
  const router = useRouter()
  const [text, setText] = useState(initialPrompt ?? "")
  const { options: modelOptions } = useAiSiteModels(tenantSlug)
  const [model, setModel] = useState<string>(modelOptions[0].value)
  const [submitting, setSubmitting] = useState(false)
  const fromSchema = Boolean(initialPrompt)

  const apiBase = `/api/tenant/${encodeURIComponent(tenantSlug)}/ai-site`

  async function start() {
    const brief = text.trim()
    if (!brief || submitting) return
    setSubmitting(true)
    try {
      let projectId = existingProjectId
      if (!projectId) {
        const projectRes = await fetch(`${apiBase}/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: titleFrom(brief) }),
        })
        const projectBody = await projectRes.json().catch(() => ({}))
        if (!projectRes.ok) throw new Error(projectBody?.error || "Gagal membuat proyek")
        projectId = projectBody.project.id as string
      }

      const chatRes = await fetch(`${apiBase}/projects/${projectId}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: brief, model }),
      })
      const chatBody = await chatRes.json().catch(() => ({}))
      if (!chatRes.ok) throw new Error(chatBody?.error || "Gagal membuat chat")
      const chatId = chatBody.chat.id as string

      router.push(`/dashboard/${tenantId}/developer/aisite/${projectId}/chats/${chatId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan")
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full min-h-[70vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{fromSchema ? "Brief sudah disiapkan dari skemamu" : "Apa yang ingin kamu bangun?"}</h1>
          <p className="text-sm text-muted-foreground">
            {fromSchema
              ? "Dibuat otomatis dari Content Type, Single Type, dan Component yang sudah kamu finalkan — tinjau atau edit sebentar, lalu klik generate."
              : "Jelaskan websitenya, AI Site akan menulis dan menampilkan preview langsung."}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background shadow-sm">
          <div className="flex items-end gap-2 p-2.5 pb-1">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  start()
                }
              }}
              placeholder="Contoh: Landing page untuk toko kopi, warna hijau tua, ada menu, lokasi, dan form kontak."
              className={cn("flex-1 resize-none border-0 text-sm shadow-none focus-visible:ring-0", fromSchema ? "max-h-64 min-h-32" : "min-h-14")}
              rows={fromSchema ? 8 : 3}
              autoFocus
              disabled={submitting}
            />
            <Button size="icon" onClick={start} disabled={submitting || !text.trim()} aria-label="Mulai membangun">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-1.5 border-t border-border/50 px-3 pb-2.5 pt-1">
            <Cpu className="size-3 shrink-0 text-muted-foreground" />
            <Select value={model} onValueChange={setModel} disabled={submitting}>
              <SelectTrigger className="h-7 w-auto gap-1.5 rounded-lg border-0 bg-transparent px-1.5 text-[11px] font-semibold shadow-none hover:bg-muted/50 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72 rounded-xl border-border bg-card">
                {modelOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="rounded-lg text-xs">
                    <span className="font-semibold">{opt.label}</span>
                    <span className="ml-1.5 text-muted-foreground">— {opt.provider}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-1.5">
              <AiCreditsBadge />
              <div className="flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <Zap className="size-2.5" /> Vercel AI Gateway
              </div>
            </div>
          </div>
        </div>

        <div className={cn("flex flex-wrap justify-center gap-2", fromSchema && "hidden")}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={submitting}
              onClick={() => setText(s)}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function titleFrom(text: string) {
  const line = text.trim().split("\n")[0]!.trim()
  return line.length > 80 ? `${line.slice(0, 79)}…` : line || "Website Saya"
}
