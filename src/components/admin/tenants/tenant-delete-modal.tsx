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
  onOpenChange: (open: boolean) => void
  tenant: Tenant | null
  confirmationText: string
  setConfirmationText: (text: string) => void
  onConfirm: () => void
  isSubmitting: boolean
}

export function TenantDeleteModal({
  isOpen,
  onOpenChange,
  tenant,
  confirmationText,
  setConfirmationText,
  onConfirm,
  isSubmitting
}: TenantDeleteModalProps) {
  if (!tenant) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
              Type <strong className="font-mono bg-muted px-1 py-0.5 rounded select-all">{tenant.id}</strong> to confirm
            </Label>
            <Input
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Paste ID here"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            disabled={confirmationText !== tenant.id || isSubmitting}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Yes, delete workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
