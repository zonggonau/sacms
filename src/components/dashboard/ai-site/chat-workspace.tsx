"use client"

import type { UIMessage } from "ai"
import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Eye, Code2, ExternalLink, RefreshCw, Trash2, Loader2, Globe, Rocket, PartyPopper } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ChatConversation } from "./chat-conversation"
import { CodeView } from "./code-view"
import { PreviewPane } from "./preview-pane"
import { DEFAULT_AI_SITE_MODEL } from "@/lib/ai-site/models"
import { cn } from "@/lib/utils"

type View = "preview" | "code"

export function ChatWorkspace({
  tenantSlug,
  tenantId,
  chat,
  initialMessages,
  projectId,
}: {
  tenantSlug: string
  tenantId: string
  chat: { id: string; title: string; model: string | null }
  initialMessages: UIMessage[]
  projectId: string
}) {
  const router = useRouter()
  const [view, setView] = useState<View>("preview")
  // Bumped after every generation so the preview re-syncs and the code view reloads.
  const [revision, setRevision] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const handleGenerationFinished = useCallback(() => setRevision((value) => value + 1), [])

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)

  async function publishProject() {
    setPublishing(true)
    try {
      const res = await fetch(
        `/api/tenant/${encodeURIComponent(tenantSlug)}/ai-site/projects/${projectId}/publish`,
        { method: "POST" },
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || "Gagal publish")
      setPublishedUrl(body.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan")
    } finally {
      setPublishing(false)
    }
  }

  async function deleteProject() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/tenant/${encodeURIComponent(tenantSlug)}/ai-site/projects/${projectId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Gagal menghapus proyek")
      }
      router.push(`/dashboard/${tenantId}/developer/aisite`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan")
      setDeleting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <Globe className="size-4 shrink-0 text-primary" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{chat.title}</h1>
        <div className="flex items-center rounded-lg border border-border p-0.5">
          {(["preview", "code"] as const).map((item) => (
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors",
                view === item && "bg-accent text-foreground",
              )}
              key={item}
              onClick={() => setView(item)}
              type="button"
            >
              {item === "preview" ? <Eye className="size-3.5" /> : <Code2 className="size-3.5" />}
              {item === "preview" ? "Preview" : "Kode"}
            </button>
          ))}
        </div>
        <Button
          aria-label="Muat ulang preview"
          onClick={() => setRevision((value) => value + 1)}
          size="icon"
          variant="ghost"
        >
          <RefreshCw className="size-4" />
        </Button>
        {previewUrl ? (
          <Button asChild aria-label="Buka preview di tab baru" size="icon" variant="ghost">
            <a href={previewUrl} rel="noreferrer" target="_blank">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        ) : null}
        <Button
          size="sm"
          onClick={() => setConfirmPublishOpen(true)}
          disabled={publishing}
          className="h-8 gap-1.5 text-xs font-bold"
        >
          {publishing ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
          Publish
        </Button>
        <Button
          aria-label="Hapus proyek"
          onClick={() => setConfirmOpen(true)}
          size="icon"
          variant="ghost"
          disabled={deleting}
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </header>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Hapus proyek ini?"
        description={`"${chat.title}" beserta semua file, chat, dan preview-nya akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={deleteProject}
      />

      <ConfirmDialog
        open={confirmPublishOpen}
        onOpenChange={setConfirmPublishOpen}
        title="Publish website ini ke hosting produksi?"
        description="File yang sedang di preview akan dideploy ke hosting Vercel asli milik workspace ini — bukan sekadar preview sementara lagi. Setelah live, kamu bisa pasang domain sendiri dari halaman Infrastruktur."
        confirmLabel="Publish"
        onConfirm={publishProject}
      />

      <Dialog open={!!publishedUrl} onOpenChange={(open) => !open && setPublishedUrl(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="flex items-center gap-2 text-base">
            <PartyPopper className="size-5 text-primary" /> Website kamu sudah live!
          </DialogTitle>
          <div className="space-y-4 pt-1">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <a
                href={publishedUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-medium text-primary hover:underline"
              >
                {publishedUrl}
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Sudah bisa diakses publik. Mau pakai domain sendiri? Atur lewat halaman Infrastruktur workspace ini.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPublishedUrl(null)}>
                Tutup
              </Button>
              <Button asChild size="sm">
                <Link href={`/dashboard/${tenantId}/infrastructure`}>Atur Domain</Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 w-full min-w-0 shrink-0 flex-col border-r border-border md:w-96 md:max-w-[42%]">
          <ChatConversation
            tenantSlug={tenantSlug}
            chatId={chat.id}
            initialMessages={initialMessages}
            initialModel={chat.model || DEFAULT_AI_SITE_MODEL}
            onGenerationFinished={handleGenerationFinished}
          />
        </div>
        <div className="hidden min-h-0 min-w-0 flex-1 md:block">
          <div className={view === "preview" ? "h-full" : "hidden"}>
            <PreviewPane tenantSlug={tenantSlug} onUrlChange={setPreviewUrl} projectId={projectId} revision={revision} />
          </div>
          {view === "code" ? <CodeView tenantSlug={tenantSlug} projectId={projectId} revision={revision} /> : null}
        </div>
      </div>
    </div>
  )
}
