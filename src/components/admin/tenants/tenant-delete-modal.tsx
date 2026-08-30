"use client"

import { useState } from "react"
import { AlertTriangle, Loader2, Trash2, Copy, Check, Users, Database, ImageIcon, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tenant } from "@/hooks/admin/use-admin-tenants"

interface TenantDeleteModalProps {
  isOpen: boolean
  onOpenChange?: (open: boolean) => void
  onClose?: () => void
  tenant: Tenant | null
  confirmationText?: string
  confirmation?: string
  setConfirmationText?: (text: string) => void
  setConfirmation?: (text: string) => void
  onConfirm: () => void
  isSubmitting: boolean
}

export function TenantDeleteModal({
  isOpen,
  onOpenChange,
  onClose,
  tenant,
  confirmationText,
  confirmation,
  setConfirmationText,
  setConfirmation,
  onConfirm,
  isSubmitting
}: TenantDeleteModalProps) {
  const [copied, setCopied] = useState(false)

  if (!tenant) return null

  const handleClose = (open: boolean) => {
    if (!open) {
      if (onClose) onClose()
      if (onOpenChange) onOpenChange(false)
    } else {
      if (onOpenChange) onOpenChange(true)
    }
  }

  const currentText = confirmationText ?? confirmation ?? ""
  const handleTextChange = (val: string) => {
    if (setConfirmationText) setConfirmationText(val)
    if (setConfirmation) setConfirmation(val)
  }

  const handleAutoFill = () => {
    handleTextChange(tenant.name)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const normalizedInput = currentText.trim().toLowerCase()
  const isValidConfirmation =
    Boolean(normalizedInput) &&
    (normalizedInput === tenant.name.trim().toLowerCase() ||
     normalizedInput === tenant.id.trim().toLowerCase() ||
     normalizedInput === (tenant.slug || "").trim().toLowerCase())

  const memberCount = tenant._count?.members ?? 0
  const contentTypeCount = (tenant._count?.contentTypeAssignments ?? 0) + (tenant._count?.componentAssignments ?? 0)
  const mediaCount = tenant._count?.media ?? 0
  const apiTokenCount = tenant._count?.apiTokens ?? 0

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl border-border/80 bg-card p-6 shadow-lg">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-destructive">
                Hapus Workspace Permanen
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Tindakan ini tidak dapat dibatalkan. Seluruh data workspace akan dihapus selamanya.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target Workspace Info Card */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-sm text-foreground truncate">{tenant.name}</div>
                <div className="text-[11px] font-mono text-muted-foreground">/{tenant.slug} &bull; <span className="text-[10px] opacity-75">ID: {tenant.id}</span></div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold capitalize shrink-0 border-border/80">
                Paket {tenant.plan}
              </Badge>
            </div>

            {/* Impact Metric Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-medium">{memberCount} Anggota</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Database className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-medium">{contentTypeCount} Skema</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-medium">{mediaCount} Media</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Key className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-medium">{apiTokenCount} Token</span>
              </div>
            </div>
          </div>

          {/* Warning Message Box */}
          <div className="bg-destructive/10 p-3 rounded-xl text-destructive text-xs font-medium border border-destructive/20 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Perhatian: Menghapus workspace ini akan menghapus database, entri konten, berkas aset di storage Cloudflare R2, dan mencabut seluruh akses anggota tim.
            </span>
          </div>

          {/* Confirmation Input Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="delete-confirm-input" className="text-xs font-semibold text-foreground">
                Ketik nama <span className="font-mono text-primary font-bold">{tenant.name}</span> atau slug <span className="font-mono text-primary font-bold">{tenant.slug}</span>:
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAutoFill}
                className="h-6 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3 mr-1 text-emerald-500" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? "Terisi" : "Isi Otomatis"}
              </Button>
            </div>
            <Input
              id="delete-confirm-input"
              value={currentText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={`Ketik "${tenant.name}" di sini`}
              className="font-mono text-xs h-9 rounded-xl border-border/80 bg-background"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
            className="rounded-xl text-xs font-bold h-9"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={!isValidConfirmation || isSubmitting}
            className="rounded-xl text-xs font-bold h-9 shadow-xs"
          >
            {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
            Ya, Hapus Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
