"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, Trash2, Download, UserPlus, UserMinus, Send, Globe, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { formatRupiah } from "@/lib/utils"
import { getStageLabel } from "@/lib/proposal-stages"
import { generateProposalPDF } from "@/lib/pdf-generator"
import QRCode from "qrcode"
import type { Proposal, ProposalActivity } from "./types"

const DEFAULT_FEATURES_TEXT = "CMS, Frontend, Domain & SSL, Storage 5GB"

interface ProposalDetailDialogProps {
  proposal: Proposal | null
  onOpenChange: (open: boolean) => void
  onUpdated: (proposal: Proposal) => void
  onDeleted: (id: string) => void
}

export function ProposalDetailDialog({ proposal, onOpenChange, onUpdated, onDeleted }: ProposalDetailDialogProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activities, setActivities] = useState<ProposalActivity[]>([])
  const [newNote, setNewNote] = useState("")
  const [addingNote, setAddingNote] = useState(false)

  const [institutionName, setInstitutionName] = useState("")
  const [institutionType, setInstitutionType] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [estimatedValueIdr, setEstimatedValueIdr] = useState("")
  const [notes, setNotes] = useState("")
  const [demoUrl, setDemoUrl] = useState("")
  const [featuresText, setFeaturesText] = useState("")
  const [suggestingFeatures, setSuggestingFeatures] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    if (!proposal) return
    setInstitutionName(proposal.institutionName)
    setInstitutionType(proposal.institutionType || "")
    setContactName(proposal.contactName || "")
    setContactEmail(proposal.contactEmail || "")
    setContactPhone(proposal.contactPhone || "")
    setEstimatedValueIdr(proposal.estimatedValueIdr != null ? String(proposal.estimatedValueIdr) : "")
    setNotes(proposal.notes || "")
    setDemoUrl(proposal.demoUrl || "")
    setFeaturesText(proposal.featuresText || "")
    setActivities(proposal.activities || [])

    setLoading(true)
    fetch(`/api/admin/proposals/${proposal.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.proposal?.activities) setActivities(body.proposal.activities)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [proposal?.id])

  if (!proposal) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionName: institutionName.trim(),
          institutionType: institutionType.trim() || null,
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          estimatedValueIdr: estimatedValueIdr.trim() ? Number(estimatedValueIdr) : null,
          notes: notes.trim() || null,
          demoUrl: demoUrl.trim() || null,
          featuresText: featuresText.trim() || null,
        }),
      })
      const body = await res.json()
      if (res.ok) {
        toast({ title: "Tersimpan" })
        onUpdated(body.proposal)
      } else {
        toast({ variant: "destructive", title: "Gagal Menyimpan", description: body.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan" })
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = async (assignedToId: string | null) => {
    try {
      const res = await fetch(`/api/admin/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId }),
      })
      const body = await res.json()
      if (res.ok) onUpdated(body.proposal)
    } catch {}
  }

  const handleSuggestFeatures = async () => {
    if (!institutionName.trim()) {
      toast({ variant: "destructive", title: "Isi Nama Instansi Dulu" })
      return
    }
    setSuggestingFeatures(true)
    try {
      const res = await fetch("/api/admin/proposals/suggest-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionName, institutionType: institutionType || undefined }),
      })
      const body = await res.json()
      if (res.ok && Array.isArray(body.features)) {
        setFeaturesText(body.features.join(", "))
        toast({ title: "Saran Fitur Dibuat", description: "Tinjau dan sesuaikan sebelum menyimpan." })
      } else {
        toast({ variant: "destructive", title: "Gagal Membuat Saran", description: body.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan" })
    } finally {
      setSuggestingFeatures(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setAddingNote(true)
    try {
      const res = await fetch(`/api/admin/proposals/${proposal.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "note", message: newNote.trim() }),
      })
      const body = await res.json()
      if (res.ok) {
        setActivities((prev) => [body.activity, ...prev])
        setNewNote("")
      } else {
        toast({ variant: "destructive", title: "Gagal Menambah Catatan", description: body.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan" })
    } finally {
      setAddingNote(false)
    }
  }

  const handleDelete = async () => {
    if (!(await confirm({ title: `Hapus penawaran "${proposal.institutionName}"?`, confirmLabel: "Hapus", variant: "destructive" }))) return
    try {
      const res = await fetch(`/api/admin/proposals/${proposal.id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Penawaran Dihapus" })
        onDeleted(proposal.id)
      } else {
        toast({ variant: "destructive", title: "Gagal Menghapus" })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan" })
    }
  }

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true)
    try {
      const value = estimatedValueIdr.trim() ? Number(estimatedValueIdr) : 0
      const trimmedDemoUrl = demoUrl.trim()
      // Generated here (async) rather than inside generateProposalPDF, since
      // jsPDF's addImage needs the data URL synchronously ready by the time
      // the PDF is drawn.
      let demoQrDataUrl: string | undefined
      if (trimmedDemoUrl) {
        try {
          demoQrDataUrl = await QRCode.toDataURL(trimmedDemoUrl, { margin: 1, width: 240 })
        } catch {
          toast({ variant: "destructive", title: "Gagal Membuat QR Code", description: "PDF tetap dibuat tanpa QR code demo." })
        }
      }

      generateProposalPDF({
        institutionName,
        institutionType: institutionType || undefined,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        proposalNumber: proposal.id.slice(-8).toUpperCase(),
        date: new Date(),
        items: [
          {
            name: '1 Paket Lengkap Pengembangan Website & CMS',
            description: `Termasuk: ${DEFAULT_FEATURES_TEXT}`,
            priceIdr: value,
          },
        ],
        notes: notes || undefined,
        preparedByName: proposal.assignedTo?.name || undefined,
        demoUrl: trimmedDemoUrl || undefined,
        demoQrDataUrl,
        pageFeaturesText: featuresText.trim() || undefined,
      })
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <>
      {confirmDialog}
      <Dialog open={!!proposal} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-bold">{proposal.institutionName}</DialogTitle>
              <Badge variant="outline" className="text-[10px] font-bold">{getStageLabel(proposal.stage)}</Badge>
            </div>
            <DialogDescription className="text-xs">
              Dibuat {new Date(proposal.createdAt).toLocaleDateString("id-ID")}
              {proposal.createdBy && ` oleh ${proposal.createdBy.name || proposal.createdBy.email}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold">Nama Instansi</Label>
                <Input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} className="text-xs" disabled={saving} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Jenis Instansi</Label>
                <Input value={institutionType} onChange={(e) => setInstitutionType(e.target.value)} className="text-xs" disabled={saving} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Estimasi Nilai (IDR)</Label>
                <Input type="number" min={0} value={estimatedValueIdr} onChange={(e) => setEstimatedValueIdr(e.target.value)} className="text-xs" disabled={saving} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Nama Kontak</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="text-xs" disabled={saving} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">No. Telepon</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="text-xs" disabled={saving} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold">Email Kontak</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="text-xs" disabled={saving} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Catatan</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs min-h-16" disabled={saving} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">Halaman & Fitur Website (khusus instansi ini)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] gap-1"
                  onClick={handleSuggestFeatures}
                  disabled={suggestingFeatures || saving}
                >
                  {suggestingFeatures ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Sarankan dengan AI
                </Button>
              </div>
              <Textarea
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                className="text-xs min-h-16"
                disabled={saving}
                placeholder="Contoh: Home, Tentang Kami, Layanan, Poli Gigi, Dokter Kami, Kontak"
              />
              <p className="text-[11px] text-muted-foreground">
                Tambahan di luar paket standar ({DEFAULT_FEATURES_TEXT}) — daftar halaman/fitur konkret agar customer langsung paham isi website. Kosongkan jika tidak perlu ditampilkan.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> URL Demo Website
              </Label>
              <Input
                type="url"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                placeholder="https://nama-proyek.vercel.app"
                className="text-xs font-mono"
                disabled={saving}
              />
              <p className="text-[11px] text-muted-foreground">
                Khusus website yang sudah dibuat tim SaCMS untuk instansi ini (misal preview Vercel). Akan ditampilkan sebagai QR code di PDF supaya instansi bisa langsung melihat demonya.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
              <div className="text-xs">
                <span className="text-muted-foreground">Ditugaskan ke: </span>
                <span className="font-bold">{proposal.assignedTo ? proposal.assignedTo.name || proposal.assignedTo.email : "Belum ditugaskan"}</span>
              </div>
              {proposal.assignedToId === session?.user?.id ? (
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => handleAssign(null)}>
                  <UserMinus className="h-3 w-3 mr-1" /> Lepas Tugas
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleAssign(session?.user?.id || null)}>
                  <UserPlus className="h-3 w-3 mr-1" /> Tugaskan ke Saya
                </Button>
              )}
            </div>

            {estimatedValueIdr && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {formatRupiah(Number(estimatedValueIdr))}
              </p>
            )}

            {proposal.stage === "lost" && proposal.lostReason && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-[11px] text-red-600 dark:text-red-400">
                <span className="font-bold">Alasan gagal: </span>{proposal.lostReason}
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-border/60">
              <Label className="text-xs font-bold">Riwayat Aktivitas</Label>
              <div className="flex gap-2">
                <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Tambah catatan..." className="text-xs" disabled={addingNote} onKeyDown={(e) => e.key === "Enter" && handleAddNote()} />
                <Button size="sm" variant="outline" onClick={handleAddNote} disabled={addingNote || !newNote.trim()}>
                  {addingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat riwayat...
                </div>
              ) : activities.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">Belum ada aktivitas.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activities.map((activity) => (
                    <div key={activity.id} className="text-xs rounded-lg bg-muted/40 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">
                          {activity.type === "status_change"
                            ? `${getStageLabel(activity.fromStage || "")} → ${getStageLabel(activity.toStage || "")}`
                            : activity.author?.name || activity.author?.email || "Sistem"}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(activity.createdAt).toLocaleString("id-ID")}
                        </span>
                      </div>
                      {activity.message && <p className="text-muted-foreground mt-0.5">{activity.message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={generatingPdf}>
              {generatingPdf ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
              Unduh Proposal (PDF)
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
