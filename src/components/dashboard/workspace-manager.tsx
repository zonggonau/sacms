"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Plus, Building2, Search, Settings, 
  MoreVertical, Trash2, AlertTriangle, Clock,
  ArrowRight, Zap, CheckCircle2, ExternalLink,
  Crown
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
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { deleteTenantAction } from "@/actions/tenant"
import { useRouter } from "next/navigation"
import { WorkspaceCreationDialog } from "./workspace-creation-dialog"

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
  const [creationTemplateId, setCreationTemplateId] = useState("custom")

  // Delete State
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredTenants = initialTenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeWorkspacesCount = initialTenants.filter(t => t.status === 'active' && (t.daysRemaining === null || t.daysRemaining > 0)).length
  const suspendedCount = initialTenants.length - activeWorkspacesCount
  const expiringSoonCount = initialTenants.filter(t => t.daysRemaining !== null && t.daysRemaining <= 3 && t.daysRemaining > 0).length

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return
    setIsDeleting(true)
    try {
      const res = await deleteTenantAction(tenantToDelete.id)
      if (res.success) {
        toast({ title: "Workspace Deleted", description: "All data has been permanently removed." })
        setTenantToDelete(null)
        setDeleteConfirm("")
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Delete Failed", description: res.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Deletion failed" })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Your Workspaces</h2>
          <p className="text-sm md:text-base text-muted-foreground mt-1 font-medium">Manage and access all your projects.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {isSuperAdmin && (
            <Button variant="outline" asChild className="border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 rounded-xl font-bold text-xs h-10 px-4">
              <Link href="/admin">
                <Crown className="mr-2 h-4 w-4" />
                Super Admin
              </Link>
            </Button>
          )}
          {usage && (
            <div className="text-xs px-3 py-2 bg-card/40 backdrop-blur-md rounded-xl flex items-center gap-2 border border-white/10 shadow-sm font-semibold text-muted-foreground">
              <span>Limit:</span>
              <span className={cn("font-black text-foreground", !usage.allowed && "text-red-500")}>
                {usage.current} / {usage.max === null ? "∞" : usage.max}
              </span>
            </div>
          )}
          <Button 
            className="rounded-xl h-10 px-5 font-bold shadow-lg shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:opacity-90 transition-opacity"
            onClick={() => { 
              if (usage && !usage.allowed) {
                toast({ variant: "destructive", title: "Limit Reached", description: `You have reached the maximum workspaces for your ${usage.plan} plan.` })
                return
              }
              setCreationTemplateId("custom")
              setIsCreateOpen(true) 
            }}
          >
            <Plus className="mr-2 h-4 w-4 stroke-[3]" /> New Workspace
          </Button>
        </div>
      </div>

      {/* Glassmorphic Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Card className="bg-card/40 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="p-6 relative z-10 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Workspaces</span>
              <h3 className="text-3xl font-black text-foreground tracking-tighter">{initialTenants.length}</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="p-6 relative z-10 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Projects</span>
              <h3 className="text-3xl font-black text-foreground tracking-tighter">{activeWorkspacesCount}</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="p-6 relative z-10 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">System Alerts</span>
              <h3 className="text-3xl font-black text-foreground tracking-tighter">{expiringSoonCount + suspendedCount}</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-6">
        <div className="flex justify-end relative z-10">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search workspaces..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-11 bg-card/40 backdrop-blur-xl border-white/10 rounded-xl text-sm font-medium focus-visible:ring-primary/30"
            />
          </div>
        </div>

        {initialTenants.length === 0 ? (
          <div className="py-20 bg-card/30 backdrop-blur-md border border-white/10 border-dashed rounded-[2rem] flex flex-col items-center justify-center text-center gap-5 shadow-2xl">
            <div className="w-20 h-20 rounded-[1.5rem] bg-card flex items-center justify-center shadow-inner border border-white/5">
              <Building2 className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight">No workspaces yet</h3>
              <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto">
                Get started by creating your first workspace or choosing from our premium templates.
              </p>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="mt-4 rounded-xl font-bold h-11 px-6 shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4 stroke-[3]" /> Create Workspace
            </Button>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="py-16 text-center bg-card/30 backdrop-blur-md border border-white/10 rounded-[2rem] shadow-xl">
            <p className="text-sm font-bold text-muted-foreground">No workspaces found matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTenants.map((tenant) => (
              <Card key={tenant.id} className="group bg-card/40 backdrop-blur-xl border-white/10 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 rounded-[1.5rem] overflow-hidden flex flex-col">
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 rounded-[1rem] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-inner border border-white/5">
                      <span className="text-primary font-black text-lg">
                        {tenant.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl border-white/10 bg-card/80 backdrop-blur-2xl">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Manage</DropdownMenuLabel>
                        {['owner', 'admin'].includes(tenant.role) ? (
                          <>
                            <DropdownMenuItem asChild className="cursor-pointer text-xs font-semibold rounded-md">
                              <Link href={`/dashboard/${tenant.id}/settings`}>
                                <Settings className="mr-2 h-4 w-4" /> Settings
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="cursor-pointer text-xs font-semibold rounded-md">
                              <Link href={`/dashboard/${tenant.id}/subscriptions`}>
                                <Zap className="mr-2 h-4 w-4" /> Billing & Plans
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/5" />
                            <DropdownMenuItem 
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer text-xs font-bold rounded-md"
                              onClick={() => { setTenantToDelete(tenant); setDeleteConfirm(""); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Workspace
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem asChild className="cursor-pointer text-xs font-semibold rounded-md">
                            <Link href={`/cms/${tenant.slug}`}>
                              <ExternalLink className="mr-2 h-4 w-4" /> Content Studio
                            </Link>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="mb-6 flex-1">
                    <h3 className="text-xl font-black text-foreground tracking-tight line-clamp-1">{tenant.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono mt-1">{tenant.slug}.sacms.com</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex flex-wrap gap-2">
                      {tenant.status === 'provisioning' ? (
                        <Badge className="bg-blue-500/20 text-blue-500 border-none text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md animate-pulse">
                          <Loader2 className="h-3 w-3 animate-spin mr-1 inline" /> Setup
                        </Badge>
                      ) : tenant.status === 'failed' ? (
                        <Badge variant="destructive" className="border-none text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">
                          Failed
                        </Badge>
                      ) : (
                        <Badge 
                          className={cn(
                            "border-none text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md", 
                            tenant.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {tenant.status}
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-white/10 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-card/50 text-muted-foreground">
                        {tenant.plan}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
                <div className="p-4 bg-muted/30 border-t border-white/5 flex items-center justify-between">
                  <Badge variant="secondary" className="bg-background/50 text-[10px] font-bold text-muted-foreground capitalize rounded-md">
                    Role: {tenant.role.replace('_', ' ')}
                  </Badge>
                  <Link href={tenant.status === 'provisioning' ? '#' : `/dashboard/${tenant.id}`} onClick={(e) => tenant.status === 'provisioning' && e.preventDefault()}>
                    <Button size="sm" className="h-8 rounded-lg font-bold text-xs shadow-md shadow-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all" disabled={tenant.status === 'provisioning' || tenant.status === 'failed'}>
                      Open <ArrowRight className="ml-1.5 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Unified Creation Modal */}
      <WorkspaceCreationDialog 
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        dbTemplates={dbTemplates}
        workspacePlans={workspacePlans}
        addonPlans={addonPlans}
        initialTemplateId={creationTemplateId}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2rem] border-white/10 bg-card/80 backdrop-blur-3xl shadow-2xl">
          <DialogHeader className="p-8 pb-4 text-center">
            <div className="w-16 h-16 rounded-[1.5rem] bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-inner shadow-red-500/20">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <DialogTitle className="text-2xl font-black text-foreground tracking-tight">Delete Workspace?</DialogTitle>
            <DialogDescription className="text-sm font-medium text-muted-foreground mt-2">
              This will permanently delete <strong className="text-foreground">"{tenantToDelete?.name}"</strong> and all of its data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-8 pt-4 space-y-4">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center block">Type to confirm</Label>
              <div className="p-3 bg-muted/50 border border-white/10 rounded-xl text-center select-none font-mono font-bold text-foreground text-sm">
                {tenantToDelete?.name}
              </div>
              <Input 
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Workspace name"
                className="text-center font-bold h-11 rounded-xl bg-background/50 border-white/10 focus-visible:ring-red-500/30 focus-visible:border-red-500/50"
              />
            </div>
          </div>
          
          <DialogFooter className="p-6 bg-muted/20 border-t border-white/5 flex-col sm:flex-row gap-2">
            <Button variant="ghost" className="rounded-xl font-bold h-11 sm:flex-1" onClick={() => setTenantToDelete(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              className="rounded-xl font-bold h-11 sm:flex-1 shadow-lg shadow-red-500/20"
              disabled={deleteConfirm !== tenantToDelete?.name || isDeleting}
              onClick={handleDeleteTenant}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Erase Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

