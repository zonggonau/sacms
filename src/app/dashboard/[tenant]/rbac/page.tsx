"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Loader2, Shield, Key, Lock,
  Info, RefreshCw, Plus, Trash2, AlertCircle
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
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

interface Permission {
  id: string
  name: string
  displayName: string
  description: string | null
  category: string
  granted: boolean
  isOverride: boolean
}

interface Role {
  id: string
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  permissions: Permission[]
  permissionCount: number
}

export default function TenantRbacPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params.tenant as string
  const { toast } = useToast()
  
  const [permissions, setPermissions] = useState<any[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // New Role Dialog State
  const [isRoleOpen, setIsRoleOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newRole, setNewRole] = useState({
    name: "",
    displayName: "",
    description: ""
  })

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/rbac`)
      
      if (res.ok) {
        const data = await res.json()
        setRoles(data.roles || [])
        setPermissions(data.allPermissions || [])
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to fetch RBAC data" })
      }
    } catch (error) {
      console.error("Failed to fetch RBAC data:", error)
      toast({ variant: "destructive", title: "Error", description: "Could not connect to server" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (session?.user && tenantSlug) fetchData()
  }, [session, tenantSlug])

  const handleTogglePermission = async (roleName: string, permissionId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/rbac`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: roleName, // roleId in API expects the role slug/name
          permissionId,
          granted: !currentStatus
        })
      })
      
      if (res.ok) {
        toast({ title: "Updated", description: "Permission updated successfully" })
        fetchData() // Refresh
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to update" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not update permission" })
    }
  }

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/rbac/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRole),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Custom role created" })
        setIsRoleOpen(false)
        fetchData()
        setNewRole({ name: "", displayName: "", description: "" })
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

  const handleDeleteRole = async (roleId: string) => {
    if (!window.confirm("Are you sure you want to delete this role? Users assigned to this role will lose their permissions.")) return
    
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/rbac/roles/${roleId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: "Deleted", description: "Custom role has been removed" })
        fetchData()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete role" })
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
        <TenantSidebar tenantSlug={tenantSlug} />
        <main className="flex-1 min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    )
  }

  // Group permissions by category
  const categories = Array.from(new Set(permissions.map(p => p.category)))

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Roles & Permissions</h1>
              <p className="text-muted-foreground font-medium mt-1">Manage standard roles or create custom ones for your workspace.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setRefreshing(true); fetchData(); }} disabled={refreshing} className="bg-card">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Reload
              </Button>
              <Dialog open={isRoleOpen} onOpenChange={setIsRoleOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 shadow-sm rounded-xl">
                    <Plus className="mr-2 h-4 w-4" /> Add Custom Role
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl border-none shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold tracking-tight">Create Custom Role</DialogTitle>
                    <DialogDescription>Define a new role with specific permissions for your team.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateRole} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="role-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">Slug (System ID)</Label>
                        <Input id="role-name" placeholder="content-reviewer" value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value.toLowerCase().replace(/\s+/g, '-')})} required className="bg-muted/30 border-none focus-visible:ring-primary h-11" />
                        <p className="text-[10px] text-muted-foreground pl-1 font-mono">ID: {newRole.name || '...'}</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role-display" className="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">Display Name</Label>
                        <Input id="role-display" placeholder="Content Reviewer" value={newRole.displayName} onChange={e => setNewRole({...newRole, displayName: e.target.value})} required className="bg-muted/30 border-none focus-visible:ring-primary h-11" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role-desc" className="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">Description</Label>
                      <Textarea id="role-desc" placeholder="What is this role for?" value={newRole.description} onChange={e => setNewRole({...newRole, description: e.target.value})} className="bg-muted/30 border-none focus-visible:ring-primary min-h-[100px]" />
                    </div>
                    <DialogFooter className="pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsRoleOpen(false)} className="rounded-xl h-11">Cancel</Button>
                      <Button type="submit" disabled={isSubmitting} className="rounded-xl h-11 min-w-[120px]">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Role
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Tabs defaultValue="matrix" className="space-y-6">
            <TabsList className="bg-card border p-1 rounded-2xl h-12 shadow-sm inline-flex">
              <TabsTrigger value="matrix" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Permission Matrix</TabsTrigger>
              <TabsTrigger value="list" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Role Definitions</TabsTrigger>
            </TabsList>

            <TabsContent value="matrix">
              <Card className="border-none shadow-sm overflow-hidden bg-card rounded-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-4 text-left text-[11px] font-black uppercase tracking-widest text-muted-foreground min-w-[250px] pl-8">Capability</th>
                        {roles.map(role => (
                          <th key={role.id} className="p-4 text-center text-[11px] font-black uppercase tracking-widest text-muted-foreground min-w-[120px]">
                            {role.displayName}
                            {!role.isSystem && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 h-3 font-bold border-blue-200 text-blue-600 bg-blue-50/50 uppercase">Custom</Badge>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-card">
                      {categories.map(cat => (
                        <React.Fragment key={cat}>
                          <tr className="bg-muted/20">
                            <td colSpan={roles.length + 1} className="px-8 py-2.5 text-[10px] font-black uppercase text-primary tracking-widest border-y border-muted/30">
                              {cat} Management
                            </td>
                          </tr>
                          {permissions.filter(p => p.category === cat).map(perm => (
                            <tr key={perm.id} className="border-b border-muted/20 hover:bg-muted/5 transition-colors group">
                              <td className="p-4 pl-8">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold group-hover:text-primary transition-colors">{perm.displayName}</span>
                                  <span className="text-[10px] font-mono text-muted-foreground">{perm.name}</span>
                                </div>
                              </td>
                              {roles.map(role => {
                                const rolePerm = role.permissions.find(p => p.id === perm.id)
                                const hasIt = rolePerm?.granted ?? false
                                const isOverride = rolePerm?.isOverride ?? false
                                const isOwner = role.name === 'owner'
                                
                                return (
                                  <td key={`${role.id}-${perm.id}`} className="p-4 text-center">
                                    <div className="flex flex-col items-center justify-center gap-1">
                                      {isOwner ? (
                                        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                                          <Lock className="h-3.5 w-3.5 text-primary opacity-50" />
                                        </div>
                                      ) : (
                                        <>
                                          <Checkbox 
                                            checked={hasIt} 
                                            onCheckedChange={() => handleTogglePermission(role.name, perm.id, hasIt)}
                                            className="data-[state=checked]:bg-primary h-5 w-5 rounded-md border-muted-foreground/30"
                                          />
                                          {isOverride && role.isSystem && (
                                            <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter">Override</span>
                                          )}
                                        </>
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 p-5 bg-blue-50/50 border border-blue-100 rounded-2xl text-blue-700 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Info className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">System Overrides</p>
                    <p className="text-[11px] font-medium opacity-80 leading-relaxed">Changes to standard roles (Admin, Editor, Viewer) only affect this workspace. The Owner role is always locked with full access.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-emerald-700 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">Custom Workspace Roles</p>
                    <p className="text-[11px] font-medium opacity-80 leading-relaxed">Custom roles created here will be available to assign to any team member in this workspace via the Team Management page.</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="list" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <Card key={role.id} className="border-none shadow-sm bg-card rounded-2xl overflow-hidden hover:ring-2 hover:ring-primary/20 transition-all">
                    <CardHeader className="pb-3 border-b border-muted/20 bg-muted/5">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          {role.isSystem ? <Shield className="h-5 w-5" /> : <Key className="h-5 w-5" />}
                        </div>
                        <div className="flex gap-2">
                          {role.isSystem && <Badge variant="secondary" className="text-[9px] font-black uppercase bg-primary/5 text-primary border-none">System</Badge>}
                          {!role.isSystem && <Badge variant="outline" className="text-[9px] font-black uppercase border-blue-200 text-blue-600">Custom</Badge>}
                        </div>
                      </div>
                      <div className="mt-4">
                        <CardTitle className="text-lg font-bold">{role.displayName}</CardTitle>
                        <CardDescription className="text-xs font-mono mt-1 opacity-70">ID: {role.name}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-4">
                      <p className="text-xs text-muted-foreground min-h-[40px] leading-relaxed">
                        {role.description || "No description provided for this role."}
                      </p>
                      
                      <div className="pt-4 border-t border-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-muted text-muted-foreground hover:bg-muted border-none font-bold text-[10px] h-5 px-1.5">
                            {role.permissionCount} Permissions
                          </Badge>
                        </div>
                        {!role.isSystem && (
                          <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-lg px-2 text-[11px] font-bold uppercase tracking-tight">
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-[11px] font-bold leading-relaxed">Deleting a custom role will also remove it from any users assigned to it. Standard system roles cannot be deleted.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
