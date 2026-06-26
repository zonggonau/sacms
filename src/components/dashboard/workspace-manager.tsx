"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"
import { deleteTenantAction } from "@/actions/tenant"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { WorkspaceCreationDialog } from "./workspace-creation-dialog"
import { EnterpriseLicenseBanner } from "./enterprise-license-banner"

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
    <div className="space-y-6 max-w-6xl mx-auto">
      <EnterpriseLicenseBanner hideActivation={true} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Your Workspaces</h2>
          <p className="text-muted-foreground mt-1">Manage and access all your projects.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {isSuperAdmin && (
            <Button variant="outline" asChild className="text-orange-600 border-orange-200 hover:bg-orange-100 dark:border-orange-900 dark:hover:bg-orange-900/50">
              <Link href="/admin">
                <Crown className="mr-2 h-4 w-4" />
                Super Admin
              </Link>
            </Button>
          )}
          {usage && (
            <div className="text-sm px-3 py-2 bg-secondary rounded-md flex items-center gap-2 border font-medium text-muted-foreground">
              <span>Limit:</span>
              <span className={cn("font-bold text-foreground", !usage.allowed && "text-destructive")}>
                {usage.current} / {usage.max === null || usage.max > 9000 ? "Unlimited" : usage.max}
              </span>
            </div>
          )}
          <Button 
            onClick={() => { 
              if (usage && !usage.allowed) {
                toast({ variant: "destructive", title: "Limit Reached", description: `You have reached the maximum workspaces for your ${usage.plan} plan.` })
                return
              }
              setCreationTemplateId("custom")
              setIsCreateOpen(true) 
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> New Workspace
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Workspaces</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{initialTenants.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeWorkspacesCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">System Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringSoonCount + suspendedCount}</div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-6">
        <div className="flex justify-end">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search workspaces..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {initialTenants.length === 0 ? (
          <Card className="py-20 text-center border-dashed">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 rounded-full bg-secondary">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">No workspaces yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Get started by creating your first workspace or choosing from our premium templates.
                </p>
              </div>
              <Button onClick={() => setIsCreateOpen(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" /> Create Workspace
              </Button>
            </CardContent>
          </Card>
        ) : filteredTenants.length === 0 ? (
          <Card className="py-16 text-center">
            <CardContent>
              <p className="text-muted-foreground">No workspaces found matching "{searchQuery}"</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                          <span className="text-primary font-bold text-xs">
                            {tenant.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium line-clamp-1">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{tenant.slug}.sacms.com</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tenant.status === 'provisioning' ? (
                        <Badge variant="outline" className="text-blue-500 border-blue-200 bg-blue-50">
                          <Loader2 className="h-3 w-3 animate-spin mr-1" /> Setup
                        </Badge>
                      ) : tenant.status === 'failed' ? (
                        <Badge variant="destructive">Failed</Badge>
                      ) : (
                        <Badge variant={tenant.status === 'active' ? "default" : "secondary"}>
                          {tenant.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tenant.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {tenant.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={tenant.status === 'provisioning' ? '#' : `/dashboard/${tenant.id}`} onClick={(e) => tenant.status === 'provisioning' && e.preventDefault()}>
                          <Button size="sm" variant="secondary" className="font-medium" disabled={tenant.status === 'provisioning' || tenant.status === 'failed'}>
                            Open <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Manage</DropdownMenuLabel>
                            {['owner', 'admin'].includes(tenant.role) ? (
                              <>
                                <DropdownMenuItem asChild className="cursor-pointer">
                                  <Link href={`/dashboard/${tenant.id}/settings`}>
                                    <Settings className="mr-2 h-4 w-4" /> Settings
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer">
                                  <Link href={`/dashboard/${tenant.id}/subscriptions`}>
                                    <Zap className="mr-2 h-4 w-4" /> Billing & Plans
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive focus:bg-destructive focus:text-destructive-foreground cursor-pointer"
                                  onClick={() => { setTenantToDelete(tenant); setDeleteConfirm(""); }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Workspace
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/dashboard/${tenant.id}/cms`}>
                                  <ExternalLink className="mr-2 h-4 w-4" /> Content Studio
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workspace?</DialogTitle>
            <DialogDescription>
              This will permanently delete "{tenantToDelete?.name}" and all of its data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type <span className="font-bold">{tenantToDelete?.name}</span> to confirm</Label>
              <Input 
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Workspace name"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTenantToDelete(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
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
