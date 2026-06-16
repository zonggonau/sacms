"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Shield, Plus, MoreVertical, Edit, Trash2, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { saveRoleAction, deleteRoleAction, getRoleDetailsAction } from "@/actions/roles"

interface CustomRole {
  id: string
  name: string
  slug: string
  description: string | null
}

const WORKFLOW_PERMISSIONS = [
  { id: "workflow.draft_to_review", label: "Submit for Review", desc: "Allow users to move Drafts into Review." },
  { id: "workflow.review_to_approve", label: "Approve Content", desc: "Allow users to Approve content that is In Review." },
  { id: "workflow.review_to_reject", label: "Reject Content", desc: "Allow users to Reject content that is In Review." },
  { id: "workflow.approve_to_schedule", label: "Schedule Content", desc: "Allow users to Schedule approved content." },
  { id: "workflow.approve_to_publish", label: "Publish Content", desc: "Allow users to Publish approved content immediately." },
  { id: "workflow.publish_to_archive", label: "Archive Content", desc: "Allow users to Archive published content." },
  { id: "workflow.archive_to_draft", label: "Restore to Draft", desc: "Allow users to restore Archived content to Draft." },
]

export function TenantRolesClient({ 
  initialRoles, 
  tenantSlug 
}: { 
  initialRoles: CustomRole[], 
  tenantSlug: string 
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [customRoles, setCustomRoles] = useState<CustomRole[]>(initialRoles)
  const [isPending, startTransition] = useTransition()

  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  
  // Form State
  const [roleName, setRoleName] = useState("")
  const [roleSlugValue, setRoleSlugValue] = useState("")
  const [roleDesc, setRoleDesc] = useState("")
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})

  // We don't need fetchRoles anymore because server action revalidatePath will refresh the page automatically.
  // We can just rely on props updating, or manually update local state if we want optimistic UI.
  // For now, we'll let Next.js revalidatePath handle the refresh, but we keep local state in sync just in case.

  const handleOpenCreate = () => {
    setEditingRole(null)
    setRoleName("")
    setRoleSlugValue("")
    setRoleDesc("")
    setPermissions({})
    setIsOpen(true)
  }

  const handleOpenEdit = async (slug: string) => {
    try {
      const data = await getRoleDetailsAction(tenantSlug, slug)
      if (data.role) {
        setEditingRole(slug)
        setRoleName(data.role.name)
        setRoleSlugValue(data.role.slug)
        setRoleDesc(data.role.description || "")
        setPermissions(data.role.permissions || {})
        setIsOpen(true)
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to load role details." })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load role details." })
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    const slugToUse = editingRole || roleSlugValue.toLowerCase().replace(/[^a-z0-9_]/g, "_")

    startTransition(async () => {
      try {
        const result = await saveRoleAction(tenantSlug, editingRole, {
          name: roleName,
          slug: slugToUse,
          description: roleDesc,
          permissions
        })

        if (result.success) {
          toast({ title: editingRole ? "Role Updated" : "Role Created" })
          setIsOpen(false)
          // router.refresh() will be called by revalidatePath in the action implicitly if it's the current route
        } else {
          toast({ variant: "destructive", title: "Error", description: result.error })
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Error", description: "Failed to save role." })
      } finally {
        setIsSaving(false)
      }
    })
  }

  const handleDelete = async (slug: string) => {
    if (!confirm("Are you sure you want to delete this custom role? Users with this role may lose access.")) return

    startTransition(async () => {
      try {
        const result = await deleteRoleAction(tenantSlug, slug)
        if (result.success) {
          toast({ title: "Role Deleted" })
        } else {
          toast({ variant: "destructive", title: "Error", description: result.error })
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete role." })
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="p-6 lg:p-8 w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Roles & Permissions</h1>
            <p className="text-muted-foreground">Manage workspace access levels and custom roles.</p>
          </div>
          <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" /> Create Custom Role
          </Button>
        </div>

        <div className="grid gap-6">
          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <CardHeader>
              <CardTitle>Standard Roles</CardTitle>
              <CardDescription>Default roles provided by the system.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {[
                  { name: "Admin", slug: "admin", desc: "Full access to settings, members, and content." },
                  { name: "Editor", slug: "editor", desc: "Can manage and publish all content, cannot manage settings." },
                  { name: "Viewer", slug: "viewer", desc: "Read-only access to content." },
                ].map(r => (
                  <div key={r.slug} className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">{r.name}</h3>
                      <p className="text-sm text-muted-foreground">{r.desc}</p>
                    </div>
                    <Badge variant="outline" className="bg-muted text-muted-foreground">System</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <CardHeader>
              <CardTitle>Custom Roles</CardTitle>
              <CardDescription>Roles tailored for your specific workflows.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {initialRoles.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Shield className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>No custom roles created yet.</p>
                  </div>
                ) : (
                  initialRoles.map(role => (
                    <div key={role.id} className="p-4 flex items-center justify-between hover:bg-muted/30">
                      <div>
                        <h3 className="font-bold flex items-center gap-2">
                          {role.name}
                          <Badge className="bg-primary/10 text-primary text-[10px] uppercase">{role.slug}</Badge>
                        </h3>
                        {role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={(e) => {
                            e.preventDefault();
                            setTimeout(() => handleOpenEdit(role.slug), 0);
                          }}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Role
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(role.slug)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[600px] p-0">
            <div className="p-6 pb-0">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">
                  {editingRole ? "Edit Role" : "Create Custom Role"}
                </DialogTitle>
                <DialogDescription>Define permissions for this role.</DialogDescription>
              </DialogHeader>
            </div>
            
            <ScrollArea className="max-h-[70vh]">
              <form onSubmit={handleSave} className="space-y-6 px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role Name *</Label>
                  <Input 
                    required 
                    placeholder="e.g. Drafter" 
                    value={roleName} 
                    onChange={e => {
                      setRoleName(e.target.value)
                      if (!editingRole) setRoleSlugValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                    }}
                    className="bg-muted/30 border-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Slug ID</Label>
                  <Input 
                    disabled={!!editingRole} 
                    placeholder="drafter" 
                    value={roleSlugValue} 
                    onChange={e => setRoleSlugValue(e.target.value)}
                    className="bg-muted/30 border-none font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</Label>
                <Input 
                  placeholder="What can this role do?" 
                  value={roleDesc} 
                  onChange={e => setRoleDesc(e.target.value)}
                  className="bg-muted/30 border-none"
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div>
                  <h4 className="font-bold mb-1">Content Workflow</h4>
                  <p className="text-xs text-muted-foreground mb-4">Granular permissions for content publishing state machine.</p>
                  <div className="space-y-3">
                    {WORKFLOW_PERMISSIONS.map(perm => (
                      <div key={perm.id} className="flex items-start space-x-3">
                        <Checkbox 
                          id={perm.id} 
                          checked={permissions[perm.id] || false}
                          onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, [perm.id]: !!checked }))}
                        />
                        <div className="leading-none space-y-1">
                          <label htmlFor={perm.id} className="text-sm font-medium leading-none cursor-pointer">{perm.label}</label>
                          <p className="text-xs text-muted-foreground">{perm.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

                <DialogFooter className="pt-4 border-t pb-2">
                  <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-primary font-bold rounded-xl" disabled={isSaving || !roleName || (!editingRole && !roleSlugValue)}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    {editingRole ? "Save Changes" : "Create Role"}
                  </Button>
                </DialogFooter>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
