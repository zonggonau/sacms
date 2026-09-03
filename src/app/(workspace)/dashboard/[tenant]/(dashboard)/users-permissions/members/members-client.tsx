"use client"

import { useState } from "react"
import { Users, UserPlus, Search, Shield, MoreHorizontal, CheckCircle, XCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageContainer } from "@/components/ui/page-container"
import { PageHeader } from "@/components/ui/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useLanguage } from "@/lib/i18n/context"
import { toast } from "sonner"

interface Member {
  id: string
  email: string
  name: string | null
  avatar: string | null
  role: string
  status: string
  createdAt: string
  lastLoginAt: string | null
  emailVerified: string | null
}

interface Role {
  id: string
  name: string
  slug: string
  isSystem: boolean
}

interface MemberAuthPolicy {
  allowMemberRegistration: boolean
  requireMemberEmailVerification: boolean
}

interface Props {
  tenantSlug: string
  initialMembers: Member[]
  roles: Role[]
  total: number
  policy: MemberAuthPolicy
}

function RegistrationPolicyCard({ tenantSlug, initial }: { tenantSlug: string; initial: MemberAuthPolicy }) {
  const { dict } = useLanguage()
  const m = dict.members
  const [policy, setPolicy] = useState<MemberAuthPolicy>(initial)
  const [saving, setSaving] = useState<string | null>(null)

  const update = async (patch: Partial<MemberAuthPolicy>) => {
    const key = Object.keys(patch)[0]
    setSaving(key)
    const prev = policy
    setPolicy((p) => ({ ...p, ...patch }))
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/app-members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? dict.common.somethingWentWrong)
      }
      toast.success(m.policy.updated)
    } catch (err: any) {
      setPolicy(prev)
      toast.error(err.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{m.policy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="allow-reg">{m.policy.allowRegistration}</Label>
            <p className="text-xs text-muted-foreground">
              <code className="text-[11px]">/auth/register</code>
            </p>
          </div>
          <Switch
            id="allow-reg"
            checked={policy.allowMemberRegistration}
            disabled={saving === "allowMemberRegistration"}
            onCheckedChange={(v) => update({ allowMemberRegistration: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="require-verify">{m.policy.requireVerification}</Label>
            <p className="text-xs text-muted-foreground">
              <code className="text-[11px]">pending_verification</code>
            </p>
          </div>
          <Switch
            id="require-verify"
            checked={policy.requireMemberEmailVerification}
            disabled={saving === "requireMemberEmailVerification"}
            onCheckedChange={(v) => update({ requireMemberEmailVerification: v })}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function AddMemberDialog({ tenantSlug, roles, onSuccess }: { tenantSlug: string; roles: Role[]; onSuccess: (m: Member) => void }) {
  const { dict } = useLanguage()
  const m = dict.members
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "authenticated" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/app-members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? dict.common.somethingWentWrong)
      toast.success(m.actions.created)
      onSuccess(data.member)
      setOpen(false)
      setForm({ name: "", email: "", password: "", role: "authenticated" })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" /> {dict.common.add}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{m.addUser}</DialogTitle>
          <DialogDescription>{m.subtitle.replace("{count}", String(roles.length))}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="name">{m.form.name}</Label>
            <Input id="name" placeholder={m.form.namePlaceholder} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">{m.form.email} *</Label>
            <Input id="email" type="email" placeholder="user@example.com" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">{m.form.password} *</Label>
            <Input id="password" type="password" placeholder={m.form.passwordPlaceholder} required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="role">{m.form.role}</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger id="role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map(r => <SelectItem key={r.id} value={r.slug}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
            <Button type="submit" disabled={loading}>{loading ? m.form.creating : m.form.create}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function MembersClient({ tenantSlug, initialMembers, roles, total, policy }: Props) {
  const { dict, fmt, locale } = useLanguage()
  const m = dict.members
  const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: m.filters.active, variant: "default" },
    suspended: { label: m.filters.suspended, variant: "destructive" },
    pending_verification: { label: m.filters.pending, variant: "secondary" },
  }
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const filtered = members.filter(m => {
    const matchSearch = !search || m.email.includes(search) || (m.name ?? "").toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || m.status === statusFilter
    const matchRole = roleFilter === "all" || m.role === roleFilter
    return matchSearch && matchStatus && matchRole
  })

  const handleSuspend = async (member: Member) => {
    const newStatus = member.status === "active" ? "suspended" : "active"
    const res = await fetch(`/api/tenant/${tenantSlug}/app-members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setMembers(prev => prev.map(mem => mem.id === member.id ? { ...mem, status: newStatus } : mem))
      toast.success(newStatus === "active" ? m.actions.reactivated : m.actions.suspended)
    }
  }

  const handleDelete = async (memberId: string) => {
    const res = await fetch(`/api/tenant/${tenantSlug}/app-members/${memberId}`, { method: "DELETE" })
    if (res.ok) {
      setMembers(prev => prev.filter(mem => mem.id !== memberId))
      toast.success(m.actions.deleted)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={<span className="flex items-center gap-2"><Users className="h-6 w-6" /> {m.title}</span>}
        description={fmt(m.subtitle, { count: total })}
        action={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`/dashboard/${tenantSlug}/users-permissions/roles`} className="gap-2 flex items-center">
                <Shield className="h-4 w-4" /> {m.manageRoles}
              </a>
            </Button>
            <AddMemberDialog tenantSlug={tenantSlug} roles={roles} onSuccess={mem => setMembers(prev => [mem, ...prev])} />
          </>
        }
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={m.actions.confirmDeleteTitle}
        description={m.actions.confirmDeleteDesc}
        confirmLabel={m.actions.confirmDeleteLabel}
        variant="destructive"
        onConfirm={async () => { if (pendingDelete) await handleDelete(pendingDelete) }}
      />

      <RegistrationPolicyCard tenantSlug={tenantSlug} initial={policy} />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={m.filters.search} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder={m.filters.status} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.filters.allStatus}</SelectItem>
            <SelectItem value="active">{m.filters.active}</SelectItem>
            <SelectItem value="suspended">{m.filters.suspended}</SelectItem>
            <SelectItem value="pending_verification">{m.filters.pending}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={m.filters.role} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.filters.allRoles}</SelectItem>
            {roles.map(r => <SelectItem key={r.id} value={r.slug}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>{m.table.user}</TableHead>
              <TableHead>{m.table.role}</TableHead>
              <TableHead>{m.table.status}</TableHead>
              <TableHead>{m.table.joined}</TableHead>
              <TableHead>{m.table.lastLogin}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {search || statusFilter !== "all" || roleFilter !== "all" ? dict.common.noResults : dict.common.noData}
                </TableCell>
              </TableRow>
            ) : filtered.map(member => (
              <TableRow key={member.id} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar ?? undefined} />
                      <AvatarFallback className="text-xs">{(member.name ?? member.email).slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">{member.name ?? <span className="text-muted-foreground italic">{m.table.noName}</span>}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </div>
                    {member.emailVerified ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 ml-1" title={m.table.emailVerified} />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground ml-1" title={m.table.emailNotVerified} />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-mono">{member.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGES[member.status]?.variant ?? "outline"} className="text-xs">
                    {STATUS_BADGES[member.status]?.label ?? member.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(member.createdAt).toLocaleDateString(locale === "id" ? "id-ID" : "en-US", { day: "2-digit", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleDateString(locale === "id" ? "id-ID" : "en-US", { day: "2-digit", month: "short", year: "numeric" }) : <span className="italic">{m.table.never}</span>}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleSuspend(member)}>
                        {member.status === "active" ? m.filters.suspended : m.actions.reactivated}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setPendingDelete(member.id)}>{m.actions.deleteUser}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageContainer>
  )
}
