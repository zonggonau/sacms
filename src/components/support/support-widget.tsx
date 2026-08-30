"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import {
  MessageSquare,
  Send,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  ChevronLeft,
  X,
  Minimize2,
  Maximize2,
  Headphones,
  LifeBuoy,
  Sparkles,
  ExternalLink,
  Bot
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface SupportWidgetProps {
  tenantSlug: string
  tenantName?: string
}

export function SupportWidget({ tenantSlug, tenantName }: SupportWidgetProps) {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<"list" | "detail" | "create">("list")
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTicket, setActiveTicket] = useState<any | null>(null)
  const [ticketDetailLoading, setTicketDetailLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Form states
  const [newSubject, setNewSubject] = useState("")
  const [newCategory, setNewCategory] = useState("technical")
  const [newPriority, setNewPriority] = useState("normal")
  const [newInitialMsg, setNewInitialMsg] = useState("")
  const [submittingTicket, setSubmittingTicket] = useState(false)

  // Reply state
  const [replyMessage, setReplyMessage] = useState("")
  const [sendingReply, setSendingReply] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchUnread = async () => {
    if (!tenantSlug) return
    try {
      const res = await fetch(`/api/support/unread-count?tenant=${tenantSlug}`)
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unreadCount || 0)
      }
    } catch {}
  }

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 8000)
    return () => clearInterval(interval)
  }, [tenantSlug])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/tenant/${tenantSlug}/support`)
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets || [])
      }
    } catch {
      // silent
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
        setActiveTicket(data.ticket)
        setView("detail")
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat percakapan" })
    } finally {
      setTicketDetailLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchTickets()
    }
  }, [isOpen, tenantSlug])

  // Live Stream SSE connection for active ticket
  useEffect(() => {
    if (!activeTicket?.id || !isOpen || view !== "detail") return

    const eventSource = new EventSource(`/api/tenant/${tenantSlug}/support/${activeTicket.id}/stream`)

    eventSource.addEventListener("message", (event) => {
      try {
        const newMsg = JSON.parse(event.data)
        if (newMsg && newMsg.id) {
          setActiveTicket((prev: any) => {
            if (!prev || prev.id !== activeTicket.id) return prev
            const exists = prev.messages?.some((m: any) => m.id === newMsg.id)
            if (exists) return prev
            return {
              ...prev,
              messages: [...(prev.messages || []), newMsg]
            }
          })
        }
      } catch (err) {
        // silent parse error
      }
    })

    return () => {
      eventSource.close()
    }
  }, [activeTicket?.id, isOpen, view, tenantSlug])

  useEffect(() => {
    if (view === "detail") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [activeTicket?.messages, view])

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
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: "Tiket Terkirim", description: "Tim IT SaCMS siap merespons tiket Anda." })
        setNewSubject("")
        setNewInitialMsg("")
        setActiveTicket(data.ticket)
        setView("detail")
        fetchTickets()
      } else {
        toast({ variant: "destructive", title: "Gagal Mengirim", description: data.error || "Gagal membuat tiket" })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message })
    } finally {
      setSubmittingTicket(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyMessage.trim() || !activeTicket) return

    try {
      setSendingReply(true)
      const res = await fetch(`/api/tenant/${tenantSlug}/support/${activeTicket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setReplyMessage("")
        setActiveTicket((prev: any) => ({
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

  return (
    <>
      {/* Floating Action Bubble */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => {
            setIsOpen(!isOpen)
            if (!isOpen) fetchUnread()
          }}
          className={cn(
            "relative h-12 w-12 sm:h-12 sm:w-auto sm:px-4.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-2xl shadow-primary/30 gap-2 transition-all hover:scale-105",
            isOpen && "rotate-0 scale-95"
          )}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Headphones className="h-5 w-5 shrink-0" />}
          <span className="hidden sm:inline text-xs font-bold">
            {isOpen ? "Tutup" : "Bantuan & IT Support"}
          </span>

          {/* Unread Ping Badge */}
          {!isOpen && unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow-lg animate-bounce ring-2 ring-background">
              {unreadCount}
            </span>
          )}
        </Button>
      </div>

      {/* Non-Modal Floating Pop-up Widget Box (Intercom Style) */}
      {isOpen && (
        <div className="fixed bottom-22 right-6 z-50 w-[380px] sm:w-[410px] h-[540px] max-h-[calc(100vh-7rem)] bg-card border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="p-3.5 px-4 bg-primary text-primary-foreground flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              {view !== "list" ? (
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="p-1 hover:bg-primary-foreground/20 rounded-lg transition-colors text-primary-foreground"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-primary-foreground/15 flex items-center justify-center font-bold">
                  <LifeBuoy className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <div>
                <h3 className="text-xs font-bold leading-tight">
                  {view === "create" ? "Buat Tiket Bantuan" : view === "detail" ? activeTicket?.subject || "Percakapan" : "Live IT Support"}
                </h3>
                <p className="text-[10px] opacity-80 leading-tight">
                  {view === "detail" ? `Tiket #${activeTicket?.id?.slice(-6)}` : "Tim CS & Teknisi SaCMS"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href={`/dashboard/${tenantSlug}/support`}
                title="Buka Halaman Penuh"
                className="p-1.5 hover:bg-primary-foreground/20 rounded-lg text-primary-foreground transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-primary-foreground/20 rounded-lg text-primary-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* VIEW: TICKET LIST */}
          {view === "list" && (
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
              <div className="p-3 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Riwayat Tiket ({tickets.length})</span>
                <Button
                  size="sm"
                  onClick={() => setView("create")}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
                >
                  <Plus className="h-3 w-3" /> Tiket Baru
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-border/40">
                {loading ? (
                  <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" /> Memuat obrolan...
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="font-bold text-foreground">Belum ada obrolan</p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                      Ada pertanyaan seputar CMS, domain atau billing?
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setView("create")}
                      className="mt-4 h-8 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Mulai Obrolan Baru
                    </Button>
                  </div>
                ) : (
                  tickets.map(t => (
                    <div
                      key={t.id}
                      onClick={() => fetchTicketDetail(t.id)}
                      className="p-3.5 cursor-pointer hover:bg-muted/40 transition-all flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
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
                      <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                        {t.messages?.[0]?.message || "..."}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* VIEW: CREATE TICKET */}
          {view === "create" && (
            <form onSubmit={handleCreateTicket} className="flex-1 flex flex-col p-4 space-y-3 overflow-y-auto bg-background">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subjek Masalah</Label>
                <Input
                  placeholder="Contoh: Bantuan setting A-Record domain"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  required
                  className="h-8.5 rounded-xl text-xs bg-muted/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kategori</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-8.5 rounded-xl text-xs bg-muted/20"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="technical" className="text-xs">Teknis CMS</SelectItem>
                      <SelectItem value="infrastructure" className="text-xs">Dedicated VPS/DB</SelectItem>
                      <SelectItem value="domain" className="text-xs">Custom Domain</SelectItem>
                      <SelectItem value="billing" className="text-xs">Billing</SelectItem>
                      <SelectItem value="general" className="text-xs">Umum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prioritas</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="h-8.5 rounded-xl text-xs bg-muted/20"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="low" className="text-xs">Rendah</SelectItem>
                      <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                      <SelectItem value="high" className="text-xs">Penting</SelectItem>
                      <SelectItem value="urgent" className="text-xs text-rose-500 font-bold">Mendesak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1 flex-1 flex flex-col">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detail Pertanyaan</Label>
                <Textarea
                  placeholder="Tuliskan kendala atau pertanyaan Anda secara rinci..."
                  value={newInitialMsg}
                  onChange={e => setNewInitialMsg(e.target.value)}
                  required
                  rows={4}
                  className="flex-1 rounded-xl text-xs bg-muted/20 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setView("list")} className="flex-1 rounded-xl text-xs h-9">
                  Batal
                </Button>
                <Button type="submit" disabled={submittingTicket} className="flex-1 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-9 shadow-xs">
                  {submittingTicket ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Kirim Pesan"}
                </Button>
              </div>
            </form>
          )}

          {/* VIEW: CONVERSATION DETAIL */}
          {view === "detail" && (
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
              {ticketDetailLoading ? (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Membuka obrolan...
                </div>
              ) : activeTicket ? (
                <>
                  {/* Stream Message Area */}
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-muted/5">
                    {activeTicket.messages?.map((msg: any) => {
                      const isAdmin = msg.senderRole === "admin"
                      const isMe = msg.senderId === session?.user?.id

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex flex-col max-w-[85%] rounded-2xl p-2.5 text-xs leading-relaxed shadow-2xs",
                            isAdmin
                              ? "bg-primary/10 border border-primary/20 text-foreground mr-auto rounded-tl-xs"
                              : isMe
                              ? "bg-primary text-primary-foreground ml-auto rounded-tr-xs"
                              : "bg-muted text-foreground mr-auto rounded-tl-xs"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 text-[9px] font-bold mb-0.5 opacity-80">
                            <span>{isAdmin ? "👨‍💻 Tim IT SaCMS" : isMe ? "Anda" : "Tim"}</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input Box */}
                  <form onSubmit={handleSendMessage} className="p-2.5 border-t border-border/60 bg-card flex gap-2">
                    <Input
                      placeholder="Ketik balasan Anda..."
                      value={replyMessage}
                      onChange={e => setReplyMessage(e.target.value)}
                      disabled={sendingReply}
                      className="h-9 rounded-xl text-xs bg-muted/20 flex-1"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={sendingReply || !replyMessage.trim()}
                      className="h-9 px-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                    >
                      {sendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </form>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </>
  )
}
