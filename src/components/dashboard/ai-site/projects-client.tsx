"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Globe, MessageSquare, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type AiSiteProjectSummary = {
  id: string
  name: string
  description: string | null
  updatedAt: string
  chatCount: number
}

export function AiSiteProjectsClient({
  tenantSlug,
  tenantId,
  initialProjects,
}: {
  tenantSlug: string
  tenantId: string
  initialProjects: AiSiteProjectSummary[]
}) {
  const router = useRouter()
  const [projects] = useState(initialProjects)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [brief, setBrief] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const apiBase = `/api/tenant/${encodeURIComponent(tenantSlug)}/ai-site`

  async function createProject() {
    if (!name.trim() || !brief.trim()) return
    setSubmitting(true)
    try {
      const projectRes = await fetch(`${apiBase}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const projectBody = await projectRes.json().catch(() => ({}))
      if (!projectRes.ok) throw new Error(projectBody?.error || "Gagal membuat proyek")
      const projectId = projectBody.project.id as string

      const chatRes = await fetch(`${apiBase}/projects/${projectId}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: brief.trim() }),
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">AI Site</h1>
          <p className="text-sm text-muted-foreground">
            Bangun website dengan AI — chat untuk menjelaskan, AI menulis dan menampilkan preview langsung.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Proyek Baru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Proyek AI Site baru</DialogTitle>
              <DialogDescription>
                Beri nama proyeknya, lalu jelaskan website yang ingin dibangun — AI akan langsung mulai membuatnya.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="ai-site-name">Nama proyek</Label>
                <Input
                  id="ai-site-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Landing Page Produk"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-site-brief">Jelaskan websitenya</Label>
                <Textarea
                  id="ai-site-brief"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Contoh: Landing page untuk toko kopi, warna hijau tua, ada menu, lokasi, dan form kontak."
                  rows={4}
                  disabled={submitting}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createProject} disabled={submitting || !name.trim() || !brief.trim()}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Mulai Membangun
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Globe className="size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Belum ada proyek AI Site. Buat yang pertama.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer space-y-2 p-4 transition-colors hover:border-primary/50"
              onClick={() => router.push(`/dashboard/${tenantId}/developer/aisite/${project.id}`)}
            >
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                <h3 className="truncate font-semibold">{project.name}</h3>
              </div>
              {project.description ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
              ) : null}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3" /> {project.chatCount} chat
                </span>
                <span>{new Date(project.updatedAt).toLocaleDateString("id-ID")}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
