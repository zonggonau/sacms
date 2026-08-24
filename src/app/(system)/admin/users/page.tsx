"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RbacMatrixView } from "@/components/admin/rbac-matrix-view"
import {
  Loader2, Users, Search, Plus, Shield, Mail, Building2,
  MoreVertical, Edit, Trash2, Key, UserPlus, AlertCircle, CheckCircle,
  ChevronLeft, ChevronRight, Sliders, ShieldCheck
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { cn } from "@/lib/utils"

interface User {
  id: string
  email: string
  name: string | null
  role: string
  plan?: string
  image: string | null
  emailVerified: string | null
  createdAt: string
  tenants: Array<{
    role?: string
    tenant: { id: string; name: string; slug: string; plan?: string }
  }>
}

function AdminUsersContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get("tab")
  const [activeTab, setActiveTab] = useState(tabParam === "rbac" ? "rbac" : "users")

  useEffect(() => {
    if (tabParam === "rbac") {
      setActiveTab("rbac")
    }
  }, [tabParam])
  
  const isAdmin = session?.user?.role === "super_admin" || session?.user?.role === "admin"

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalUsersCount, setTotalUsersCount] = useState(0)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState("")

  // Override States
  const [isOverrideOpen, setIsOverrideOpen] = useState(false)
  const [isRemoveOverrideOpen, setIsRemoveOverrideOpen] = useState(false)
  const [overrideUser, setOverrideUser] = useState<User | null>(null)
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [overrideFormData, setOverrideFormData] = useState({
    maxWorkspaces: "",
    note: ""
  })

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "owner"
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated" && !isAdmin) {
      router.push("/dashboard")
    }
  }, [status, isAdmin, router])

  const fetchUsers = async (p: number = 1) => {
    try {
      let url = `/api/admin/users?page=${p}&limit=10`
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`
      
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages)
          setPage(data.pagination.page)
          setTotalUsersCount(data.pagination.total)
        }
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    const timer = setTimeout(() => {
      fetchUsers(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [isAdmin, searchQuery])

  const displayUsers = users

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast({ title: "Berhasil", description: "Pengguna berhasil didaftarkan" })
        setIsCreateOpen(false)
        fetchUsers(page)
        setFormData({ name: "", email: "", password: "", role: "owner" })
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Gagal", description: err.error || "Gagal membuat pengguna" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan yang tidak terduga" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          role: formData.role,
          email: formData.email
        }),
      })
      if (res.ok) {
        toast({ title: "Berhasil", description: "Profil pengguna berhasil diperbarui" })
        setIsEditOpen(false)
        fetchUsers(page)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Gagal", description: err.error || "Gagal memperbarui pengguna" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan yang tidak terduga" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Gagal", description: "Kata sandi minimal 6 karakter" })
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: newPassword
        }),
      })
      if (res.ok) {
        toast({ title: "Berhasil", description: "Kata sandi pengguna berhasil diubah" })
        setIsPasswordOpen(false)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Gagal", description: err.error || "Gagal memperbarui sandi" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan yang tidak terduga" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isDeleteConfirmed = Boolean(
    userToDelete &&
    deleteConfirmEmail.trim().toLowerCase() === userToDelete.email.trim().toLowerCase()
  )

  const openDelete = (user: User) => {
    if (user.id === session?.user?.id) {
      toast({ variant: "destructive", title: "Dilarang", description: "Anda tidak dapat menghapus akun Anda sendiri" })
      return
    }
    setUserToDelete(user)
    setDeleteConfirmEmail("")
    setIsDeleteOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete) return
    if (!isDeleteConfirmed) {
      toast({
        variant: "destructive",
        title: "Konfirmasi Diperlukan",
        description: "Silakan masukkan alamat email yang sesuai untuk mengonfirmasi penghapusan."
      })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ confirmEmail: deleteConfirmEmail.trim() })
      })
      if (res.ok) {
        toast({ title: "Pengguna Dihapus", description: `Pengguna ${userToDelete.name || userToDelete.email} telah dihapus permanen.` })
        setIsDeleteOpen(false)
        setUserToDelete(null)
        setDeleteConfirmEmail("")
        fetchUsers(page)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Gagal Menghapus", description: err.error || "Gagal menghapus pengguna" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan saat menghapus pengguna" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const openOverride = async (user: User) => {
    setOverrideUser(user)
    setIsOverrideOpen(true)
    setOverrideLoading(true)
    setOverrideFormData({
      maxWorkspaces: "",
      note: ""
    })
    try {
      const res = await fetch(`/api/admin/users/${user.id}/override`)
      if (res.ok) {
        const data = await res.json()
        if (data.override) {
          setOverrideFormData({
            maxWorkspaces: data.override.maxWorkspaces?.toString() || "",
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
    if (!overrideUser) return
    setIsSubmitting(true)
    try {
      const body = {
        maxWorkspaces: overrideFormData.maxWorkspaces ? parseInt(overrideFormData.maxWorkspaces) : null,
        note: overrideFormData.note || null
      }
      const res = await fetch(`/api/admin/users/${overrideUser.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast({ title: "Berhasil", description: "Batas limit pengguna berhasil disimpan" })
        setIsOverrideOpen(false)
        fetchUsers(page)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Gagal", description: err.error || "Gagal menyimpan limit" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan yang tidak terduga" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmRemoveOverride = async () => {
    if (!overrideUser) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${overrideUser.id}/override`, {
        method: "DELETE"
      })
      if (res.ok) {
        toast({ title: "Berhasil", description: "Batas limit khusus berhasil dihapus" })
        setIsRemoveOverrideOpen(false)
        setIsOverrideOpen(false)
        fetchUsers(page)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Gagal", description: err.error || "Gagal menghapus limit" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan yang tidak terduga" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEdit = (user: User) => {
    setSelectedUser(user)
    setFormData({
      name: user.name || "",
      email: user.email,
      password: "",
      role: user.role
    })
    setIsEditOpen(true)
  }

  const openPassword = (user: User) => {
    setSelectedUser(user)
    setNewPassword("")
    setIsPasswordOpen(true)
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 flex-col w-full">
        <div className="flex-1 min-h-[80vh] flex items-center justify-center flex-col w-full bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center text-muted-foreground">
        <p>Akses dibatasi khusus untuk Super Administrator.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Identitas & Hak Akses (IAM)</h1>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 rounded-full">
                  Users & RBAC
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                Kelola akun pengguna platform, batas limit khusus, dan konfigurasi matriks perizinan RBAC tingkat platform.
              </p>
            </div>
            
            {activeTab === "users" && (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs shrink-0">
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Tambah Akun Baru
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl border-border/80 shadow-xl bg-card sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold">Tambah Akun Owner Baru</DialogTitle>
                    <DialogDescription className="text-xs">
                      Buat akun pemilik platform baru secara manual.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-3 py-2">
                    <div className="space-y-1">
                      <Label htmlFor="name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama Lengkap</Label>
                      <Input id="name" placeholder="Budi Santoso" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alamat Email</Label>
                      <Input id="email" type="email" placeholder="budi@domain.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kata Sandi</Label>
                      <Input id="password" type="password" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="role" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Peran Platform</Label>
                      <Select value={formData.role || "owner"} onValueChange={val => setFormData({...formData, role: val})}>
                        <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card">
                          <SelectItem value="owner" className="text-xs rounded-lg font-medium">Account Owner (Pemilik Workspace)</SelectItem>
                          <SelectItem value="super_admin" className="text-xs rounded-lg font-medium">Super Admin (Platform Master)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                      <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl text-xs font-bold h-9">Batal</Button>
                      <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
                        {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Buat Akun
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-2xl">
              <TabsTrigger value="users" className="rounded-xl font-bold text-xs px-5 py-2 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                Pengguna Platform ({totalUsersCount})
              </TabsTrigger>
              <TabsTrigger value="rbac" className="rounded-xl font-bold text-xs px-5 py-2 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Matriks RBAC & Peran Sistem
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-6">

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Akun</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-black text-foreground tracking-tight">{totalUsersCount}</div>
                <p className="text-xs text-muted-foreground mt-0.5">Total akun terdaftar</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Super Admin</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Shield className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-black text-foreground tracking-tight">
                  {users.filter((u) => u.role === "super_admin").length}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Akses platform penuh</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Account Owners</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-black text-foreground tracking-tight">
                  {users.filter((u) => u.role !== "super_admin").length}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Pemilik akun & tenant</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Workspace Aktif</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-black text-foreground tracking-tight">
                  {users.filter((u) => u.tenants && u.tenants.length > 0).length}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Memiliki workspace aktif</p>
              </CardContent>
            </Card>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari pemilik akun berdasarkan nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-xl text-xs bg-card border-border/80"
            />
          </div>

          {/* Users List */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground">Direktori Pemilik Akun</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {totalUsersCount} akun ditemukan &middot; Anggota tim internal dikelola di dalam masing-masing workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {displayUsers.length === 0 ? (
                <div className="text-center py-14 text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-xs font-bold text-foreground">{searchQuery ? "Tidak ada akun yang sesuai pencarian" : "Belum ada akun terdaftar"}</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {displayUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border/70 rounded-2xl hover:bg-muted/20 transition-colors bg-card gap-4 shadow-xs"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                          {user.image ? (
                            <img
                              src={user.image}
                              alt={user.name || user.email}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-bold text-primary text-base">
                              {(user.name || user.email).charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{user.name || "Pengguna Tanpa Nama"}</span>
                            {user.emailVerified && (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{user.email}</div>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <Badge
                              className={cn(
                                "text-[9px] font-bold uppercase rounded-full border shadow-none px-2 py-0",
                                user.role === "super_admin" 
                                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" 
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              )}
                            >
                              {user.role === "super_admin" ? "SUPER ADMIN" : "ACCOUNT OWNER"}
                            </Badge>
                            
                            {user.plan && (
                              <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-full border-border/60 text-muted-foreground">
                                Paket: {user.plan}
                              </Badge>
                            )}

                            {user.tenants && user.tenants.length > 0 ? (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[9px] font-bold rounded-full">
                                {user.tenants.length} workspace dimiliki
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-dashed text-[9px] rounded-full">
                                Belum ada workspace
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0">
                        <div className="flex flex-col items-start sm:items-end text-left sm:text-right">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Bergabung</span>
                          <span className="text-xs font-mono text-foreground">{new Date(user.createdAt).toLocaleDateString('id-ID')}</span>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-xl border-border bg-card">
                            <DropdownMenuLabel className="text-xs font-bold text-muted-foreground">Aksi Akun</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEdit(user)} className="cursor-pointer text-xs rounded-lg">
                              <Edit className="mr-2 h-3.5 w-3.5" /> Edit Profil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPassword(user)} className="cursor-pointer text-xs rounded-lg">
                              <Key className="mr-2 h-3.5 w-3.5" /> Ubah Kata Sandi
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openOverride(user)} className="cursor-pointer text-xs rounded-lg">
                              <Sliders className="mr-2 h-3.5 w-3.5 text-primary" /> Kustomisasi Kuota
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="cursor-pointer text-xs rounded-lg">
                              <Link href={`/admin/tenants`}>
                                <Building2 className="mr-2 h-3.5 w-3.5" /> Kelola Workspace
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => openDelete(user)}
                              className="text-destructive focus:text-destructive cursor-pointer text-xs rounded-lg"
                              disabled={user.id === session?.user?.id}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus Akun
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            
            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className="p-3 bg-muted/20 border-t border-border/60 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Halaman <span className="font-bold text-foreground">{page}</span> dari <span className="font-bold text-foreground">{totalPages}</span> ({totalUsersCount} Total)
                </p>
                <div className="flex gap-1.5">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fetchUsers(page - 1)} 
                    disabled={page <= 1}
                    className="h-8 rounded-lg text-xs font-bold"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Sebelumnya
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fetchUsers(page + 1)} 
                    disabled={page >= totalPages || totalPages === 0}
                    className="h-8 rounded-lg text-xs font-bold"
                  >
                    Berikutnya <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="rounded-2xl border-border/80 shadow-xl bg-card sm:max-w-[460px]">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                  {selectedUser?.image ? (
                    <img src={selectedUser.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-primary text-sm">
                      {(selectedUser?.name || selectedUser?.email || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">Edit Akun: {selectedUser?.name || selectedUser?.email}</DialogTitle>
                  <DialogDescription className="text-xs">Perbarui rincian profil dan peran platform.</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="edit-name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama Lengkap</Label>
                <Input id="edit-name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-email" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alamat Email</Label>
                <Input id="edit-email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-role" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Peran Platform</Label>
                <Select value={formData.role === "super_admin" ? "super_admin" : "owner"} onValueChange={val => setFormData({...formData, role: val})}>
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-card">
                    <SelectItem value="owner" className="text-xs rounded-lg">Account Owner</SelectItem>
                    <SelectItem value="super_admin" className="text-xs rounded-lg">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl text-xs font-bold h-9">Batal</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
                  {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
          <DialogContent className="rounded-2xl border-border/80 shadow-xl bg-card sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Ubah Sandi: {selectedUser?.name || selectedUser?.email}
              </DialogTitle>
              <DialogDescription className="text-xs">Tentukan kata sandi baru untuk akun pengguna ini.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleChangePassword} className="space-y-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="new-password" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kata Sandi Baru</Label>
                <Input 
                  id="new-password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  required 
                  minLength={6}
                  className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsPasswordOpen(false)} className="rounded-xl text-xs font-bold h-9">Batal</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
                  {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Perbarui Sandi
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Override Dialog */}
        <Dialog open={isOverrideOpen} onOpenChange={setIsOverrideOpen}>
          <DialogContent className="rounded-2xl border-border/80 shadow-xl bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <Sliders className="h-4 w-4 text-primary" />
                Kustomisasi Kuota: {overrideUser?.name || overrideUser?.email}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Kustomisasi langsung batas maksimal workspace yang dapat dimiliki akun ini.
              </DialogDescription>
            </DialogHeader>

            {overrideLoading ? (
              <div className="py-12 flex justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <form onSubmit={handleSaveOverride} className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label htmlFor="user-maxWorkspaces" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Maksimal Workspace</Label>
                  <Input
                    id="user-maxWorkspaces"
                    type="number"
                    placeholder="Ikuti paket default (Free: 1, Starter: 3, Pro: 10)"
                    value={overrideFormData.maxWorkspaces}
                    onChange={e => setOverrideFormData({...overrideFormData, maxWorkspaces: e.target.value})}
                    className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="user-note" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Catatan Administratif</Label>
                  <Textarea
                    id="user-note"
                    placeholder="Alasan penyesuaian kuota workspace..."
                    value={overrideFormData.note}
                    onChange={e => setOverrideFormData({...overrideFormData, note: e.target.value})}
                    rows={2}
                    className="rounded-xl text-xs bg-muted/20 border-border/80"
                  />
                </div>

                <DialogFooter className="flex sm:justify-between items-center w-full gap-2 pt-3 border-t border-border/60">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setIsRemoveOverrideOpen(true)}
                    className="mr-auto rounded-xl text-xs font-bold h-9"
                  >
                    Hapus Batas Kustom
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsOverrideOpen(false)} className="rounded-xl text-xs font-bold h-9">Batal</Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
                      {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      Simpan Kuota
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete User Confirmation Modal */}
        <AlertDialog
          open={isDeleteOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsDeleteOpen(false)
              setUserToDelete(null)
              setDeleteConfirmEmail("")
            }
          }}
        >
          <AlertDialogContent className="rounded-2xl border-border/80 shadow-xl bg-card max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <AlertDialogTitle className="text-base font-bold text-foreground">Hapus Pengguna Permanen</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Tindakan ini berbahaya dan tidak dapat dibatalkan. Akun pengguna akan dihapus permanen.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>

            <div className="p-3 my-2 border border-border/60 rounded-xl bg-muted/20 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nama Pengguna:</span>
                <span className="font-bold text-foreground">{userToDelete?.name || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email Akun:</span>
                <span className="font-mono font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">{userToDelete?.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Peran Platform:</span>
                <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-full">
                  {userToDelete?.role}
                </Badge>
              </div>
              {userToDelete?.tenants && userToDelete.tenants.length > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-border/60 text-amber-600 dark:text-amber-400 font-medium">
                  <span>Workspace Terkait:</span>
                  <span>{userToDelete.tenants.length} workspace</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 py-1">
              <Label htmlFor="confirm-delete-email" className="text-xs font-semibold text-foreground">
                Ketik email <span className="font-mono text-destructive underline">{userToDelete?.email}</span> untuk konfirmasi:
              </Label>
              <Input
                id="confirm-delete-email"
                type="email"
                autoComplete="off"
                placeholder={userToDelete?.email || "masukkan email pengguna..."}
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                className="rounded-xl font-mono text-xs border-destructive/40 focus-visible:ring-destructive/30 h-9"
              />
              {deleteConfirmEmail ? (
                <p className={`text-[11px] flex items-center gap-1 ${isDeleteConfirmed ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-amber-600 dark:text-amber-400"}`}>
                  {isDeleteConfirmed ? "✓ Email sesuai. Tombol hapus sekarang aktif." : "Email yang Anda ketik belum sesuai dengan akun di atas."}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Tombol hapus akan aktif setelah Anda mengetik email pengguna dengan benar.
                </p>
              )}
            </div>

            <AlertDialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
              <AlertDialogCancel 
                disabled={isSubmitting} 
                onClick={() => {
                  setIsDeleteOpen(false)
                  setUserToDelete(null)
                  setDeleteConfirmEmail("")
                }}
                className="rounded-xl text-xs font-bold h-9"
              >
                Batal
              </AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={isSubmitting || !isDeleteConfirmed}
                onClick={handleConfirmDelete}
                className="rounded-xl text-xs font-bold h-9 gap-1.5"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Hapus Pengguna
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Remove Override Confirmation Modal */}
        <AlertDialog open={isRemoveOverrideOpen} onOpenChange={setIsRemoveOverrideOpen}>
          <AlertDialogContent className="rounded-2xl border-border/80 shadow-xl bg-card max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <AlertDialogTitle className="text-base font-bold text-foreground">Hapus Custom Override</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Kembalikan batasan akun ke pengaturan plan default.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>

            <p className="text-xs text-muted-foreground leading-relaxed my-2">
              Apakah Anda yakin ingin menghapus semua batasan khusus untuk pengguna <strong>{overrideUser?.name || overrideUser?.email}</strong>? Pengguna ini akan kembali mengikuti kuota plan standarnya.
            </p>

            <AlertDialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
              <AlertDialogCancel 
                disabled={isSubmitting} 
                onClick={() => setIsRemoveOverrideOpen(false)}
                className="rounded-xl text-xs font-bold h-9"
              >
                Batal
              </AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={isSubmitting}
                onClick={handleConfirmRemoveOverride}
                className="rounded-xl text-xs font-bold h-9"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Hapus Override
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

            </TabsContent>

            <TabsContent value="rbac">
              <RbacMatrixView />
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 min-h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AdminUsersContent />
    </Suspense>
  )
}
