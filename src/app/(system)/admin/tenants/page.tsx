"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Loader2, Building2, Search, ArrowUpRight, Users, Database, FileText,
  ImageIcon, Key, MoreVertical, Edit, Trash2, Plus, AlertCircle, Ban, CheckCircle, Play, ChevronLeft, ChevronRight, X, Shield, Sliders
} from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { SYSTEM_TENANT_SLUG, TENANT_STATUSES } from "@/lib/constants"
import { DEFAULT_LIMITS } from "@/lib/tenant-plan"
import { Skeleton } from "@/components/ui/skeleton"

const TENANT_PLANS = Object.keys(DEFAULT_LIMITS)

interface Tenant {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  databaseUrl: string | null
  description: string | null
  createdAt: string
  _count: {
    members: number
    contentTypeAssignments: number
    singleTypeAssignments: number
    componentAssignments: number
    media: number
    apiTokens: number
  }
  members: {
    role: string
    user: { id: string; name: string; email: string }
  }[]
  subscriptions: {
    id: string
    plan: string
    status: string
    currentPeriodEnd: string
  }[]
}

export default function AdminTenantsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalTenants, setTotalTenants] = useState(0)
  const [sort, setSort] = useState("createdAt:desc")

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isSubmitting, setIsCreateSubmitting] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  // Override States
  const [isOverrideOpen, setIsOverrideOpen] = useState(false)
  const [overrideTenant, setOverrideTenant] = useState<Tenant | null>(null)
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [overrideFormData, setOverrideFormData] = useState({
    maxContentTypes: "",
    maxContentEntries: "",
    maxTeamMembers: "",
    maxStorage: "",
    maxLocales: "",
    maxApiCalls: "",
    note: ""
  })

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    plan: "free",
    status: "active",
    databaseUrl: ""
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const fetchTenants = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants?page=${page}&limit=10&search=${encodeURIComponent(debouncedSearch)}&sort=${encodeURIComponent(sort)}`)
      if (res.ok) {
        const data = await res.json()
        setTenants(data.tenants || [])
        setTotalPages(data.totalPages || 1)
        setTotalTenants(data.total || 0)
      }
    } catch (error) {
      console.error("Failed to fetch tenants:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin") {
      fetchTenants()
    }
  }, [session, page, debouncedSearch, sort])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreateSubmitting(true)
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Tenant created successfully" })
        setIsCreateOpen(false)
        fetchTenants()
        setFormData({ name: "", slug: "", description: "", plan: "free", status: "active", databaseUrl: "" })
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to create tenant" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setIsCreateSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTenant) return
    setIsCreateSubmitting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${selectedTenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Tenant updated successfully" })
        setIsEditOpen(false)
        fetchTenants()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to update tenant" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setIsCreateSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!tenantToDelete) return
    if (deleteConfirmation !== tenantToDelete.id) {
      toast({ variant: "destructive", title: "Validation Error", description: "Tenant ID does not match" })
      return
    }

    setIsCreateSubmitting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantToDelete.id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Deleted", description: "Tenant deleted successfully" })
        setIsDeleteOpen(false)
        fetchTenants()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to delete tenant" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete tenant" })
    } finally {
      setIsCreateSubmitting(false)
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
        toast({ title: "Updated", description: `Tenant status changed to ${status}` })
        fetchTenants()
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update status" })
    }
  }

  const handleRunSeed = async () => {
    try {
      const res = await fetch("/api/admin/global/seed", { method: "POST" })
      if (res.ok) {
        toast({ title: "Success", description: "Global seed data ran successfully" })
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to run seed data" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    }
  }

  const openOverride = async (tenant: Tenant) => {
    setOverrideTenant(tenant)
    setIsOverrideOpen(true)
    setOverrideLoading(true)
    setOverrideFormData({
      maxContentTypes: "",
      maxContentEntries: "",
      maxTeamMembers: "",
      maxStorage: "",
      maxLocales: "",
      maxApiCalls: "",
      note: ""
    })
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/override`)
      if (res.ok) {
        const data = await res.json()
        if (data.override) {
          setOverrideFormData({
            maxContentTypes: data.override.maxContentTypes?.toString() || "",
            maxContentEntries: data.override.maxContentEntries?.toString() || "",
            maxTeamMembers: data.override.maxTeamMembers?.toString() || "",
            maxStorage: data.override.maxStorage?.toString() || "",
            maxLocales: data.override.maxLocales?.toString() || "",
            maxApiCalls: data.override.maxApiCalls?.toString() || "",
            note: data.override.note || ""
          })
        }
      }
    } catch (error) {
      console.error("Failed to fetch overrides:", error)
    } finally {
      setOverrideLoading(false)
    }
  }

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!overrideTenant) return
    setIsCreateSubmitting(true)
    try {
      const body = {
        maxContentTypes: overrideFormData.maxContentTypes ? parseInt(overrideFormData.maxContentTypes) : null,
        maxContentEntries: overrideFormData.maxContentEntries ? parseInt(overrideFormData.maxContentEntries) : null,
        maxTeamMembers: overrideFormData.maxTeamMembers ? parseInt(overrideFormData.maxTeamMembers) : null,
        maxStorage: overrideFormData.maxStorage ? parseInt(overrideFormData.maxStorage) : null,
        maxLocales: overrideFormData.maxLocales ? parseInt(overrideFormData.maxLocales) : null,
        maxApiCalls: overrideFormData.maxApiCalls ? parseInt(overrideFormData.maxApiCalls) : null,
        note: overrideFormData.note || null
      }
      const res = await fetch(`/api/admin/tenants/${overrideTenant.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Tenant overrides saved successfully" })
        setIsOverrideOpen(false)
        fetchTenants()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to save overrides" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setIsCreateSubmitting(false)
    }
  }

  const handleRemoveOverride = async () => {
    if (!overrideTenant) return
    if (!confirm("Are you sure you want to remove all custom overrides for this tenant?")) return
    setIsCreateSubmitting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${overrideTenant.id}/override`, {
        method: "DELETE"
      })
      if (res.ok) {
        toast({ title: "Success", description: "Tenant overrides removed successfully" })
        setIsOverrideOpen(false)
        fetchTenants()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to remove overrides" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setIsCreateSubmitting(false)
    }
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

  if (status === "loading") {
    return (
      <div className="flex">
        <div className="flex-1 min-h-screen flex items-center justify-center flex-col w-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
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
            
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" /> New Tenant
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Tenant</DialogTitle>
                  <DialogDescription>
                    Create a new workspace. Users can then be invited to this tenant.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" placeholder="Acme Corp" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan">Initial Plan</Label>
                    <Select value={formData.plan} onValueChange={val => setFormData({...formData, plan: val})}>
                      <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                      <SelectContent>
                        {TENANT_PLANS.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desc">Description</Label>
                    <Textarea id="desc" placeholder="Brief description..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dbUrl">Dedicated Database URL (Optional)</Label>
                    <Input id="dbUrl" placeholder="postgresql://user:pass@host:5432/dbname" value={formData.databaseUrl} onChange={e => setFormData({...formData, databaseUrl: e.target.value})} />
                    <p className="text-[10px] text-muted-foreground italic">Leave empty to use the shared platform database.</p>
                  </div>
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                    <p className="text-[10px] font-bold text-primary uppercase">Automation</p>
                    <p className="text-[11px] text-muted-foreground mt-1">A unique URL slug will be generated automatically.</p>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Tenant
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Select value={sort} onValueChange={(val) => { setSort(val); setPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt:desc">Newest First</SelectItem>
                  <SelectItem value="createdAt:asc">Oldest First</SelectItem>
                  <SelectItem value="name:asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name:desc">Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tenant List */}
          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="rounded-none shadow-none">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-none" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tenants.length === 0 ? (
            <Card className="rounded-none shadow-none">
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No workspaces found</h3>
                <p className="text-muted-foreground max-w-xs mx-auto mb-4">
                  {searchQuery ? "Try adjusting your search query or filters" : "Get started by creating your first tenant workspace."}
                </p>
                {searchQuery && (
                  <Button variant="outline" onClick={() => setSearchQuery("")}>Clear Search</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tenants.map((tenant) => {
                const owner = tenant.members?.[0]?.user
                const sub = tenant.subscriptions?.[0]
                
                return (
                  <Card key={tenant.id} className="group overflow-hidden rounded-none shadow-none hover:bg-background transition-colors">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row md:items-center p-4 md:p-6 gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 shrink-0 bg-muted flex items-center justify-center text-foreground font-bold text-lg border border-border rounded-none">
                            {tenant.name ? tenant.name.charAt(0).toUpperCase() : "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-lg truncate">{tenant.name || "Unnamed Workspace"}</span>
                              {tenant.slug === SYSTEM_TENANT_SLUG && (
                                <Badge className="rounded-none bg-purple-500 text-white text-xs shrink-0">
                                  SYSTEM
                                </Badge>
                              )}
                              <Badge variant={tenant.status === "active" ? "default" : "secondary"} className={
                                tenant.status === "active" ? "bg-green-500 text-white hover:bg-green-600 rounded-none capitalize" : "bg-muted/50 text-foreground hover:bg-zinc-300 rounded-none capitalize"
                              }>
                                {tenant.status === "active" ? <CheckCircle className="mr-1 h-3 w-3" /> : <Ban className="mr-1 h-3 w-3" />}
                                {tenant.status}
                              </Badge>
                              <Badge variant="outline" className="capitalize rounded-none border-border">
                                {tenant.plan}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground font-mono">/{tenant.slug}</p>
                            
                            {/* Owner and Sub info */}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {owner && (
                                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Owner: {owner.name || owner.email}</span>
                              )}
                              {sub && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> 
                                  Sub: <span className="capitalize">{sub.status}</span> 
                                  {sub.currentPeriodEnd ? ` (ends ${new Date(sub.currentPeriodEnd).toLocaleDateString()})` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 md:flex items-center gap-4 lg:gap-8 text-sm text-muted-foreground border-t md:border-t-0 pt-4 md:pt-0">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium uppercase text-muted-foreground mb-1">Members</span>
                            <span className="flex items-center gap-1.5 text-foreground">
                              <Users className="h-4 w-4 text-orange-500" /> {tenant._count.members}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-medium uppercase text-muted-foreground mb-1">Content</span>
                            <span className="flex items-center gap-1.5 text-foreground">
                              <Database className="h-4 w-4 text-orange-500" /> {tenant._count.contentTypeAssignments}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-medium uppercase text-muted-foreground mb-1">Media</span>
                            <span className="flex items-center gap-1.5 text-foreground">
                              <ImageIcon className="h-4 w-4 text-orange-500" /> {tenant._count.media}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          {tenant.slug === SYSTEM_TENANT_SLUG && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={handleRunSeed}
                              className="hidden sm:flex rounded-none border-border"
                            >
                              <Play className="mr-2 h-4 w-4 text-purple-500" /> Run Seed
                            </Button>
                          )}
                          <Link href={`/dashboard/${tenant.slug}`}>
                            <Button variant="outline" size="sm" className="hidden sm:flex rounded-none border-border">
                              Dashboard <ArrowUpRight className="ml-2 h-4 w-4" />
                            </Button>
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-none">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openEdit(tenant)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openOverride(tenant)}>
                                <Sliders className="mr-2 h-4 w-4 text-orange-500" /> Custom Overrides
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(tenant.id, tenant.status === 'active' ? 'suspended' : 'active')}>
                                {tenant.status === 'active' ? (
                                  <><Ban className="mr-2 h-4 w-4 text-orange-500" /> Suspend Tenant</>
                                ) : (
                                  <><CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Activate Tenant</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => {
                                  if (tenant.plan !== "free") {
                                    toast({ 
                                      variant: "destructive", 
                                      title: "Action Denied", 
                                      description: "Cannot delete a tenant with an active paid plan. Please downgrade the plan to free first." 
                                    })
                                  } else {
                                    setTenantToDelete(tenant)
                                    setDeleteConfirmation("")
                                    setIsDeleteOpen(true)
                                  }
                                }} 
                                className="text-red-500 focus:text-red-500"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-4 p-4 border rounded-none bg-muted/10">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Showing page {page} of {totalPages || 1} ({totalTenants} Total)
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-none border-border"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || totalPages === 0}
                    className="rounded-none border-border"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tenant: {selectedTenant?.name}</DialogTitle>
              <DialogDescription>Update workspace configuration and status.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-plan">Plan</Label>
                  <Select value={formData.plan} onValueChange={val => setFormData({...formData, plan: val})}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      {TENANT_PLANS.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={formData.status} onValueChange={val => setFormData({...formData, status: val})}>
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      {TENANT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dbUrl">Dedicated Database URL (Optional)</Label>
                <Input id="edit-dbUrl" placeholder="postgresql://user:pass@host:5432/dbname" value={formData.databaseUrl} onChange={e => setFormData({...formData, databaseUrl: e.target.value})} />
                <p className="text-[10px] text-muted-foreground italic">Update this to move tenant to a dedicated database instance.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" /> Delete Tenant
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the tenant
                <strong className="mx-1 text-foreground">{tenantToDelete?.name}</strong> 
                and remove all associated data.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-900 text-sm text-red-800 dark:text-red-300">
                <p>Please type the tenant ID to confirm deletion:</p>
                <p className="font-mono font-bold mt-1 select-all">{tenantToDelete?.id}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-delete">Tenant ID</Label>
                <Input 
                  id="confirm-delete" 
                  value={deleteConfirmation} 
                  onChange={e => setDeleteConfirmation(e.target.value)} 
                  placeholder="Type ID here..."
                  autoComplete="off"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={confirmDelete} 
                disabled={isSubmitting || deleteConfirmation !== tenantToDelete?.id}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Permanently Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Override Dialog */}
        <Dialog open={isOverrideOpen} onOpenChange={setIsOverrideOpen}>
          <DialogContent className="max-w-2xl rounded-none border border-border bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Sliders className="h-5 w-5 text-orange-500" />
                Custom Plan Overrides: {overrideTenant?.name}
              </DialogTitle>
              <DialogDescription>
                Directly override plan resource limits. Leave fields blank to inherit base plan limits ({overrideTenant?.plan} plan).
              </DialogDescription>
            </DialogHeader>

            {overrideLoading ? (
              <div className="py-12 flex justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <form onSubmit={handleSaveOverride} className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4 border border-border p-4 bg-muted/10 rounded-none">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="override-maxContentTypes" className="text-xs font-bold uppercase tracking-wider">Max Content Types</Label>
                      <Input
                        id="override-maxContentTypes"
                        type="number"
                        placeholder={`Base: ${DEFAULT_LIMITS[overrideTenant?.plan || 'free']?.max_content_types}`}
                        value={overrideFormData.maxContentTypes}
                        onChange={e => setOverrideFormData({...overrideFormData, maxContentTypes: e.target.value})}
                        className="rounded-none border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="override-maxContentEntries" className="text-xs font-bold uppercase tracking-wider">Max Content Entries</Label>
                      <Input
                        id="override-maxContentEntries"
                        type="number"
                        placeholder={`Base: ${DEFAULT_LIMITS[overrideTenant?.plan || 'free']?.max_content_entries}`}
                        value={overrideFormData.maxContentEntries}
                        onChange={e => setOverrideFormData({...overrideFormData, maxContentEntries: e.target.value})}
                        className="rounded-none border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="override-maxTeamMembers" className="text-xs font-bold uppercase tracking-wider">Max Team Members</Label>
                      <Input
                        id="override-maxTeamMembers"
                        type="number"
                        placeholder={`Base: ${DEFAULT_LIMITS[overrideTenant?.plan || 'free']?.max_team_members}`}
                        value={overrideFormData.maxTeamMembers}
                        onChange={e => setOverrideFormData({...overrideFormData, maxTeamMembers: e.target.value})}
                        className="rounded-none border-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="override-maxStorage" className="text-xs font-bold uppercase tracking-wider">Max Storage (MB)</Label>
                      <Input
                        id="override-maxStorage"
                        type="number"
                        placeholder={`Base: ${DEFAULT_LIMITS[overrideTenant?.plan || 'free']?.max_storage} MB`}
                        value={overrideFormData.maxStorage}
                        onChange={e => setOverrideFormData({...overrideFormData, maxStorage: e.target.value})}
                        className="rounded-none border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="override-maxLocales" className="text-xs font-bold uppercase tracking-wider">Max Locales</Label>
                      <Input
                        id="override-maxLocales"
                        type="number"
                        placeholder={`Base: ${DEFAULT_LIMITS[overrideTenant?.plan || 'free']?.max_locales}`}
                        value={overrideFormData.maxLocales}
                        onChange={e => setOverrideFormData({...overrideFormData, maxLocales: e.target.value})}
                        className="rounded-none border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="override-maxApiCalls" className="text-xs font-bold uppercase tracking-wider">Max API Calls / Month</Label>
                      <Input
                        id="override-maxApiCalls"
                        type="number"
                        placeholder={`Base: ${DEFAULT_LIMITS[overrideTenant?.plan || 'free']?.max_api_calls}`}
                        value={overrideFormData.maxApiCalls}
                        onChange={e => setOverrideFormData({...overrideFormData, maxApiCalls: e.target.value})}
                        className="rounded-none border-border"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="override-note" className="text-xs font-bold uppercase tracking-wider">Administrative Note</Label>
                  <Textarea
                    id="override-note"
                    placeholder="Reason for this custom override..."
                    value={overrideFormData.note}
                    onChange={e => setOverrideFormData({...overrideFormData, note: e.target.value})}
                    rows={2}
                    className="rounded-none border-border"
                  />
                </div>

                <DialogFooter className="flex sm:justify-between items-center w-full gap-2 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleRemoveOverride}
                    className="mr-auto rounded-none"
                  >
                    Remove Override
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsOverrideOpen(false)} className="rounded-none">Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Overrides
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
