"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { copyToClipboard } from "@/lib/clipboard"
import { Loader2, FileCode, Copy, Check, Rocket, Layers } from "lucide-react"

interface WebsiteTemplateFile {
  path: string
  content: string
}

interface WebsiteTemplateDetail {
  id: string
  name: string
  icon: string
  description: string | null
  published: boolean
  files: WebsiteTemplateFile[]
  schemaTemplate: {
    id: string
    name: string
    icon: string
    schema: { contentTypes?: unknown[]; singleTypes?: unknown[]; components?: unknown[] }
  }
}

interface WebsiteTemplateReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  websiteTemplateId: string | null
  /** Global staff gets a read-only viewer ("Lihat File") — no Terapkan action. */
  isGlobal: boolean
  /** Called after a successful "Terapkan" so the parent can switch to Diagram Schema and refresh. */
  onApplied?: (deployment: { url?: string } | undefined) => void
}

export function WebsiteTemplateReviewDialog({
  open,
  onOpenChange,
  tenantSlug,
  websiteTemplateId,
  isGlobal,
  onApplied,
}: WebsiteTemplateReviewDialogProps) {
  const { toast } = useToast()
  const [detail, setDetail] = useState<WebsiteTemplateDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  useEffect(() => {
    if (!open || !websiteTemplateId) return
    setIsLoading(true)
    setDetail(null)
    setSelectedPath(null)
    fetch(`/api/tenant/${tenantSlug}/website-templates/${websiteTemplateId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.template) {
          setDetail(data.template)
          setSelectedPath(data.template.files?.[0]?.path || null)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [open, websiteTemplateId, tenantSlug])

  const handleCopy = (content: string) => {
    copyToClipboard(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleApply = async () => {
    if (!detail) return
    setIsApplying(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/website-templates/${detail.id}/apply`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal menerapkan Website Template")
      const envNote = data.envVarsApplied?.length
        ? ` ${data.envVarsApplied.length} variabel environment (${data.envVarsApplied.join(", ")}) otomatis diisi dengan nilai production.`
        : ""
      toast({
        title: "Website Template Diterapkan",
        description: (data.deployment?.url
          ? `Schema dibuat dan situs sedang di-deploy. Lihat statusnya di tab Hosting: ${data.deployment.url}`
          : "Schema dibuat dan situs sedang di-deploy. Cek tab Hosting untuk status terbaru.") + envNote,
      })
      onApplied?.(data.deployment)
      onOpenChange(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Menerapkan", description: err.message })
    } finally {
      setIsApplying(false)
    }
  }

  const selectedFile = detail?.files.find((f) => f.path === selectedPath) || null
  const totalModels = detail
    ? (detail.schemaTemplate.schema.contentTypes?.length || 0) +
      (detail.schemaTemplate.schema.singleTypes?.length || 0) +
      (detail.schemaTemplate.schema.components?.length || 0)
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border border-border bg-card sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <span className="text-lg">{detail?.icon || "🖥️"}</span>
            {detail?.name || "Memuat Website Template..."}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            {detail?.description}
            {detail && (
              <Badge variant="outline" className="text-[10px] font-bold gap-1">
                <Layers className="h-3 w-3" /> {detail.schemaTemplate.icon} {detail.schemaTemplate.name} · {totalModels} struktur
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat file template...
          </div>
        ) : detail ? (
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3 min-h-0 flex-1 overflow-hidden">
            <div className="border border-border/60 rounded-xl overflow-y-auto bg-muted/20">
              {detail.files.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setSelectedPath(f.path)}
                  className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-mono truncate transition-colors cursor-pointer ${
                    selectedPath === f.path ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                  title={f.path}
                >
                  <FileCode className="h-3 w-3 shrink-0" />
                  <span className="truncate">{f.path}</span>
                </button>
              ))}
            </div>
            <div className="border border-border/60 rounded-xl overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/60 bg-muted/20 shrink-0">
                <span className="text-[11px] font-mono font-bold text-foreground truncate">{selectedFile?.path}</span>
                {selectedFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-lg shrink-0"
                    onClick={() => handleCopy(selectedFile.content)}
                    title="Salin isi file"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
              <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono leading-relaxed bg-background/60">
                {selectedFile?.content || "Pilih file di sebelah kiri."}
              </pre>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-xs text-muted-foreground">Website Template tidak ditemukan.</div>
        )}

        {!isGlobal && detail?.published && (
          <DialogFooter className="pt-2">
            <Button
              className="rounded-xl text-xs font-bold gap-1.5"
              onClick={handleApply}
              disabled={isApplying}
            >
              {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              {isApplying ? "Menerapkan..." : "Terapkan ke Workspace Saya"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
