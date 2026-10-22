"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Plus, Pencil, Trash2, Tag, Building2, Sparkles, Puzzle, Server } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { formatRupiah } from "@/lib/utils"

type FieldType = "text" | "textarea" | "number" | "boolean" | "features"

interface FieldDef {
  key: string
  label: string
  type: FieldType
  required?: boolean
  /** Shown as a column in the table too — not every field needs to be. */
  showInTable?: boolean
  formatValue?: (value: any) => string
}

interface CategoryConfig {
  key: string
  title: string
  icon: React.ElementType
  apiPath: string
  listKey: string
  fields: FieldDef[]
}

const money = (v: any) => formatRupiah(Number(v) || 0)

const CATEGORIES: CategoryConfig[] = [
  {
    key: "account-plans",
    title: "Akun (Personal)",
    icon: Tag,
    apiPath: "/api/admin/pricing/account-plans",
    listKey: "plans",
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true, showInTable: true },
      { key: "name", label: "Nama Paket", type: "text", required: true, showInTable: true },
      { key: "description", label: "Deskripsi", type: "textarea" },
      { key: "price", label: "Harga Bulanan (IDR)", type: "number", required: true, showInTable: true, formatValue: money },
      { key: "yearlyPrice", label: "Harga Tahunan (IDR)", type: "number", showInTable: true, formatValue: money },
      { key: "maxWorkspaces", label: "Maks Workspace", type: "number", required: true, showInTable: true },
      { key: "features", label: "Fitur (satu per baris)", type: "features" },
      { key: "isPopular", label: "Tandai Populer", type: "boolean" },
      { key: "ctaText", label: "Teks CTA", type: "text" },
      { key: "ctaHref", label: "URL CTA", type: "text" },
      { key: "isActive", label: "Aktif", type: "boolean", showInTable: true },
    ],
  },
  {
    key: "workspace-plans",
    title: "Workspace",
    icon: Building2,
    apiPath: "/api/admin/pricing/workspace-plans",
    listKey: "plans",
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true, showInTable: true },
      { key: "name", label: "Nama Paket", type: "text", required: true, showInTable: true },
      { key: "description", label: "Deskripsi", type: "textarea" },
      { key: "price", label: "Harga Bulanan (IDR)", type: "number", required: true, showInTable: true, formatValue: money },
      { key: "yearlyPrice", label: "Harga Tahunan (IDR)", type: "number", showInTable: true, formatValue: money },
      { key: "maxContentTypes", label: "Maks Content Type", type: "number", required: true },
      { key: "maxContentEntries", label: "Maks Entri Konten", type: "number", required: true, showInTable: true },
      { key: "maxTeamMembers", label: "Maks Anggota Tim", type: "number", required: true, showInTable: true },
      { key: "maxStorageMb", label: "Maks Storage (MB)", type: "number", required: true },
      { key: "maxLocales", label: "Maks Bahasa", type: "number", required: true },
      { key: "maxApiCalls", label: "Maks API Calls/bulan", type: "number", required: true },
      { key: "fairUseBandwidthGb", label: "Fair-Use Bandwidth (GB)", type: "number" },
      { key: "features", label: "Fitur (satu per baris)", type: "features" },
      { key: "isActive", label: "Aktif", type: "boolean", showInTable: true },
    ],
  },
  {
    key: "ai-credit-packs",
    title: "Kredit AI",
    icon: Sparkles,
    apiPath: "/api/admin/pricing/ai-credit-packs",
    listKey: "packs",
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true, showInTable: true },
      { key: "name", label: "Nama Paket", type: "text", required: true, showInTable: true },
      { key: "description", label: "Deskripsi", type: "textarea" },
      { key: "credits", label: "Jumlah Kredit", type: "number", required: true, showInTable: true },
      { key: "priceUsd", label: "Harga (USD)", type: "number", required: true, showInTable: true },
      { key: "price", label: "Harga (IDR)", type: "number", required: true, showInTable: true, formatValue: money },
      { key: "badge", label: "Badge", type: "text" },
      { key: "features", label: "Fitur (satu per baris)", type: "features" },
      { key: "isActive", label: "Aktif", type: "boolean", showInTable: true },
    ],
  },
  {
    key: "addons",
    title: "Addons",
    icon: Puzzle,
    apiPath: "/api/admin/pricing/addons",
    listKey: "addons",
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true, showInTable: true },
      { key: "name", label: "Nama", type: "text", required: true, showInTable: true },
      { key: "description", label: "Deskripsi", type: "textarea" },
      { key: "icon", label: "Icon (nama Lucide)", type: "text" },
      { key: "price", label: "Harga (IDR)", type: "number", showInTable: true, formatValue: money },
      { key: "priceLabel", label: "Label Harga", type: "text" },
      { key: "unit", label: "Unit", type: "text" },
      { key: "featureKey", label: "Feature Key", type: "text" },
      { key: "checkoutAlias", label: "Checkout Alias (plan slug)", type: "text" },
      { key: "yearlyPrice", label: "Harga Tahunan (IDR)", type: "number", formatValue: money },
      { key: "isTopup", label: "Top-up (kuota bertambah)", type: "boolean", showInTable: true },
      { key: "quotaType", label: "Tipe Kuota", type: "text" },
      { key: "amountUnits", label: "Jumlah Unit (bytes)", type: "number" },
      { key: "billingPeriod", label: "Periode Billing", type: "text" },
      { key: "features", label: "Fitur (satu per baris)", type: "features" },
      { key: "isActive", label: "Aktif", type: "boolean", showInTable: true },
    ],
  },
  {
    key: "vps-offerings",
    title: "VPS",
    icon: Server,
    apiPath: "/api/admin/pricing/vps-offerings",
    listKey: "vpsOfferings",
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true, showInTable: true },
      { key: "name", label: "Nama Paket", type: "text", required: true, showInTable: true },
      { key: "description", label: "Deskripsi", type: "textarea" },
      {
        key: "biznetProductId",
        label: "Biznet Gio Product ID (dari GET /neolites/products)",
        type: "text",
        required: true,
      },
      {
        key: "biznetOsImageId",
        label: "Biznet Gio OS Image ID / vmid (dari GET /neolites/products/{id}/oss)",
        type: "text",
        required: true,
      },
      { key: "osLabel", label: "Label OS (tampilan)", type: "text", required: true, showInTable: true },
      { key: "cpuCores", label: "CPU (cores)", type: "number", required: true, showInTable: true },
      { key: "memoryMb", label: "RAM (MB)", type: "number", required: true, showInTable: true },
      { key: "diskGb", label: "Disk (GB)", type: "number", required: true },
      { key: "priceMonthlyIdr", label: "Harga Jual Bulanan (IDR)", type: "number", required: true, showInTable: true, formatValue: money },
      { key: "priceAnnualIdr", label: "Harga Jual Tahunan (IDR)", type: "number", formatValue: money },
      { key: "features", label: "Fitur (satu per baris)", type: "features" },
      { key: "isActive", label: "Aktif", type: "boolean", showInTable: true },
    ],
  },
]

function emptyFormFromFields(fields: FieldDef[]) {
  const form: Record<string, any> = {}
  for (const f of fields) {
    if (f.type === "boolean") form[f.key] = f.key === "isActive"
    else if (f.type === "features") form[f.key] = ""
    else form[f.key] = ""
  }
  return form
}

function itemToForm(item: any, fields: FieldDef[]) {
  const form: Record<string, any> = {}
  for (const f of fields) {
    const v = item[f.key]
    if (f.type === "features") form[f.key] = Array.isArray(v) ? v.join("\n") : ""
    else if (f.type === "boolean") form[f.key] = Boolean(v)
    else form[f.key] = v ?? ""
  }
  return form
}

function formToPayload(form: Record<string, any>, fields: FieldDef[]) {
  const payload: Record<string, any> = {}
  for (const f of fields) {
    const v = form[f.key]
    if (f.type === "number") payload[f.key] = v === "" || v === null || v === undefined ? null : Number(v)
    else if (f.type === "boolean") payload[f.key] = Boolean(v)
    else if (f.type === "features") payload[f.key] = String(v || "").split("\n").map((s) => s.trim()).filter(Boolean)
    else payload[f.key] = v === "" ? null : v
  }
  return payload
}

function CategoryManager({ config, canEdit }: { config: CategoryConfig; canEdit: boolean }) {
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, any>>(() => emptyFormFromFields(config.fields))
  const [isSaving, setIsSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(config.apiPath)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal memuat data")
      setItems(data[config.listKey] || [])
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Memuat", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.apiPath])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyFormFromFields(config.fields))
    setIsDialogOpen(true)
  }

  const openEdit = (item: any) => {
    setEditingId(item.id)
    setForm(itemToForm(item, config.fields))
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = formToPayload(form, config.fields)
      const url = editingId ? `${config.apiPath}/${editingId}` : config.apiPath
      const method = editingId ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan")
      toast({ title: editingId ? "Berhasil Diperbarui" : "Berhasil Dibuat" })
      setIsDialogOpen(false)
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item: any) => {
    if (
      !(await confirm({
        title: `Hapus "${item.name}"?`,
        description: "Tindakan ini tidak dapat dibatalkan.",
        confirmLabel: "Hapus",
        variant: "destructive",
      }))
    )
      return
    try {
      const res = await fetch(`${config.apiPath}/${item.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus")
      toast({ title: "Berhasil Dihapus" })
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Menghapus", description: err.message })
    }
  }

  const tableFields = config.fields.filter((f) => f.showInTable)

  return (
    <Card className="rounded-2xl border-border/80 shadow-xs">
      {confirmDialog}
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-sm font-bold">{config.title}</CardTitle>
          <CardDescription className="text-xs">{items.length} entri</CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" className="h-8 text-xs font-bold rounded-xl gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">Belum ada data.</div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                {tableFields.map((f) => (
                  <TableHead key={f.key} className="text-[10px] font-bold uppercase text-muted-foreground">
                    {f.label}
                  </TableHead>
                ))}
                {canEdit && <TableHead className="text-right text-[10px] font-bold uppercase text-muted-foreground">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {items.map((item) => (
                <TableRow key={item.id}>
                  {tableFields.map((f) => (
                    <TableCell key={f.key}>
                      {f.type === "boolean" ? (
                        <Badge variant={item[f.key] ? "default" : "outline"} className="text-[10px]">
                          {item[f.key] ? "Ya" : "Tidak"}
                        </Badge>
                      ) : f.formatValue ? (
                        f.formatValue(item[f.key])
                      ) : (
                        String(item[f.key] ?? "-")
                      )}
                    </TableCell>
                  ))}
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => handleDelete(item)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editingId ? `Edit ${config.title}` : `Tambah ${config.title}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Perubahan berlaku langsung setelah disimpan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {config.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                {f.type !== "boolean" && (
                  <Label className="text-[11px] font-bold">
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </Label>
                )}
                {f.type === "textarea" || f.type === "features" ? (
                  <Textarea
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="text-xs rounded-lg min-h-[70px]"
                    placeholder={f.type === "features" ? "Satu fitur per baris" : undefined}
                  />
                ) : f.type === "boolean" ? (
                  <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                    <Label className="text-[11px] font-bold">{f.label}</Label>
                    <Switch
                      checked={Boolean(form[f.key])}
                      onCheckedChange={(checked) => setForm((prev) => ({ ...prev, [f.key]: checked }))}
                    />
                  </div>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="h-9 text-xs rounded-lg"
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button size="sm" className="rounded-lg gap-1.5" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function AdminPricingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="flex flex-1 min-h-[80vh] items-center justify-center flex-col w-full bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (session?.user?.role !== "super_admin" && session?.user?.role !== "admin") {
    router.push("/dashboard")
    return null
  }

  const canEdit = session?.user?.role === "super_admin"

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-6">
      <div className="border-b border-border/70 pb-5">
        <h1 className="text-xl font-black text-foreground">Pricing &amp; Plans</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Kelola harga akun, workspace, paket kredit AI, addon, dan VPS secara langsung — sumber kebenaran tunggal yang dipakai checkout, halaman harga publik, dan dashboard.
          {!canEdit && " Role Anda (admin) hanya bisa melihat — perubahan hanya bisa dilakukan super_admin."}
        </p>
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 font-medium">
          ⚠️ Tab VPS: harga di sini adalah harga JUAL ke customer, terpisah dari biaya asli Biznet Gio. Setiap VPS yang terjual langsung menagih metode pembayaran akun Biznet Gio SaCMS sendiri — pastikan harga jual sudah ada margin yang cukup di atas harga produk Biznet Gio yang dipilih. VPS ini bukan server serbaguna: begitu VM aktif, SaCMS otomatis memasang PostgreSQL &amp; MinIO lewat SSH dan menghubungkannya sebagai database/storage mandiri (BYODB/BYOS) milik akun atau workspace pembeli.
        </p>
      </div>

      <Tabs defaultValue={CATEGORIES[0].key}>
        <TabsList>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key} className="text-xs font-bold gap-1.5">
              <c.icon className="h-3.5 w-3.5" /> {c.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {CATEGORIES.map((c) => (
          <TabsContent key={c.key} value={c.key} className="pt-4">
            <CategoryManager config={c} canEdit={canEdit} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
