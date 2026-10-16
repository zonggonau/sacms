"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, MessageSquare, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type ChatSummary = { id: string; title: string; updatedAt: string }

export function ProjectChatsClient({
  tenantSlug,
  tenantId,
  projectId,
  projectName,
  initialChats,
}: {
  tenantSlug: string
  tenantId: string
  projectId: string
  projectName: string
  initialChats: ChatSummary[]
}) {
  const router = useRouter()
  const [chats] = useState(initialChats)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function createChat() {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tenant/${encodeURIComponent(tenantSlug)}/ai-site/projects/${projectId}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || "Gagal membuat chat")
      router.push(`/dashboard/${tenantId}/developer/aisite/${projectId}/chats/${body.chat.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan")
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link href={`/dashboard/${tenantId}/developer/aisite`}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">{projectName}</h1>
        </div>
        <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Chat Baru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mulai chat baru</DialogTitle>
            </DialogHeader>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Minta perubahan atau fitur baru untuk website ini…"
              rows={4}
              disabled={submitting}
            />
            <DialogFooter>
              <Button onClick={createChat} disabled={submitting || !text.trim()}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Kirim
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {chats.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <MessageSquare className="size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Belum ada chat di proyek ini.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <Card
              key={chat.id}
              className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:border-primary/50"
              onClick={() => router.push(`/dashboard/${tenantId}/developer/aisite/${projectId}/chats/${chat.id}`)}
            >
              <span className="flex items-center gap-2 truncate font-medium">
                <MessageSquare className="size-4 text-muted-foreground" /> {chat.title}
              </span>
              <span className="text-xs text-muted-foreground">{new Date(chat.updatedAt).toLocaleDateString("id-ID")}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
