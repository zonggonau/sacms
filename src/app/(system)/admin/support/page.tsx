"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import {
  Headphones,
  Search,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  User,
  Shield,
  Loader2,
  RefreshCw,
  Sparkles,
  Paperclip,
  Check,
  Filter,
  FileText,
  ExternalLink,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton"
import { cn } from "@/lib/utils"

export default function AdminSupportPage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<any[]>([])
  const [summary, setSummary] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, urgent: 0 })
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null)
  const [ticketDetailLoading, setTicketDetailLoading] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  // Reply state
  const [replyMessage, setReplyMessage] = useState("")
  const [replyAttachments, setReplyAttachments] = useState<string[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (categoryFilter !== "all") params.set("category", categoryFilter)
      if (searchQuery) params.set("search", searchQuery)

      const res = await fetch(`/api/admin/support?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets || [])
        setSummary(data.summary || { total: 0, open: 0, inProgress: 0, resolved: 0, urgent: 0 })
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat tiket support" })
    } finally {
      setLoading(false)
    }
  }

  const fetchTicketDetail = async (ticketId: string) => {
    try {
      setTicketDetailLoading(true)
      // Find tenant slug
      const found = tickets.find(t => t.id === ticketId)
      const tenantSlug = found?.tenant?.slug || "global"
      const res = await fetch(`/api/tenant/${tenantSlug}/support/${ticketId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedTicket(data.ticket)
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat detail tiket" })
    } finally {
      setTicketDetailLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [statusFilter, categoryFilter])

  // Live Stream SSE connection for active ticket in Admin Helpdesk
  useEffect(() => {
    if (!selectedTicket?.id) return

    const tenantSlug = selectedTicket.tenant?.slug || "global"
    const eventSource = new EventSource(`/api/tenant/${tenantSlug}/support/${selectedTicket.id}/stream`)

    eventSource.addEventListener("message", (event) => {
      try {
        const newMsg = JSON.parse(event.data)
        if (newMsg && newMsg.id) {
          setSelectedTicket((prev: any) => {
            if (!prev || prev.id !== selectedTicket.id) return prev
            const exists = prev.messages?.some((m: any) => m.id === newMsg.id)
            if (exists) return prev
            return {
              ...prev,
              messages: [...(prev.messages || []), newMsg]
            }
          })
          fetchTickets() // refresh sidebar unread / last message
        }
      } catch (err) {
        // silent parse error
      }
    })

    return () => {
      eventSource.close()
    }
  }, [selectedTicket?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selectedTicket?.messages])

  const handleFileUpload = async (file: File) => {
    try {
      setUploadingFile(true)
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/support/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.url) {
        toast({ title: "Berkas Terunggah", description: `${file.name} siap dikirim.` })
        setReplyAttachments(prev => [...prev, data.url])
      } else {
        toast({ variant: "destructive", title: "Upload Gagal", description: data.error || "Gagal mengunggah berkas" })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setUploadingFile(false)
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!replyMessage.trim() && replyAttachments.length === 0) || !selectedTicket) return

    try {
      setSendingReply(true)
      const tenantSlug = selectedTicket.tenant?.slug || "global"
      const res = await fetch(`/api/tenant/${tenantSlug}/support/${selectedTicket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: replyMessage.trim() || "(Lampiran Berkas)",
          attachments: replyAttachments,
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setReplyMessage("")
        setReplyAttachments([])
        setSelectedTicket((prev: any) => ({
          ...prev,
          messages: [...(prev?.messages || []), data.message]
        }))
        fetchTickets()
      } else {
        toast({ variant: "destructive", title: "Gagal Kirim", description: data.error })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setSendingReply(false)
    }
  }

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicket) return
    try {
      setUpdatingStatus(true)
      const tenantSlug = selectedTicket.tenant?.slug || "global"
      const res = await fetch(`/api/tenant/${tenantSlug}/support/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        toast({ title: "Status Diperbarui", description: `Tiket diubah ke status ${newStatus}` })
        setSelectedTicket((prev: any) => ({ ...prev, status: newStatus }))
        fetchTickets()
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memperbarui status" })
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading && tickets.length === 0) {
    return (
      <div className="p-6">
        <AdminPageSkeleton layout="dashboard" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden p-6 gap-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black tracking-tight text-foreground">Support & Helpdesk CS</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full">
              Live Hub
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pusat komunikasi interaktif & pemecahan kendala untuk Workspace Owners dan Tim IT SaCMS.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-xs flex items-center gap-2 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="font-bold text-foreground">{summary.open} Menunggu CS</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-xs flex items-center gap-2 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="font-bold text-foreground">{summary.inProgress} Diproses</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-xs flex items-center gap-2 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="font-bold text-rose-600 dark:text-rose-400">{summary.urgent} Mendesak</span>
          </div>
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <div className="flex-1 flex gap-6 overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs">
        {/* Left Pane: Ticket List & Filtering */}
        <div className="w-full sm:w-96 border-r border-border/60 flex flex-col bg-muted/10">
          {/* Filter Bar */}
          <div className="p-3.5 border-b border-border/60 space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari tiket, owner, workspace..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchTickets()}
                className="pl-8.5 h-8.5 rounded-xl text-xs bg-card border-border/80"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 rounded-xl text-xs bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs">Semua Status</SelectItem>
                  <SelectItem value="open" className="text-xs">Menunggu CS</SelectItem>
                  <SelectItem value="in_progress" className="text-xs">Diproses</SelectItem>
                  <SelectItem value="resolved" className="text-xs">Selesai</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 rounded-xl text-xs bg-card"><SelectValue placeholder="Kategori" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs">Semua Kategori</SelectItem>
                  <SelectItem value="technical" className="text-xs">Teknis & CMS</SelectItem>
                  <SelectItem value="infrastructure" className="text-xs">VPS / DB</SelectItem>
                  <SelectItem value="domain" className="text-xs">Custom Domain</SelectItem>
                  <SelectItem value="billing" className="text-xs">Billing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ticket Feed */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {tickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Tidak ada tiket yang cocok dengan filter.
              </div>
            ) : (
              tickets.map(t => {
                const isSelected = selectedTicket?.id === t.id
                return (
                  <div
                    key={t.id}
                    onClick={() => fetchTicketDetail(t.id)}
                    className={cn(
                      "p-3.5 cursor-pointer transition-all hover:bg-muted/40",
                      isSelected && "bg-primary/10 border-l-4 border-l-primary"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1.5 py-0 capitalize font-bold",
                          t.status === "open" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                          t.status === "in_progress" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                          t.status === "resolved" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        )}
                      >
                        {t.status === "open" ? "Baru" : t.status === "in_progress" ? "Diproses" : "Selesai"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(t.updatedAt).toLocaleDateString("id-ID", { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-foreground line-clamp-1">{t.subject}</h4>
                    
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                      <Building2 className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate font-semibold">{t.tenant?.name || "Global Workspace"}</span>
                      <span>•</span>
                      <span className="truncate">{t.user?.name || t.user?.email}</span>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1 italic">
                      "{t.messages?.[0]?.message || "..."}"
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Pane: Ticket Conversation Thread */}
        <div className="flex-1 flex flex-col bg-background">
          {ticketDetailLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" /> Membuka percakapan...
            </div>
          ) : selectedTicket ? (
            <>
              {/* Ticket Control Header */}
              <div className="p-4 border-b border-border/60 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{selectedTicket.subject}</h3>
                    <Badge variant="outline" className="text-[10px] font-mono capitalize">
                      {selectedTicket.category}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold capitalize",
                        selectedTicket.priority === "urgent" && "bg-rose-500/10 text-rose-600 border-rose-500/30",
                        selectedTicket.priority === "high" && "bg-amber-500/10 text-amber-600 border-amber-500/30"
                      )}
                    >
                      {selectedTicket.priority}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Tenant: <strong>{selectedTicket.tenant?.name}</strong> ({selectedTicket.tenant?.slug}) • Dibuat oleh: {selectedTicket.user?.name} ({selectedTicket.user?.email})
                  </p>
                </div>

                {/* Status Updater Actions */}
                <div className="flex items-center gap-2">
                  <Select value={selectedTicket.status} onValueChange={handleUpdateStatus} disabled={updatingStatus}>
                    <SelectTrigger className="h-8 rounded-xl text-xs bg-muted/20 font-bold w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="open" className="text-xs">Menunggu CS</SelectItem>
                      <SelectItem value="in_progress" className="text-xs">Sedang Diproses</SelectItem>
                      <SelectItem value="resolved" className="text-xs">Selesai (Resolved)</SelectItem>
                      <SelectItem value="closed" className="text-xs">Tutup Tiket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Message Stream */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/5">
                {selectedTicket.messages?.map((msg: any) => {
                  const isAdmin = msg.senderRole === "admin"
                  const isMe = msg.senderId === session?.user?.id
                  const attachments: string[] = Array.isArray(msg.attachments) ? msg.attachments : []

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed shadow-2xs",
                        isAdmin
                          ? "bg-primary text-primary-foreground ml-auto rounded-tr-xs"
                          : "bg-card border border-border/80 text-foreground mr-auto rounded-tl-xs"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] font-bold mb-1 opacity-85">
                        <span>{isAdmin ? "👨‍💻 Anda (Tim IT SaCMS)" : `👤 ${selectedTicket.user?.name || "Owner"}`}</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.message}</p>

                      {/* Render Attachments in message bubble */}
                      {attachments.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-2 pt-1 border-t border-current/10">
                          {attachments.map((url, i) => {
                            const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                            if (isImage) {
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setPreviewImageUrl(url)}
                                  className="group relative block overflow-hidden rounded-xl border border-current/20 bg-background/20 transition-all hover:scale-105 cursor-pointer text-left"
                                >
                                  <div className="relative">
                                    <img src={url} alt="attachment" className="max-h-48 max-w-xs object-cover rounded-xl" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                      <span className="text-[11px] font-bold">Lihat Gambar</span>
                                    </div>
                                  </div>
                                </button>
                              )
                            }

                            return (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative block overflow-hidden rounded-xl border border-current/20 bg-background/20 transition-all hover:scale-105"
                              >
                                <div className="flex items-center gap-2 p-2 px-3 text-[11px] font-mono">
                                  <FileText className="h-4 w-4" />
                                  <span className="truncate max-w-[150px]">{url.split("/").pop()}</span>
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </div>
                              </a>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Form */}
              <div className="p-4 border-t border-border/60 bg-card space-y-2">
                {replyAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    {replyAttachments.map((url, idx) => (
                      <div key={idx} className="relative rounded-xl border border-border bg-muted/40 p-1 flex items-center gap-1.5 pr-2">
                        {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img src={url} alt="thumbnail" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <FileText className="w-6 h-6 text-primary ml-1" />
                        )}
                        <span className="text-[10px] font-mono truncate max-w-[120px]">{url.split("/").pop()}</span>
                        <button
                          type="button"
                          onClick={() => setReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="p-0.5 hover:bg-rose-500/20 text-rose-500 rounded-md"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSendReply} className="flex gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile || sendingReply}
                    className="h-10 w-10 rounded-xl shrink-0 text-muted-foreground hover:text-foreground"
                    title="Lampirkan Screenshot atau File"
                  >
                    {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Paperclip className="h-4 w-4" />}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.txt,.log,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file)
                    }}
                  />

                  <Input
                    placeholder="Ketik balasan untuk owner workspace..."
                    value={replyMessage}
                    onChange={e => setReplyMessage(e.target.value)}
                    disabled={sendingReply}
                    className="h-10 rounded-xl text-xs bg-muted/20 flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={sendingReply || (!replyMessage.trim() && replyAttachments.length === 0)}
                    className="h-10 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5"
                  >
                    {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Balas Tiket
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Headphones className="h-14 w-14 mb-3 text-muted-foreground/30" />
              <h3 className="text-sm font-bold text-foreground mb-1">Pilih Tiket dari Daftar</h3>
              <p className="text-xs max-w-sm">
                Pilih salah satu tiket di sebelah kiri untuk melihat percakapan lengkap dan membalas pertanyaan owner workspace.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Transparent Image Lightbox Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div 
            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-12 right-0 sm:-right-12 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all shadow-xl hover:scale-110"
              title="Tutup (ESC)"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Full-resolution Image */}
            <img
              src={previewImageUrl}
              alt="Preview"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
            />
          </div>
        </div>
      )}
    </div>
  )
}
