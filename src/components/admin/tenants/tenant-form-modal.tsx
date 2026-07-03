import { Loader2 } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SYSTEM_TENANT_SLUG, TENANT_STATUSES } from "@/lib/constants"
import { DEFAULT_LIMITS } from "@/lib/constants/tenant-limits"
import React from "react"

const TENANT_PLANS = Object.keys(DEFAULT_LIMITS)

interface TenantFormModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  isEditing: boolean
  formData: {
    name: string
    slug: string
    description: string
    plan: string
    status: string
    databaseUrl: string
  }
  setFormData: (data: any) => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
}

export function TenantFormModal({
  isOpen,
  onOpenChange,
  isEditing,
  formData,
  setFormData,
  onSubmit,
  isSubmitting
}: TenantFormModalProps) {
  const isSystemTenant = formData.slug === SYSTEM_TENANT_SLUG

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Tenant" : "Create Workspace"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update tenant configuration." : "Create a new isolated workspace environment."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace Name</Label>
            <Input
              id="name"
              placeholder="Acme Corp"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={isSystemTenant}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL identifier)</Label>
            <Input
              id="slug"
              placeholder="acme-corp"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              required
              disabled={isEditing}
            />
            {!isEditing && <p className="text-xs text-muted-foreground">This will be used for API endpoints and dashboard URLs. Cannot be changed later.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Main workspace for Acme..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan">Billing Plan</Label>
              <Select value={formData.plan} onValueChange={(val) => setFormData({ ...formData, plan: val })} disabled={isSystemTenant}>
                <SelectTrigger id="plan">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {TENANT_PLANS.map(plan => (
                    <SelectItem key={plan} value={plan} className="capitalize">{plan}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })} disabled={isSystemTenant}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {TENANT_STATUSES.map(status => (
                    <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="databaseUrl" className="flex items-center gap-2">
              Database URL
              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Enterprise</span>
            </Label>
            <Input
              id="databaseUrl"
              placeholder="postgresql://user:pass@host:5432/db"
              value={formData.databaseUrl}
              onChange={(e) => setFormData({ ...formData, databaseUrl: e.target.value })}
              disabled={isSystemTenant}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Leave blank to use the shared database pool. Require Enterprise license to function.
            </p>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || (isSystemTenant && !formData.databaseUrl)}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
