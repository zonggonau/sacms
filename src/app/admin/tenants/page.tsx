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
  ImageIcon, Key, MoreVertical, Edit, Trash2, Plus, AlertCircle, Ban, CheckCircle, Play
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
}

export default function AdminTenantsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSubmitting, setIsCreateSubmitting] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)

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

  const fetchTenants = async () => {
    try {
      const res = await fetch("/api/admin/tenants")
      if (res.ok) {
        const data = await res.json()
        setTenants(data.tenants || data || [])
      }
    } catch (error) {
      console.error("Failed to fetch tenants:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin") fetchTenants()
  }, [session])

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tenant? All data will be lost.")) return
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Deleted", description: "Tenant deleted successfully" })
        fetchTenants()
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete tenant" })
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

  if (status === "loading" || loading) {
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
                Manage {tenants.length} workspaces across the platform
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
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
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Workspaces</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold">{tenants.length}</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold text-green-600">
                  {tenants.filter((t) => t.status === "active").length}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue Plans</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold text-blue-600">
                  {tenants.filter((t) => t.plan !== "free").length}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suspended</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold text-orange-600">
                  {tenants.filter((t) => t.status === "suspended").length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tenant List */}
          {filteredTenants.length === 0 ? (
            <Card className="rounded-none shadow-none">
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No workspaces found</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  {searchQuery ? "Try adjusting your search query or filters" : "Get started by creating your first tenant workspace."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredTenants.map((tenant) => (
                <Card key={tenant.id} className="group overflow-hidden rounded-none shadow-none hover:bg-background transition-colors">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row md:items-center p-4 md:p-6 gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 shrink-0 bg-muted flex items-center justify-center text-foreground font-bold text-lg border border-border rounded-none">
                          {tenant.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-lg truncate">{tenant.name}</span>
                            {tenant.slug === "sacms-global" && (
                              <Badge className="rounded-none bg-purple-500 text-white text-xs shrink-0">
                                SYSTEM
                              </Badge>
                            )}
                            <Badge variant={tenant.status === "active" ? "default" : "secondary"} className={
                              tenant.status === "active" ? "bg-green-500 text-white hover:bg-green-600 rounded-none" : "bg-muted/50 text-foreground hover:bg-zinc-300 rounded-none"
                            }>
                              {tenant.status === "active" ? <CheckCircle className="mr-1 h-3 w-3" /> : <Ban className="mr-1 h-3 w-3" />}
                              {tenant.status}
                            </Badge>
                            <Badge variant="outline" className="capitalize rounded-none border-border">
                              {tenant.plan}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground font-mono">/{tenant.slug}</p>
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
                        {tenant.slug === "sacms-global" && (
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

                        {tenant.slug !== "sacms-global" && (
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
                              <DropdownMenuItem onClick={() => handleStatusChange(tenant.id, tenant.status === 'active' ? 'suspended' : 'active')}>
                                {tenant.status === 'active' ? (
                                  <><Ban className="mr-2 h-4 w-4 text-orange-500" /> Suspend Tenant</>
                                ) : (
                                  <><CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Activate Tenant</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(tenant.id)} className="text-red-500 focus:text-red-500">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={formData.status} onValueChange={val => setFormData({...formData, status: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
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
      </div>
    </div>
  )
}
