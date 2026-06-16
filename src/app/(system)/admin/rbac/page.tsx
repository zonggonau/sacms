"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Loader2, Shield, Key, Plus, CheckCircle2, XCircle, Lock,
  ChevronRight, Info, AlertCircle, Save, RefreshCw, MoreVertical, Edit, Trash2
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Permission {
  id: string
  name: string
  displayName: string
  description: string | null
  category: string
}

interface Role {
  id: string
  name: string
  displayName: string
  description: string | null
  permissions: Array<{ id: string; name: string }>
  permissionCount: number
}

export default function AdminRbacPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // New Permission Dialog State
  const [isPermOpen, setIsPermOpen] = useState(false)
  const [isEditPermOpen, setIsEditPermOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newPerm, setNewPerm] = useState({
    name: "",
    displayName: "",
    category: "content",
    description: ""
  })
  const [editingPerm, setEditingPerm] = useState<Permission | null>(null)

  const fetchData = async () => {
    try {
      const [permRes, roleRes] = await Promise.all([
        fetch("/api/admin/rbac/permissions"),
        fetch("/api/admin/rbac/roles")
      ])
      
      if (permRes.ok) {
        const data = await permRes.json()
        setPermissions(data.permissions || [])
      }
      
      if (roleRes.ok) {
        const data = await roleRes.json()
        setRoles(data.roles || [])
      }
    } catch (error) {
      console.error("Failed to fetch RBAC data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (session?.user?.role === "super_admin") fetchData()
  }, [session])

  const handleTogglePermission = async (roleId: string, permissionId: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/admin/rbac/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId,
          permissionId,
          granted: !currentStatus
        })
      })
      
      if (res.ok) {
        toast({ title: "Updated", description: "Permission updated successfully" })
        fetchData() // Refresh
      } else {
        throw new Error("Failed to update")
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not update permission" })
    }
  }

  const handleToggleCategory = async (roleId: string, category: string, currentGranted: boolean) => {
    const permsInCategory = permissions.filter(p => p.category === category)
    try {
      await Promise.all(permsInCategory.map(p => 
        fetch("/api/admin/rbac/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId, permissionId: p.id, granted: !currentGranted })
        })
      ))
      toast({ title: "Updated", description: `Updated all ${category} permissions for role` })
      fetchData()
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update permissions" })
    }
  }

  const handleCreatePermission = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/admin/rbac/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPerm),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Permission created" })
        setIsPermOpen(false)
        fetchData()
        setNewPerm({ name: "", displayName: "", category: "content", description: "" })
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "An error occurred" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdatePermission = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPerm) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/rbac/permissions/${editingPerm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingPerm.name,
          displayName: editingPerm.displayName,
          description: editingPerm.description,
          category: editingPerm.category,
        }),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Permission updated" })
        setIsEditPermOpen(false)
        fetchData()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "An error occurred" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePermission = async (id: string) => {
    if (!confirm("Are you sure you want to delete this permission? This action cannot be undone and will remove it from all roles.")) return
    try {
      const res = await fetch(`/api/admin/rbac/permissions/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Deleted", description: "Permission has been removed" })
        fetchData()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "An error occurred" })
    }
  }

  const categoryColors: Record<string, string> = {
    content: "bg-blue-100 text-blue-700",
    media: "bg-purple-100 text-purple-700",
    users: "bg-green-100 text-green-700",
    settings: "bg-orange-100 text-orange-700",
    api: "bg-pink-100 text-pink-700",
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

  // Group permissions by category
  const categories = Array.from(new Set(permissions.map(p => p.category)))

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Role-Based Access Control</h1>
              <p className="text-muted-foreground">Define platform capabilities and map them to workspace roles.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setRefreshing(true); fetchData(); }} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Reload
              </Button>
              <Dialog open={isPermOpen} onOpenChange={setIsPermOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90">
                    <Plus className="mr-2 h-4 w-4" /> New Permission
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add System Permission</DialogTitle>
                    <DialogDescription>Create a new granular capability that can be assigned to roles.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreatePermission} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="perm-name">System Name (slug)</Label>
                        <Input id="perm-name" placeholder="content.archive" value={newPerm.name} onChange={e => setNewPerm({...newPerm, name: e.target.value.toLowerCase()})} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="perm-display">Display Name</Label>
                        <Input id="perm-display" placeholder="Archive Content" value={newPerm.displayName} onChange={e => setNewPerm({...newPerm, displayName: e.target.value})} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="perm-cat">Category</Label>
                      <Select value={newPerm.category} onValueChange={v => setNewPerm({...newPerm, category: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="content">Content</SelectItem>
                          <SelectItem value="media">Media</SelectItem>
                          <SelectItem value="users">Users</SelectItem>
                          <SelectItem value="settings">Settings</SelectItem>
                          <SelectItem value="api">API</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="perm-desc">Description</Label>
                      <Textarea id="perm-desc" placeholder="What does this allow users to do?" value={newPerm.description} onChange={e => setNewPerm({...newPerm, description: e.target.value})} />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsPermOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Permission
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Tabs defaultValue="matrix" className="space-y-6">
            <TabsList className="bg-card border p-1 rounded-xl">
              <TabsTrigger value="matrix" className="rounded-lg">Permission Matrix</TabsTrigger>
              <TabsTrigger value="permissions" className="rounded-lg">Definition List</TabsTrigger>
            </TabsList>

            <TabsContent value="matrix">
              <Card className="border-none shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[250px]">Capability</th>
                        {roles.map(role => (
                          <th key={role.id} className="p-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[120px]">
                            {role.displayName}
                            <Badge variant="outline" className="ml-2 text-[8px] bg-muted/50 rounded-none text-muted-foreground tracking-tighter">SYSTEM</Badge>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-card">
                      {categories.map(cat => (
                        <React.Fragment key={cat}>
                          <tr className="bg-muted/20">
                            <td className="px-4 py-2 text-[10px] font-black uppercase text-primary tracking-widest border-y">
                              {cat} Management
                            </td>
                            {roles.map(role => {
                               const catPerms = permissions.filter(p => p.category === cat)
                               const rolePermsInCat = role.permissions.filter(rp => catPerms.some(p => p.id === rp.id))
                               const allGranted = catPerms.length > 0 && rolePermsInCat.length === catPerms.length
                               const isOwner = role.id === 'owner'
                               return (
                                 <td key={`toggle-${role.id}-${cat}`} className="px-4 py-2 text-center border-y">
                                    {!isOwner && (
                                       <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground" onClick={() => handleToggleCategory(role.id, cat, allGranted)}>
                                         {allGranted ? 'Deselect All' : 'Select All'}
                                       </Button>
                                    )}
                                 </td>
                               )
                            })}
                          </tr>
                          {permissions.filter(p => p.category === cat).map(perm => (
                            <tr key={perm.id} className="border-b hover:bg-muted/5 transition-colors">
                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold">{perm.displayName}</span>
                                  <span className="text-[10px] font-mono text-muted-foreground">{perm.name}</span>
                                </div>
                              </td>
                              {roles.map(role => {
                                const hasIt = role.permissions.some(rp => rp.id === perm.id)
                                const isOwner = role.id === 'owner'
                                return (
                                  <td key={`${role.id}-${perm.id}`} className="p-4 text-center">
                                    <div className="flex justify-center">
                                      {isOwner ? (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center cursor-not-allowed">
                                                <Lock className="h-3 w-3 text-primary opacity-50" />
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="rounded-none">
                                              <p>Owner always has full permissions</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : (
                                        <Checkbox 
                                          checked={hasIt} 
                                          onCheckedChange={() => handleTogglePermission(role.id, perm.id, hasIt)}
                                          className="data-[state=checked]:bg-primary"
                                        />
                                      )}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="mt-4 flex items-center gap-2 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-xs">
                <Info className="h-4 w-4 shrink-0" />
                <span>Note: <strong>Owner</strong> role always has full permissions and cannot be modified. Changes take effect immediately for all tenants.</span>
              </div>
            </TabsContent>

            <TabsContent value="permissions">
              <div className="grid gap-4">
                {permissions.map((permission) => (
                  <Card key={permission.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${categoryColors[permission.category] || "bg-gray-100"}`}>
                            <Key className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold">{permission.displayName}</h3>
                              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tight">{permission.category}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{permission.name}</p>
                            {permission.description && (
                              <p className="text-xs text-muted-foreground mt-2 max-w-md">{permission.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-none shadow-none border-border">
                               <DropdownMenuItem className="cursor-pointer" onClick={() => { setEditingPerm(permission); setIsEditPermOpen(true); }}>
                                 <Edit className="h-4 w-4 mr-2" /> Edit
                               </DropdownMenuItem>
                               <DropdownMenuItem className="text-red-600 focus:text-red-600 cursor-pointer" onClick={() => handleDeletePermission(permission.id)}>
                                 <Trash2 className="h-4 w-4 mr-2" /> Delete
                               </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Permission Dialog */}
      <Dialog open={isEditPermOpen} onOpenChange={setIsEditPermOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permission</DialogTitle>
            <DialogDescription>Update details for {editingPerm?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePermission} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-perm-name">System Name (slug)</Label>
                <Input id="edit-perm-name" value={editingPerm?.name || ''} onChange={e => editingPerm && setEditingPerm({...editingPerm, name: e.target.value.toLowerCase()})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-perm-display">Display Name</Label>
                <Input id="edit-perm-display" value={editingPerm?.displayName || ''} onChange={e => editingPerm && setEditingPerm({...editingPerm, displayName: e.target.value})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-perm-cat">Category</Label>
              <Select value={editingPerm?.category || 'content'} onValueChange={v => editingPerm && setEditingPerm({...editingPerm, category: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="content">Content</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-perm-desc">Description</Label>
              <Textarea id="edit-perm-desc" value={editingPerm?.description || ''} onChange={e => editingPerm && setEditingPerm({...editingPerm, description: e.target.value})} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditPermOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
