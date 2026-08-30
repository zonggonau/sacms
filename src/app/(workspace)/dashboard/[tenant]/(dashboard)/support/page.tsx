"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useParams } from "next/navigation"
import {
  Headphones,
  Search,
  MessageSquare,
  Send,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  Shield,
  Loader2,
  LifeBuoy,
  Paperclip,
  X,
  ImageIcon,
  FileText,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton"
import { cn } from "@/lib/utils"

export default function TenantSupportPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const params = useParams()
  const tenantSlug = typeof params?.tenant === "string" ? params.tenant : ""

  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<any[]>([])
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null)
  const [ticketDetailLoading, setTicketDetailLoading] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // New ticket form
  const [newSubject, setNewSubject] = useState("")
  const [newCategory, setNewCategory] = useState("technical")
  const [newPriority, setNewPriority] = useState("normal")
  const [newInitialMsg, setNewInitialMsg] = useState("")
  const [createAttachments, setCreateAttachments] = useState<string[]>([])
  const [submittingTicket, setSubmittingTicket] = useState(false)

  // Reply state
  const [replyMessage, setReplyMessage] = useState("")
  const [replyAttachments, setReplyAttachments] = useState<string[]>([])
  const [sendingReply, setSendingReply] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createFileInputRef = useRef<HTMLInputElement>(null)

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/tenant/${tenantSlug}/support`)
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets || [])
        if (!selectedTicket && data.tickets?.length > 0) {
          fetchTicketDetail(data.tickets[0].id)
        }
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
      const res = await fetch(`/api/tenant/${tenantSlug}/support/${ticketId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedTicket(data.ticket)
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat detail obrolan" })
    } finally {
      setTicketDetailLoading(false)
    }
  }

  useEffect(() => {
    if (tenantSlug) {
      fetchTickets()
    }
  }, [tenantSlug])

  // Live Stream SSE connection for active ticket in Full Page
  useEffect(() => {
    if (!selectedTicket?.id || !tenantSlug) return

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
          fetchTickets()
        }
      } catch (err) {
        // silent parse error
      }
    })

    return () => {
      eventSource.close()
    }
  }, [selectedTicket?.id, tenantSlug])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selectedTicket?.messages])

  const handleFileUpload = async (file: File, target: "create" | "reply") => {
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
        if (target === "create") {
          setCreateAttachments(prev => [...prev, data.url])
        } else {
          setReplyAttachments(prev => [...prev, data.url])
        }
      } else {
        toast({ variant: "destructive", title: "Upload Gagal", description: data.error || "Gagal mengunggah gambar/berkas" })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setUploadingFile(false)
    }
  }

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubject.trim() || !newInitialMsg.trim()) return

    try {
      setSubmittingTicket(true)
      const res = await fetch(`/api/tenant/${tenantSlug}/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newSubject,
          category: newCategory,
          priority: newPriority,
          initialMessage: newInitialMsg,
          attachments: createAttachments,
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: "Tiket Terkirim", description: "Tim IT SaCMS telah menerima tiket bantuan Anda." })
        setIsCreateOpen(false)
        setNewSubject("")
        setNewInitialMsg("")
        setCreateAttachments([])
        fetchTickets()
        setSelectedTicket(data.ticket)
      } else {
        toast({ variant: "destructive", title: "Gagal Mengirim", description: data.error || "Gagal membuat tiket" })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setSubmittingTicket(false)
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!replyMessage.trim() && replyAttachments.length === 0) || !selectedTicket) return

    try {
      setSendingReply(true)
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

  if (loading && tickets.length === 0) {
    return (
      <div className="p-6">
        <AdminPageSkeleton layout="dashboard" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden p-6 gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black tracking-tight text-foreground">Bantuan & IT Support</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full">
              Live Hub
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Saluran komunikasi langsung dengan tim teknis & customer service SaCMS.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-9 shadow-xs">
              <Plus className="h-4 w-4" /> Buat Tiket Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl border-border bg-card sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Buat Tiket Bantuan Baru</DialogTitle>
              <DialogDescription className="text-xs">
                Sampaikan kendala atau pertanyaan Anda langsung kepada tim teknis SaCMS.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateTicket} className="space-y-3.5 pt-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subjek / Masalah</Label>
                <Input
                  placeholder="Contoh: Kendala verifikasi DNS custom domain"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  required
                  className="h-9 rounded-xl text-xs bg-muted/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kategori</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="technical" className="text-xs">Teknis & CMS</SelectItem>
                      <SelectItem value="infrastructure" className="text-xs">Dedicated VPS / DB</SelectItem>
                      <SelectItem value="domain" className="text-xs">Custom Domain & SSL</SelectItem>
                      <SelectItem value="billing" className="text-xs">Billing & Subscription</SelectItem>
                      <SelectItem value="general" className="text-xs">Pertanyaan Umum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prioritas</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="low" className="text-xs">Rendah</SelectItem>
                      <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                      <SelectItem value="high" className="text-xs">Tinggi</SelectItem>
                      <SelectItem value="urgent" className="text-xs text-rose-500 font-bold">Mendesak (Server Down)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detail Pertanyaan / Kendala</Label>
                <Textarea
                  placeholder="Jelaskan kendala Anda secara rinci..."
                  value={newInitialMsg}
                  onChange={e => setNewInitialMsg(e.target.value)}
                  required
                  rows={4}
                  className="rounded-xl text-xs bg-muted/20 resize-none"
                />
              </div>

              {/* Attachments Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lampiran / Screenshot Error</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => createFileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="h-7 text-[11px] rounded-lg gap-1 border-dashed"
                  >
                    <Paperclip className="h-3 w-3" />
                    {uploadingFile ? "Mengunggah..." : "Tambah Foto/File"}
                  </Button>
                  <input
                    ref={createFileInputRef}
                    type="file"
                    accept="image/*,.pdf,.txt,.log,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, "create")
                    }}
                  />
                </div>

                {createAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {createAttachments.map((url, idx) => (
                      <div key={idx} className="relative group rounded-xl border border-border bg-muted/30 p-1 flex items-center gap-1.5 pr-2">
                        {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img src={url} alt="thumbnail" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <FileText className="w-6 h-6 text-primary ml-1" />
                        )}
                        <span className="text-[10px] font-mono truncate max-w-[100px]">{url.split("/").pop()}</span>
                        <button
                          type="button"
                          onClick={() => setCreateAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="p-0.5 hover:bg-rose-500/20 text-rose-500 rounded-md"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl text-xs h-9">
                  Batal
                </Button>
                <Button type="submit" disabled={submittingTicket} className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-9 shadow-xs">
                  {submittingTicket && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Kirim Tiket
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Split-Pane */}
      <div className="flex-1 flex gap-6 overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs">
        {/* Left: Ticket List */}
        <div className="w-full sm:w-80 border-r border-border/60 flex flex-col bg-muted/10">
          <div className="p-3.5 border-b border-border/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
            <span>Riwayat Tiket ({tickets.length})</span>
            <Button variant="ghost" size="sm" onClick={fetchTickets} className="h-6 px-1.5 text-[10px]">
              Refresh
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {tickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Belum ada tiket support. Klik "Buat Tiket Baru" untuk memulai percakapan.
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
                        {t.status === "open" ? "Menunggu CS" : t.status === "in_progress" ? "Diproses" : "Selesai"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(t.updatedAt).toLocaleDateString("id-ID", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-foreground line-clamp-1">{t.subject}</h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 italic">
                      "{t.messages?.[0]?.message || "..."}"
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right: Live Chat Screen */}
        <div className="flex-1 flex flex-col bg-background">
          {ticketDetailLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" /> Membuka percakapan...
            </div>
          ) : selectedTicket ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border/60 bg-card flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{selectedTicket.subject}</h3>
                    <Badge variant="outline" className="text-[10px] font-mono capitalize">
                      {selectedTicket.category}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Tiket #{selectedTicket.id.slice(-6)} • Terakhir diperbarui: {new Date(selectedTicket.updatedAt).toLocaleTimeString("id-ID")}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
                    selectedTicket.status === "open" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                    selectedTicket.status === "in_progress" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                    selectedTicket.status === "resolved" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  )}
                >
                  {selectedTicket.status}
                </Badge>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3.5 bg-muted/5">
                {selectedTicket.messages?.map((msg: any) => {
                  const isAdmin = msg.senderRole === "admin"
                  const isMe = msg.senderId === session?.user?.id
                  const attachments: string[] = Array.isArray(msg.attachments) ? msg.attachments : []

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[75%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-2xs",
                        isAdmin
                          ? "bg-primary/10 border border-primary/20 text-foreground mr-auto rounded-tl-xs"
                          : isMe
                          ? "bg-primary text-primary-foreground ml-auto rounded-tr-xs"
                          : "bg-muted text-foreground mr-auto rounded-tl-xs"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] font-bold mb-1 opacity-80">
                        <span>{isAdmin ? "👨‍💻 Tim IT SaCMS" : isMe ? "Anda" : "Anggota Tim"}</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.message}</p>

                      {/* Render Attachments in chat message */}
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
                {/* Reply Attachments Staging Bar */}
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

                <form onSubmit={handleSendReply} className="flex gap-2">
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
                      if (file) handleFileUpload(file, "reply")
                    }}
                  />

                  <Input
                    placeholder="Ketik balasan untuk Tim IT SaCMS..."
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
                    Kirim
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <LifeBuoy className="h-12 w-12 mb-3 text-muted-foreground/30" />
              <h3 className="text-sm font-bold text-foreground mb-1">Pilih Tiket Bantuan</h3>
              <p className="text-xs max-w-sm">
                Pilih salah satu tiket di sebelah kiri untuk melihat pesan atau buat tiket baru.
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
