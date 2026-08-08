"use client"

import { useState, useTransition } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Loader2,
  Users,
  UserPlus,
  Shield,
  MoreVertical,
  Trash2,
  Search,
  Check,
  Key,
  Lock,
  AlertCircle
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { createMemberAction, updateMemberAction, deleteMemberAction } from "@/actions/users"
import { Checkbox } from "@/components/ui/checkbox"
import Image from "next/image"
import Link from "next/link"

export const WORKFLOW_PERMISSION_OPTIONS = [
  { key: "workflow.draft_to_review", label: "Submit for Review (DRAFT → IN_REVIEW)", desc: "Allows sending drafts for editorial review" },
  { key: "workflow.draft_to_publish", label: "Direct Publish (DRAFT → PUBLISHED)", desc: "Allows publishing drafts immediately" },
  { key: "workflow.draft_to_schedule", label: "Direct Schedule (DRAFT → SCHEDULED)", desc: "Allows scheduling drafts for publication" },
  { key: "workflow.review_to_approve", label: "Approve Content (IN_REVIEW → APPROVED)", desc: "Allows approving submitted drafts" },
  { key: "workflow.review_to_reject", label: "Reject Content (IN_REVIEW → REJECTED)", desc: "Allows requesting revisions on submitted drafts" },
  { key: "workflow.approve_to_publish", label: "Publish Approved (APPROVED → PUBLISHED)", desc: "Allows publishing approved content" },
  { key: "workflow.approve_to_schedule", label: "Schedule Approved (APPROVED → SCHEDULED)", desc: "Allows scheduling approved content" },
  { key: "workflow.scheduled_to_draft", label: "Cancel Schedule (SCHEDULED → DRAFT)", desc: "Allows canceling scheduled publications" },
  { key: "workflow.published_to_archived", label: "Archive Content (PUBLISHED → ARCHIVED)", desc: "Allows archiving published content" },
  { key: "workflow.published_to_draft", label: "Unpublish Content (PUBLISHED → DRAFT)", desc: "Allows reverting published content to draft" },
  { key: "workflow.archived_to_draft", label: "Restore Content (ARCHIVED → DRAFT)", desc: "Allows restoring archived content" },
  { key: "workflow.rejected_to_draft", label: "Revise Content (REJECTED → DRAFT)", desc: "Allows editing rejected content back to draft" },
]

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: WORKFLOW_PERMISSION_OPTIONS.map(o => o.key),
  owner: WORKFLOW_PERMISSION_OPTIONS.map(o => o.key),
  editor: [
    "workflow.draft_to_review",
    "workflow.draft_to_publish",
    "workflow.draft_to_schedule",
    "workflow.review_to_approve",
    "workflow.review_to_reject",
    "workflow.approve_to_publish",
    "workflow.approve_to_schedule",
    "workflow.scheduled_to_draft",
    "workflow.published_to_archived",
    "workflow.published_to_draft",
    "workflow.archived_to_draft",
    "workflow.rejected_to_draft"
  ],
  author: [
    "workflow.draft_to_review",
    "workflow.draft_to_publish",
    "workflow.draft_to_schedule",
    "workflow.rejected_to_draft"
  ],
  contributor: [
    "workflow.draft_to_review",
    "workflow.rejected_to_draft"
  ],
  subscriber: []
}

interface Member {
  id: string
  role: string
  customPermissions?: string[] | null
  joinedAt: Date | string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface UsersClientProps {
  initialMembers: Member[]
  tenantSlug: string

  limit: number
  current: number
}

export function UsersClient({ initialMembers, tenantSlug, limit, current }: UsersClientProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const isLimitReached = current >= limit

  const [searchQuery, setSearchQuery] = useState("")
  
  // Create Member State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createPermissions, setCreatePermissions] = useState<string[]>(ROLE_DEFAULT_PERMISSIONS["subscriber"] || [])
  const [newMember, setNewMember] = useState({
    email: "",
    role: "subscriber",
    name: "",
    password: "",
  })

  // Edit Role State
  const [isRoleOpen, setIsRoleOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [newRole, setNewRole] = useState<string>("")
  const [editPermissions, setEditPermissions] = useState<string[]>([])

  // Password Management State
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")

  const handleCreateRoleChange = (role: string) => {
    setNewMember(prev => ({ ...prev, role }))
    setCreatePermissions(ROLE_DEFAULT_PERMISSIONS[role] || [])
  }

  const handleEditRoleChange = (role: string) => {
    setNewRole(role)
    setEditPermissions(ROLE_DEFAULT_PERMISSIONS[role] || [])
  }

  const openEditRoleModal = (member: Member) => {
    setSelectedMember(member)
    setNewRole(member.role)
    setEditPermissions(member.customPermissions || ROLE_DEFAULT_PERMISSIONS[member.role] || [])
    setIsRoleOpen(true)
  }

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createMemberAction(tenantSlug, {
        ...newMember,
        customPermissions: createPermissions
      })
      if (res.error) {
        toast({ variant: "destructive", title: "Error", description: res.error })
      } else {
        toast({ title: "Member Added", description: "Successfully added new team member." })
        setIsCreateOpen(false)
        setNewMember({ email: "", role: "subscriber", name: "", password: "" })
        setCreatePermissions(ROLE_DEFAULT_PERMISSIONS["subscriber"] || [])
      }
    })
  }

  const handleUpdateMemberRole = () => {
    if (!selectedMember) return
    startTransition(async () => {
      const res = await updateMemberAction(tenantSlug, selectedMember.id, { 
        role: newRole,
        customPermissions: editPermissions
      })
      if (res.error) {
        toast({ variant: "destructive", title: "Error", description: res.error })
      } else {
        toast({ title: "Member Updated" })
        setIsRoleOpen(false)
      }
    })
  }

  const renderPermissionsMatrix = (
    permissions: string[],
    setPermissions: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const togglePermission = (key: string) => {
      setPermissions(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      )
    }

    const toggleAll = () => {
      if (permissions.length === WORKFLOW_PERMISSION_OPTIONS.length) {
        setPermissions([])
      } else {
        setPermissions(WORKFLOW_PERMISSION_OPTIONS.map(o => o.key))
      }
    }

    return (
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Workflow Transition Permissions ({permissions.length}/{WORKFLOW_PERMISSION_OPTIONS.length})
          </Label>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-primary font-bold hover:underline"
          >
            {permissions.length === WORKFLOW_PERMISSION_OPTIONS.length ? "Clear All" : "Select All"}
          </button>
        </div>

        <div className="border border-border rounded-xl p-3 max-h-56 overflow-y-auto space-y-2.5 bg-muted/20">
          {WORKFLOW_PERMISSION_OPTIONS.map((opt) => {
            const checked = permissions.includes(opt.key)
            return (
              <div 
                key={opt.key} 
                className="flex items-start space-x-3 hover:bg-muted/40 p-1.5 rounded-lg transition-colors cursor-pointer" 
                onClick={() => togglePermission(opt.key)}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => togglePermission(opt.key)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground leading-none">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const handleUpdateMemberPassword = () => {
    if (!selectedMember) return
    startTransition(async () => {
      const res = await updateMemberAction(tenantSlug, selectedMember.id, { password: newPassword })
      if (res.error) {
        toast({ variant: "destructive", title: "Error", description: res.error })
      } else {
        toast({ title: "Password Updated" })
        setIsPasswordOpen(false)
        setNewPassword("")
      }
    })
  }

  const handleRemoveMember = (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member from the workspace?")) return
    startTransition(async () => {
      const res = await deleteMemberAction(tenantSlug, memberId)
      if (res.error) {
        toast({ variant: "destructive", title: "Error", description: res.error })
      } else {
        toast({ title: "Member Removed" })
      }
    })
  }

  const filteredMembers = initialMembers.filter(
    (m) =>
      m.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.user.name && m.user.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Team Members</h1>
              <p className="text-muted-foreground">
                Manage who has access to this workspace and their permissions ({current} of {limit} members used).
              </p>
            </div>
            
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
              if (open && isLimitReached) {
                toast({ variant: "destructive", title: "Limit Reached", description: "You have reached the maximum number of team members allowed by your plan." })
                return
              }
              setIsCreateOpen(open)
            }}>
              <DialogTrigger asChild>
                <Button 
                  disabled={isLimitReached}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="mr-2 h-4 w-4" /> Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[450px] rounded-2xl border-none shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black uppercase tracking-tight">Add Team Member</DialogTitle>
                  <DialogDescription>
                    Provide credentials to create a new user or invite an existing one.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateMember} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name (optional)</Label>
                    <Input 
                      placeholder="Jane Doe" 
                      value={newMember.name} 
                      onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                      className="bg-muted/30 border-none h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address *</Label>
                    <Input 
                      type="email" 
                      placeholder="jane@company.com" 
                      value={newMember.email} 
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                      required
                      className="bg-muted/30 border-none h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Access Password *</Label>
                    <Input 
                      type="password" 
                      placeholder="Min. 8 characters" 
                      value={newMember.password} 
                      onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                      required
                      className="bg-muted/30 border-none h-10"
                    />
                    <p className="text-[9px] text-muted-foreground italic">Required for creating new accounts.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Workspace Role</Label>
                    <Select value={newMember.role} onValueChange={handleCreateRoleChange}>
                      <SelectTrigger className="bg-muted/30 border-none h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="author">Author</SelectItem>
                        <SelectItem value="contributor">Contributor</SelectItem>
                        <SelectItem value="subscriber">Subscriber</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {renderPermissionsMatrix(createPermissions, setCreatePermissions)}
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={isPending}>Cancel</Button>
                    <Button type="submit" className="bg-primary font-bold rounded-xl" disabled={isPending}>
                      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Create & Add Member
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-none shadow-sm h-11"
            />
          </div>

          {/* Limit Warning Banner */}
          {isLimitReached && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-2 bg-destructive/25 text-destructive rounded-xl shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-destructive">Team Member Limit Reached</h4>
                  <p className="text-xs text-muted-foreground">
                    You have used <span className="font-semibold text-foreground">{current}</span> of your {" "}
                    <span className="font-semibold text-foreground">{limit}</span> team member limit.
                    Please upgrade your plan to invite more team members.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="border-destructive/30 hover:bg-destructive/5 text-destructive text-xs h-8 shrink-0" asChild>
                <Link href={`/dashboard/${tenantSlug}/subscriptions`}>Upgrade Plan</Link>
              </Button>
            </div>
          )}

          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredMembers.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-10" />
                    <p>No team members found.</p>
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <div key={member.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary font-bold overflow-hidden relative">
                          {member.user.image ? (
                            <Image src={member.user.image} alt="" fill className="object-cover" />
                          ) : (
                            (member.user.name || member.user.email)[0].toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground leading-none mb-1">
                            {member.user.name || "Unnamed User"}
                            {member.user.id === session?.user?.id && <span className="ml-2 text-[10px] text-primary">(You)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <Badge className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-2 py-0.5",
                          member.role === 'owner' ? 'bg-indigo-100 text-indigo-700' :
                          member.role === 'admin' ? 'bg-emerald-100 text-emerald-700' :
                          member.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                          member.role === 'author' ? 'bg-purple-100 text-purple-700' :
                          member.role === 'contributor' ? 'bg-orange-100 text-orange-700' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {member.role}
                        </Badge>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Member Access</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEditRoleModal(member)}>
                              <Shield className="mr-2 h-4 w-4" /> Change Role & Permissions
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedMember(member); setIsPasswordOpen(true); }}>
                              <Lock className="mr-2 h-4 w-4" /> Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              disabled={member.role === "owner" || member.user.id === session?.user?.id || isPending}
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Remove from Team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Change Role Dialog */}
        <Dialog open={isRoleOpen} onOpenChange={setIsRoleOpen}>
          <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Modify Permissions</DialogTitle>
              <DialogDescription>Update role and transition permissions for {selectedMember?.user.email}</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Selected Role Preset</Label>
                <Select value={newRole} onValueChange={handleEditRoleChange}>
                  <SelectTrigger className="h-11 bg-muted/30 border-none rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                    <SelectItem value="editor">Editor (Review, Approve & Publish)</SelectItem>
                    <SelectItem value="author">Author (Publish Own)</SelectItem>
                    <SelectItem value="contributor">Contributor (Submit Review Only)</SelectItem>
                    <SelectItem value="subscriber">Subscriber (Read Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {renderPermissionsMatrix(editPermissions, setEditPermissions)}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsRoleOpen(false)} disabled={isPending}>Cancel</Button>
              <Button 
                className="bg-primary font-bold rounded-xl"
                disabled={isPending}
                onClick={handleUpdateMemberRole}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Role & Permissions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
          <DialogContent className="rounded-2xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Security Reset
              </DialogTitle>
              <DialogDescription>Set a new password for {selectedMember?.user.name || selectedMember?.user.email}</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">New Password</Label>
                <Input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="h-11 bg-muted/30 border-none rounded-xl"
                />
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 text-amber-800">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-[11px] leading-relaxed">
                  Changing a password will not log the user out of their current session, but will be required for their next sign-in.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsPasswordOpen(false)} disabled={isPending}>Cancel</Button>
              <Button 
                className="bg-primary font-bold rounded-xl"
                disabled={isPending || newPassword.length < 8}
                onClick={handleUpdateMemberPassword}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm New Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
