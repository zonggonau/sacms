"use client"

import { useMemo, useState } from "react"
import { Shield, Plus, Users, Lock, Save, Trash2 } from "lucide-react"
import { PageContainer } from "@/components/ui/page-container"
import { PageHeader } from "@/components/ui/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"

const ACTIONS = ["find", "findOne", "create", "update", "delete"] as const
type Action = (typeof ACTIONS)[number]


interface RolePermission {
  contentTypeSlug: string
  action: Action
  granted: boolean
}

interface Role {
  id: string
  name: string
  slug: string
  description: string | null
  isSystem: boolean
  memberCount: number
  permissions: RolePermission[]
  _count: { permissions: number }
}

interface ContentType {
  id: string
  name: string
  slug: string
}

interface Props {
  tenantSlug: string
  roles: Role[]
  contentTypes: ContentType[]
}

/** Build a { "slug:action": boolean } lookup from a role's stored permissions. */
function toMatrix(permissions: RolePermission[]): Record<string, boolean> {
  const m: Record<string, boolean> = {}
  for (const p of permissions) m[`${p.contentTypeSlug}:${p.action}`] = p.granted
  return m
}

function CreateRoleDialog({ tenantSlug, onCreated }: { tenantSlug: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "", description: "" })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/member-roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Terjadi kesalahan. Silakan coba lagi.")
      toast.success(`Peran "${form.name}" dibuat`)
      setOpen(false)
      setForm({ name: "", slug: "", description: "" })
      onCreated()
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
          <Plus className="h-4 w-4" /> Peran Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buat Peran Anggota</DialogTitle>
          <DialogDescription>Peran khusus untuk workspace ini. Anggota yang ditugaskan mewarisi izin kontennya.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="role-name">Nama *</Label>
            <Input
              id="role-name"
              placeholder="VIP Member"
              required
              value={form.name}
              onChange={(e) => {
                const name = e.target.value
                setForm((f) => ({
                  ...f,
                  name,
                  slug: f.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                }))
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="role-slug">Slug *</Label>
            <Input
              id="role-slug"
              placeholder="vip-member"
              required
              pattern="[a-z0-9-]+"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="role-desc">Deskripsi</Label>
            <Input
              id="role-desc"
              placeholder="Opsional"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Membuat…" : "Buat Peran"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PermissionMatrix({
  tenantSlug,
  role,
  contentTypes,
}: {
  tenantSlug: string
  role: Role
  contentTypes: ContentType[]
}) {
  const ACTION_LABELS: Record<Action, string> = {
    find: "Daftar",
    findOne: "Baca",
    create: "Buat",
    update: "Ubah",
    delete: "Hapus",
  }
  const [matrix, setMatrix] = useState<Record<string, boolean>>(() => toMatrix(role.permissions))
  const [saving, setSaving] = useState(false)
  const initial = useMemo(() => JSON.stringify(toMatrix(role.permissions)), [role.permissions])
  const dirty = JSON.stringify(matrix) !== initial

  const rows: { slug: string; label: string }[] = [
    { slug: "*", label: "Semua tipe konten" },
    ...contentTypes.map((ct) => ({ slug: ct.slug, label: ct.name })),
  ]

  const toggle = (slug: string, action: Action) => {
    setMatrix((m) => ({ ...m, [`${slug}:${action}`]: !m[`${slug}:${action}`] }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const permissions = Object.entries(matrix)
        .filter(([, granted]) => granted)
        .map(([key]) => {
          const [contentTypeSlug, action] = key.split(":")
          return { contentTypeSlug, action, granted: true }
        })
      const res = await fetch(`/api/tenant/${tenantSlug}/member-roles/${role.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Terjadi kesalahan. Silakan coba lagi.")
      toast.success(`Izin disimpan untuk "${role.name}"`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="min-w-[180px]">Tipe Konten</TableHead>
              {ACTIONS.map((a) => (
                <TableHead key={a} className="text-center">
                  {ACTION_LABELS[a]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.slug} className="hover:bg-muted/30">
                <TableCell className="font-medium text-sm">
                  {row.slug === "*" ? (
                    <span className="italic text-muted-foreground">{row.label}</span>
                  ) : (
                    row.label
                  )}
                  {row.slug !== "*" && (
                    <span className="ml-2 text-xs text-muted-foreground font-mono">{row.slug}</span>
                  )}
                </TableCell>
                {ACTIONS.map((a) => (
                  <TableCell key={a} className="text-center">
                    <Checkbox
                      checked={!!matrix[`${row.slug}:${a}`]}
                      onCheckedChange={() => toggle(row.slug, a)}
                      aria-label={`${row.label} ${ACTION_LABELS[a]}`}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Menyimpan…" : dirty ? "Simpan Perubahan" : "Tersimpan"}
        </Button>
      </div>
    </div>
  )
}

/** Render a string with **bold** spans. */
function withBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export function RolesClient({ tenantSlug, roles, contentTypes }: Props) {
  const [selectedId, setSelectedId] = useState<string>(roles[0]?.id ?? "")
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0]
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null)

  const refresh = () => {
    // Server component owns the data; a full refresh is the simplest correct path.
    window.location.reload()
  }

  const deleteRole = async (role: Role) => {
    const res = await fetch(`/api/tenant/${tenantSlug}/member-roles/${role.id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Peran dihapus")
      refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Terjadi kesalahan. Silakan coba lagi.")
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Shield className="h-6 w-6" /> Peran & Perizinan
          </span>
        }
        description="Kontrol apa yang boleh dilakukan tiap peran anggota terhadap konten Anda via public API."
        action={
          <>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/dashboard/${tenantSlug}/users-permissions/members`}
                className="gap-2 flex items-center"
              >
                <Users className="h-4 w-4" /> Anggota
              </a>
            </Button>
            <CreateRoleDialog tenantSlug={tenantSlug} onCreated={refresh} />
          </>
        }
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Hapus peran "${pendingDelete?.name ?? ""}"?`}
        description='Anggota dengan peran ini kembali ke "authenticated".'
        confirmLabel="Hapus peran"
        variant="destructive"
        onConfirm={async () => { if (pendingDelete) await deleteRole(pendingDelete) }}
      />

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* Role list */}
        <div className="space-y-1">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedId(role.id)}
              className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                role.id === selected?.id
                  ? "bg-muted border-foreground/20"
                  : "border-transparent hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{role.name}</span>
                {role.isSystem && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] font-mono px-1">
                  {role.slug}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {`${role.memberCount} anggota`}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Matrix */}
        {selected && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {selected.name}
                  {selected.isSystem && (
                    <Badge variant="secondary" className="text-xs">
                      Sistem
                    </Badge>
                  )}
                </h2>
                {selected.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{selected.description}</p>
                )}
              </div>
              {!selected.isSystem && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive gap-1"
                  onClick={() => setPendingDelete(selected)}
                >
                  <Trash2 className="h-4 w-4" /> Hapus
                </Button>
              )}
            </div>

            {selected.isSystem && selected.slug === "public" && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                {withBold("Peran **Public** berlaku untuk permintaan API tanpa autentikasi. Secara default hanya boleh melihat dan membaca konten terbit.")}
              </p>
            )}
            {selected.isSystem && selected.slug === "authenticated" && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                {withBold("Peran **Authenticated** berlaku untuk anggota yang login tanpa peran yang lebih spesifik.")}
              </p>
            )}

            <PermissionMatrix
              key={selected.id}
              tenantSlug={tenantSlug}
              role={selected}
              contentTypes={contentTypes}
            />
          </div>
        )}
      </div>
    </PageContainer>
  )
}
