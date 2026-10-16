"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Database, Loader2, Save, Eye, EyeOff, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { EnterpriseLicenseBanner } from "@/components/dashboard/enterprise-license-banner"

export function AccountInfrastructureView() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasLicense, setHasLicense] = useState(false)
  const [showStandaloneForm, setShowStandaloneForm] = useState(false)

  const [databaseUrl, setDatabaseUrl] = useState("")
  const [endpoint, setEndpoint] = useState("")
  const [bucket, setBucket] = useState("")
  const [accessKey, setAccessKey] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [publicUrl, setPublicUrl] = useState("")
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  const fetchInfra = async () => {
    try {
      const res = await fetch("/api/auth/user/infrastructure")
      if (res.ok) {
        const data = await res.json()
        setHasLicense(Boolean(data.hasLicense))
        setDatabaseUrl(data.databaseUrl || "")
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

  const handleSave = async () => {
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
        setDatabaseUrl(""); setEndpoint(""); setBucket(""); setAccessKey(""); setSecretKey(""); setPublicUrl("")
        setShowStandaloneForm(false)
        setRevealed({})
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

  const hasDedicated = Boolean(databaseUrl || endpoint)

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
                    onChange={(e) => setDatabaseUrl(e.target.value)}
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
                      onChange={(e) => setEndpoint(e.target.value)}
                      className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bucket" className="text-xs font-semibold text-foreground">Nama Bucket</Label>
                    <Input
                      id="bucket"
                      placeholder="nama-bucket-media"
                      value={bucket}
                      onChange={(e) => setBucket(e.target.value)}
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
                      onChange={(e) => setAccessKey(e.target.value)}
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
                      onChange={(e) => setSecretKey(e.target.value)}
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
                    onChange={(e) => setPublicUrl(e.target.value)}
                    className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                  />
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Sistem akan menguji koneksi ke database &amp; storage ini sebelum menyimpan — isi salah satu saja jika hanya ingin memindahkan satu bagian. Berlaku otomatis untuk setiap workspace yang belum diset up sendiri secara khusus.
                </p>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs gap-1.5"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {saving ? "Menguji Koneksi & Menyimpan..." : "Uji Koneksi & Simpan"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
