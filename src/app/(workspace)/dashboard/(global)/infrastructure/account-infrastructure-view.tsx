"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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
  Database,
  Loader2,
  Save,
  Eye,
  EyeOff,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  PlugZap,
  Layers,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { EnterpriseLicenseBanner } from "@/components/dashboard/enterprise-license-banner"

export function AccountInfrastructureView() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [initializingSchema, setInitializingSchema] = useState(false)
  const [hasLicense, setHasLicense] = useState(false)
  const [showStandaloneForm, setShowStandaloneForm] = useState(false)

  const [databaseUrl, setDatabaseUrl] = useState("")
  const [endpoint, setEndpoint] = useState("")
  const [bucket, setBucket] = useState("")
  const [accessKey, setAccessKey] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [publicUrl, setPublicUrl] = useState("")
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  // The form must be tested successfully, with no edits since, before
  // "Simpan" is enabled — see handleTest()/markDirty().
  const [tested, setTested] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [savedDatabaseUrl, setSavedDatabaseUrl] = useState("")

  const fetchInfra = async () => {
    try {
      const res = await fetch("/api/auth/user/infrastructure")
      if (res.ok) {
        const data = await res.json()
        setHasLicense(Boolean(data.hasLicense))
        setDatabaseUrl(data.databaseUrl || "")
        setSavedDatabaseUrl(data.databaseUrl || "")
        setEndpoint(data.endpoint || "")
        setBucket(data.bucket || "")
        setAccessKey(data.accessKey || "")
        setSecretKey(data.secretKey || "")
        setPublicUrl(data.publicUrl || "")
        setShowStandaloneForm(Boolean(data.databaseUrl || data.endpoint))
      }
    } catch {
      toast.error("Gagal memuat konfigurasi infrastruktur akun")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInfra()
  }, [])

  // Any edit after a successful test invalidates it — "Simpan" must always
  // reflect a test that actually ran against the values about to be saved.
  const markDirty = () => {
    if (tested || testError) {
      setTested(false)
      setTestError(null)
    }
  }

  const reveal = async (field: "databaseUrl" | "accessKey" | "secretKey", setter: (v: string) => void) => {
    if (revealed[field]) {
      setRevealed((r) => ({ ...r, [field]: false }))
      await fetchInfra()
      return
    }
    try {
      const res = await fetch(`/api/auth/user/infrastructure?reveal=${field}`)
      if (!res.ok) throw new Error("reveal failed")
      const data = await res.json()
      setter(data.value ?? "")
      setRevealed((r) => ({ ...r, [field]: true }))
    } catch {
      toast.error("Gagal mengambil nilai rahasia")
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestError(null)
    try {
      const res = await fetch("/api/auth/user/infrastructure?dryRun=true", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseUrl, endpoint, bucket, accessKey, secretKey, publicUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setTested(true)
        toast.success("Koneksi berhasil diuji — silakan simpan.")
      } else {
        setTested(false)
        setTestError(data.error || "Koneksi gagal diuji.")
      }
    } catch {
      setTested(false)
      setTestError("Terjadi kesalahan saat menguji koneksi.")
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!tested) {
      toast.error("Uji koneksi terlebih dahulu sebelum menyimpan.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/auth/user/infrastructure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseUrl, endpoint, bucket, accessKey, secretKey, publicUrl }),
      })
      if (res.ok) {
        toast.success("Konfigurasi infrastruktur akun berhasil disimpan! Berlaku untuk semua workspace Anda.")
        setRevealed({})
        setTested(false)
        await fetchInfra()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Gagal menyimpan konfigurasi")
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan")
    } finally {
      setSaving(false)
    }
  }

  const handleRevertToManaged = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/auth/user/infrastructure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseUrl: "", endpoint: "", bucket: "", accessKey: "", secretKey: "", publicUrl: "" }),
      })
      if (res.ok) {
        toast.success("Kembali menggunakan infrastruktur SaCMS (Terkelola) untuk semua workspace.")
        setDatabaseUrl(""); setSavedDatabaseUrl(""); setEndpoint(""); setBucket(""); setAccessKey(""); setSecretKey(""); setPublicUrl("")
        setShowStandaloneForm(false)
        setRevealed({})
        setTested(false)
        setTestError(null)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Gagal beralih ke infrastruktur SaCMS")
      }
    } catch {
      toast.error("Terjadi kesalahan saat beralih")
    } finally {
      setSaving(false)
    }
  }

  const handleInitSchema = async () => {
    setInitializingSchema(true)
    try {
      const res = await fetch("/api/auth/user/infrastructure/init-schema", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success("Skema database berhasil diinisialisasi. Workspace Anda sudah bisa memakai database ini.")
      } else {
        toast.error(data.error || "Gagal menginisialisasi skema")
      }
    } catch {
      toast.error("Terjadi kesalahan saat menginisialisasi skema")
    } finally {
      setInitializingSchema(false)
    }
  }

  const hasDedicated = Boolean(databaseUrl || endpoint)
  const schemaReady = Boolean(savedDatabaseUrl) && databaseUrl === savedDatabaseUrl

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Database &amp; Storage</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Konfigurasi di sini berlaku untuk akun Anda — semua workspace yang Anda miliki otomatis menggunakannya. Workspace yang tidak Anda setup sendiri tetap memakai infrastruktur SaCMS.
        </p>
      </div>

      <EnterpriseLicenseBanner scope="user" />

      {loading ? (
        <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-5 w-72 rounded-md" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </CardContent>
        </Card>
      ) : !hasLicense ? (
        <Card className="rounded-2xl border border-border/80 bg-card/60 shadow-xs">
          <CardContent className="p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-muted/80 border border-border/80 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Setup database &amp; storage standalone (VPS/server milik Anda sendiri) adalah fitur khusus pemegang Lisensi Enterprise. Aktifkan lisensi di atas untuk membukanya.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="rounded-2xl border border-primary/30 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-primary/5">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Database &amp; Storage Standalone — Termasuk Lisensi Enterprise Anda
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Setup mandiri ke VPS/server milik Anda sendiri — tanpa biaya tambahan, tanpa menunggu tim IT SaCMS. Berlaku otomatis untuk semua workspace Anda.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center p-1 bg-muted/60 border border-border/80 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setShowStandaloneForm(false)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    !showStandaloneForm ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pakai SaCMS (Terkelola)
                </button>
                <button
                  type="button"
                  onClick={() => setShowStandaloneForm(true)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    showStandaloneForm ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Server Sendiri (Standalone)
                </button>
              </div>

              {!showStandaloneForm ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Konten dan media semua workspace Anda disimpan di infrastruktur bersama SaCMS Cloud — tidak perlu setup apa pun.
                  </p>
                  {hasDedicated && (
                    <Button onClick={handleRevertToManaged} disabled={saving} size="sm" variant="outline" className="rounded-xl h-8 text-xs font-bold">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                      Kembali ke SaCMS (Hapus Konfigurasi Standalone)
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="databaseUrl" className="text-xs font-semibold text-foreground">PostgreSQL Connection URL</Label>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => reveal("databaseUrl", setDatabaseUrl)}>
                        {revealed.databaseUrl ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                        {revealed.databaseUrl ? "Sembunyikan" : "Tampilkan"}
                      </Button>
                    </div>
                    <Input
                      id="databaseUrl"
                      type={revealed.databaseUrl ? "text" : "password"}
                      placeholder="postgresql://user:password@db.instansi.go.id:5432/sacms_db?sslmode=require"
                      value={databaseUrl}
                      onChange={(e) => { setDatabaseUrl(e.target.value); markDirty() }}
                      className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="endpoint" className="text-xs font-semibold text-foreground">MinIO/S3 Endpoint URL</Label>
                      <Input
                        id="endpoint"
                        placeholder="https://minio.instansi.go.id"
                        value={endpoint}
                        onChange={(e) => { setEndpoint(e.target.value); markDirty() }}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bucket" className="text-xs font-semibold text-foreground">Nama Bucket</Label>
                      <Input
                        id="bucket"
                        placeholder="nama-bucket-media"
                        value={bucket}
                        onChange={(e) => { setBucket(e.target.value); markDirty() }}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="accessKey" className="text-xs font-semibold text-foreground">Access Key ID</Label>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => reveal("accessKey", setAccessKey)}>
                          {revealed.accessKey ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {revealed.accessKey ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <Input
                        id="accessKey"
                        type={revealed.accessKey ? "text" : "password"}
                        placeholder="AKIA..."
                        value={accessKey}
                        onChange={(e) => { setAccessKey(e.target.value); markDirty() }}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="secretKey" className="text-xs font-semibold text-foreground">Secret Access Key</Label>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => reveal("secretKey", setSecretKey)}>
                          {revealed.secretKey ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {revealed.secretKey ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <Input
                        id="secretKey"
                        type={revealed.secretKey ? "text" : "password"}
                        placeholder="••••••••••••"
                        value={secretKey}
                        onChange={(e) => { setSecretKey(e.target.value); markDirty() }}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="publicUrl" className="text-xs font-semibold text-foreground">Public CDN Base URL</Label>
                    <Input
                      id="publicUrl"
                      placeholder="https://media.instansi.go.id"
                      value={publicUrl}
                      onChange={(e) => { setPublicUrl(e.target.value); markDirty() }}
                      className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                    />
                  </div>

                  {testError && (
                    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{testError}</span>
                    </div>
                  )}
                  {tested && !testError && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Koneksi berhasil diuji — siap disimpan.</span>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    Isi salah satu saja jika hanya ingin memindahkan satu bagian (database atau storage). "Simpan" baru aktif setelah koneksi berhasil diuji dengan nilai yang sama persis — ubah field apa pun akan meminta uji ulang.
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleTest}
                      disabled={testing || (!databaseUrl && !endpoint)}
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-9 text-xs font-bold gap-1.5"
                    >
                      {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                      {testing ? "Menguji Koneksi..." : "Uji Koneksi"}
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving || !tested}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs gap-1.5 disabled:opacity-40"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {saving ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schema init — only relevant once a database connection is saved */}
          {savedDatabaseUrl && schemaReady && (
            <Card className="rounded-2xl border border-amber-500/30 shadow-xs bg-card overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-border/60 bg-amber-500/5">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Langkah Terakhir: Inisialisasi Skema Database
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Database baru masih kosong — jalankan ini sekali untuk membuat seluruh tabel yang SaCMS butuhkan, sebelum workspace Anda mulai memakainya.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={initializingSchema} size="sm" className="rounded-xl h-9 text-xs font-bold gap-1.5 bg-amber-600 hover:bg-amber-600/90 text-white">
                      {initializingSchema ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
                      {initializingSchema ? "Menginisialisasi..." : "Inisialisasi Skema Sekarang"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl border-border/80 shadow-xl bg-card max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-base font-bold">Inisialisasi Skema Database?</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                        Tindakan ini membuat seluruh tabel SaCMS di database yang Anda hubungkan. <strong className="text-foreground">Hanya aman dijalankan pada database yang masih baru/kosong.</strong> Jika database ini sudah berisi data lain yang tidak kompatibel, proses akan ditolak otomatis demi keamanan data Anda.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
                      <AlertDialogCancel className="rounded-xl text-xs font-bold h-9">Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={handleInitSchema} className="bg-amber-600 hover:bg-amber-600/90 text-white rounded-xl text-xs font-bold h-9">
                        Ya, Inisialisasi
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}

          {/* Usage instructions — the two setup pathways */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground">Cara Penggunaan</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Ada dua cara menyiapkan server/VPS, database, dan storage standalone Anda sendiri.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2">
                  <p className="text-xs font-bold text-foreground">1. Dibantu Tim SaCMS</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Tim kami menyiapkan VPS, database PostgreSQL, dan storage MinIO untuk Anda dari awal sampai siap pakai — termasuk mengisi field di atas dan inisialisasi skema. Cocok jika Anda tidak punya tim IT sendiri.
                  </p>
                  <a href="mailto:legal@sacms.cloud?subject=Permintaan%20Setup%20Database%20%26%20Storage%20Standalone">
                    <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-xl border-border mt-1">
                      <ExternalLink className="w-3 h-3 mr-1.5" />
                      Hubungi Tim SaCMS
                    </Button>
                  </a>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2">
                  <p className="text-xs font-bold text-foreground">2. Tim IT Anda Sendiri</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Tim IT instansi Anda menyiapkan server sendiri mengikuti persyaratan teknis di bawah, lalu mengisi field di atas dan menjalankan "Uji Koneksi" dan "Inisialisasi Skema" sendiri — sepenuhnya mandiri, tanpa menunggu tim SaCMS.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">Persyaratan Teknis (untuk Tim IT Anda)</p>
                <ul className="text-[11px] text-muted-foreground leading-relaxed space-y-1.5 list-disc pl-4">
                  <li>
                    <strong className="text-foreground">Database:</strong> PostgreSQL 14+ yang dapat diakses dari internet publik (bukan localhost/IP privat — koneksi ditolak sistem jika tidak). Siapkan database kosong/baru khusus untuk SaCMS; tabel akan dibuat otomatis lewat tombol "Inisialisasi Skema" di atas, tidak perlu diisi manual.
                  </li>
                  <li>
                    <strong className="text-foreground">Storage:</strong> Endpoint S3-compatible (MinIO, atau layanan object storage lain) yang juga dapat diakses dari internet publik, dengan satu bucket khusus untuk media SaCMS. "Public CDN Base URL" opsional — jika dikosongkan, media tetap bisa diakses lewat proxy SaCMS walau bucket privat.
                  </li>
                  <li>
                    <strong className="text-foreground">VPS/Server:</strong> boleh menggunakan penyedia mana pun yang bisa menjalankan PostgreSQL dan MinIO sendiri — misalnya <strong className="text-foreground">Biznet Gio</strong> (penyedia cloud lokal Indonesia) atau penyedia VPS lain yang Anda percaya. SaCMS tidak mewajibkan penyedia tertentu.
                  </li>
                  <li>
                    Setelah connection string & kredensial diisi, klik <strong className="text-foreground">"Uji Koneksi"</strong> — baru setelah berhasil, tombol "Simpan" aktif.
                  </li>
                  <li>
                    Setelah tersimpan, jalankan <strong className="text-foreground">"Inisialisasi Skema Sekarang"</strong> satu kali (hanya untuk database baru/kosong) sebelum workspace Anda mulai memakainya.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
