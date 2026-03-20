"use client"

import { useEffect, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Plus, Building2, LogOut, 
  ShieldCheck, Search, Settings, 
  LayoutDashboard, MoreVertical, Trash2,
  AlertTriangle, Clock, Ban, CheckCircle2,
  Calendar, ArrowRight, Zap, ExternalLink
} from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Tenant {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  role: string
  daysRemaining: number | null
  expiresAt: string | null
  createdAt: string
}

export default function WorkspaceSelectionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loadingTenants, setLoadingTenants] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Delete State
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const [newTenant, setNewMember] = useState({
    name: "",
    description: ""
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchTenants = async () => {
    try {
      const res = await fetch("/api/tenants")
      if (res.ok) {
        const data = await res.json()
        setTenants(data.tenants || [])
      }
    } catch (error) {
      console.error("Failed to fetch tenants:", error)
    } finally {
      setLoadingTenants(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchTenants()
    }
  }, [session])

  const isSuperAdmin = session?.user?.role === "super_admin"

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTenant),
      })

      if (res.ok) {
        const data = await res.json()
        toast({ title: "Workspace Created!", description: "Launching your dashboard..." })
        window.location.href = `/dashboard/${data.tenant.slug}`
      } else {
        const data = await res.json()
        toast({ variant: "destructive", title: "Creation Failed", description: data.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Network error occurred." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/tenants/${tenantToDelete.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: "Workspace Deleted", description: "All data has been permanently removed." })
        setTenantToDelete(null)
        setDeleteConfirm("")
        fetchTenants()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Delete Failed", description: err.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Deletion failed" })
    } finally {
      setIsDeleting(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/10">
      {/* Top Navbar */}
      <nav className="h-16 bg-card border-b px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black shadow-sm">CF</div>
          <span className="font-bold tracking-tight">ContentFlow</span>
        </div>
        <div className="flex items-center gap-4">
          {isSuperAdmin && (
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-xs font-bold text-primary">
                <ShieldCheck className="mr-2 h-4 w-4" /> PLATFORM ADMIN
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-xs font-bold text-muted-foreground hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> SIGN OUT
          </Button>
        </div>
      </nav>

      <main className="p-6 lg:p-12 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-primary/20 text-[10px] font-black uppercase tracking-widest px-2">Workspace selection</Badge>
            <h1 className="text-4xl font-extrabold tracking-tight">Your Workspaces</h1>
            <p className="text-muted-foreground">Manage your projects or create a new one.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 h-12 px-6 font-bold rounded-2xl">
                <Plus className="mr-2 h-5 w-5" /> New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
              <DialogHeader className="p-8 bg-muted/30 border-b">
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Create Workspace</DialogTitle>
                <DialogDescription>A workspace is where you manage specific projects and team members.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTenant} className="p-8 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Workspace Name</Label>
                  <Input 
                    placeholder="e.g. My Awesome Blog" 
                    value={newTenant.name}
                    onChange={e => setNewMember({...newTenant, name: e.target.value})}
                    required
                    className="h-12 bg-muted/30 border-none text-lg rounded-xl focus-visible:ring-primary shadow-inner"
                  />
                </div>
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <p className="text-[10px] font-bold text-primary uppercase">Note</p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">A unique URL slug will be generated automatically for your workspace. New workspaces include a <strong>7-day trial</strong> of the Starter plan.</p>
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl font-bold">Cancel</Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-primary font-bold rounded-xl h-12 px-8">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 fill-current" />}
                    Launch Workspace
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-50" />
          <Input 
            placeholder="Search workspaces..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-12 h-14 bg-card border-none shadow-sm rounded-2xl text-lg focus-visible:ring-primary"
          />
        </div>

        {loadingTenants ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-bold uppercase tracking-widest">Loading your workspaces...</p>
          </div>
        ) : tenants.length === 0 ? (
          <Card className="border-dashed border-2 py-20 bg-card/50 rounded-3xl">
            <CardContent className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mx-auto mb-6">
                <Building2 className="h-10 w-10 text-primary/30" />
              </div>
              <h3 className="text-2xl font-bold">No active workspaces</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mt-2 mb-8">
                You haven't joined or created any workspace yet. Start by creating your first project workspace.
              </p>
              <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl h-12 px-8 font-bold">
                Create First Workspace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[300px] py-5 px-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Workspace</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Plan</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trial / Expiry</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role</TableHead>
                    <TableHead className="text-right py-5 px-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => {
                    const isSuspended = tenant.status === 'suspended' || (tenant.daysRemaining !== null && tenant.daysRemaining <= 0)
                    const isTrial = tenant.daysRemaining !== null && tenant.daysRemaining > 0
                    
                    return (
                      <TableRow key={tenant.id} className="group transition-colors hover:bg-muted/5">
                        <TableCell className="py-5 px-8">
                          <Link href={`/dashboard/${tenant.slug}`} className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all shadow-sm",
                              isSuspended ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                            )}>
                              {tenant.name[0].toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-sm truncate max-w-[180px]">{tenant.name}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">/{tenant.slug}</span>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          {isSuspended ? (
                            <Badge variant="destructive" className="text-[9px] font-black uppercase bg-red-100 text-red-700 hover:bg-red-100 border-none">
                              <Ban className="h-2.5 w-2.5 mr-1" /> Suspended
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border-emerald-100">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-bold uppercase tracking-tight">{tenant.plan}</span>
                        </TableCell>
                        <TableCell>
                          {tenant.daysRemaining !== null ? (
                            <div className="flex flex-col gap-1">
                              <div className={cn(
                                "flex items-center gap-1.5 font-bold text-[10px] uppercase",
                                tenant.daysRemaining <= 2 ? "text-red-600" : tenant.daysRemaining <= 5 ? "text-orange-600" : "text-blue-600"
                              )}>
                                <Clock className="h-3 w-3" />
                                {tenant.daysRemaining} days left
                              </div>
                              <span className="text-[9px] text-muted-foreground">
                                {isTrial ? "7-day trial active" : "Subscription active"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-medium italic">Unlimited</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <ShieldCheck className="h-3 w-3" />
                            <span className="text-[10px] font-black uppercase tracking-tight">{tenant.role}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5 px-8 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/dashboard/${tenant.slug}`}>
                              <Button size="sm" className="h-8 rounded-lg font-bold text-[11px] px-3">
                                Enter <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-none">
                                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Manage</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/${tenant.slug}/settings`}>
                                    <Settings className="mr-2 h-4 w-4" /> Workspace Settings
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/${tenant.slug}/subscriptions`}>
                                    <Zap className="mr-2 h-4 w-4" /> Billing & Plans
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive focus:bg-red-50 font-bold"
                                  onClick={() => { setTenantToDelete(tenant); setDeleteConfirm(""); }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Workspace
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-widest leading-none">Subscription Policy</p>
              <p className="text-[11px] font-medium leading-relaxed max-w-2xl">
                Trial accounts are automatically <strong>suspended</strong> after 7 days if no active subscription plan is chosen. All workspace data is preserved for 30 days during suspension.
              </p>
            </div>
          </div>
          <Button variant="outline" className="bg-white border-amber-200 text-amber-800 hover:bg-amber-100 rounded-xl font-bold text-xs h-10 px-5">
            Learn more about plans
          </Button>
        </div>

        <footer className="mt-20 py-8 border-t text-center space-y-4">
          <div className="flex items-center justify-center gap-6 text-xs font-bold text-muted-foreground uppercase tracking-widest">
            <a href="#" className="hover:text-primary transition-colors">Docs</a>
            <a href="#" className="hover:text-primary transition-colors">Support</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
          </div>
          <p className="text-[10px] text-muted-foreground opacity-50 italic">ContentFlow v0.2.0 &middot; Secure Multi-tenant Infrastructure</p>
        </footer>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
        <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden sm:max-w-[500px]">
          <DialogHeader className="p-8 bg-red-50 border-b">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-red-900">Erase Workspace?</DialogTitle>
            <DialogDescription className="text-red-700 font-medium leading-relaxed">
              This will permanently delete <strong>"{tenantToDelete?.name}"</strong> and all of its content, members, and media. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <Label className="text-xs font-black uppercase text-muted-foreground">To confirm, type the workspace name below:</Label>
              <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 text-center">
                <span className="font-mono font-black text-red-600 select-none">{tenantToDelete?.name}</span>
              </div>
              <Input 
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Enter workspace name exactly"
                className="h-12 bg-muted/30 border-none rounded-xl focus-visible:ring-red-500 text-center font-bold"
              />
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/10 border-t gap-3">
            <Button variant="ghost" onClick={() => setTenantToDelete(null)} className="rounded-xl font-bold h-12 px-6">Keep Workspace</Button>
            <Button 
              variant="destructive" 
              className="rounded-xl font-black uppercase h-12 px-8 shadow-lg shadow-red-200"
              disabled={deleteConfirm !== tenantToDelete?.name || isDeleting}
              onClick={handleDeleteTenant}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Erase Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
