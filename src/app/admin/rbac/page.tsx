"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Loader2, Shield, Key, Plus, CheckCircle2, XCircle, Lock,
  ChevronRight, Info, AlertCircle, Save, RefreshCw
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newPerm, setNewPerm] = useState({
    name: "",
    displayName: "",
    category: "content",
    description: ""
  })

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
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
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
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-card">
                      {categories.map(cat => (
                        <React.Fragment key={cat}>
                          <tr className="bg-muted/20">
                            <td colSpan={roles.length + 1} className="px-4 py-2 text-[10px] font-black uppercase text-primary tracking-widest border-y">
                              {cat} Management
                            </td>
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
                                        <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                                          <Lock className="h-3 w-3 text-primary opacity-50" />
                                        </div>
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
                          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
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
    </div>
  )
}

import React from "react"
import { MoreVertical } from "lucide-react"
