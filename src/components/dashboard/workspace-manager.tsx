"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Plus, Building2, Search, Settings, 
  MoreVertical, Trash2, AlertTriangle, Clock,
  ArrowRight, Zap, CheckCircle2, ExternalLink
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
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { createTenantAction, deleteTenantAction } from "@/actions/tenant"
import { useRouter } from "next/navigation"

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
  subscriptionStatus: string | null
}

interface WorkspaceManagerProps {
  initialTenants: Tenant[]
  usage: { current: number; max: number | null; allowed: boolean; plan: string } | null
  dbTemplates: any[]
  workspacePlans: any[]
  addonPlans: any[]
  isSuperAdmin?: boolean
}

export function WorkspaceManager({
  initialTenants,
  usage,
  dbTemplates,
  workspacePlans,
  addonPlans,
  isSuperAdmin
}: WorkspaceManagerProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete State
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const [newTenant, setNewMember] = useState({
    name: "",
    description: "",
    plan: "free",
    websiteType: "custom",
    isAnnual: true,
    selectedAddons: [] as string[]
  })

  const filteredTenants = initialTenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeWorkspacesCount = initialTenants.filter(t => t.status === 'active' && (t.daysRemaining === null || t.daysRemaining > 0)).length
  const suspendedCount = initialTenants.length - activeWorkspacesCount
  const expiringSoonCount = initialTenants.filter(t => t.daysRemaining !== null && t.daysRemaining <= 3 && t.daysRemaining > 0).length

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await createTenantAction(newTenant)

      if (res.success) {
        toast({ title: "Workspace Created!", description: "Launching your dashboard..." })
        router.push(`/dashboard/${res.tenantId}`)
      } else {
        toast({ variant: "destructive", title: "Creation Failed", description: res.error })
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
      const res = await deleteTenantAction(tenantToDelete.id)
      if (res.success) {
        toast({ title: "Workspace Deleted", description: "All data has been permanently removed." })
        setTenantToDelete(null)
        setDeleteConfirm("")
      } else {
        toast({ variant: "destructive", title: "Delete Failed", description: res.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Deletion failed" })
    } finally {
      setIsDeleting(false)
    }
  }

  const calculateTotalPrice = () => {
    const basePlan = workspacePlans.find(p => p.id === newTenant.plan)
    if (!basePlan) return 0
    
    let basePrice = basePlan.priceAmount || 0
    if (newTenant.isAnnual) basePrice = basePlan.yearlyPrice !== undefined ? basePlan.yearlyPrice : basePrice * 10
    
    let addonPrice = newTenant.selectedAddons.reduce((sum, addonId) => {
      const addon = addonPlans.find(a => a.id === addonId)
      return sum + (addon?.priceAmount || 0)
    }, 0)
    
    if (newTenant.isAnnual) addonPrice = addonPrice * 10

    return basePrice + addonPrice
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Your Workspaces</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage and access all your projects.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {isSuperAdmin && (
            <Button variant="outline" asChild className="border-orange-500 text-orange-500 hover:bg-orange-500/10">
              <Link href="/admin">
                Super Admin Panel
              </Link>
            </Button>
          )}
          {usage && (
            <div className="text-sm px-3 py-1.5 bg-muted rounded-md flex items-center gap-2 border border-border">
              <span className="text-muted-foreground">Workspaces:</span>
              <span className={cn("font-medium", !usage.allowed && "text-red-500")}>
                {usage.current} / {usage.max === null ? "Unlimited" : usage.max}
              </span>
            </div>
          )}
          <Button 
            onClick={() => { 
              if (usage && !usage.allowed) {
                toast({ variant: "destructive", title: "Limit Reached", description: `You have reached the maximum workspaces for your ${usage.plan} plan. Please upgrade your account.` })
                return
              }
              setNewMember({...newTenant, websiteType: 'custom'})
              setIsCreateOpen(true) 
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> New Workspace
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="p-6 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Total Workspaces</span>
              <h3 className="text-2xl font-bold">{initialTenants.length}</h3>
            </div>
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="p-6 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Active Projects</span>
              <h3 className="text-2xl font-bold">{activeWorkspacesCount}</h3>
            </div>
            <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border border-border">
          <CardContent className="p-6 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">System Alerts</span>
              <h3 className="text-2xl font-bold">{expiringSoonCount + suspendedCount}</h3>
            </div>
            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex justify-end">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search workspaces..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-background"
            />
          </div>
        </div>

        {initialTenants.length === 0 ? (
          <div className="py-16 bg-card border border-border border-dashed rounded-xl flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">No workspaces yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Get started by creating your first workspace or choosing from our premium templates.
              </p>
            </div>
            <Button 
              onClick={() => { 
                if (usage && !usage.allowed) {
                  toast({ variant: "destructive", title: "Limit Reached", description: "You have reached your workspace limit. Please upgrade your account." })
                  return
                }
                setNewMember({...newTenant, websiteType: 'custom'})
                setIsCreateOpen(true) 
              }}
              className="mt-2"
            >
              <Plus className="mr-2 h-4 w-4" /> Create Workspace
            </Button>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground bg-card border border-border rounded-xl">
            <p>No workspaces found matching "{searchQuery}"</p>
          </div>
        ) : (
          <Card className="shadow-sm border border-border overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-foreground">Workspace Name</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Billing</TableHead>
                    <TableHead className="font-semibold text-foreground">Your Role</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => (
                    <TableRow key={tenant.id} className="group hover:bg-muted/50">
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {tenant.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{tenant.slug}.sacms.com</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {tenant.subscriptionStatus === 'trialing' ? (
                          <Badge 
                            className="capitalize text-[10px] font-black bg-orange-500 hover:bg-orange-600 text-white border-none"
                          >
                            Trial {tenant.daysRemaining !== null ? `(${tenant.daysRemaining} Days Left)` : ''}
                          </Badge>
                        ) : (
                          <Badge 
                            variant={tenant.status === 'active' ? "default" : tenant.status === 'suspended' ? "destructive" : "secondary"}
                            className={cn(
                              "capitalize text-[10px] font-bold",
                              tenant.status === 'active' ? "bg-green-500 hover:bg-green-600 text-white border-none" : ""
                            )}
                          >
                            {tenant.status} {tenant.status === 'active' && tenant.daysRemaining !== null ? `(${tenant.daysRemaining} Days Left)` : ''}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {tenant.plan === 'trial' && tenant.daysRemaining !== null ? (
                          <div className="flex flex-col">
                            <div className={cn(
                              "flex items-center gap-1 font-semibold text-xs",
                              tenant.daysRemaining <= 3 ? "text-destructive" : tenant.daysRemaining <= 5 ? "text-orange-500" : "text-foreground"
                            )}>
                              <Clock className="h-3 w-3" />
                              {tenant.daysRemaining} days left
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {tenant.daysRemaining > 0 ? "Trial active" : "Expired"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground capitalize">{tenant.plan}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize font-medium">{tenant.role.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/${tenant.id}`}>
                            <Button size="sm" variant="default" className="h-8 font-medium">
                              Enter <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel className="text-xs text-muted-foreground">Manage Workspace</DropdownMenuLabel>
                              {['owner', 'admin'].includes(tenant.role) ? (
                                <>
                                  <DropdownMenuItem asChild className="cursor-pointer text-xs">
                                    <Link href={`/dashboard/${tenant.id}/settings`}>
                                      <Settings className="mr-2 h-4 w-4" /> Settings
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild className="cursor-pointer text-xs">
                                    <Link href={`/dashboard/${tenant.id}/subscriptions`}>
                                      <Zap className="mr-2 h-4 w-4" /> Billing & Plans
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className={cn("cursor-pointer text-xs", 
                                      tenant.plan !== 'free' && tenant.plan !== 'trial' && (tenant.subscriptionStatus === 'active' || tenant.subscriptionStatus === 'trialing') 
                                      ? "text-muted-foreground opacity-50" 
                                      : "text-destructive focus:bg-destructive focus:text-destructive-foreground"
                                    )}
                                    onClick={(e) => { 
                                      if (tenant.plan !== 'free' && tenant.plan !== 'trial' && (tenant.subscriptionStatus === 'active' || tenant.subscriptionStatus === 'trialing')) {
                                        e.preventDefault()
                                        toast({ variant: "destructive", title: "Action Blocked", description: "Cannot delete an active paid workspace. Please cancel your subscription first." })
                                        return
                                      }
                                      setTenantToDelete(tenant); 
                                      setDeleteConfirm(""); 
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Workspace
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                                  <Link href={`/cms/${tenant.slug}`}>
                                    <ExternalLink className="mr-2 h-4 w-4" /> Go to Content Studio
                                  </Link>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </section>

      {/* Workspace Creation Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-border bg-muted/30">
            <DialogTitle className="text-xl font-bold">
              {newTenant.websiteType === 'custom' 
                ? "Launch New Workspace" 
                : `Launch ${dbTemplates.find(t => t.template_id === newTenant.websiteType)?.name || dbTemplates.find(t => t.template_id === newTenant.websiteType)?.nama_template || "Workspace"}`}
            </DialogTitle>
            <DialogDescription>
              {newTenant.websiteType === 'custom' 
                ? "Start fresh or choose from a selection of templates later." 
                : "We'll bootstrap your workspace with the selected premium template."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto">
            <form id="create-workspace-form" onSubmit={handleCreateTenant} className="p-6 space-y-6">
              <div className="space-y-2">
                <Label>Workspace Name</Label>
                <Input 
                  placeholder="e.g. My Awesome Project" 
                  value={newTenant.name}
                  onChange={e => setNewMember({...newTenant, name: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <Label>Select a Subscription Plan</Label>
                  <Badge variant="outline" className="text-emerald-500 border-emerald-200 bg-emerald-50">
                    Billed Annually (2 Months Free)
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {workspacePlans.map((plan) => (
                    <div 
                      key={plan.id}
                      onClick={() => setNewMember({...newTenant, plan: plan.id})}
                      className={cn(
                        "cursor-pointer p-4 rounded-lg border transition-all relative",
                        newTenant.plan === plan.id 
                          ? "border-primary bg-primary/5 ring-1 ring-primary" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {newTenant.plan === plan.id && (
                        <div className="absolute top-3 right-3 text-primary">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-1 pr-4">
                        <span className="font-semibold text-sm">{plan.name}</span>
                        <span className="font-bold text-sm text-primary">
                          {plan.id === "enterprise" 
                            ? "Custom" 
                            : plan.yearlyPrice === 0 
                              ? "Free" 
                              : `Rp ${(plan.yearlyPrice !== undefined ? plan.yearlyPrice : plan.priceAmount! * 10).toLocaleString('id-ID')}/yr`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{plan.desc}</p>
                      <div className="flex flex-wrap gap-1">
                        {plan.features.map((f: string) => (
                          <Badge key={f} variant="secondary" className="text-[10px] font-normal">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </div>
          
          <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between">
            <div>
              <p className="text-xs opacity-90">Total Due Today</p>
              <h3 className="text-xl font-bold">
                {calculateTotalPrice() === 0 ? "Free" : `Rp ${calculateTotalPrice().toLocaleString('id-ID')}`}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-90">Billing Cycle</p>
              <p className="text-sm font-bold uppercase">{newTenant.isAnnual ? "Annual" : "Monthly"}</p>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" form="create-workspace-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-destructive/10 border-b border-destructive/20">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center mb-3 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-destructive">Delete Workspace?</DialogTitle>
            <DialogDescription className="text-sm text-destructive/90 mt-1">
              This will permanently delete <strong>"{tenantToDelete?.name}"</strong> and all of its content schema, entries, and associated R2 media files. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Type workspace name to confirm:</Label>
              <div className="p-3 bg-muted border border-border rounded-md text-center select-none font-mono font-bold text-foreground">
                {tenantToDelete?.name}
              </div>
              <Input 
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Enter workspace name exactly"
                className="text-center font-bold"
              />
            </div>
          </div>
          
          <DialogFooter className="p-4 bg-muted/30 border-t border-border gap-2">
            <Button variant="ghost" onClick={() => setTenantToDelete(null)}>Keep Workspace</Button>
            <Button 
              variant="destructive" 
              disabled={deleteConfirm !== tenantToDelete?.name || isDeleting}
              onClick={handleDeleteTenant}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Erase Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
