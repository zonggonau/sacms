"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Loader2, Shield, Key, Plus, Lock, Info, RefreshCw, MoreVertical, Edit, Trash2,
  Building2, Users, CreditCard, Settings, ShieldCheck, Crown, UserCheck
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
  isLocked?: boolean
  permissions: Array<{ id: string; name: string }>
  permissionCount: number
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  workspaces: { label: "Workspaces & Tenants", icon: Building2, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  users: { label: "Pengguna & Akun Platform", icon: Users, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  billing: { label: "Billing & Langganan", icon: CreditCard, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  system: { label: "Sistem & Infrastruktur", icon: Settings, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  security: { label: "Keamanan & Lisensi", icon: ShieldCheck, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
}

export function RbacMatrixView() {
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
    category: "workspaces",
    description: ""
  })
  const [editingPerm, setEditingPerm] = useState<Permission | null>(null)

  const fetchData = async () => {
    try {
      const [permRes, roleRes] = await Promise.all([
        fetch("/api/admin/rbac/permissions"),
        fetch("/api/admin/rbac/roles"),
      ])
      if (permRes.ok && roleRes.ok) {
        const permData = await permRes.json()
        const roleData = await roleRes.json()
        setPermissions(permData.permissions || [])
        setRoles(roleData.roles || [])
      }
    } catch (error) {
      console.error("Failed to fetch RBAC data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleTogglePermission = async (roleId: string, permissionId: string, currentlyGranted: boolean) => {
    if (roleId === "super_admin") {
      toast({
        title: "Peran Terkunci",
        description: "Super Admin selalu memiliki akses penuh ke seluruh kapabilitas platform.",
      })
      return
    }

    try {
      const method = currentlyGranted ? "DELETE" : "POST"
      const res = await fetch(`/api/admin/rbac/roles/${roleId}/permissions`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId }),
      })

      if (res.ok) {
        setRoles(prev => prev.map(role => {
          if (role.id === roleId) {
            const newPerms = currentlyGranted
              ? role.permissions.filter(p => p.id !== permissionId)
              : [...role.permissions, { id: permissionId, name: permissions.find(p => p.id === permissionId)?.name || "" }]
            return {
              ...role,
              permissions: newPerms,
              permissionCount: newPerms.length
            }
          }
          return role
        }))
        toast({
          title: currentlyGranted ? "Izin Dicabut" : "Izin Diberikan",
          description: "Hak akses peran berhasil diperbarui secara instan."
        })
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Gagal", description: err.error || "Gagal memperbarui izin" })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan yang tidak terduga" })
    }
  }

  const handleToggleCategory = async (roleId: string, category: string, allCurrentlyGranted: boolean) => {
    if (roleId === "super_admin") return

    const catPerms = permissions.filter(p => p.category === category)
    try {
      const res = await fetch(`/api/admin/rbac/roles/${roleId}/permissions/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissionIds: catPerms.map(p => p.id),
          action: allCurrentlyGranted ? "revoke" : "grant"
        }),
      })

      if (res.ok) {
        fetchData()
        toast({
          title: "Izin Diperbarui",
          description: `Semua izin untuk kategori '${category}' berhasil diperbarui.`
        })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Gagal memperbarui izin massal" })
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
        toast({ title: "Berhasil", description: "Kapabilitas izin baru berhasil ditambahkan." })
        setIsPermOpen(false)
        fetchData()
        setNewPerm({ name: "", displayName: "", category: "workspaces", description: "" })
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Gagal", description: err.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan yang tidak terduga" })
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
        toast({ title: "Berhasil", description: "Izin berhasil diperbarui." })
        setIsEditPermOpen(false)
        fetchData()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Gagal", description: err.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan yang tidak terduga" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePermission = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus izin ini? Tindakan ini akan mencabutnya dari semua peran.")) return
    try {
      const res = await fetch(`/api/admin/rbac/permissions/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Dihapus", description: "Izin telah berhasil dihapus" })
        fetchData()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Gagal", description: err.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan yang tidak terduga" })
    }
  }

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center flex-col w-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Memuat matriks perizinan RBAC...</p>
      </div>
    )
  }

  // Group permissions by category
  const categories = Array.from(new Set(permissions.map(p => p.category)))
  const superAdminRole = roles.find(r => r.id === "super_admin")
  const ownerRole = roles.find(r => r.id === "owner")

  return (
    <div className="space-y-6">
      {/* Roles Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="rounded-2xl border border-purple-500/20 bg-card shadow-xs">
          <CardHeader className="p-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    Super Admin
                    <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[9px] uppercase font-bold rounded-full">
                      Akses Penuh
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Tata kelola master platform, lisensi enterprise, dan seluruh workspace.
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">
                  {superAdminRole?.permissionCount ?? permissions.length}/{permissions.length}
                </span>
                <p className="text-[9px] text-muted-foreground uppercase font-bold">Kapabilitas</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border border-emerald-500/20 bg-card shadow-xs">
          <CardHeader className="p-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    Account Owner
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px] uppercase font-bold rounded-full">
                      Dikonfigurasi
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Pemilik akun SaaS yang membuat workspace, mengelola paket, dan mengundang tim.
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {ownerRole?.permissionCount ?? 0}/{permissions.length}
                </span>
                <p className="text-[9px] text-muted-foreground uppercase font-bold">Kapabilitas</p>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Informative Isolation Banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-foreground">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-foreground">Pemisahan Hirarki RBAC Platform vs Workspace:</p>
          <p className="text-muted-foreground leading-relaxed">
            Tab ini mengelola hak akses di tingkat <strong>Platform Global</strong> (Super Admin vs Account Owner). 
            Peran di dalam workspace (seperti <em>Admin, Editor, Author, Contributor, Viewer</em>) 
            terisolasi mandiri di dalam setiap workspace pada menu <strong>Pengguna & Tim</strong> masing-masing.
          </p>
        </div>
      </div>

      <Tabs defaultValue="matrix" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-2xl">
            <TabsTrigger value="matrix" className="rounded-xl font-bold text-xs px-4 py-1.5">Matriks Izin Platform</TabsTrigger>
            <TabsTrigger value="permissions" className="rounded-xl font-bold text-xs px-4 py-1.5">Definisi Kapabilitas</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); fetchData(); }} disabled={refreshing} className="rounded-xl h-8 text-xs font-bold shadow-xs border-border/80">
              <RefreshCw className={`h-3 w-3 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Muat Ulang
            </Button>
            <Dialog open={isPermOpen} onOpenChange={setIsPermOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-8 rounded-xl shadow-xs">
                  <Plus className="mr-1.5 h-3 w-3" /> Tambah Izin Baru
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl border-border/80 shadow-xl bg-card sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold">Tambah Kapabilitas Platform</DialogTitle>
                  <DialogDescription className="text-xs">Buat izin tingkat platform baru yang dapat diterapkan ke peran.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreatePermission} className="space-y-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="perm-name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kode Slug</Label>
                      <Input id="perm-name" placeholder="workspaces.export" value={newPerm.name} onChange={e => setNewPerm({...newPerm, name: e.target.value.toLowerCase()})} required className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="perm-display" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama Tampilan</Label>
                      <Input id="perm-display" placeholder="Ekspor Workspace" value={newPerm.displayName} onChange={e => setNewPerm({...newPerm, displayName: e.target.value})} required className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="perm-cat" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kategori</Label>
                    <Select value={newPerm.category} onValueChange={v => setNewPerm({...newPerm, category: v})}>
                      <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card">
                        <SelectItem value="workspaces" className="text-xs rounded-lg">Workspaces & Tenants</SelectItem>
                        <SelectItem value="users" className="text-xs rounded-lg">Pengguna & Akun Platform</SelectItem>
                        <SelectItem value="billing" className="text-xs rounded-lg">Billing & Langganan</SelectItem>
                        <SelectItem value="system" className="text-xs rounded-lg">Sistem & Infrastruktur</SelectItem>
                        <SelectItem value="security" className="text-xs rounded-lg">Keamanan & Lisensi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="perm-desc" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deskripsi</Label>
                    <Textarea id="perm-desc" placeholder="Penjelasan aksi atau hak yang diizinkan..." value={newPerm.description} onChange={e => setNewPerm({...newPerm, description: e.target.value})} className="rounded-xl text-xs bg-muted/20 border-border/80" rows={2} />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
                    <Button type="button" variant="outline" onClick={() => setIsPermOpen(false)} className="rounded-xl text-xs font-bold h-9">Batal</Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
                      {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      Simpan Izin
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="matrix">
          <Card className="border border-border/80 shadow-xs overflow-hidden rounded-2xl bg-card">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/60">
                    <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[280px]">
                      Kapabilitas Platform
                    </th>
                    {roles.map(role => (
                      <th key={role.id} className="p-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[150px]">
                        <div className="flex items-center justify-center gap-1.5">
                          {role.id === "super_admin" ? (
                            <Crown className="w-3.5 h-3.5 text-purple-500" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          <span>{role.displayName}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-card">
                  {categories.map(cat => {
                    const catConfig = CATEGORY_CONFIG[cat] || { label: `${cat.toUpperCase()}`, icon: Shield, color: "bg-muted text-foreground border-border" }
                    const CatIcon = catConfig.icon
                    const catPerms = permissions.filter(p => p.category === cat)

                    return (
                      <React.Fragment key={cat}>
                        <tr className="bg-muted/20 border-t border-b border-border/60">
                          <td className="px-4 py-2.5 text-xs font-bold text-foreground">
                            <div className="flex items-center gap-2">
                              <span className={`p-1 rounded-lg border text-xs ${catConfig.color}`}>
                                <CatIcon className="w-3.5 h-3.5" />
                              </span>
                              <span className="font-bold uppercase tracking-wider text-[11px] text-muted-foreground">
                                {catConfig.label}
                              </span>
                            </div>
                          </td>
                          {roles.map(role => {
                            const rolePermsInCat = role.permissions.filter(rp => catPerms.some(p => p.id === rp.id))
                            const allGranted = catPerms.length > 0 && rolePermsInCat.length === catPerms.length
                            const isSuperAdmin = role.id === 'super_admin'

                            return (
                              <td key={`toggle-${role.id}-${cat}`} className="px-4 py-2 text-center">
                                {!isSuperAdmin ? (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground rounded-lg" 
                                    onClick={() => handleToggleCategory(role.id, cat, allGranted)}
                                  >
                                    {allGranted ? 'Lepas Semua' : 'Pilih Semua'}
                                  </Button>
                                ) : (
                                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                                    Semua Diberikan
                                  </span>
                                )}
                              </td>
                            )
                          })}
                        </tr>

                        {catPerms.map(perm => (
                          <tr key={perm.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                            <td className="p-3.5 pl-6">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-foreground">{perm.displayName}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{perm.name}</span>
                                {perm.description && (
                                  <span className="text-[11px] text-muted-foreground/80 mt-0.5">{perm.description}</span>
                                )}
                              </div>
                            </td>
                            {roles.map(role => {
                              const hasIt = role.permissions.some(rp => rp.id === perm.id)
                              const isSuperAdmin = role.id === 'super_admin'

                              return (
                                <td key={`${role.id}-${perm.id}`} className="p-3.5 text-center">
                                  <div className="flex justify-center">
                                    {isSuperAdmin ? (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="h-6 w-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center cursor-not-allowed">
                                              <Lock className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent className="rounded-xl text-xs">
                                            <p>Super Admin selalu memiliki akses penuh</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : (
                                      <Checkbox 
                                        checked={hasIt} 
                                        onCheckedChange={() => handleTogglePermission(role.id, perm.id, hasIt)}
                                        className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 rounded-md h-4 w-4"
                                      />
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <div className="grid gap-3">
            {permissions.map((permission) => {
              const catConfig = CATEGORY_CONFIG[permission.category] || { label: permission.category, icon: Key, color: "bg-muted text-foreground border-border" }
              const CatIcon = catConfig.icon

              return (
                <Card key={permission.id} className="rounded-2xl border border-border/80 hover:border-primary/40 transition-colors shadow-xs bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${catConfig.color}`}>
                          <CatIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-xs text-foreground">{permission.displayName}</h3>
                            <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tight rounded-full">
                              {catConfig.label}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{permission.name}</p>
                          {permission.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">{permission.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-xl border-border bg-card">
                            <DropdownMenuItem className="cursor-pointer text-xs rounded-lg" onClick={() => { setEditingPerm(permission); setIsEditPermOpen(true); }}>
                              <Edit className="h-3.5 w-3.5 mr-2" /> Edit Izin
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer text-xs rounded-lg" onClick={() => handleDeletePermission(permission.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Hapus Izin
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Permission Dialog */}
      <Dialog open={isEditPermOpen} onOpenChange={setIsEditPermOpen}>
        <DialogContent className="rounded-2xl border-border/80 shadow-xl bg-card sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Edit Kapabilitas Platform</DialogTitle>
            <DialogDescription className="text-xs">Perbarui rincian izin untuk {editingPerm?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePermission} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-perm-name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kode Slug</Label>
                <Input id="edit-perm-name" value={editingPerm?.name || ''} onChange={e => editingPerm && setEditingPerm({...editingPerm, name: e.target.value.toLowerCase()})} required className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-perm-display" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama Tampilan</Label>
                <Input id="edit-perm-display" value={editingPerm?.displayName || ''} onChange={e => editingPerm && setEditingPerm({...editingPerm, displayName: e.target.value})} required className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-perm-cat" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kategori</Label>
              <Select value={editingPerm?.category || 'workspaces'} onValueChange={v => editingPerm && setEditingPerm({...editingPerm, category: v})}>
                <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  <SelectItem value="workspaces" className="text-xs rounded-lg">Workspaces & Tenants</SelectItem>
                  <SelectItem value="users" className="text-xs rounded-lg">Pengguna & Akun Platform</SelectItem>
                  <SelectItem value="billing" className="text-xs rounded-lg">Billing & Langganan</SelectItem>
                  <SelectItem value="system" className="text-xs rounded-lg">Sistem & Infrastruktur</SelectItem>
                  <SelectItem value="security" className="text-xs rounded-lg">Keamanan & Lisensi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-perm-desc" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deskripsi</Label>
              <Textarea id="edit-perm-desc" value={editingPerm?.description || ''} onChange={e => editingPerm && setEditingPerm({...editingPerm, description: e.target.value})} className="rounded-xl text-xs bg-muted/20 border-border/80" rows={2} />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
              <Button type="button" variant="outline" onClick={() => setIsEditPermOpen(false)} className="rounded-xl text-xs font-bold h-9">Batal</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
                {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
