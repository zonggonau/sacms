"use client"

import { useState } from "react"
import { Building2, Plus, Search, ChevronLeft, ChevronRight, Loader2, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useAdminTenants, Tenant } from "@/hooks/admin/use-admin-tenants"
import { TenantTable } from "@/components/admin/tenants/tenant-table"
import { TenantFormModal } from "@/components/admin/tenants/tenant-form-modal"
import { TenantDeleteModal } from "@/components/admin/tenants/tenant-delete-modal"
import { TenantOverrideModal } from "@/components/admin/tenants/tenant-override-modal"

export default function AdminTenantsPage() {
  const { toast } = useToast()
  const {
    tenants,
    loading,
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    totalPages,
    totalTenants,
    refetch
  } = useAdminTenants()

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isOverrideOpen, setIsOverrideOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [isSettingUpGlobal, setIsSettingUpGlobal] = useState(false)

  // Selection States
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null)
  const [overrideTenant, setOverrideTenant] = useState<Tenant | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  // Form States
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    plan: "free",
    status: "active",
    databaseUrl: ""
  })

  const [overrideFormData, setOverrideFormData] = useState({
    maxContentTypes: "",
    maxContentEntries: "",
    maxTeamMembers: "",
    maxStorage: "",
    maxLocales: "",
    maxApiCalls: "",
    note: ""
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Tenant created successfully" })
        setIsCreateOpen(false)
        refetch()
        setFormData({ name: "", slug: "", description: "", plan: "free", status: "active", databaseUrl: "" })
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to create tenant" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTenant) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${selectedTenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Tenant updated successfully" })
        setIsEditOpen(false)
        refetch()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to update tenant" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!tenantToDelete) return
    if (tenantToDelete.slug === "sacms-global" || tenantToDelete.slug === "sacms" || tenantToDelete.id === "sacms-global" || tenantToDelete.name.toLowerCase() === "sacms global") {
      toast({ variant: "destructive", title: "Action Forbidden", description: "Global tenant cannot be deleted." })
      return
    }
    if (deleteConfirmation !== tenantToDelete.id) {
      toast({ variant: "destructive", title: "Validation Error", description: "Tenant ID does not match" })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantToDelete.id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Deleted", description: "Tenant deleted successfully" })
        setIsDeleteOpen(false)
        refetch()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to delete tenant" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete tenant" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        toast({ title: "Success", description: `Tenant status updated to ${status}` })
        refetch()
      } else {
        toast({ variant: "destructive", title: "Error", description: "Failed to update status" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update status" })
    }
  }

  const handleSaveOverrides = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!overrideTenant) return

    setOverrideLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${overrideTenant.id}/overrides`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrideFormData)
      })

      if (res.ok) {
        toast({ title: "Success", description: "Tenant limits overridden successfully" })
        setIsOverrideOpen(false)
        refetch()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to save overrides" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setOverrideLoading(false)
    }
  }

  const handleResetOverrides = async () => {
    if (!overrideTenant) return
    setOverrideLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${overrideTenant.id}/overrides`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Success", description: "Tenant overrides removed. Back to plan defaults." })
        setIsOverrideOpen(false)
        refetch()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to remove overrides" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setOverrideLoading(false)
    }
  }

  const handleSetupGlobalTenant = async () => {
    setIsSettingUpGlobal(true)
    try {
      const res = await fetch("/api/admin/tenants/setup-global", { method: "POST" })
      if (res.ok) {
        toast({ title: "Setup Successful", description: "Global Tenant & Seed Data provisioned successfully." })
        refetch()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Setup Failed", description: err.error || "Failed to setup global tenant" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Setup Error", description: "An unexpected error occurred during setup." })
    } finally {
      setIsSettingUpGlobal(false)
    }
  }

  const openCreate = () => {
    setFormData({ name: "", slug: "", description: "", plan: "free", status: "active", databaseUrl: "" })
    setIsCreateOpen(true)
  }

  const openEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description || "",
      plan: tenant.plan,
      status: tenant.status,
      databaseUrl: tenant.databaseUrl || ""
    })
    setIsEditOpen(true)
  }

  const openDelete = (tenant: Tenant) => {
    if (tenant.slug === "sacms-global" || tenant.slug === "sacms" || tenant.id === "sacms-global" || tenant.name.toLowerCase() === "sacms global") {
      toast({ variant: "destructive", title: "Action Forbidden", description: "Global tenant cannot be deleted." })
      return
    }
    setTenantToDelete(tenant)
    setDeleteConfirmation("")
    setIsDeleteOpen(true)
  }

  const openOverride = async (tenant: Tenant) => {
    setOverrideTenant(tenant)
    setOverrideFormData({
      maxContentTypes: "",
      maxContentEntries: "",
      maxTeamMembers: "",
      maxStorage: "",
      maxLocales: "",
      maxApiCalls: "",
      note: ""
    })
    setIsOverrideOpen(true)
    setOverrideLoading(true)
    
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/overrides`)
      if (res.ok) {
        const data = await res.json()
        if (data.overrides) {
          setOverrideFormData({
            maxContentTypes: data.overrides.maxContentTypes?.toString() || "",
            maxContentEntries: data.overrides.maxContentEntries?.toString() || "",
            maxTeamMembers: data.overrides.maxTeamMembers?.toString() || "",
            maxStorage: data.overrides.maxStorage?.toString() || "",
            maxLocales: data.overrides.maxLocales?.toString() || "",
            maxApiCalls: data.overrides.maxApiCalls?.toString() || "",
            note: data.overrides.note || ""
          })
        }
      }
    } catch (error) {
      console.error("Failed to fetch overrides:", error)
    } finally {
      setOverrideLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 min-h-screen bg-muted/10 flex-col w-full">
        <div className="p-6 lg:p-8 w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Tenant Management</h1>
              <p className="text-muted-foreground">
                Manage {totalTenants} workspaces across the platform
              </p>
            </div>
            
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                onClick={handleSetupGlobalTenant} 
                disabled={isSettingUpGlobal}
                className="gap-2"
              >
                {isSettingUpGlobal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                Setup Global Tenant SaCMS
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search workspaces by name or slug..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <TenantTable 
            tenants={tenants}
            loading={loading}
            onEdit={openEdit}
            onDelete={openDelete}
            onOverride={openOverride}
            onStatusChange={handleStatusChange}
          />

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <TenantFormModal 
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        isEditing={false}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />

      <TenantFormModal 
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        isEditing={true}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
      />

      <TenantDeleteModal 
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        tenant={tenantToDelete}
        confirmationText={deleteConfirmation}
        setConfirmationText={setDeleteConfirmation}
        onConfirm={confirmDelete}
        isSubmitting={isSubmitting}
      />

      <TenantOverrideModal 
        isOpen={isOverrideOpen}
        onOpenChange={setIsOverrideOpen}
        tenant={overrideTenant}
        formData={overrideFormData}
        setFormData={setOverrideFormData}
        onSubmit={handleSaveOverrides}
        isSubmitting={overrideLoading}
        onReset={handleResetOverrides}
      />
    </div>
  )
}
