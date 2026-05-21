"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
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
  Mail,
  Shield,
  MoreVertical,
  Edit,
  Trash2,
  Search,
  Check,
  X,
  Key,
  Lock,
  RefreshCw,
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

interface Member {
  id: string
  role: string
  joinedAt: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

export default function TenantUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const { toast } = useToast()

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Create Member State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newMember, setNewMember] = useState({
    email: "",
    role: "viewer",
    name: "",
    password: "",
  })

  // Edit Role State
  const [isRoleOpen, setIsRoleOpen] = useState(false)
  const [selectedMember, setSelectedLog] = useState<Member | null>(null)
  const [updating, setUpdating] = useState(false)
  const [newRole, setNewRole] = useState<string>("")

  // Password Management State
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")

  const tenants = useMemo(() => session?.user?.tenants || [], [session])
  const currentTenant = useMemo(() => tenants.find(t => t.slug === tenantSlug), [tenants, tenantSlug])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchMembers = async () => {
    if (!tenantSlug) return
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/members`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error("Failed to fetch members:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchMembers()
  }, [tenantSlug, session])

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      })

      if (res.ok) {
        toast({ title: "Member Added", description: "Successfully added new team member." })
        setIsCreateOpen(false)
        setNewMember({ email: "", role: "viewer", name: "", password: "" })
        fetchMembers()
      } else {
        const data = await res.json()
        toast({ variant: "destructive", title: "Error", description: data.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Operation failed" })
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateMember = async (memberId: string, data: any) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        toast({ title: "Member Updated" })
        setIsRoleOpen(false)
        setIsPasswordOpen(false)
        setNewPassword("")
        fetchMembers()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Update failed" })
    } finally {
      setUpdating(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member from the workspace?")) return

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/members/${memberId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast({ title: "Member Removed" })
        fetchMembers()
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Removal failed" })
    }
  }

  const filteredMembers = members.filter(
    (m) =>
      m.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.user.name && m.user.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (status === "loading" || loading) {
    return (
      <div className="flex">
<div className="flex-1 min-h-screen flex items-center justify-center flex-col w-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Team Members</h1>
              <p className="text-muted-foreground">Manage who has access to this workspace and their permissions.</p>
            </div>
            
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
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
                    <Select value={newMember.role} onValueChange={(v) => setNewMember({ ...newMember, role: v })}>
                      <SelectTrigger className="bg-muted/30 border-none h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin (Full Access)</SelectItem>
                        <SelectItem value="editor">Editor (Can edit content)</SelectItem>
                        <SelectItem value="viewer">Viewer (Read-only)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" className="bg-primary font-bold rounded-xl" disabled={creating}>
                      {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
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
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary font-bold">
                          {member.user.image ? (
                            <img src={member.user.image} alt="" className="w-full h-full rounded-full object-cover" />
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
                            <DropdownMenuItem onClick={() => { setSelectedLog(member); setNewRole(member.role); setIsRoleOpen(true); }}>
                              <Shield className="mr-2 h-4 w-4" /> Change Role
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedLog(member); setIsPasswordOpen(true); }}>
                              <Lock className="mr-2 h-4 w-4" /> Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              disabled={member.role === "owner" || member.user.id === session?.user?.id}
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
          <DialogContent className="rounded-2xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Modify Permissions</DialogTitle>
              <DialogDescription>Update role for {selectedMember?.user.email}</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Selected Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="h-11 bg-muted/30 border-none rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Full Control)</SelectItem>
                  <SelectItem value="editor">Editor (Content only)</SelectItem>
                  <SelectItem value="viewer">Viewer (Read-only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsRoleOpen(false)}>Cancel</Button>
              <Button 
                className="bg-primary font-bold rounded-xl"
                disabled={updating || newRole === selectedMember?.role}
                onClick={() => selectedMember && handleUpdateMember(selectedMember.id, { role: newRole })}
              >
                {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Role
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
              <Button variant="ghost" onClick={() => setIsPasswordOpen(false)}>Cancel</Button>
              <Button 
                className="bg-primary font-bold rounded-xl"
                disabled={updating || newPassword.length < 8}
                onClick={() => selectedMember && handleUpdateMember(selectedMember.id, { password: newPassword })}
              >
                {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm New Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

import { AlertCircle as AlertIcon } from "lucide-react"
