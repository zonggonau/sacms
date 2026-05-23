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
  ArrowRight, Zap, Layout, Globe, FileText, CreditCard
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Checkbox } from "@/components/ui/checkbox"
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
  const [isAccountPlanOpen, setIsAccountPlanOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null)
  const activeView = 'billing';
  const setActiveView = (view: string) => { if (view === 'templates') router.push('/dashboard/templates'); else if (view === 'billing') router.push('/dashboard/billing'); else router.push('/dashboard'); };

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [selectedCheckoutPlan, setSelectedCheckoutPlan] = useState<any>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const [accountPlans, setAccountPlans] = useState<any[]>([])

  const handleUpdateUserPlan = async (planId: string) => {
    setUpdatingPlanId(planId)
    try {
      if (planId === "free") {
        const res = await fetch("/api/user/plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: "free" }),
        })
        if (res.ok) {
          toast({ title: "Account Plan Updated", description: "You are now on the Free plan." })
          setIsAccountPlanOpen(false)
          router.refresh()
          return
        }
      } else {
        const plan = accountPlans.find(p => p.id === planId)
        if (plan) {
          setSelectedCheckoutPlan(plan)
          setIsAccountPlanOpen(false)
          setIsCheckoutModalOpen(true)
        } else {
          toast({ variant: "destructive", title: "Error", description: "Plan not found." })
        }
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to initiate checkout." })
    } finally {
      setUpdatingPlanId(null)
    }
  }

  const handleCheckoutProcess = async () => {
    if (!selectedCheckoutPlan) return
    setCheckoutLoading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedCheckoutPlan.id,
          type: "account",
          interval: "year"
        }),
      })

      const data = await res.json()

      if (res.ok && data.token) {
        if (typeof window !== 'undefined' && (window as any).snap) {
          setIsCheckoutModalOpen(false) // Tutup modal agar tidak memblokir Midtrans iframe
          ;(window as any).snap.pay(data.token, {
            onSuccess: (result: any) => {
              toast({ title: "Payment Successful!", description: "Your account has been upgraded." })
              router.refresh()
            },
            onPending: (result: any) => {
              toast({ title: "Payment Pending", description: "Please complete your payment." })
              router.refresh()
            },
            onError: (error: any) => {
              toast({ variant: "destructive", title: "Payment Failed", description: "Please try again." })
            },
            onClose: () => {
              setCheckoutLoading(false)
            }
          })
        } else {
          toast({ variant: "destructive", title: "Error", description: "Payment system not ready." })
          setCheckoutLoading(false)
        }
      } else {
        throw new Error(data.error || "Checkout failed")
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
      setCheckoutLoading(false)
    }
  }
  
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
    websiteType: "custom",
    isAnnual: false,
    selectedAddons: [] as string[]
  })

  const calculateTotalPrice = () => {
    const basePlan = workspacePlans.find(p => p.id === newTenant.plan)
    if (!basePlan) return 0
    
    let basePrice = basePlan.priceAmount || 0
    if (newTenant.isAnnual) basePrice = basePrice * 10 // 2 months free for annual
    
    let addonPrice = newTenant.selectedAddons.reduce((sum, addonId) => {
      const addon = addonPlans.find(a => a.id === addonId)
      return sum + (addon?.priceAmount || 0)
    }, 0)
    
    if (newTenant.isAnnual) addonPrice = addonPrice * 10

    return basePrice + addonPrice
  }

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

  const [workspacePlans, setWorkspacePlans] = useState<any[]>([
    { 
      id: "free", name: "Free", price: "Rp 0", priceAmount: 0,
      desc: "For small personal projects", 
      features: ["Unlimited Content Types", "500 Entries"]
    }
  ])
  
  const [addonPlans, setAddonPlans] = useState<any[]>([])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated") {
      const user = session?.user
      if (user?.role !== "super_admin" && user?.role !== "admin") {
        const isOwnerOrAdmin = user?.tenants?.some((t: any) => t.role === "owner" || t.role === "admin")
        if (!isOwnerOrAdmin && user?.tenants && user.tenants.length > 0) {
          router.push(`/cms/${user.tenants[0].slug}`)
        }
      }
    }
  }, [status, session, router])

  // Load Midtrans Snap Script
  useEffect(() => {
    const snapScript = process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL || "https://app.sandbox.midtrans.com/snap/snap.js"
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ""
    
    const script = document.createElement("script")
    script.src = snapScript
    script.setAttribute("data-client-key", clientKey)
    script.async = true
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

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
      
      // Fetch dynamic account plans
      const globalToken = process.env.NEXT_PUBLIC_SACMS_GLOBAL_API_KEY || "cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd"
      fetch("/api/public/sacms-global/content/sacms-account-pricing?sort=price:asc", {
        headers: {
          "Authorization": `Bearer ${globalToken}`
        }
      })
        .then(res => res.json())
        .then(json => {
          if (json.data && Array.isArray(json.data)) {
            const mapped = json.data
              .filter((p: any) => p.plan_slug !== 'free' && p.price > 0)
              .map((p: any) => {
              let displayPrice = "Rp 0"
              const yearlyPrice = p.price * 10
              if (p.price > 0) {
                if (yearlyPrice >= 1000000) {
                  displayPrice = `Rp ${(yearlyPrice / 1000000).toLocaleString('id-ID')}M`
                } else {
                  displayPrice = `Rp ${(yearlyPrice / 1000).toLocaleString('id-ID')}k`
                }
              } else if (p.price === 0 && p.cta_text?.toLowerCase().includes('contact')) {
                displayPrice = "Custom"
              }
              
              return {
                id: p.plan_slug,
                name: p.name,
                workspaces: p.max_workspaces || "Unlimited",
                price: displayPrice,
                priceAmount: p.price,
                features: p.features || []
              }
            })
            if (mapped.length > 0) setAccountPlans(mapped)
          }
        })
        .catch(err => console.error("Failed to fetch account plans:", err))

      // Fetch dynamic workspace plans
      fetch("/api/public/sacms-global/content/sacms-workspace-pricing?sort=price:asc", {
        headers: { "Authorization": `Bearer ${globalToken}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.data && Array.isArray(json.data)) {
            const mapped = json.data.map((p: any) => ({
              id: p.plan_slug || p.name.toLowerCase().replace(/\s+/g, '-'),
              name: p.name,
              price: `Rp ${(p.price / 1000).toLocaleString('id-ID')}k`,
              priceAmount: p.price,
              desc: p.description || "",
              features: p.features || []
            }))
            if (mapped.length > 0) setWorkspacePlans(mapped)
          }
        })
        .catch(err => console.error("Failed to fetch workspace plans:", err))

      // Fetch dynamic addons
      fetch("/api/public/sacms-global/content/sacms-addons?sort=price:asc", {
        headers: { "Authorization": `Bearer ${globalToken}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.data && Array.isArray(json.data)) {
            const mapped = json.data.map((p: any) => ({
              id: p.addon_slug || p.name.toLowerCase().replace(/\s+/g, '-'),
              name: p.name,
              price: `Rp ${(p.price / 1000).toLocaleString('id-ID')}k`,
              priceAmount: p.price,
              desc: p.description || "",
              icon: p.icon || "Zap"
            }))
            if (mapped.length > 0) setAddonPlans(mapped)
          }
        })
        .catch(err => console.error("Failed to fetch addons:", err))
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      

      <main className="flex-1 p-6 md:p-10 max-w-7xl w-full mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground">Manage your content ecosystem and tenants.</p>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/dashboard')}
                className={cn(
                  "text-sm font-semibold pb-2 transition-all border-b-2",
                  activeView === 'workspaces' 
                    ? "border-orange-500 text-orange-500 font-bold" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Workspaces
              </button>
              <button 
                onClick={() => router.push('/dashboard/templates')}
                className={cn(
                  "text-sm font-semibold pb-2 transition-all border-b-2",
                  activeView === 'templates' 
                    ? "border-orange-500 text-orange-500 font-bold" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Templates
              </button>
              <button 
                onClick={() => router.push('/dashboard/billing')}
                className={cn(
                  "text-sm font-semibold pb-2 transition-all border-b-2",
                  activeView === 'billing' 
                    ? "border-orange-500 text-orange-500 font-bold" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Billing
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <Button 
              variant="outline"
              onClick={() => router.push('/dashboard/templates')}
              className="h-10 px-4 font-semibold rounded-none border-border"
            >
              <Layout className="mr-2 h-4 w-4" /> Browse Templates
            </Button>
            <Button 
              onClick={() => { setNewMember({...newTenant, websiteType: 'custom'}); setIsCreateOpen(true); }}
              className="bg-orange-500 hover:bg-orange-600 text-white h-10 px-4 font-semibold rounded-none border-none"
            >
              <Plus className="mr-2 h-4 w-4" /> New Workspace
            </Button>
          </div>
        </div>

        {activeView === 'workspaces' ? (
          <div className="space-y-8">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card border border-border shadow-none rounded-none">
                <CardContent className="p-6 flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Workspaces</span>
                    <h3 className="text-3xl font-bold">{tenants.length}</h3>
                  </div>
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card className="bg-card border border-border shadow-none rounded-none">
                <CardContent className="p-6 flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Projects</span>
                    <h3 className="text-3xl font-bold">{activeWorkspacesCount}</h3>
                  </div>
                  <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card className="bg-card border border-border shadow-none rounded-none">
                <CardContent className="p-6 flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Alerts</span>
                    <h3 className="text-3xl font-bold">{expiringSoonCount + suspendedCount}</h3>
                  </div>
                  <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                </CardContent>
              </Card>
            </div>

            {/* Workspaces List Section */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">Your Workspaces</h2>
                </div>
                
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                  <Input 
                    placeholder="Search workspaces..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 bg-background border border-border rounded-none text-sm focus-visible:ring-orange-500 focus-visible:ring-1 shadow-none"
                  />
                </div>
              </div>

              {loadingTenants ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider">Loading workspaces...</p>
                </div>
              ) : tenants.length === 0 ? (
                <Card className="border border-border border-dashed py-16 bg-card rounded-none">
                  <CardContent className="text-center space-y-6">
                    <div className="w-16 h-16 rounded-none bg-muted flex items-center justify-center mx-auto border border-border">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold">No active workspaces</h3>
                      <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                        Start by browsing professional pre-built templates or launch a blank workspace.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <Button onClick={() => router.push('/dashboard/templates')} variant="outline" className="rounded-none h-10 px-6 font-semibold border-border">
                        Browse Templates
                      </Button>
                      <Button onClick={() => setIsCreateOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white rounded-none h-10 px-6 font-semibold border-none">
                        Create Workspace
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-border shadow-none bg-card rounded-none overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="border-b border-border">
                          <TableHead className="w-[300px] py-4 px-6 text-xs font-bold uppercase text-muted-foreground">Workspace</TableHead>
                          <TableHead className="text-xs font-bold uppercase text-muted-foreground">Status</TableHead>
                          <TableHead className="text-xs font-bold uppercase text-muted-foreground">Plan</TableHead>
                          <TableHead className="text-xs font-bold uppercase text-muted-foreground">Trial / Expiry</TableHead>
                          <TableHead className="text-xs font-bold uppercase text-muted-foreground">Role</TableHead>
                          <TableHead className="text-right py-4 px-6 text-xs font-bold uppercase text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTenants.map((tenant) => {
                          const isSuspended = tenant.status === 'suspended' || (tenant.daysRemaining !== null && tenant.daysRemaining <= 0)
                          
                          return (
                            <TableRow key={tenant.id} className="border-b border-border hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                              <TableCell className="py-4 px-6">
                                <Link href={`/dashboard/${tenant.id}`} className="flex items-center gap-4">
                                  <div className="w-9 h-9 rounded-none bg-muted border border-border flex items-center justify-center font-bold text-foreground">
                                    {tenant.name[0].toUpperCase()}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-sm truncate max-w-[180px] text-foreground">{tenant.name}</span>
                                    <span className="text-xs text-muted-foreground font-mono">/{tenant.slug}</span>
                                  </div>
                                </Link>
                              </TableCell>
                              <TableCell>
                                {isSuspended ? (
                                  <Badge variant="outline" className="text-[10px] font-semibold uppercase bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 rounded-none border-red-200">
                                    <Ban className="h-2.5 w-2.5 mr-1" /> Suspended
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-none border-emerald-200">
                                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Active
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs font-semibold uppercase">{tenant.plan}</span>
                              </TableCell>
                              <TableCell>
                                {tenant.daysRemaining !== null ? (
                                  <div className="flex flex-col">
                                    <div className={cn(
                                      "flex items-center gap-1 font-bold text-xs",
                                      tenant.daysRemaining <= 3 ? "text-red-600" : tenant.daysRemaining <= 5 ? "text-orange-600" : "text-foreground"
                                    )}>
                                      <Clock className="h-3 w-3" />
                                      {tenant.daysRemaining} days left
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {tenant.daysRemaining > 0 ? "Trial active" : "Expired"}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">Unlimited</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs font-bold uppercase">{tenant.role}</span>
                              </TableCell>
                              <TableCell className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Link href={`/dashboard/${tenant.id}`}>
                                    <Button size="sm" className="h-8 rounded-none font-bold text-xs px-3 bg-orange-500 hover:bg-orange-600 text-white border-none">
                                      Enter <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                    </Button>
                                  </Link>
                                  
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-none border-border">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-none border border-border bg-background shadow-none">
                                      <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">Manage</DropdownMenuLabel>
                                      <DropdownMenuItem asChild>
                                        <Link href={`/dashboard/${tenant.id}/settings`} className="text-xs cursor-pointer">
                                          <Settings className="mr-2 h-4 w-4" /> Workspace Settings
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <Link href={`/dashboard/${tenant.id}/subscriptions`} className="text-xs cursor-pointer">
                                          <Zap className="mr-2 h-4 w-4 text-orange-500 fill-orange-500" /> Billing & Plans
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator className="border-b border-border" />
                                      <DropdownMenuItem 
                                        className="text-destructive focus:text-destructive focus:bg-red-50 font-bold text-xs cursor-pointer"
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
        ) : activeView === 'billing' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-tight">Account Billing</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage your global subscription, usage, and payment methods.</p>
              </div>
              <Button 
                onClick={() => setIsAccountPlanOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-none h-10 px-6 border-none text-xs uppercase shadow-none"
              >
                <Zap className="mr-2 h-4 w-4 fill-current" />
                Upgrade Plan
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card border border-border shadow-none rounded-none">
                <CardContent className="p-6 flex flex-col justify-between h-full space-y-6">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Plan</span>
                    <div className="flex items-center gap-3 mt-2">
                      <h3 className="text-4xl font-black uppercase tracking-tight text-orange-500">{session?.user?.plan || "Free"}</h3>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 rounded-none font-bold uppercase tracking-widest text-[10px]">Active</Badge>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-muted/10 border border-border text-sm text-muted-foreground">
                    You are currently on the <strong className="text-foreground uppercase">{session?.user?.plan || "Free"}</strong> plan. 
                    {session?.user?.plan === 'free' ? " Upgrade your account to unlock premium templates, higher limits, and unlimited workspaces." : " Your subscription is active and in good standing. You will be billed annually."}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border border-border shadow-none rounded-none">
                <CardContent className="p-6 space-y-6">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workspace Usage Limit</span>
                    <div className="flex items-end gap-2 mt-2">
                      <h3 className="text-4xl font-black tracking-tight">{activeWorkspacesCount}</h3>
                      <span className="text-sm text-muted-foreground font-bold mb-1 uppercase">/ {session?.user?.plan === 'free' ? '3' : 'Unlimited'} Workspaces</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="w-full bg-muted h-2.5 rounded-none overflow-hidden border border-border">
                       <div 
                         className={cn(
                           "h-full transition-all duration-500", 
                           session?.user?.plan === 'free' ? (activeWorkspacesCount >= 3 ? "bg-red-500" : "bg-orange-500") : "bg-emerald-500"
                         )} 
                         style={{ width: session?.user?.plan === 'free' ? `${Math.min((activeWorkspacesCount / 3) * 100, 100)}%` : '100%' }} 
                       />
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                      {session?.user?.plan === 'free' 
                        ? `${Math.max(3 - activeWorkspacesCount, 0)} workspaces remaining on Free plan.` 
                        : "You have unlimited workspaces."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card className="bg-card border border-border shadow-none rounded-none mt-6">
               <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                 <div>
                   <h3 className="text-sm font-bold uppercase tracking-tight mb-1">Payment Method & Invoices</h3>
                   <p className="text-xs text-muted-foreground">Manage your credit cards, billing address, and download past invoices via our secure portal.</p>
                 </div>
                 <Button variant="outline" className="rounded-none font-bold text-xs uppercase h-10 border-border" disabled>
                   <CreditCard className="mr-2 h-4 w-4" /> Open Billing Portal
                 </Button>
               </CardContent>
            </Card>
          </div>
        ) : (
          /* Templates View Section - REDESIGNED TO BE SIMPLISTIC & CLASSIC */
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold uppercase tracking-tight">Premium Templates</h2>
                <p className="text-xs text-muted-foreground font-medium">Expertly crafted pre-configured architectures.</p>
              </div>

              {/* Category Filter Bar */}
              <div className="flex flex-wrap gap-1.5">
                {uniqueCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-none text-xs font-semibold tracking-tight transition-all border",
                      selectedCategory === cat
                        ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                        : "bg-background text-muted-foreground hover:bg-zinc-50 hover:text-foreground border-border"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {loadingTemplates ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse space-y-4 border border-border p-6 rounded-none bg-card">
                    <div className="h-8 w-8 bg-muted rounded-none" />
                    <div className="h-4 w-2/3 bg-muted rounded-none" />
                    <div className="h-10 w-full bg-muted rounded-none" />
                  </div>
                ))
              ) : filteredTemplates.length > 0 ? (
                filteredTemplates.map((tpl) => {
                  const Icon = IconMap[tpl.icon] || Globe
                  
                  return (
                    <Card 
                      key={tpl.id} 
                      onClick={() => openTemplateDialog(tpl.template_id || tpl.id)}
                      className="border border-border bg-card rounded-none shadow-none hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer transition-colors flex flex-col justify-between"
                    >
                      <CardContent className="p-6 space-y-4 flex flex-col justify-between h-full">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="w-10 h-10 bg-muted border border-border flex items-center justify-center">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[9px] font-semibold uppercase rounded-none border-border bg-transparent text-muted-foreground px-1.5 h-4">
                                {tpl.kategori_website || "General"}
                              </Badge>
                              {tpl.is_popular && (
                                <Badge className="bg-amber-400 text-amber-950 border-none text-[9px] font-bold uppercase rounded-none px-1.5 h-4">
                                  Popular
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <h3 className="font-bold text-sm uppercase tracking-tight text-foreground">
                              {tpl.name || tpl.nama_template}
                            </h3>
                            <div 
                              className="text-xs text-muted-foreground leading-relaxed line-clamp-3"
                              dangerouslySetInnerHTML={{ __html: tpl.description || "" }}
                            />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-border flex items-center justify-between text-muted-foreground group">
                          <span className="text-[10px] font-bold uppercase tracking-tight">Select Template</span>
                          <ArrowRight className="h-4 w-4 text-orange-500 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              ) : (
                <div className="col-span-full py-16 bg-card rounded-none border border-border border-dashed flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-16 h-16 rounded-none bg-muted border border-border flex items-center justify-center">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold">No templates found</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto text-xs">
                      Try adjusting your search query or category filters.
                    </p>
                  </div>
                  <Button 
                    onClick={() => { setSelectedCategory("All"); setSearchQuery(""); }}
                    variant="outline" 
                    className="rounded-none text-xs h-10 px-6 border-border"
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Global Footer warning info - simplified */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-none bg-zinc-50 border border-border text-foreground dark:bg-zinc-900/30">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wider">Subscription Policy</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Trial accounts are automatically suspended after 7 days if no active subscription plan is chosen. Workspace data is preserved for 30 days during suspension.
              </p>
            </div>
          </div>
        </div>

        <footer className="py-8 border-t border-border text-center space-y-3">
          <div className="flex items-center justify-center gap-6 text-xs font-bold text-muted-foreground uppercase tracking-widest">
            <a href="#" className="hover:text-orange-500 transition-colors">Docs</a>
            <a href="#" className="hover:text-orange-500 transition-colors">Support</a>
            <a href="#" className="hover:text-orange-500 transition-colors">Privacy</a>
          </div>
          <p className="text-[10px] text-muted-foreground opacity-60">SaCMS v0.2.0 &middot; Secure Multi-tenant Infrastructure</p>
        </footer>

        {/* Workspace Creation Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="rounded-none border border-border bg-background shadow-none p-0 overflow-hidden lg:max-w-2xl flex flex-col max-h-[90vh]">
            <DialogHeader className="p-6 border-b border-border bg-muted/20 flex-shrink-0">
              <DialogTitle className="text-xl font-bold uppercase tracking-tight text-foreground">
                {newTenant.websiteType === 'custom' 
                  ? "Launch New Workspace" 
                  : `Launch ${dbTemplates.find(t => t.template_id === newTenant.websiteType)?.name || dbTemplates.find(t => t.template_id === newTenant.websiteType)?.nama_template || "Workspace"}`}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {newTenant.websiteType === 'custom' 
                  ? "Start fresh or choose from a selection of templates later." 
                  : "We'll bootstrap your workspace with the selected premium template."}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto">
              <form onSubmit={handleCreateTenant} className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-foreground">Workspace Name</Label>
                  <Input 
                    placeholder="e.g. My Awesome Project" 
                    value={newTenant.name}
                    onChange={e => setNewMember({...newTenant, name: e.target.value})}
                    required
                    className="h-11 bg-background border border-border text-base rounded-none focus-visible:ring-orange-500 focus-visible:ring-1 shadow-none"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-foreground">Select a Subscription Plan</Label>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-semibold", !newTenant.isAnnual ? "text-orange-500 font-bold" : "text-muted-foreground")}>Monthly</span>
                      <Checkbox 
                        checked={newTenant.isAnnual} 
                        onCheckedChange={(checked) => setNewMember({...newTenant, isAnnual: checked as boolean})}
                        className="rounded-none border-border"
                      />
                      <span className={cn("text-xs font-semibold", newTenant.isAnnual ? "text-orange-500 font-bold" : "text-muted-foreground")}>Yearly <span className="text-emerald-600 font-bold">(2 Months Free)</span></span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {workspacePlans.map((plan) => (
                      <div 
                        key={plan.id}
                        onClick={() => setNewMember({...newTenant, plan: plan.id})}
                        className={cn(
                          "cursor-pointer p-4 rounded-none border transition-all relative",
                          newTenant.plan === plan.id 
                            ? "border-orange-500 bg-orange-500/[0.02]" 
                            : "border-border hover:border-muted-foreground/30 bg-card"
                        )}
                      >
                        {newTenant.plan === plan.id && (
                          <div className="absolute top-3 right-3 text-orange-500">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-1 pr-4">
                          <span className="font-bold uppercase text-xs tracking-tight">{plan.name}</span>
                          <span className="font-bold text-xs text-orange-500">
                            {plan.id === "enterprise" 
                              ? "Custom" 
                              : `Rp ${(newTenant.isAnnual ? (plan.priceAmount! * 10 / 1000) : (plan.priceAmount! / 1000))}k${newTenant.isAnnual ? "/yr" : "/mo"}`}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-3 leading-tight">{plan.desc}</p>
                        <div className="flex flex-wrap gap-1">
                          {plan.features.map(f => (
                            <Badge key={f} variant="outline" className="text-[9px] font-bold px-1.5 py-0 bg-muted/60 border-none rounded-none text-muted-foreground">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add-ons Section - Dynamic */}
                {addonPlans.length > 0 && (
                  <div className="space-y-4 p-5 bg-muted/20 rounded-none border border-border">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 fill-current" /> Premium Add-ons
                    </h4>
                    
                    <div className="space-y-4">
                      {addonPlans.map((addon, idx) => {
                        const IconComp = IconMap[addon.icon] || Zap
                        const isSelected = newTenant.selectedAddons.includes(addon.id)
                        return (
                          <div key={addon.id} className={cn("flex items-center justify-between gap-4", idx > 0 && "pt-4 border-t border-border")}>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <IconComp className="h-4 w-4 text-muted-foreground" />
                                <Label className="text-xs font-bold">{addon.name}</Label>
                              </div>
                              <p className="text-[10px] text-muted-foreground">{addon.price}/month. {addon.desc}</p>
                            </div>
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNewMember({...newTenant, selectedAddons: [...newTenant.selectedAddons, addon.id]})
                                } else {
                                  setNewMember({...newTenant, selectedAddons: newTenant.selectedAddons.filter(a => a !== addon.id)})
                                }
                              }}
                              className="h-5 w-5 rounded-none border-border"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-orange-500 text-white rounded-none flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Total Due Today</p>
                    <h3 className="text-xl font-bold tracking-tight">
                      Rp {(calculateTotalPrice() / 1000).toLocaleString()}k
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase opacity-90">Billing Cycle</p>
                    <p className="text-xs font-bold uppercase">{newTenant.isAnnual ? "Annual" : "Monthly"}</p>
                  </div>
                </div>

                <DialogFooter className="pt-2 border-t border-border">
                  <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-none font-bold text-xs h-10">Cancel</Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-none h-10 px-6 border-none text-xs">
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
        <DialogContent className="rounded-none border border-border bg-background shadow-none p-0 overflow-hidden sm:max-w-[450px]">
          <DialogHeader className="p-6 bg-red-50 border-b border-red-100 dark:bg-red-950/10">
            <div className="w-10 h-10 rounded-none bg-red-100 flex items-center justify-center mb-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <DialogTitle className="text-lg font-bold uppercase tracking-tight text-red-900 dark:text-red-400">Delete Workspace?</DialogTitle>
            <DialogDescription className="text-xs text-red-700 dark:text-red-300 mt-1 leading-normal">
              This will permanently delete <strong>"{tenantToDelete?.name}"</strong> and all of its content schema, entries, and associated R2 media files. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase pl-0.5">Type workspace name to confirm:</Label>
              <div className="p-2 bg-red-50/50 dark:bg-red-950/5 border border-red-100 text-center select-none font-mono font-bold text-red-600">
                {tenantToDelete?.name}
              </div>
              <Input 
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Enter workspace name exactly"
                className="h-10 bg-background border border-border rounded-none focus-visible:ring-red-500 text-center font-bold text-sm"
              />
            </div>
          </div>
          
          <DialogFooter className="p-6 bg-muted/10 border-t border-border gap-2">
            <Button variant="ghost" onClick={() => setTenantToDelete(null)} className="rounded-none font-bold text-xs h-10 px-4">Keep Workspace</Button>
            <Button 
              variant="destructive" 
              className="rounded-none font-bold uppercase text-xs h-10 px-5 shadow-none"
              disabled={deleteConfirm !== tenantToDelete?.name || isDeleting}
              onClick={handleDeleteTenant}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Erase Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Plan Management Dialog */}
      <Dialog open={isAccountPlanOpen} onOpenChange={setIsAccountPlanOpen}>
        <DialogContent className="rounded-none border border-border bg-background shadow-none p-0 overflow-hidden lg:max-w-4xl flex flex-col max-h-[90vh]">
          <DialogHeader className="p-8 border-b border-border bg-muted/20 flex-shrink-0">
            <DialogTitle className="text-xl font-bold uppercase tracking-tight text-foreground flex items-center gap-2">
              <Zap className="h-6 w-6 text-orange-500 fill-orange-500" /> Account Plans
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Select or upgrade your account tier. Limits scale per plan.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {accountPlans.slice(0, 3).map((plan) => {
                const isCurrent = session?.user?.plan === plan.id
                
                return (
                  <Card 
                    key={plan.id}
                    className={cn(
                      "rounded-none border shadow-none relative transition-colors",
                      isCurrent 
                        ? "border-orange-500 bg-orange-500/[0.01]" 
                        : "border-border hover:border-zinc-300"
                    )}
                  >
                    {isCurrent && (
                      <div className="absolute top-3 right-3 bg-orange-500 text-white text-[8px] font-bold uppercase px-2 py-0.5 rounded-none">
                        Active
                      </div>
                    )}
                    
                    <CardContent className="p-6 space-y-4 flex flex-col justify-between h-full">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{plan.name}</h4>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold">{plan.price}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">/yr</span>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2">
                          <div className="flex items-center gap-2 text-xs text-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" />
                            <span>{plan.workspaces} Workspaces</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" />
                            <span>Unlimited Content schemas</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" />
                            <span>Standard Support SLAs</span>
                          </div>
                        </div>
                      </div>

                      <Button 
                        disabled={isCurrent || updatingPlanId !== null}
                        onClick={() => handleUpdateUserPlan(plan.id)}
                        className={cn(
                          "w-full h-10 rounded-none font-bold uppercase text-xs border transition-colors mt-4",
                          isCurrent 
                            ? "bg-muted border-border text-muted-foreground" 
                            : "bg-orange-500 border-none hover:bg-orange-600 text-white"
                        )}
                      >
                        {updatingPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrent ? "Active Plan" : "Upgrade to Yearly"}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            
            <div className="p-4 rounded-none bg-zinc-50 border border-border dark:bg-zinc-900/30 flex gap-4 items-center">
              <div className="w-10 h-10 bg-background border border-border flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-orange-500" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold uppercase tracking-wider">Enterprise Dedicated Limits</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                  Need massive custom storage, custom routing domains, isolated database shards, or custom legal agreements? <a href="#" className="text-orange-500 font-bold hover:underline">Contact sales support</a>.
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="p-4 border-t border-border bg-muted/10 flex-shrink-0">
            <Button variant="ghost" onClick={() => setIsAccountPlanOpen(false)} className="rounded-none font-bold text-xs h-10 px-5">Close Manager</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
        <DialogContent className="rounded-none border border-border bg-background shadow-none p-0 overflow-hidden sm:max-w-xl flex flex-col">
          <DialogHeader className="p-8 border-b border-border bg-muted/20 flex-shrink-0">
            <DialogTitle className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-orange-500" /> Secure Checkout
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Review your annual subscription details before proceeding to payment.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-8 space-y-6">
            {selectedCheckoutPlan && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/10 border border-border">
                  <div>
                    <p className="font-bold uppercase text-lg">{selectedCheckoutPlan.name} Plan</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Yearly Billing</p>
                  </div>
                  <p className="text-xl font-black text-orange-500">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(selectedCheckoutPlan.priceAmount * 10)}</p>
                </div>

                <div className="space-y-3 pt-4">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="text-foreground">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(selectedCheckoutPlan.priceAmount * 10)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <span>PPN (11%)</span>
                    <span className="text-foreground">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Math.round(selectedCheckoutPlan.priceAmount * 10 * 0.11))}</span>
                  </div>
                  <div className="border-t border-border mt-4 pt-4 flex justify-between items-end">
                    <span className="text-base font-black uppercase tracking-tight">Total Amount</span>
                    <span className="text-3xl font-black text-foreground tracking-tight">
                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format((selectedCheckoutPlan.priceAmount * 10) + Math.round(selectedCheckoutPlan.priceAmount * 10 * 0.11))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="p-6 border-t border-border bg-muted/10 flex items-center justify-between gap-4">
            <Button variant="ghost" onClick={() => setIsCheckoutModalOpen(false)} className="rounded-none font-bold text-xs h-12 px-6">Cancel</Button>
            <Button 
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-none h-12 px-8 flex-1 sm:flex-none border-none text-sm uppercase shadow-none"
              onClick={handleCheckoutProcess}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CreditCard className="mr-2 h-5 w-5" />}
              {checkoutLoading ? "Processing" : "Pay Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
