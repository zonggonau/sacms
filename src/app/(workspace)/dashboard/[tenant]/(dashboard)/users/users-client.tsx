"use client"

import React, { useState, useTransition, useCallback } from "react"
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
  AlertCircle,
  Crown,
  Edit3,
  PenTool,
  FileText,
  Eye,
  BookOpen,
  Info
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
import Link from "next/link"

export const WORKFLOW_PERMISSION_OPTIONS = [
  { key: "workflow.draft_to_review", label: "Kirim untuk Review (DRAFT → IN_REVIEW)", desc: "Mengizinkan pengiriman draf untuk ditinjau redaksi" },
  { key: "workflow.draft_to_publish", label: "Terbitkan Langsung (DRAFT → PUBLISHED)", desc: "Mengizinkan publikasi draf langsung ke publik" },
  { key: "workflow.draft_to_schedule", label: "Jadwalkan Langsung (DRAFT → SCHEDULED)", desc: "Mengizinkan penjadwalan draf untuk publikasi otomatis" },
  { key: "workflow.review_to_approve", label: "Setujui Konten (IN_REVIEW → APPROVED)", desc: "Mengizinkan persetujuan draf yang telah ditinjau" },
  { key: "workflow.review_to_reject", label: "Tolak / Minta Revisi (IN_REVIEW → REJECTED)", desc: "Mengizinkan permintaan revisi atas draf yang ditinjau" },
  { key: "workflow.approve_to_publish", label: "Terbitkan Konten Disetujui (APPROVED → PUBLISHED)", desc: "Mengizinkan penerbitan konten yang telah disetujui" },
  { key: "workflow.approve_to_schedule", label: "Jadwalkan Konten Disetujui (APPROVED → SCHEDULED)", desc: "Mengizinkan penjadwalan konten yang disetujui" },
  { key: "workflow.scheduled_to_draft", label: "Batalkan Jadwal (SCHEDULED → DRAFT)", desc: "Mengizinkan pembatalan publikasi terjadwal kembali ke draf" },
  { key: "workflow.published_to_archived", label: "Arsipkan Konten (PUBLISHED → ARCHIVED)", desc: "Mengizinkan pengarsipan konten yang sedang terbit" },
  { key: "workflow.published_to_draft", label: "Tarik Kembali Publikasi (PUBLISHED → DRAFT)", desc: "Mengizinkan penarikan konten terbit kembali menjadi draf" },
  { key: "workflow.archived_to_draft", label: "Pulihkan Arsip (ARCHIVED → DRAFT)", desc: "Mengizinkan pemulihan konten arsip kembali ke draf" },
  { key: "workflow.rejected_to_draft", label: "Revisi Draf Ditolak (REJECTED → DRAFT)", desc: "Mengizinkan pengeditan konten yang ditolak kembali ke draf" },
]

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator (Kontrol Penuh Workspace)",
  editor: "Editor (Review, Setujui & Terbitkan)",
  author: "Author (Terbitkan Konten Sendiri)",
  contributor: "Contributor (Kirim Draf untuk Review)",
  viewer: "Viewer (Hanya Baca Konten)",
  subscriber: "Subscriber (Baca Publik)",
}

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
    "workflow.published_to_draft",
    "workflow.rejected_to_draft"
  ],
  contributor: [
    "workflow.draft_to_review",
    "workflow.rejected_to_draft"
  ],
  viewer: [],
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

const PermissionsMatrix = React.memo(function PermissionsMatrix({
  permissions,
  onTogglePermission,
  onToggleAll,
}: {
  permissions: string[]
  onTogglePermission: (key: string) => void
  onToggleAll: () => void
}) {
  const isAllSelected = permissions.length === WORKFLOW_PERMISSION_OPTIONS.length
  return (
    <div className="space-y-2.5 pt-1">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Izin Transisi Workflow ({permissions.length}/{WORKFLOW_PERMISSION_OPTIONS.length})
        </Label>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-xs text-primary font-bold hover:underline cursor-pointer"
        >
          {isAllSelected ? "Batal Semua" : "Pilih Semua"}
        </button>
      </div>

      <div className="border border-border/80 rounded-xl p-3 max-h-52 overflow-y-auto space-y-2 bg-muted/20">
        {WORKFLOW_PERMISSION_OPTIONS.map((opt) => {
          const checked = permissions.includes(opt.key)
          return (
            <div 
              key={opt.key} 
              className="flex items-start space-x-3 hover:bg-muted/40 p-1.5 rounded-lg transition-colors cursor-pointer select-none" 
              onClick={(e) => {
                e.preventDefault()
                onTogglePermission(opt.key)
              }}
            >
              <Checkbox
                checked={checked}
                className="mt-0.5 pointer-events-none"
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
})

export function UsersClient({ initialMembers, tenantSlug, limit, current }: UsersClientProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isRoleOpen, setIsRoleOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
  
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const [newRole, setNewRole] = useState("")
  const [newPassword, setNewPassword] = useState("")

  const [newMember, setNewMember] = useState({
    email: "",
    role: "viewer",
    name: "",
    password: ""
  })
  
  const [createPermissions, setCreatePermissions] = useState<string[]>(
    ROLE_DEFAULT_PERMISSIONS["viewer"] || []
  )
  const [editPermissions, setEditPermissions] = useState<string[]>([])

  const tenantMembership = session?.user?.tenants?.find((t) => t.slug === tenantSlug || t.id === tenantSlug)
  const effectiveRole = session?.user?.role === "super_admin" ? "owner" : (tenantMembership?.role || "viewer")
  const isOwnerOrAdmin = effectiveRole === "owner" || effectiveRole === "admin"
  const isLimitReached = current >= limit

  const handleCreateRoleChange = useCallback((role: string) => {
    setNewMember(prev => ({ ...prev, role }))
    setCreatePermissions(ROLE_DEFAULT_PERMISSIONS[role] || [])
  }, [])

  const handleToggleCreatePermission = useCallback((key: string) => {
    setCreatePermissions(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }, [])

  const handleToggleAllCreatePermissions = useCallback(() => {
    setCreatePermissions(prev => 
      prev.length === WORKFLOW_PERMISSION_OPTIONS.length 
        ? [] 
        : WORKFLOW_PERMISSION_OPTIONS.map(o => o.key)
    )
  }, [])

  const handleEditRoleChange = useCallback((role: string) => {
    setNewRole(role)
    setEditPermissions(ROLE_DEFAULT_PERMISSIONS[role] || [])
  }, [])

  const handleToggleEditPermission = useCallback((key: string) => {
    setEditPermissions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }, [])

  const handleToggleAllEditPermissions = useCallback(() => {
    setEditPermissions(prev =>
      prev.length === WORKFLOW_PERMISSION_OPTIONS.length
        ? []
        : WORKFLOW_PERMISSION_OPTIONS.map(o => o.key)
    )
  }, [])

  const openEditRoleModal = (member: Member) => {
    setSelectedMember(member)
    const roleVal = member.role || "viewer"
    setNewRole(roleVal)
    setEditPermissions(member.customPermissions || ROLE_DEFAULT_PERMISSIONS[roleVal] || [])
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
        toast({ variant: "destructive", title: "Gagal Menambahkan", description: res.error })
      } else {
        toast({ title: "Anggota Ditambahkan", description: "Berhasil mengundang anggota tim baru." })
        setIsCreateOpen(false)
        setNewMember({ email: "", role: "viewer", name: "", password: "" })
        setCreatePermissions(ROLE_DEFAULT_PERMISSIONS["viewer"] || [])
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
        toast({ variant: "destructive", title: "Gagal Menyimpan", description: res.error })
      } else {
        toast({ title: "Peran Diperbarui", description: "Peran dan izin anggota berhasil disimpan." })
        setIsRoleOpen(false)
      }
    })
  }

  const handleUpdateMemberPassword = () => {
    if (!selectedMember) return
    startTransition(async () => {
      const res = await updateMemberAction(tenantSlug, selectedMember.id, { password: newPassword })
      if (res.error) {
        toast({ variant: "destructive", title: "Gagal Mengubah Sandi", description: res.error })
      } else {
        toast({ title: "Sandi Diperbarui", description: "Kata sandi akses anggota berhasil diubah." })
        setIsPasswordOpen(false)
        setNewPassword("")
      }
    })
  }

  const confirmDeleteMember = () => {
    if (!memberToDelete) return
    startTransition(async () => {
      const res = await deleteMemberAction(tenantSlug, memberToDelete.id)
      if (res.error) {
        toast({ variant: "destructive", title: "Gagal Menghapus", description: res.error })
      } else {
        toast({ title: "Anggota Dihapus", description: "Pengguna telah dikeluarkan dari workspace ini." })
        setIsDeleteOpen(false)
        setMemberToDelete(null)
      }
    })
  }

  const filteredMembers = initialMembers.filter(
    (m) =>
      m.role !== "owner" &&
      (m.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.user.name && m.user.name.toLowerCase().includes(searchQuery.toLowerCase())))
  )

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return { label: "OWNER", class: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200", icon: Crown }
      case "admin":
        return { label: "ADMINISTRATOR", class: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200", icon: Shield }
      case "editor":
        return { label: "EDITOR", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200", icon: Edit3 }
      case "author":
        return { label: "AUTHOR", class: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border-teal-200", icon: PenTool }
      case "contributor":
        return { label: "CONTRIBUTOR", class: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200", icon: FileText }
      case "viewer":
        return { label: "VIEWER", class: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200", icon: Eye }
      default:
        return { label: "SUBSCRIBER", class: "bg-muted text-muted-foreground border-border", icon: BookOpen }
    }
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Anggota Tim Workspace</h1>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 rounded-full">
                Dikelola oleh Owner
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kelola akses tim dan izin transisi alur kerja ({current} dari {limit} kuota anggota digunakan).
            </p>
          </div>
          
          {isOwnerOrAdmin && (
            <Button 
              type="button"
              onClick={() => {
                if (isLimitReached) {
                  setIsLimitModalOpen(true)
                } else {
                  setIsCreateOpen(true)
                }
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs cursor-pointer"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Tambah Anggota
            </Button>
          )}
        </div>

        {/* Informative Workspace Role Guidance */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30 border border-border/80 text-xs text-foreground shadow-xs">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-foreground">Hierarki Peran di Workspace:</p>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              Seluruh peran di dalam workspace ini dikelola secara mandiri oleh <strong>Owner Workspace</strong>. 
              Anggota yang ditambahkan hanya memiliki akses pada ruang kerja ini dan terisolasi dari akses tingkat platform Super Admin.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Cari anggota tim berdasarkan nama atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border/80 rounded-xl h-9 text-xs"
          />
        </div>

        {/* Limit Warning Banner */}
        {isLimitReached && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 bg-destructive/20 text-destructive rounded-xl shrink-0">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs text-destructive">Batas Maksimal Anggota Tercapai</h4>
                <p className="text-[11px] text-muted-foreground">
                  Anda telah menggunakan <span className="font-bold text-foreground">{current}</span> dari batas {" "}
                  <span className="font-bold text-foreground">{limit}</span> anggota tim. Tingkatkan paket Anda untuk mengundang lebih banyak anggota.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="border-destructive/30 hover:bg-destructive/10 text-destructive text-xs h-8 shrink-0 rounded-xl font-bold" asChild>
              <Link href={`/dashboard/${tenantSlug}/subscriptions`}>Upgrade Paket</Link>
            </Button>
          </div>
        )}

        {/* Members List */}
        <Card className="border border-border/80 shadow-xs overflow-hidden bg-card rounded-2xl">
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {filteredMembers.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-xs font-bold text-foreground">Tidak ada anggota tim ditemukan</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Klik tombol Tambah Anggota untuk mengundang rekan tim baru.</p>
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const roleBadge = getRoleBadge(member.role)
                  const RoleIcon = roleBadge.icon
                  const isOwner = member.role === "owner"

                  return (
                    <div key={member.id} className="p-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/20 transition-colors gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary font-bold overflow-hidden shrink-0">
                          {member.user.image ? (
                            <img src={member.user.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-black">
                              {(member.user.name || member.user.email)[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-foreground truncate">
                              {member.user.name || "Pengguna Tanpa Nama"}
                            </p>
                            {member.user.id === session?.user?.id && (
                              <Badge variant="outline" className="text-[9px] font-bold bg-primary/10 text-primary border-primary/20 rounded-full px-2 py-0">
                                Anda
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">{member.user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <Badge className={cn(
                          "text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border shadow-none flex items-center gap-1",
                          roleBadge.class
                        )}>
                          <RoleIcon className="w-3 h-3" />
                          {roleBadge.label}
                        </Badge>
                        
                        {isOwnerOrAdmin && (
                          isOwner ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled
                              className="h-8 w-8 rounded-xl opacity-30 cursor-not-allowed text-muted-foreground"
                              title="Owner tidak dapat diubah atau dihapus"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-muted">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 rounded-xl border-border bg-card">
                                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground">Kelola Akses</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openEditRoleModal(member)} className="cursor-pointer text-xs rounded-lg">
                                  <Shield className="mr-2 h-3.5 w-3.5 text-primary" /> Ubah Peran & Izin
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedMember(member); setIsPasswordOpen(true); }} className="cursor-pointer text-xs rounded-lg">
                                  <Lock className="mr-2 h-3.5 w-3.5 text-primary" /> Atur Ulang Sandi
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive cursor-pointer text-xs rounded-lg"
                                  disabled={member.user.id === session?.user?.id || isPending}
                                  onClick={() => {
                                    setMemberToDelete(member)
                                    setIsDeleteOpen(true)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus dari Tim
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Change Role Dialog */}
      <Dialog open={isRoleOpen} onOpenChange={setIsRoleOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl border-border/80 shadow-xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Ubah Peran & Perizinan</DialogTitle>
            <DialogDescription className="text-xs">Sesuaikan peran dan hak transisi workflow untuk {selectedMember?.user.email}</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preset Peran Workspace</Label>
              <Select value={newRole || "viewer"} onValueChange={handleEditRoleChange}>
                <SelectTrigger className="h-9 bg-muted/20 border-border/80 rounded-xl text-xs">
                  <SelectValue>{ROLE_LABELS[newRole || "viewer"]}</SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  <SelectItem value="admin" className="text-xs rounded-lg">Administrator (Kontrol Penuh Workspace)</SelectItem>
                  <SelectItem value="editor" className="text-xs rounded-lg">Editor (Review, Setujui & Terbitkan)</SelectItem>
                  <SelectItem value="author" className="text-xs rounded-lg">Author (Terbitkan Konten Sendiri)</SelectItem>
                  <SelectItem value="contributor" className="text-xs rounded-lg">Contributor (Kirim Draf untuk Review)</SelectItem>
                  <SelectItem value="viewer" className="text-xs rounded-lg">Viewer (Hanya Baca Konten)</SelectItem>
                  <SelectItem value="subscriber" className="text-xs rounded-lg">Subscriber (Baca Publik)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <PermissionsMatrix
              permissions={editPermissions}
              onTogglePermission={handleToggleEditPermission}
              onToggleAll={handleToggleAllEditPermissions}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setIsRoleOpen(false)} disabled={isPending} className="rounded-xl text-xs font-bold h-9">Batal</Button>
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs"
              disabled={isPending}
              onClick={handleUpdateMemberRole}
            >
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Simpan Peran & Izin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent className="rounded-2xl border-border/80 shadow-xl bg-card sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Atur Ulang Sandi Anggota
            </DialogTitle>
            <DialogDescription className="text-xs">Tentukan kata sandi baru untuk {selectedMember?.user.name || selectedMember?.user.email}</DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kata Sandi Baru</Label>
              <Input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                minLength={8}
                className="h-9 bg-muted/20 border-border/80 rounded-xl text-xs"
              />
            </div>
            <div className="p-3 bg-muted/30 rounded-xl border border-border/60 flex gap-2.5 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px]">
                Kata sandi baru akan berlaku pada sesi masuk berikutnya anggota ini.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setIsPasswordOpen(false)} disabled={isPending} className="rounded-xl text-xs font-bold h-9">Batal</Button>
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs"
              disabled={isPending || newPassword.length < 8}
              onClick={handleUpdateMemberPassword}
            >
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Konfirmasi Sandi Baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Member Confirmation Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="rounded-2xl border-border/80 shadow-xl bg-card sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Keluarkan Anggota Tim
            </DialogTitle>
            <DialogDescription className="text-xs">
              Apakah Anda yakin ingin mengeluarkan <strong>{memberToDelete?.user.name || memberToDelete?.user.email}</strong> dari workspace ini?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-[11px] text-muted-foreground">
            Pengguna akan kehilangan semua hak akses pada konten, media, dan pengaturan di ruang kerja ini.
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isPending} className="rounded-xl text-xs font-bold h-9">
              Batal
            </Button>
            <Button 
              variant="destructive"
              className="font-bold rounded-xl text-xs h-9"
              disabled={isPending}
              onClick={confirmDeleteMember}
            >
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Hapus Anggota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Workspace Member Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl border-border/80 shadow-xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Tambah Anggota Workspace</DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan kredensial akun untuk menambahkan anggota baru ke workspace ini.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateMember} className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama Lengkap (Opsional)</Label>
              <Input 
                placeholder="Budi Pratama" 
                value={newMember.name} 
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                className="bg-muted/20 border-border/80 rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alamat Email *</Label>
              <Input 
                type="email" 
                placeholder="budi@perusahaan.com" 
                value={newMember.email} 
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                required
                className="bg-muted/20 border-border/80 rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kata Sandi Akses *</Label>
              <Input 
                type="password" 
                placeholder="Minimal 8 karakter" 
                value={newMember.password} 
                onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                required
                minLength={8}
                className="bg-muted/20 border-border/80 rounded-xl h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground italic">Kata sandi yang digunakan anggota saat login.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Peran Workspace</Label>
              <Select value={newMember.role || "viewer"} onValueChange={handleCreateRoleChange}>
                <SelectTrigger className="bg-muted/20 border-border/80 rounded-xl h-9 text-xs">
                  <SelectValue>{ROLE_LABELS[newMember.role || "viewer"]}</SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  <SelectItem value="admin" className="text-xs rounded-lg">Administrator (Kontrol Penuh Workspace)</SelectItem>
                  <SelectItem value="editor" className="text-xs rounded-lg">Editor (Review, Setujui & Terbitkan)</SelectItem>
                  <SelectItem value="author" className="text-xs rounded-lg">Author (Terbitkan Konten Sendiri)</SelectItem>
                  <SelectItem value="contributor" className="text-xs rounded-lg">Contributor (Kirim Draf untuk Review)</SelectItem>
                  <SelectItem value="viewer" className="text-xs rounded-lg">Viewer (Hanya Baca Konten)</SelectItem>
                  <SelectItem value="subscriber" className="text-xs rounded-lg">Subscriber (Baca Publik)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <PermissionsMatrix
              permissions={createPermissions}
              onTogglePermission={handleToggleCreatePermission}
              onToggleAll={handleToggleAllCreatePermissions}
            />
            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isPending} className="rounded-xl text-xs font-bold h-9">Batal</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs" disabled={isPending}>
                {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                Tambah Anggota
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Limit Reached Alert Modal */}
      <Dialog open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen}>
        <DialogContent className="rounded-2xl border-border/80 shadow-xl bg-card sm:max-w-[440px]">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1">
              <AlertCircle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold">Batas Maksimal Akun Tercapai</DialogTitle>
            <DialogDescription className="text-xs">
              Workspace Anda telah menggunakan <span className="font-bold text-foreground">{current} dari {limit}</span> kuota anggota tim yang diizinkan pada paket saat ini.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-xl border border-border/50">
            Untuk dapat menambahkan anggota tim baru, silakan tingkatkan (*upgrade*) paket langganan workspace Anda.
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setIsLimitModalOpen(false)} className="rounded-xl text-xs font-bold h-9">
              Tutup
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl" asChild>
              <Link href={`/dashboard/${tenantSlug}/subscriptions`}>
                Upgrade Paket
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
