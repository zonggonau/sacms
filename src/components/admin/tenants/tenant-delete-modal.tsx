import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete Workspace</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the workspace
            <strong className="mx-1 text-foreground">{tenant.name}</strong>
            and all of its content, users, media, and API tokens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-destructive/10 p-3 rounded-md text-destructive text-sm font-medium border border-destructive/20">
            Warning: You are about to destroy data for {tenant._count.members} users and {tenant._count.singleTypeAssignments} entries.
          </div>
          
          <div className="space-y-2">
            <Label>
              Ketik nama workspace <strong className="font-mono bg-muted px-1.5 py-0.5 rounded select-all text-foreground">{tenant.name}</strong> atau ID <strong className="font-mono bg-muted px-1.5 py-0.5 rounded select-all text-foreground text-xs">{tenant.id}</strong> untuk konfirmasi:
            </Label>
            <Input
              value={currentText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={`Ketik "${tenant.name}" atau ID di sini`}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Batal
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            disabled={
              !currentText ||
              (currentText.trim().toLowerCase() !== tenant.name.trim().toLowerCase() &&
               currentText.trim().toLowerCase() !== tenant.id.trim().toLowerCase() &&
               currentText.trim().toLowerCase() !== (tenant.slug || "").trim().toLowerCase()) ||
              isSubmitting
            }
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Ya, Hapus Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
