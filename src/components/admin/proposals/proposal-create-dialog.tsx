"use client"

import { useState } from "react"
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
import { Loader2, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Proposal } from "./types"

interface ProposalCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (proposal: Proposal) => void
}

const INSTITUTION_TYPE_SUGGESTIONS = ["UMKM", "Sekolah", "Pemerintah", "Perusahaan"]

export function ProposalCreateDialog({ open, onOpenChange, onCreated }: ProposalCreateDialogProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [institutionName, setInstitutionName] = useState("")
  const [institutionType, setInstitutionType] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [estimatedValueIdr, setEstimatedValueIdr] = useState("")
  const [notes, setNotes] = useState("")

  const reset = () => {
    setInstitutionName("")
    setInstitutionType("")
    setContactName("")
    setContactEmail("")
    setContactPhone("")
    setEstimatedValueIdr("")
    setNotes("")
  }

  const handleSubmit = async () => {
    if (!institutionName.trim()) {
      toast({ variant: "destructive", title: "Nama Instansi Wajib Diisi" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionName: institutionName.trim(),
          institutionType: institutionType.trim() || undefined,
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          estimatedValueIdr: estimatedValueIdr.trim() ? Number(estimatedValueIdr) : undefined,
          notes: notes.trim() || undefined,
        }),
      })
      const body = await res.json()
      if (res.ok) {
        toast({ title: "Penawaran Dibuat", description: `${institutionName} ditambahkan ke pipeline.` })
        onCreated(body.proposal)
        reset()
        onOpenChange(false)
      } else {
        toast({ variant: "destructive", title: "Gagal Membuat Penawaran", description: body.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Penawaran Baru</DialogTitle>
          <DialogDescription className="text-xs">Mulai pipeline penawaran ke instansi baru.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Nama Instansi *</Label>
            <Input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="SMA Negeri 1 Nabire" className="text-xs" disabled={saving} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Jenis Instansi</Label>
            <Input value={institutionType} onChange={(e) => setInstitutionType(e.target.value)} placeholder="UMKM, Sekolah, Pemerintah, dll" className="text-xs" disabled={saving} />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {INSTITUTION_TYPE_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInstitutionType(s)}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nama Kontak</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="text-xs" disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">No. Telepon</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="text-xs" disabled={saving} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Email Kontak</Label>
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="text-xs" disabled={saving} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Estimasi Nilai Kontrak (IDR)</Label>
            <Input type="number" min={0} value={estimatedValueIdr} onChange={(e) => setEstimatedValueIdr(e.target.value)} placeholder="contoh: 15000000" className="text-xs" disabled={saving} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Catatan</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs min-h-20" disabled={saving} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
            Buat Penawaran
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
