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
  Calendar, ArrowRight, Zap, ExternalLink,
  Layout, Globe, FileText
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
  const [activeView, setActiveView] = useState<'workspaces' | 'templates'>('workspaces')
  
  // Delete State
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const [dbTemplates, setDbTemplates] = useState<any[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>("All")

  const [newTenant, setNewMember] = useState({
    name: "",
    description: "",
    plan: "free",
    websiteType: "custom"
  })

  // Icon mapping
  const IconMap: Record<string, any> = {
    Zap,
    LayoutDashboard,
    Search,
    Settings,
    Building2,
    Layout,
    Globe,
    FileText
  }

  const fetchTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const token = process.env.NEXT_PUBLIC_SYSTEM_API_KEY || "internal"
      const res = await fetch("/api/public/content/templates", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Cache-Control": "no-cache"
        }
      })
      
      if (res.ok) {
        const json = await res.json()
        setDbTemplates(json.data || [])
      } else {
        const resNoAuth = await fetch("/api/public/content/templates")
        if (resNoAuth.ok) {
          const json = await resNoAuth.json()
          setDbTemplates(json.data || [])
        }
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const plans = [
    { 
      id: "free", name: "Free", price: "Rp 0", 
      desc: "For small personal projects", 
      features: ["10 Content Schemas", "500 Entries"],
      color: "bg-slate-100 text-slate-700 border-slate-200"
    },
    { 
      id: "starter", name: "Starter", price: "Rp 499k", 
      desc: "Perfect for growing sites", 
      features: ["25 Content Schemas", "5,000 Entries"],
      color: "bg-blue-50 text-blue-700 border-blue-100"
    },
    { 
      id: "pro", name: "Business Pro", price: "Rp 1.499k", 
      desc: "Advanced features for teams", 
      features: ["50 Content Schemas", "50,000 Entries"],
      color: "bg-emerald-50 text-emerald-700 border-emerald-100"
    },
    { 
      id: "enterprise", name: "Enterprise", price: "Custom", 
      desc: "Isolated DB & Maximum security", 
      features: ["Dedicated Database", "Unlimited Content"],
      color: "bg-purple-50 text-purple-700 border-purple-100"
    }
  ]

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
      fetchTemplates()
    }
  }, [session])

  const isSuperAdmin = session?.user?.role === "super_admin"

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>()
    dbTemplates.forEach(tpl => {
      if (tpl.kategori_website) cats.add(tpl.kategori_website)
    })
    return ["All", ...Array.from(cats)]
  }, [dbTemplates])

  const filteredTemplates = useMemo(() => {
    return dbTemplates.filter(tpl => {
      const matchesCategory = selectedCategory === "All" || tpl.kategori_website === selectedCategory
      const matchesSearch = (tpl.name || tpl.nama_template || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (tpl.description || "").toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [dbTemplates, selectedCategory, searchQuery])

  const activeWorkspacesCount = tenants.filter(t => t.status === 'active' && (t.daysRemaining === null || t.daysRemaining > 0)).length
  const suspendedCount = tenants.length - activeWorkspacesCount
  const expiringSoonCount = tenants.filter(t => t.daysRemaining !== null && t.daysRemaining <= 3 && t.daysRemaining > 0).length

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
        window.location.href = `/dashboard/${data.tenant.id}`
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

  const openTemplateDialog = (tplId: string) => {
    setNewMember({ ...newTenant, websiteType: tplId })
    setIsCreateOpen(true)
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
          <span className="font-bold tracking-tight">SaCMS</span>
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

      <main className="p-6 lg:p-12 max-w-7xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-primary/20 text-[10px] font-black uppercase tracking-widest px-2">Workspace management</Badge>
              <h1 className="text-4xl font-extrabold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground">Manage your content ecosystem or launch a new project.</p>
            </div>
            
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setActiveView('workspaces')}
                className={cn(
                  "text-sm font-black uppercase tracking-widest pb-2 transition-all border-b-2",
                  activeView === 'workspaces' 
                    ? "border-primary text-primary" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Workspaces
              </button>
              <button 
                onClick={() => setActiveView('templates')}
                className={cn(
                  "text-sm font-black uppercase tracking-widest pb-2 transition-all border-b-2",
                  activeView === 'templates' 
                    ? "border-primary text-primary" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Templates
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => setActiveView('templates')}
              className="h-12 px-6 font-bold rounded-2xl border-2 hover:bg-muted/50"
            >
              <Layout className="mr-2 h-5 w-5" /> Templates
            </Button>
            <Button 
              onClick={() => { setNewMember({...newTenant, websiteType: 'custom'}); setIsCreateOpen(true); }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 h-12 px-6 font-bold rounded-2xl"
            >
              <Plus className="mr-2 h-5 w-5" /> New Blank Workspace
            </Button>
          </div>
        </div>

        {activeView === 'workspaces' ? (
          <div className="space-y-12">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card border-none shadow-sm rounded-3xl overflow-hidden group">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Workspaces</p>
                      <h3 className="text-3xl font-black">{tenants.length}</h3>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Building2 className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {tenants.slice(0, 3).map((t, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-[8px] font-bold">
                          {t.name[0]}
                        </div>
                      ))}
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">Recent activity across all</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-none shadow-sm rounded-3xl overflow-hidden group">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Projects</p>
                      <h3 className="text-3xl font-black">{activeWorkspacesCount}</h3>
                    </div>
                    <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-1000" 
                        style={{ width: `${(activeWorkspacesCount / (tenants.length || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-none shadow-sm rounded-3xl overflow-hidden group">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">System Alerts</p>
                      <h3 className="text-3xl font-black">{expiringSoonCount + suspendedCount}</h3>
                    </div>
                    <div className={cn(
                      "p-3 rounded-2xl",
                      (expiringSoonCount + suspendedCount) > 0 ? "bg-amber-100 text-amber-600 animate-pulse" : "bg-muted text-muted-foreground"
                    )}>
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] font-bold text-muted-foreground">
                    {expiringSoonCount} expiring soon · {suspendedCount} suspended
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Workspaces List Section */}
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-1 bg-primary rounded-full" />
                  <h2 className="text-xl font-black uppercase tracking-tight">Your Workspaces</h2>
                </div>
                
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                  <Input 
                    placeholder="Search workspaces..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 bg-card border-none shadow-inner rounded-xl text-sm focus-visible:ring-primary"
                  />
                </div>
              </div>

              {loadingTenants ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-bold uppercase tracking-widest">Synchronizing...</p>
                </div>
              ) : tenants.length === 0 ? (
                <Card className="border-dashed border-2 py-20 bg-card/50 rounded-3xl">
                  <CardContent className="text-center">
                    <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mx-auto mb-6">
                      <Building2 className="h-10 w-10 text-primary/30" />
                    </div>
                    <h3 className="text-2xl font-bold">No active workspaces</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mt-2 mb-8">
                      You haven't joined or created any workspace yet. Start by choosing a template or creating from scratch.
                    </p>
                    <div className="flex items-center justify-center gap-4">
                      <Button onClick={() => setActiveView('templates')} variant="outline" className="rounded-xl h-12 px-8 font-bold">
                        Browse Templates
                      </Button>
                      <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl h-12 px-8 font-bold">
                        Create Workspace
                      </Button>
                    </div>
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
                                <Link href={`/dashboard/${tenant.id}`} className="flex items-center gap-4">
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
                                      tenant.daysRemaining <= 3 ? "text-red-600" : tenant.daysRemaining <= 5 ? "text-orange-600" : "text-blue-600"
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
                                  <Link href={`/dashboard/${tenant.id}`}>
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
                                        <Link href={`/dashboard/${tenant.id}/settings`}>
                                          <Settings className="mr-2 h-4 w-4" /> Workspace Settings
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <Link href={`/dashboard/${tenant.id}/subscriptions`}>
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
            </section>
          </div>
        ) : (
          /* Templates View Section - REDESIGNED */
          <section className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-1 bg-primary rounded-full" />
                  <h2 className="text-2xl font-black uppercase tracking-tight">Premium Templates</h2>
                </div>
                <p className="text-sm text-muted-foreground">Expertly crafted architectures for your next big thing.</p>
              </div>

              {/* Category Filter Bar */}
              <div className="flex flex-wrap gap-2">
                {uniqueCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      selectedCategory === cat
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-card text-muted-foreground hover:bg-muted/50 border border-transparent hover:border-muted-foreground/10"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {loadingTemplates ? (
                Array(8).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse space-y-4">
                    <div className="aspect-[4/3] rounded-[2.5rem] bg-muted/20" />
                    <div className="h-4 w-2/3 bg-muted/20 rounded-full" />
                    <div className="h-3 w-full bg-muted/20 rounded-full" />
                  </div>
                ))
              ) : filteredTemplates.length > 0 ? (
                filteredTemplates.map((tpl) => {
                  const Icon = IconMap[tpl.icon] || Globe
                  
                  return (
                    <div 
                      key={tpl.id} 
                      className="group relative cursor-pointer"
                      onClick={() => openTemplateDialog(tpl.template_id || tpl.id)}
                    >
                      {/* Premium Card Design */}
                      <Card className="border-none shadow-none bg-card rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2">
                        <CardContent className="p-0">
                          {/* Visual Header */}
                          <div className="aspect-[4/3] relative bg-muted/30 flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 group-hover:scale-110 transition-transform duration-700" />
                            
                            {/* Floating Decorative Elements */}
                            <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
                              <Badge className="bg-white/80 backdrop-blur-md text-primary border-none text-[8px] font-black uppercase tracking-tighter px-2 h-5 shadow-sm">
                                {tpl.kategori_website || "General"}
                              </Badge>
                              {tpl.is_popular && (
                                <Badge className="bg-amber-400 text-amber-950 border-none text-[8px] font-black uppercase tracking-tighter px-2 h-5">
                                  Popular
                                </Badge>
                              )}
                            </div>

                            <div className="relative z-0">
                              <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full group-hover:blur-[60px] transition-all" />
                              <Icon className="h-20 w-20 text-primary relative z-10 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 drop-shadow-2xl" />
                            </div>

                            {/* Hover Action Overlay */}
                            <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 backdrop-blur-0 group-hover:backdrop-blur-[2px] transition-all duration-500 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <Button className="rounded-2xl font-black uppercase tracking-widest text-[10px] h-10 px-6 shadow-2xl shadow-primary/40">
                                  Select Template
                                </Button>
                            </div>
                          </div>

                          {/* Content Body */}
                          <div className="p-8 space-y-4">
                            <div className="space-y-2">
                              <h3 className="text-lg font-black tracking-tight leading-tight group-hover:text-primary transition-colors uppercase">
                                {tpl.name || tpl.nama_template}
                              </h3>
                              <div 
                                className="text-xs text-muted-foreground leading-relaxed line-clamp-2 opacity-80 group-hover:opacity-100 transition-opacity"
                                dangerouslySetInnerHTML={{ __html: tpl.description || "" }}
                              />
                            </div>
                            
                            <div className="pt-2 flex items-center justify-between border-t border-muted/50">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Zap className="h-3 w-3 text-primary" />
                                </div>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Fast Setup</span>
                              </div>
                              <ArrowRight className="h-4 w-4 text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })
              ) : (
                <div className="col-span-full py-20 bg-card rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center text-center gap-6">
                  <div className="w-24 h-24 rounded-[2rem] bg-muted/30 flex items-center justify-center">
                    <Search className="h-10 w-10 text-muted-foreground/20" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase tracking-tight">No templates found</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                      Try adjusting your search or category filters to find what you're looking for.
                    </p>
                  </div>
                  <Button 
                    onClick={() => { setSelectedCategory("All"); setSearchQuery(""); }}
                    variant="outline" 
                    className="rounded-2xl font-black uppercase tracking-widest text-xs h-12 px-8"
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Global Footer info */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-3xl bg-amber-50 border border-amber-100 text-amber-800">
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

        <footer className="py-8 border-t text-center space-y-4">
          <div className="flex items-center justify-center gap-6 text-xs font-bold text-muted-foreground uppercase tracking-widest">
            <a href="#" className="hover:text-primary transition-colors">Docs</a>
            <a href="#" className="hover:text-primary transition-colors">Support</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
          </div>
          <p className="text-[10px] text-muted-foreground opacity-50 italic">SaCMS v0.2.0 &middot; Secure Multi-tenant Infrastructure</p>
        </footer>

        {/* Workspace Creation Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden lg:max-w-2xl flex flex-col max-h-[90vh]">
            <DialogHeader className="p-8 bg-muted/30 border-b flex-shrink-0">
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                {newTenant.websiteType === 'custom' 
                  ? "Launch New Workspace" 
                  : `Launch ${dbTemplates.find(t => t.template_id === newTenant.websiteType)?.name || dbTemplates.find(t => t.template_id === newTenant.websiteType)?.nama_template || "Workspace"}`}
              </DialogTitle>
              <DialogDescription>
                {newTenant.websiteType === 'custom' 
                  ? "Start fresh or use AI to generate your architecture." 
                  : "We'll set up your workspace with the selected professional template."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <form onSubmit={handleCreateTenant} className="p-8 space-y-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Workspace Name</Label>
                  <Input 
                    placeholder="e.g. My Awesome Project" 
                    value={newTenant.name}
                    onChange={e => setNewMember({...newTenant, name: e.target.value})}
                    required
                    className="h-12 bg-muted/30 border-none text-lg rounded-xl focus-visible:ring-primary shadow-inner"
                  />
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Select a Subscription Plan</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {plans.map((plan) => (
                      <div 
                        key={plan.id}
                        onClick={() => setNewMember({...newTenant, plan: plan.id})}
                        className={cn(
                          "cursor-pointer p-4 rounded-2xl border-2 transition-all relative group",
                          newTenant.plan === plan.id 
                            ? "border-primary bg-primary/5 shadow-md scale-[1.02]" 
                            : "border-muted hover:border-muted-foreground/30 bg-card"
                        )}
                      >
                        {newTenant.plan === plan.id && (
                          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-black uppercase text-xs tracking-tight">{plan.name}</span>
                          <span className="font-bold text-xs text-primary">{plan.price}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-3 leading-tight">{plan.desc}</p>
                        <div className="flex flex-wrap gap-1">
                          {plan.features.map(f => (
                            <Badge key={f} variant="outline" className="text-[8px] font-bold px-1.5 py-0 bg-muted/50 border-none">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-700 uppercase flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Trial Period
                  </p>
                  <p className="text-[11px] text-amber-800/70 mt-1 leading-relaxed">
                    All paid plans include a <strong>7-day free trial</strong>. You can cancel anytime from your settings.
                  </p>
                </div>

                <DialogFooter className="pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl font-bold">Cancel</Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-primary font-bold rounded-xl h-12 px-10 shadow-lg shadow-primary/20">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 fill-current" />}
                    Create {newTenant.plan.toUpperCase()} Workspace
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
        </Dialog>
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
