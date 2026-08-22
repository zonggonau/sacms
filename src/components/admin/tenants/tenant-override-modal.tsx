import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
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
} from "@/components/ui/dialog"
import { Tenant } from "@/hooks/admin/use-admin-tenants"

interface TenantOverrideModalProps {
  isOpen: boolean
  onOpenChange?: (open: boolean) => void
  onClose?: () => void
  tenant: Tenant | null
  formData: {
    maxContentTypes: string
    maxContentEntries: string
    maxTeamMembers: string
    maxStorage: string
    maxLocales: string
    maxApiCalls: string
    note: string
  }
  setFormData: (data: any) => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting?: boolean
  loading?: boolean
  onReset?: () => void
}

export function TenantOverrideModal({
  isOpen,
  onOpenChange,
  onClose,
  tenant,
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
  loading,
  onReset
}: TenantOverrideModalProps) {
  if (!tenant) return null

  const isBusy = isSubmitting || loading || false

  const handleClose = (open: boolean) => {
    if (!open) {
      if (onClose) onClose()
      if (onOpenChange) onOpenChange(false)
    } else {
      if (onOpenChange) onOpenChange(true)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Override Tenant Limits</DialogTitle>
          <DialogDescription>
            Set custom limits for {tenant.name}. This overrides their default plan limits.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxContentTypes">Content Types</Label>
              <Input
                id="maxContentTypes"
                type="number"
                placeholder="e.g. 50"
                value={formData.maxContentTypes}
                onChange={(e) => setFormData({ ...formData, maxContentTypes: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxContentEntries">Entries per Type</Label>
              <Input
                id="maxContentEntries"
                type="number"
                placeholder="e.g. 10000"
                value={formData.maxContentEntries}
                onChange={(e) => setFormData({ ...formData, maxContentEntries: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxTeamMembers">Team Members</Label>
              <Input
                id="maxTeamMembers"
                type="number"
                placeholder="e.g. 10"
                value={formData.maxTeamMembers}
                onChange={(e) => setFormData({ ...formData, maxTeamMembers: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxStorage">Storage (MB)</Label>
              <Input
                id="maxStorage"
                type="number"
                placeholder="e.g. 5000"
                value={formData.maxStorage}
                onChange={(e) => setFormData({ ...formData, maxStorage: e.target.value })}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="note">Internal Note / Reason</Label>
            <Textarea
              id="note"
              placeholder="Why are these limits being overridden?"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={2}
            />
          </div>

          <div className="bg-amber-50 p-3 rounded-md flex items-start gap-3 mt-4 border border-amber-200">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Warning</p>
              <p>Empty fields will fall back to their plan defaults. To remove an existing override, clear the field.</p>
            </div>
          </div>

          <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-2 sm:justify-between items-center w-full">
            {onReset && (
              <Button type="button" variant="ghost" onClick={onReset} className="text-destructive w-full sm:w-auto">
                Clear Overrides
              </Button>
            )}
            <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
              <Button type="button" variant="outline" onClick={() => handleClose(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy} className="w-full sm:w-auto">
                {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Overrides
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
