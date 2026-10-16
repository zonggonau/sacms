"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Server, Loader2, RefreshCw, AlertTriangle, Trash2 } from "lucide-react"

const CYCLES: Record<string, string> = {
  m: "Bulanan", q: "Kuartal (3 bulan)", s: "Semester (6 bulan)", a: "Tahunan",
  b: "2 Tahun", t: "3 Tahun", p4: "4 Tahun", p5: "5 Tahun",
}

export default function BiznetGioInfrastructurePage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [products, setProducts] = useState<any[]>([])
  const [osList, setOsList] = useState<any[]>([])
  const [keypairs, setKeypairs] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [provisioning, setProvisioning] = useState(false)
  const [lastResult, setLastResult] = useState<any>(null)

  const [form, setForm] = useState({
    product_id: "",
    select_os: "",
    keypair_id: "",
    cycle: "m",
    vm_name: "",
    ssh_and_console_user: "",
    console_password: "",
    promocode: "",
  })

  const loadBase = async () => {
    setLoading(true)
    try {
      const [p, k, a] = await Promise.all([
        fetch("/api/admin/biznet-gio/products").then((r) => (r.ok ? r.json() : { products: [] })),
        fetch("/api/admin/biznet-gio/keypairs").then((r) => (r.ok ? r.json() : { keypairs: [] })),
        fetch("/api/admin/biznet-gio/vms").then((r) => (r.ok ? r.json() : { accounts: [] })),
      ])
      setProducts(Array.isArray(p.products) ? p.products : [])
      setKeypairs(Array.isArray(k.keypairs) ? k.keypairs : [])
      setAccounts(Array.isArray(a.accounts) ? a.accounts : [])
    } catch {
      toast({ title: "Gagal", description: "Gagal memuat data dari Biznet Gio API", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBase() }, [])

  useEffect(() => {
    if (!form.product_id) { setOsList([]); return }
    fetch(`/api/admin/biznet-gio/products/${form.product_id}/oss`)
      .then((r) => (r.ok ? r.json() : { oss: [] }))
      .then((d) => setOsList(Array.isArray(d.oss) ? d.oss : []))
      .catch(() => setOsList([]))
  }, [form.product_id])

  const handleProvision = async () => {
    setProvisioning(true)
    setLastResult(null)
    try {
      const res = await fetch("/api/admin/biznet-gio/vms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: Number(form.product_id),
          cycle: form.cycle,
          select_os: form.select_os,
          keypair_id: Number(form.keypair_id),
          vm_name: form.vm_name || undefined,
          ssh_and_console_user: form.ssh_and_console_user,
          console_password: form.console_password,
          promocode: form.promocode || undefined,
          confirmBilling: true,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: "VM Berhasil Dibuat", description: "Cek daftar VM di bawah untuk detailnya." })
        setLastResult(data.result)
        loadBase()
      } else {
        toast({ title: "Gagal Provisioning", description: data.error || "Terjadi kesalahan", variant: "destructive" })
        setLastResult(data.details ?? null)
      }
    } catch {
      toast({ title: "Terjadi Kesalahan", description: "Gagal menghubungi Biznet Gio API", variant: "destructive" })
    } finally {
      setProvisioning(false)
    }
  }

  const handleDelete = async (accountId: string | number) => {
    try {
      const res = await fetch(`/api/admin/biznet-gio/vms/${accountId}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "VM Dihapus", description: `VM ${accountId} berhasil dihapus.` })
        loadBase()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Gagal Menghapus", description: data.error || "Terjadi kesalahan", variant: "destructive" })
      }
    } catch {
      toast({ title: "Terjadi Kesalahan", description: "Gagal menghubungi Biznet Gio API", variant: "destructive" })
    }
  }

  if (!session?.user || session.user.role !== "super_admin") {
    return (
      <div className="flex flex-1 flex-col w-full">
        <div className="flex-1 min-h-[60vh] flex items-center justify-center p-6">
          <Card className="max-w-md w-full rounded-2xl border-border/80 shadow-xs">
            <CardHeader className="text-center p-6">
              <Server className="w-10 h-10 mx-auto text-primary mb-2" />
              <CardTitle className="text-base font-bold">Akses Dibatasi</CardTitle>
              <CardDescription className="text-xs">Hanya administrator yang dapat mengelola VPS Biznet Gio.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const formValid = form.product_id && form.select_os && form.keypair_id && form.ssh_and_console_user && form.console_password.length >= 8

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-5xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                <Server className="w-6 h-6 text-primary" />
                Provisioning VPS — Biznet Gio
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Staf-only. Setiap VM yang dibuat di sini ditagih ke akun Biznet Gio milik SaCMS sendiri — bagian dari jalur "dibantu Tim SaCMS" di Database &amp; Storage pelanggan.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadBase} disabled={loading} className="h-9 rounded-xl text-xs font-bold gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Muat Ulang
            </Button>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Respons API Biznet Gio untuk detail VM (IP, status) tidak terdokumentasi lengkap di spec resmi mereka — hasil mentah (JSON) ditampilkan apa adanya di bawah. Verifikasi detail sebenarnya (IP, kredensial) langsung di portal Biznet Gio sebelum menyerahkannya ke pelanggan.
            </p>
          </div>

          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold">Buat VM Baru</CardTitle>
              <CardDescription className="text-xs">Untuk server database/storage standalone pelanggan Enterprise License.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Produk</Label>
                  <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v, select_os: "" })}>
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card">
                      {products.map((p: any) => (
                        <SelectItem key={p.id ?? p.product_id} value={String(p.id ?? p.product_id)} className="text-xs rounded-lg">
                          {p.name ?? p.label ?? JSON.stringify(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sistem Operasi</Label>
                  <Select value={form.select_os} onValueChange={(v) => setForm({ ...form, select_os: v })} disabled={!form.product_id}>
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue placeholder="Pilih OS" /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card">
                      {osList.map((os: any, i: number) => {
                        const val = os.name ?? os.select_os ?? os.id ?? String(os)
                        return <SelectItem key={i} value={String(val)} className="text-xs rounded-lg">{String(val)}</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Keypair SSH</Label>
                  <Select value={form.keypair_id} onValueChange={(v) => setForm({ ...form, keypair_id: v })}>
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue placeholder="Pilih keypair" /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card">
                      {keypairs.map((k: any) => (
                        <SelectItem key={k.id} value={String(k.id)} className="text-xs rounded-lg">{k.name ?? k.label ?? k.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {keypairs.length === 0 && (
                    <p className="text-[10px] text-amber-600">Belum ada keypair — buat dulu di portal Biznet Gio.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Masa Berlaku</Label>
                  <Select value={form.cycle} onValueChange={(v) => setForm({ ...form, cycle: v })}>
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card">
                      {Object.entries(CYCLES).map(([k, label]) => (
                        <SelectItem key={k} value={k} className="text-xs rounded-lg">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama VM (opsional)</Label>
                  <Input value={form.vm_name} onChange={(e) => setForm({ ...form, vm_name: e.target.value })} placeholder="6-16 karakter: huruf/angka/-/." className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Username SSH/Console *</Label>
                  <Input value={form.ssh_and_console_user} onChange={(e) => setForm({ ...form, ssh_and_console_user: e.target.value })} placeholder="6-32 karakter" className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Password Console *</Label>
                  <Input type="password" value={form.console_password} onChange={(e) => setForm({ ...form, console_password: e.target.value })} placeholder="Min. 8 karakter, kombinasi huruf besar/kecil & angka" className="h-9 rounded-xl text-xs bg-muted/20 border-border/80" />
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!formValid || provisioning} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
                    {provisioning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    Buat VM
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl border-border/80 shadow-xl bg-card max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base font-bold">Konfirmasi Pembuatan VM</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                      Ini akan membuat VM nyata dan <strong className="text-foreground">membebankan biaya ke akun Biznet Gio milik SaCMS</strong> (siklus: {CYCLES[form.cycle]}). Pastikan ini memang untuk setup pelanggan yang sudah dikonfirmasi.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
                    <AlertDialogCancel className="rounded-xl text-xs font-bold h-9">Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleProvision} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
                      Ya, Buat VM
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {lastResult && (
                <pre className="bg-muted/40 p-3 rounded-xl font-mono text-[10px] overflow-x-auto border border-border/80 text-foreground">
                  {JSON.stringify(lastResult, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold">VM Aktif di Akun Biznet Gio SaCMS</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-2">
              {loading ? (
                <p className="text-xs text-muted-foreground">Memuat...</p>
              ) : accounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada VM.</p>
              ) : (
                accounts.map((acc: any, i: number) => {
                  const id = acc.id ?? acc.account_id ?? i
                  return (
                    <div key={id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-border/60">
                      <pre className="font-mono text-[10px] overflow-x-auto flex-1">{JSON.stringify(acc, null, 2)}</pre>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 shrink-0" onClick={() => handleDelete(id)} title="Hapus VM">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
