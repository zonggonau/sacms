"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Loader2, Users, Search, Plus, Shield, Mail, Building2,
  MoreVertical, Edit, Trash2, Key, UserPlus, AlertCircle, CheckCircle,
  ChevronLeft, ChevronRight, Sliders
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

interface User {
  id: string
  email: string
  name: string | null
  role: string
  image: string | null
  emailVerified: string | null
  createdAt: string
  tenants: Array<{ tenant: { id: string; name: string; slug: string } }>
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalUsersCount, setTotalUsersCount] = useState(0)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState("")

  // Override States
  const [isOverrideOpen, setIsOverrideOpen] = useState(false)
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
    role: "user"
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

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
    if (session?.user?.role !== "super_admin") return
    const timer = setTimeout(() => {
      fetchUsers(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [session, searchQuery])

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
        toast({ title: "Success", description: "User created successfully" })
        setIsCreateOpen(false)
        fetchUsers(page)
        setFormData({ name: "", email: "", password: "", role: "user" })
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to create user" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
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
        toast({ title: "Success", description: "User updated successfully" })
        setIsEditOpen(false)
        fetchUsers(page)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to update user" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Error", description: "Password must be at least 6 characters" })
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
        toast({ title: "Success", description: "User password updated successfully" })
        setIsPasswordOpen(false)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to update password" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (id === session?.user?.id) {
      toast({ variant: "destructive", title: "Error", description: "You cannot delete your own account" })
      return
    }
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return
    
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Deleted", description: "User deleted successfully" })
        fetchUsers(page)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to delete user" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete user" })
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
        toast({ title: "Success", description: "User overrides saved successfully" })
        setIsOverrideOpen(false)
        fetchUsers(page)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to save overrides" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveOverride = async () => {
    if (!overrideUser) return
    if (!confirm("Are you sure you want to remove all custom overrides for this user?")) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${overrideUser.id}/override`, {
        method: "DELETE"
      })
      if (res.ok) {
        toast({ title: "Success", description: "User overrides removed successfully" })
        setIsOverrideOpen(false)
        fetchUsers(page)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to remove overrides" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEdit = (user: User) => {
    setSelectedUser(user)
    setFormData({
      name: user.name || "",
      email: user.email,
      password: "", // Don't show password
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Users & Roles</h1>
              <p className="text-muted-foreground">
                Manage users and their platform-wide permissions
              </p>
            </div>
            
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" /> Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Create a new account manually. They can then sign in with these credentials.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="John Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" placeholder="john@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Platform Role</Label>
                    <Select value={formData.role} onValueChange={val => setFormData({...formData, role: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Regular User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create User
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsersCount}</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Super Admins</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter((u) => u.role === "super_admin").length}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Admins</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter((u) => u.role === "admin").length}
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Active Members</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter((u) => u.emailVerified).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Users List */}
          <Card>
            <CardHeader>
              <CardTitle>Directory</CardTitle>
              <CardDescription>
                {totalUsersCount} user{totalUsersCount !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {displayUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-4 opacity-20" />
                  <p>{searchQuery ? "No users match your search" : "No users registered yet"}</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {displayUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors bg-card"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                          {user.image ? (
                            <img
                              src={user.image}
                              alt={user.name || "User"}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="font-bold text-primary text-lg">
                              {(user.name || user.email).charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-lg">{user.name || "Unnamed User"}</div>
                          <div className="text-sm text-muted-foreground font-mono">{user.email}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge
                              variant={
                                user.role === "super_admin"
                                  ? "default"
                                  : user.role === "admin"
                                  ? "secondary"
                                  : "outline"
                              }
                              className={user.role === "super_admin" ? "bg-purple-100 text-purple-700 hover:bg-purple-100" : ""}
                            >
                              {user.role.replace('_', ' ')}
                            </Badge>
                            {user.tenants.length > 0 && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {user.tenants.length} workspace{user.tenants.length > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="hidden lg:flex flex-col items-end mr-4 text-right">
                          <span className="text-xs text-muted-foreground">Joined</span>
                          <span className="text-sm font-medium">{new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEdit(user)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPassword(user)}>
                              <Key className="mr-2 h-4 w-4" /> Change Password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openOverride(user)}>
                              <Sliders className="mr-2 h-4 w-4 text-orange-500" /> Custom Overrides
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/tenants`}>
                                <Building2 className="mr-2 h-4 w-4" /> Manage Workspaces
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(user.id)}
                              className="text-destructive focus:text-destructive"
                              disabled={user.id === session?.user?.id}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete User
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
            <div className="p-4 bg-muted/10 border-t flex items-center justify-between">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                Showing Page {page} of {totalPages || 1} ({totalUsersCount} Total)
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchUsers(page - 1)} 
                  disabled={page <= 1}
                  className="h-8 rounded-none border border-border"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchUsers(page + 1)} 
                  disabled={page >= totalPages || totalPages === 0}
                  className="h-8 rounded-none border border-border"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User: {selectedUser?.name || selectedUser?.email}</DialogTitle>
              <DialogDescription>Update account details and platform-wide role.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input id="edit-name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Platform Role</Label>
                <Select value={formData.role} onValueChange={val => setFormData({...formData, role: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Regular User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
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

        {/* Change Password Dialog */}
        <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Password: {selectedUser?.name || selectedUser?.email}</DialogTitle>
              <DialogDescription>Set a new password for this user.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleChangePassword} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input 
                  id="new-password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  required 
                  minLength={6}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPasswordOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Override Dialog */}
        <Dialog open={isOverrideOpen} onOpenChange={setIsOverrideOpen}>
          <DialogContent className="max-w-md rounded-none border border-border bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Sliders className="h-5 w-5 text-orange-500" />
                Workspace Overrides: {overrideUser?.name || overrideUser?.email}
              </DialogTitle>
              <DialogDescription>
                Directly override the maximum number of workspaces this user can own.
              </DialogDescription>
            </DialogHeader>

            {overrideLoading ? (
              <div className="py-12 flex justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <form onSubmit={handleSaveOverride} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="user-maxWorkspaces" className="text-xs font-bold uppercase tracking-wider">Max Workspaces</Label>
                  <Input
                    id="user-maxWorkspaces"
                    type="number"
                    placeholder="Inherit plan defaults (Free: 1, Starter: 3, Pro: 10)"
                    value={overrideFormData.maxWorkspaces}
                    onChange={e => setOverrideFormData({...overrideFormData, maxWorkspaces: e.target.value})}
                    className="rounded-none border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-note" className="text-xs font-bold uppercase tracking-wider">Administrative Note</Label>
                  <Textarea
                    id="user-note"
                    placeholder="Reason for this workspace override..."
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
