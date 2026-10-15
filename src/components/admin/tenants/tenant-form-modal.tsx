import { useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
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
const MASK = "••••••••"

interface TenantFormModalProps {
  isOpen: boolean
  onOpenChange?: (open: boolean) => void
  onClose?: () => void
  isEditing?: boolean
  mode?: "create" | "edit"
  /** Needed only to reveal the real databaseUrl on demand while editing. */
  tenantId?: string
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
  onClose,
  isEditing,
  mode,
  tenantId,
  formData,
  setFormData,
  onSubmit,
  isSubmitting
}: TenantFormModalProps) {
  const isEditMode = isEditing ?? (mode === "edit")
  // Same heuristic used server-side (api/admin/tenants/[tenantId]/route.ts)
  // and in tenant-table.tsx — this used to be hardcoded `false`, so none of
  // the disabled={isSystemTenant} guards below ever actually protected the
  // global tenant's own edit form.
  const isSystemTenant = isEditMode && (
    formData.slug === SYSTEM_TENANT_SLUG ||
    formData.slug === "sacms" ||
    formData.name.toLowerCase() === "sacms global"
  )
  const [revealing, setRevealing] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const handleRevealDatabaseUrl = async () => {
    if (revealed) {
      // Toggling back off just re-masks the field visually; the real
      // value already came from the server once, so no extra audit noise
      // for a pure UI toggle.
      setFormData({ ...formData, databaseUrl: MASK })
      setRevealed(false)
      return
    }
    if (!tenantId) return
    setRevealing(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}?reveal=databaseUrl`)
      if (res.ok) {
        const data = await res.json()
        setFormData({ ...formData, databaseUrl: data.value || "" })
        setRevealed(true)
      }
    } finally {
      setRevealing(false)
    }
  }

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
          <DialogTitle>{isEditMode ? "Edit Tenant" : "Create Workspace"}</DialogTitle>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="databaseUrl" className="flex items-center gap-2">
                Database URL
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Enterprise</span>
              </Label>
              {isEditMode && tenantId && formData.databaseUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRevealDatabaseUrl}
                  disabled={revealing}
                  className="h-6 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                >
                  {revealing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : revealed ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                  {revealed ? "Sembunyikan" : "Tampilkan"}
                </Button>
              )}
            </div>
            <Input
              id="databaseUrl"
              placeholder="postgresql://user:pass@host:5432/db"
              value={formData.databaseUrl}
              onChange={(e) => setFormData({ ...formData, databaseUrl: e.target.value })}
              disabled={isSystemTenant}
              type={isEditMode && formData.databaseUrl === MASK ? "password" : "text"}
            />
            <p className="text-xs text-muted-foreground">
              {isEditMode && formData.databaseUrl === MASK
                ? "Tersimpan — klik \"Tampilkan\" untuk melihat/mengubahnya, atau kosongkan untuk kembali ke shared pool."
                : "Optional. Leave blank to use the shared database pool. Require Enterprise license to function."}
            </p>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || (isSystemTenant && !formData.databaseUrl)}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Save Changes" : "Create Workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
