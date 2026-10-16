"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Gem,
  Plus,
  Copy,
  Check,
  Search,
  ExternalLink,
  Trash2,
  Loader2,
  Key,
  ChevronLeft,
  ChevronRight,
  ShieldOff,
  ShieldCheck,
  HardDrive,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { generateLicenseContractPDF } from "@/lib/pdf-generator"

// ─── Paket Lisensi Enterprise (bundel tetap, 1 tahun) ──────────────────────
// Storage & AI credits sudah termasuk dalam paket — bukan field terpisah.
// Tipe lisensi selalu "enterprise", masa berlaku selalu 1 tahun (365 hari),
// dan maks. akun aktivasi selalu 1 (satu lisensi untuk satu akun) — lihat
// handleGenerate(). "Unlimited" memakai sentinel 999999 yang sama dengan
// yang dipakai getUserWorkspaceLicense() di plan-enforcement.ts untuk
// "praktis tak terbatas".
const LICENSE_PACKAGES: Record<string, { label: string; maxWorkspaces: number; storageGb: number; aiCredits: number; priceIdr: number }> = {
  "100": { label: "100 Workspace", maxWorkspaces: 100, storageGb: 100, aiCredits: 5000, priceIdr: 200_000_000 },
  "500": { label: "500 Workspace", maxWorkspaces: 500, storageGb: 500, aiCredits: 5000, priceIdr: 500_000_000 },
  unlimited: { label: "Unlimited Workspace", maxWorkspaces: 999999, storageGb: 1024, aiCredits: 15000, priceIdr: 1_000_000_000 },
}

function formatRupiah(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`
}

interface License {
  id: string
  displayKey?: string
  customerName: string
  customerEmail: string
  organization: string
  type: string
  storageGb: number | null
  aiCredits: number | null
  maxWorkspaces: number | null
  priceIdr: number | null
  maxInstances: number
  activationCount: number
  expiresAt: string
  isExpired: boolean
  daysRemaining: number
  status: string
  lastValidatedAt: string | null
  validatedCount: number
  createdAt: string
}

export default function EnterpriseLicensesPage() {
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLicenses, setTotalLicenses] = useState(0)
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    organization: "",
    // Paket bundel (workspace + storage + AI credits + harga) — lihat
    // LICENSE_PACKAGES di atas. Tipe lisensi, masa berlaku, dan maks. akun
    // aktivasi semuanya tetap ("enterprise", 1 tahun, 1 akun) — lihat
    // handleGenerate().
    packageTier: "100",
  })
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingRevoke, setPendingRevoke] = useState<License | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingRevokeId, setTogglingRevokeId] = useState<string | null>(null)
  const [editingQuotaFor, setEditingQuotaFor] = useState<License | null>(null)
  const [storageGbInput, setStorageGbInput] = useState("")
  const [aiCreditsInput, setAiCreditsInput] = useState("")
  const [maxInstancesInput, setMaxInstancesInput] = useState("1")
  const [maxWorkspacesInput, setMaxWorkspacesInput] = useState("")
  const [priceIdrInput, setPriceIdrInput] = useState("")
  const [savingQuota, setSavingQuota] = useState(false)

  const fetchLicenses = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (statusFilter !== "all") params.set("status", statusFilter)
      const res = await fetch(`/api/admin/license/list?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLicenses(data.licenses || [])
        setTotalPages(data.totalPages || 1)
        setTotalLicenses(data.total || 0)
      }
    } catch (err) {
      toast({
        title: "Gagal",
        description: "Gagal memuat daftar lisensi enterprise",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 400)
    return () => clearTimeout(handler)
  }, [searchQuery])

  useEffect(() => {
    fetchLicenses()
  }, [debouncedSearch, statusFilter, page])

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value)
    setPage(1)
  }

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedKey(true)
      toast({
        title: "Tersalin!",
        description: "Serial lisensi berhasil disalin ke clipboard",
      })
      setTimeout(() => setCopiedKey(false), 2000)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menyalin ke clipboard" })
    }
  }

  const handleCopyLicenseById = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/license/${id}`)
      if (!res.ok) throw new Error("reveal failed")
      const data = await res.json()
      await handleCopyKey(data.licenseKey)
    } catch {
      toast({
        title: "Gagal menyalin",
        description: "Silakan salin secara manual",
        variant: "destructive",
      })
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGeneratedKey(null)
    setConfirmGenerate(false)

    // Masa berlaku selalu 1 tahun — lihat komentar di LICENSE_PACKAGES.
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 365)
    const pkg = LICENSE_PACKAGES[form.packageTier]

    try {
      const res = await fetch("/api/admin/license/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          organization: form.organization,
          type: "enterprise",
          storageGb: pkg.storageGb,
          aiCredits: pkg.aiCredits,
          maxInstances: 1,
          maxWorkspaces: pkg.maxWorkspaces,
          priceIdr: pkg.priceIdr,
          expiresAt: expiresAt.toISOString(),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setGeneratedKey(data.licenseKey)
        setShowGenerate(false)
        fetchLicenses()
        setForm({
          customerName: "",
          customerEmail: "",
          organization: "",
          packageTier: "100",
        })
        toast({
          title: "Lisensi Dibuat",
          description: `Lisensi aktif berhasil di-generate untuk ${form.customerName}`,
        })
      } else {
        const errData = await res.json()
        toast({
          title: "Gagal Generate",
          description: errData.error || "Terjadi kesalahan",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({
        title: "Terjadi Kesalahan",
        description: "Gagal membuat lisensi",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/license/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast({
          title: "Lisensi Dihapus",
          description: "Lisensi berhasil dihapus dari sistem.",
        })
        setDeletingId(null)
        fetchLicenses()
      } else {
        const errData = await res.json()
        toast({
          title: "Gagal Menghapus",
          description: errData.error || "Terjadi kesalahan",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({
        title: "Terjadi Kesalahan",
        description: "Gagal menghapus lisensi",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDownloadContract = (lic: License) => {
    generateLicenseContractPDF({
      licenseId: lic.id,
      displayKey: lic.displayKey,
      customerName: lic.customerName,
      customerEmail: lic.customerEmail,
      organization: lic.organization,
      type: lic.type,
      storageGb: lic.storageGb,
      aiCredits: lic.aiCredits,
      maxWorkspaces: lic.maxWorkspaces,
      priceIdr: lic.priceIdr,
      issuedAt: lic.createdAt,
      expiresAt: lic.expiresAt,
    })
  }

  const openEditQuota = (lic: License) => {
    setEditingQuotaFor(lic)
    setStorageGbInput(lic.storageGb ? String(lic.storageGb) : "")
    setAiCreditsInput(lic.aiCredits ? String(lic.aiCredits) : "")
    setMaxInstancesInput(String(lic.maxInstances || 1))
    setMaxWorkspacesInput(lic.maxWorkspaces ? String(lic.maxWorkspaces) : "")
    setPriceIdrInput(lic.priceIdr != null ? String(lic.priceIdr) : "")
  }

  const handleSaveQuota = async () => {
    if (!editingQuotaFor) return
    const gb = storageGbInput.trim() === "" ? null : Number(storageGbInput)
    const credits = aiCreditsInput.trim() === "" ? null : Number(aiCreditsInput)
    const maxInstances = maxInstancesInput.trim() === "" ? 1 : Number(maxInstancesInput)
    const maxWorkspaces = maxWorkspacesInput.trim() === "" ? null : Number(maxWorkspacesInput)
    const priceIdr = priceIdrInput.trim() === "" ? null : Number(priceIdrInput)
    if (gb !== null && (!Number.isInteger(gb) || gb <= 0)) {
      toast({ title: "Nilai tidak valid", description: "Masukkan jumlah GB berupa bilangan positif, atau kosongkan.", variant: "destructive" })
      return
    }
    if (credits !== null && (!Number.isInteger(credits) || credits <= 0)) {
      toast({ title: "Nilai tidak valid", description: "Masukkan jumlah AI credits berupa bilangan positif, atau kosongkan.", variant: "destructive" })
      return
    }
    if (!Number.isInteger(maxInstances) || maxInstances <= 0) {
      toast({ title: "Nilai tidak valid", description: "Maks. akun aktivasi harus bilangan positif (minimal 1).", variant: "destructive" })
      return
    }
    if (maxWorkspaces !== null && (!Number.isInteger(maxWorkspaces) || maxWorkspaces <= 0)) {
      toast({ title: "Nilai tidak valid", description: "Maks. workspace harus bilangan positif, atau kosongkan.", variant: "destructive" })
      return
    }
    if (priceIdr !== null && (!Number.isInteger(priceIdr) || priceIdr < 0)) {
      toast({ title: "Nilai tidak valid", description: "Nilai kontrak harus bilangan bulat ≥ 0, atau kosongkan.", variant: "destructive" })
      return
    }
    setSavingQuota(true)
    try {
      const res = await fetch(`/api/admin/license/${editingQuotaFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageGb: gb, aiCredits: credits, maxInstances, maxWorkspaces, priceIdr }),
      })
      if (res.ok) {
        toast({
          title: "Kuota Diperbarui",
          description: `Kuota untuk ${editingQuotaFor.customerName} berhasil disimpan.`,
        })
        setEditingQuotaFor(null)
        fetchLicenses()
      } else {
        const errData = await res.json()
        toast({ title: "Gagal", description: errData.error || "Terjadi kesalahan", variant: "destructive" })
      }
    } catch {
      toast({ title: "Terjadi Kesalahan", description: "Gagal memperbarui kuota", variant: "destructive" })
    } finally {
      setSavingQuota(false)
    }
  }

  const handleToggleRevoke = async (lic: License) => {
    const nextStatus = lic.status === "revoked" ? "active" : "revoked"
    setTogglingRevokeId(lic.id)
    try {
      const res = await fetch(`/api/admin/license/${lic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) {
        toast({
          title: nextStatus === "revoked" ? "Lisensi Dicabut" : "Lisensi Diaktifkan Kembali",
          description:
            nextStatus === "revoked"
              ? `Lisensi untuk ${lic.customerName} tidak akan lolos validasi lagi, walau masih dipakai.`
              : `Lisensi untuk ${lic.customerName} kini dapat divalidasi kembali.`,
        })
        fetchLicenses()
      } else {
        const errData = await res.json()
        toast({ title: "Gagal", description: errData.error || "Terjadi kesalahan", variant: "destructive" })
      }
    } catch {
      toast({ title: "Terjadi Kesalahan", description: "Gagal mengubah status lisensi", variant: "destructive" })
    } finally {
      setTogglingRevokeId(null)
    }
  }

  if (!session?.user || session.user.role !== "super_admin") {
    return (
      <div className="flex flex-1 flex-col w-full">
        <div className="flex-1 min-h-[60vh] flex items-center justify-center p-6">
          <Card className="max-w-md w-full rounded-2xl border-border/80 shadow-xs">
            <CardHeader className="text-center p-6">
              <Gem className="w-10 h-10 mx-auto text-primary mb-2" />
              <CardTitle className="text-base font-bold">Akses Dibatasi</CardTitle>
              <CardDescription className="text-xs">
                Hanya administrator yang dapat mengelola lisensi enterprise.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                  <Gem className="w-6 h-6 text-primary" />
                  Lisensi Self-Hosted Enterprise
                </h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full">
                  RSA Signature
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate serial key RSA untuk pelanggan Enterprise Self-Hosted.
              </p>
            </div>
            
            <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Generate Serial Baru
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl border-border/80 shadow-xl bg-card sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" /> Generate Lisensi Enterprise
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Buat serial key RSA untuk pelanggan self-hosted.
                  </DialogDescription>
                </DialogHeader>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    setConfirmGenerate(true)
                  }}
                  className="space-y-3 py-2"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="customerName" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama Pelanggan / PIC *</Label>
                      <Input
                        id="customerName"
                        required
                        value={form.customerName}
                        onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                        placeholder="Pemerintah Kab. Jayawijaya"
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Kontak</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.customerEmail}
                        onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                        placeholder="admin@jayawijaya.go.id"
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="org" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Organisasi / Instansi</Label>
                      <Input
                        id="org"
                        value={form.organization}
                        onChange={(e) => setForm({ ...form, organization: e.target.value })}
                        placeholder="Pemkab Jayawijaya"
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="packageTier" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paket Lisensi Enterprise</Label>
                      <Select
                        value={form.packageTier}
                        onValueChange={(v) => setForm({ ...form, packageTier: v })}
                      >
                        <SelectTrigger id="packageTier" className="h-9 rounded-xl text-xs bg-muted/20 border-border/80">
                          <SelectValue placeholder="Pilih paket" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card">
                          {Object.entries(LICENSE_PACKAGES).map(([key, pkg]) => (
                            <SelectItem key={key} value={key} className="text-xs rounded-lg">
                              {pkg.label} — {formatRupiah(pkg.priceIdr)}/thn
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rincian Paket (Sudah Termasuk Storage &amp; AI Credits)</p>
                    {(() => {
                      const pkg = LICENSE_PACKAGES[form.packageTier]
                      return (
                        <ul className="text-xs text-foreground space-y-1">
                          <li>• Tipe lisensi: <span className="font-bold">Enterprise</span></li>
                          <li>• Workspace: <span className="font-bold">{pkg.maxWorkspaces >= 999999 ? "Unlimited" : `Maks. ${pkg.maxWorkspaces.toLocaleString("id-ID")}`}</span></li>
                          <li>• Storage gabungan: <span className="font-bold">{pkg.storageGb >= 1024 ? `${pkg.storageGb / 1024} TB` : `${pkg.storageGb} GB`}</span></li>
                          <li>• AI credits: <span className="font-bold">{pkg.aiCredits.toLocaleString("id-ID")}</span></li>
                          <li>• Masa berlaku: <span className="font-bold">1 tahun</span></li>
                          <li>• Maks. akun aktivasi: <span className="font-bold">1 akun</span></li>
                          <li className="pt-1 border-t border-border/60 mt-1.5">• Nilai kontrak: <span className="font-bold text-primary">{formatRupiah(pkg.priceIdr)}</span></li>
                        </ul>
                      )
                    })()}
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/60">
                    <Button type="button" variant="outline" onClick={() => setShowGenerate(false)} className="rounded-xl text-xs font-bold h-9">
                      Batal
                    </Button>
                    <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
                      <AlertDialogTrigger asChild>
                        <Button type="submit" disabled={!form.customerName.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
                          {generating ? "Memproses..." : "Generate Serial Key"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl border-border/80 shadow-xl bg-card max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-base font-bold">Konfirmasi Pembuatan Lisensi</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                            Sistem akan menandatangani serial RSA untuk{" "}
                            <strong className="text-foreground">{form.customerName}</strong>
                            {form.organization ? ` (${form.organization})` : ""} dengan paket{" "}
                            <strong className="text-foreground">{LICENSE_PACKAGES[form.packageTier].label}</strong>, aktif selama{" "}
                            <strong className="text-foreground">1 tahun</strong> dengan nilai kontrak{" "}
                            <strong className="text-foreground">{formatRupiah(LICENSE_PACKAGES[form.packageTier].priceIdr)}</strong>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
                          <AlertDialogCancel className="rounded-xl text-xs font-bold h-9">Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={handleGenerate} disabled={generating} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
                            {generating ? "Memproses..." : "Ya, Terbitkan Lisensi"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Generated Key Success */}
          {generatedKey && (
            <Card className="border border-emerald-500/30 bg-emerald-500/5 rounded-2xl shadow-xs">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Serial Lisensi Berhasil Dibuat
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Salin dan berikan kunci ini ke pelanggan secara rahasia.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3">
                <div className="relative">
                  <pre className="bg-muted/40 p-3 pr-20 rounded-xl font-mono text-[10px] break-all select-all border border-border/80 overflow-x-auto text-foreground">
                    {generatedKey}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2 rounded-lg text-xs font-bold h-7"
                    onClick={() => handleCopyKey(generatedKey)}
                  >
                    {copiedKey ? (
                      <><Check className="w-3 h-3 mr-1 text-emerald-500" /> Tersalin</>
                    ) : (
                      <><Copy className="w-3 h-3 mr-1" /> Salin</>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pelanggan harus memasukkan nilai ini ke dalam variabel{" "}
                  <code className="bg-muted/40 px-1.5 py-0.5 rounded text-[11px] font-mono text-foreground font-bold">LICENSE_KEY</code>{" "}
                  di file <code className="bg-muted/40 px-1.5 py-0.5 rounded text-[11px] font-mono text-foreground font-bold">.env</code> server mereka.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan pelanggan, email, atau instansi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-xl text-xs bg-card border-border/80"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 rounded-xl text-xs bg-card border-border/80">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-card">
                <SelectItem value="all" className="text-xs rounded-lg">Semua Status</SelectItem>
                <SelectItem value="active" className="text-xs rounded-lg">Aktif</SelectItem>
                <SelectItem value="expired" className="text-xs rounded-lg">Kadaluarsa</SelectItem>
                <SelectItem value="revoked" className="text-xs rounded-lg">Dicabut</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Licenses Table */}
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-b border-border/60">
                    <TableHead className="font-bold text-xs uppercase pl-5">Pelanggan</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Organisasi</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Tipe</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Harga</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Masa Berlaku</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Status</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Validasi</TableHead>
                    <TableHead className="text-right font-bold text-xs uppercase pr-5">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j} className="p-4">
                            <Skeleton className="h-4 w-full rounded-md" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : licenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-20 text-center">
                        <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                          <Gem className="w-8 h-8 opacity-20 mb-1" />
                          {searchQuery || statusFilter !== "all" ? (
                            <p className="text-xs font-bold text-foreground">Tidak ada lisensi yang sesuai dengan filter.</p>
                          ) : (
                            <>
                              <p className="text-xs font-bold text-foreground">Belum ada lisensi enterprise</p>
                              <p className="text-[11px] text-muted-foreground">Klik 'Generate Serial Baru' untuk menerbitkan lisensi pertama.</p>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    licenses.map((lic) => (
                      <TableRow key={lic.id} className="hover:bg-muted/20 transition-colors border-b border-border/40 last:border-0">
                        <TableCell className="pl-5 py-3.5">
                          <div className="font-bold text-xs text-foreground">{lic.customerName}</div>
                          {lic.customerEmail && (
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{lic.customerEmail}</div>
                          )}
                          {lic.displayKey && (
                            <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5" title="Serial lisensi (disamarkan)">
                              {lic.displayKey}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{lic.organization || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] uppercase font-bold rounded-full border-border/60">
                            {lic.type}
                          </Badge>
                          {lic.storageGb ? (
                            <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                              {lic.storageGb >= 1024 ? `${(lic.storageGb / 1024).toFixed(lic.storageGb % 1024 === 0 ? 0 : 1)} TB` : `${lic.storageGb} GB`} pool
                            </div>
                          ) : null}
                          {lic.aiCredits ? (
                            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                              {lic.aiCredits.toLocaleString("id-ID")} AI credits
                            </div>
                          ) : null}
                          {lic.maxWorkspaces ? (
                            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                              {lic.maxWorkspaces >= 999999 ? "Unlimited" : `${lic.maxWorkspaces} workspace`}
                            </div>
                          ) : null}
                          <div
                            className={cn(
                              "text-[10px] mt-0.5 font-mono",
                              lic.activationCount >= lic.maxInstances ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground"
                            )}
                            title="Jumlah akun yang sudah mengaktifkan kunci ini, dari maksimum yang diizinkan"
                          >
                            {lic.activationCount}/{lic.maxInstances} akun
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-foreground font-bold">
                          {lic.priceIdr != null ? formatRupiah(lic.priceIdr) : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <div className="text-foreground">{new Date(lic.expiresAt).toLocaleDateString('id-ID')}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {lic.daysRemaining > 0 ? `${lic.daysRemaining} hari tersisa` : "Kadaluarsa"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lic.status === "revoked" ? (
                            <Badge className="bg-muted-foreground/10 text-muted-foreground border-border/60 text-[9px] font-bold rounded-full border shadow-none">
                              Dicabut
                            </Badge>
                          ) : lic.status === "active" && !lic.isExpired ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px] font-bold rounded-full border shadow-none">
                              Aktif
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[9px] font-bold rounded-full border shadow-none">
                              {lic.isExpired ? "Kadaluarsa" : lic.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{lic.validatedCount}x</TableCell>
                        <TableCell className="text-right pr-5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                              onClick={() => handleCopyLicenseById(lic.id)}
                              title="Salin kunci lisensi"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                              onClick={() => openEditQuota(lic)}
                              title="Atur kuota storage & AI credits"
                            >
                              <HardDrive className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                              onClick={() => handleDownloadContract(lic)}
                              title="Unduh dokumen kontrak lisensi"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={togglingRevokeId === lic.id}
                              className={cn(
                                "h-8 w-8 rounded-lg",
                                lic.status === "revoked"
                                  ? "text-emerald-600 hover:text-emerald-600 hover:bg-emerald-500/10"
                                  : "text-amber-600 hover:text-amber-600 hover:bg-amber-500/10"
                              )}
                              onClick={() => lic.status === "revoked" ? handleToggleRevoke(lic) : setPendingRevoke(lic)}
                              title={lic.status === "revoked" ? "Aktifkan kembali lisensi" : "Cabut lisensi (tetap berlaku walau sedang dipakai)"}
                            >
                              {togglingRevokeId === lic.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : lic.status === "revoked" ? (
                                <ShieldCheck className="w-3.5 h-3.5" />
                              ) : (
                                <ShieldOff className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingId(lic.id)}
                              title="Hapus lisensi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-border/60">
                  <span className="text-xs text-muted-foreground">
                    Halaman {page} dari {totalPages} &bull; {totalLicenses} lisensi total
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="rounded-lg h-8 text-xs font-bold"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="rounded-lg h-8 text-xs font-bold"
                    >
                      Berikutnya <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delete Confirmation */}
          <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
            <AlertDialogContent className="rounded-2xl border-border/80 shadow-xl bg-card max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base font-bold text-foreground">Hapus Lisensi Enterprise?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                  Tindakan ini tidak dapat dibatalkan — baris lisensi ini akan dihapus permanen dari sistem. Hanya bisa dilakukan untuk lisensi yang belum/tidak lagi dipakai workspace mana pun; kalau masih aktif dipakai, gunakan tombol "Cabut" terlebih dahulu.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
                <AlertDialogCancel disabled={isDeleting} className="rounded-xl text-xs font-bold h-9">Batal</AlertDialogCancel>
                <Button 
                  variant="destructive" 
                  onClick={() => deletingId && handleDelete(deletingId)}
                  disabled={isDeleting}
                  className="rounded-xl text-xs font-bold h-9"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  {isDeleting ? "Menghapus..." : "Hapus Lisensi"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Revoke Confirmation — cuts off a paying customer's access instantly, unlike Reactivate */}
          <AlertDialog open={!!pendingRevoke} onOpenChange={(open) => !open && setPendingRevoke(null)}>
            <AlertDialogContent className="rounded-2xl border-border/80 shadow-xl bg-card max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base font-bold text-foreground">Cabut Lisensi "{pendingRevoke?.customerName}"?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                  Lisensi ini akan langsung berhenti lolos validasi, walau masih dipakai aktif oleh pelanggan. Bisa diaktifkan kembali kapan saja dari halaman ini.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
                <AlertDialogCancel className="rounded-xl text-xs font-bold h-9">Batal</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (pendingRevoke) handleToggleRevoke(pendingRevoke)
                    setPendingRevoke(null)
                  }}
                  className="rounded-xl text-xs font-bold h-9"
                >
                  Ya, Cabut Lisensi
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={!!editingQuotaFor} onOpenChange={(open) => !open && setEditingQuotaFor(null)}>
            <DialogContent className="rounded-2xl border-border/80 shadow-xl bg-card max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">Kuota Lisensi — {editingQuotaFor?.customerName}</DialogTitle>
                <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                  Berlaku untuk akun ini setelah lisensi diaktifkan. Kosongkan salah satu field untuk menghapus kuota itu saja (tidak mempengaruhi field lainnya).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label htmlFor="storageGbEdit" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Storage Gabungan (GB)</Label>
                  <Input
                    id="storageGbEdit"
                    type="number"
                    min={1}
                    value={storageGbInput}
                    onChange={(e) => setStorageGbInput(e.target.value)}
                    placeholder="contoh: 100, 250, 500, 1024"
                    className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                  />
                  <p className="text-[10px] text-muted-foreground">Dibagi rata ke semua workspace milik pelanggan ini.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="aiCreditsEdit" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Credits</Label>
                  <Input
                    id="aiCreditsEdit"
                    type="number"
                    min={1}
                    value={aiCreditsInput}
                    onChange={(e) => setAiCreditsInput(e.target.value)}
                    placeholder="contoh: 300, 1500, 5000, 15000"
                    className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                  />
                  <p className="text-[10px] text-muted-foreground">Berlaku selama masa aktif lisensi. Habis = pelanggan berlangganan lagi.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="maxInstancesEdit" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Maks. Akun Aktivasi</Label>
                  <Input
                    id="maxInstancesEdit"
                    type="number"
                    min={1}
                    value={maxInstancesInput}
                    onChange={(e) => setMaxInstancesInput(e.target.value)}
                    placeholder="1"
                    className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Saat ini dipakai oleh {editingQuotaFor?.activationCount ?? 0} akun. Akun baru ditolak setelah kuota ini penuh.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="maxWorkspacesEdit" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Maks. Workspace</Label>
                  <Input
                    id="maxWorkspacesEdit"
                    type="number"
                    min={1}
                    value={maxWorkspacesInput}
                    onChange={(e) => setMaxWorkspacesInput(e.target.value)}
                    placeholder="contoh: 100, 500, atau 999999 untuk Unlimited"
                    className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                  />
                  <p className="text-[10px] text-muted-foreground">Ditegakkan sistem — pembuatan workspace ke-(N+1) otomatis ditolak. Kosongkan = ikut limit paket biasa.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="priceIdrEdit" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nilai Kontrak (Rp)</Label>
                  <Input
                    id="priceIdrEdit"
                    type="number"
                    min={0}
                    value={priceIdrInput}
                    onChange={(e) => setPriceIdrInput(e.target.value)}
                    placeholder="contoh: 200000000"
                    className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">Dicetak di dokumen kontrak (ikon docs di tabel). Ubah di sini kalau ada renegosiasi harga.</p>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
                <Button type="button" variant="outline" onClick={() => setEditingQuotaFor(null)} className="rounded-xl text-xs font-bold h-9">
                  Batal
                </Button>
                <Button
                  onClick={handleSaveQuota}
                  disabled={savingQuota}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs"
                >
                  {savingQuota ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
