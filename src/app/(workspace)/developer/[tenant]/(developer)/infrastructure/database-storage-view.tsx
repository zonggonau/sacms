"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Server,
  Database,
  Upload,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Cpu,
  HardDrive,
  Lock,
  Save,
  Zap,
  ArrowRight,
  Sparkles,
  Layers,
  Check,
  X,
  HelpCircle,
  ExternalLink,
  Sliders,
  ShieldCheck,
  Network,
  CloudLightning,
  Settings2,
  Play,
  Square,
  Power,
  Rocket,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function DatabaseStorageView({ tenantSlug }: { tenantSlug: string }) {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tenantSettings, setTenantSettings] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "console">("overview")

  // BYODB & BYOS State
  const [databaseUrl, setDatabaseUrl] = useState("")
  const [storageEndpoint, setStorageEndpoint] = useState("")
  const [storageAccessKey, setStorageAccessKey] = useState("")
  const [storageSecretKey, setStorageSecretKey] = useState("")
  const [storageBucket, setStorageBucket] = useState("")
  const [storagePublicUrl, setStoragePublicUrl] = useState("")

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/auth/login")
    }
  }, [authStatus, router])

  const fetchInfrastructure = async () => {
    if (!tenantSlug) return
    try {
      const settingsRes = await fetch(`/api/tenant/${tenantSlug}/settings`)

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        const s = settingsData.settings || {}
        setTenantSettings(s)
        const dbUrl = s.databaseUrl || ""
        setDatabaseUrl(dbUrl)
        if (s.storageConfig) {
          setStorageEndpoint(s.storageConfig.endpoint || "")
          setStorageAccessKey(s.storageConfig.accessKey || "")
          setStorageSecretKey(s.storageConfig.secretKey || "")
          setStorageBucket(s.storageConfig.bucket || "")
          setStoragePublicUrl(s.storageConfig.publicUrl || "")
        }

        // Open the connection settings for a workspace that already uses its own database
        const hasActiveDedicated = Boolean(dbUrl && dbUrl.trim() !== "")
        setActiveTab(hasActiveDedicated ? "console" : "overview")
      }
    } catch {
      toast.error("Gagal memuat konfigurasi infrastruktur")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantSlug && session?.user) {
      fetchInfrastructure()
    }
  }, [tenantSlug, session])

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseUrl: databaseUrl.trim() === "" ? null : databaseUrl.trim(),
          storageConfig:
            storageEndpoint && storageAccessKey && storageSecretKey && storageBucket
              ? {
                  endpoint: storageEndpoint,
                  accessKey: storageAccessKey,
                  secretKey: storageSecretKey,
                  bucket: storageBucket,
                  publicUrl: storagePublicUrl,
                }
              : null,
        }),
      })

      if (res.ok) {
        toast.success("Konfigurasi infrastruktur berhasil disimpan!")
        fetchInfrastructure()
      } else {
        const data = await res.json()
        toast.error(data.error || "Gagal menyimpan konfigurasi")
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan")
    } finally {
      setSaving(false)
    }
  }

  const hasDedicated = Boolean(databaseUrl && databaseUrl.trim() !== "")
  // Connections are set by the SaCMS IT team after the customer orders the managed service.
  const isSuperAdmin = session?.user?.role === "super_admin"

  const [managedInfra, setManagedInfra] = useState<{ status: string; paidUntil: string } | null>(null)
  useEffect(() => {
    if (!tenantSlug || !session?.user) return
    fetch(`/api/tenant/${tenantSlug}/billing/services`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setManagedInfra(data?.managedInfra ?? null))
      .catch(() => {})
  }, [tenantSlug, session])

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-72 rounded-md" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-96 max-w-full rounded-md mt-2" />
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                      <Skeleton className="h-3 w-28 rounded-md" />
                      <Skeleton className="h-5 w-40 rounded-md" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black tracking-tight text-foreground">
                  Database &amp; Storage
                </h2>
                {hasDedicated ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold rounded-full flex items-center gap-1.5 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Database Sendiri (BYODB)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-bold rounded-full flex items-center gap-1.5 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Shared Multi-Tenant Pool
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-3xl">
                {hasDedicated 
                  ? "Workspace Anda memakai database PostgreSQL milik sendiri (BYODB)." 
                  : "Workspace Anda memakai database dan storage bersama SaCMS dengan isolasi logis tingkat tenant."
                }
              </p>
            </div>

            {/* Top Action Controls & Tab Switcher */}
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
              <div className="flex items-center p-1 bg-muted/60 border border-border/80 rounded-xl">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "overview"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Status
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("console")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "console"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" />
                    Database & Storage Sendiri
                  </span>
                </button>
              </div>
              )}

              {isSuperAdmin && activeTab === "console" && (
                <Button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs cursor-pointer gap-1.5"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Simpan
                </Button>
              )}

            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: DATABASE & STORAGE STATUS                                   */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {(activeTab === "overview" || !isSuperAdmin) && (
            <div className="space-y-8 animate-in fade-in-50 duration-300">
              
              {/* Active Shared Cluster Status Overview Card */}
              <Card className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs shadow-xs overflow-hidden">
                <CardHeader className="p-5 pb-3 bg-muted/20 border-b border-border/60">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Server className="h-4 w-4 text-emerald-500" />
                      Status Lingkungan Database Aktif
                    </CardTitle>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> {hasDedicated ? "Database Sendiri" : "Shared Pool Beroperasi Normal"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tipe Database</span>
                      <p className="text-xs font-bold text-foreground">
                        {hasDedicated ? "PostgreSQL Milik Sendiri" : "PostgreSQL 17 Bersama"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {hasDedicated ? "Bring Your Own Database" : "Shared Multi-Tenant Engine"}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Object Storage</span>
                      <p className="text-xs font-bold text-foreground">
                        {storageEndpoint ? "S3 Milik Sendiri (BYOS)" : "Storage Bersama SaCMS"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Kuota dihitung per workspace</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Isolasi Keamanan</span>
                      <p className="text-xs font-bold text-foreground">
                        {hasDedicated ? "Database Terpisah" : "Tenant Logical Scoping"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Enkripsi Data In-Transit & At-Rest</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Alokasi Resource</span>
                      <p className="text-xs font-bold text-foreground">
                        Shared Pool SaCMS
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Aplikasi dan API SaCMS bersama
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Database & Storage Sendiri — Layanan Terkelola
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Tim IT SaCMS menyiapkan server PostgreSQL dan storage khusus untuk workspace ini lalu menyambungkannya.
                    Media di storage sendiri tidak dihitung dalam kuota storage SaCMS.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  <p className="text-xs text-foreground">
                    <span className="font-bold">Rp2.500.000</span> biaya setup sekali + <span className="font-bold">Rp1.000.000/bulan</span> (bulan pertama dibayar saat memesan).
                  </p>
                  {managedInfra ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <p className="text-muted-foreground">
                        Status: <span className="font-bold text-foreground">{({ awaiting_setup: "Menunggu setup tim IT SaCMS", active: "Aktif", expired: "Kedaluwarsa", cancelled: "Dibatalkan" } as Record<string, string>)[managedInfra.status] ?? managedInfra.status}</span>
                        {" · "}dibayar sampai {new Date(managedInfra.paidUntil).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      {managedInfra.status !== "cancelled" && (
                        <Button asChild size="sm" className="rounded-xl h-8 text-xs">
                          <Link href={`/developer/${tenantSlug}/subscriptions/checkout?plan=managed_byodb_monthly`}>Perpanjang 1 Bulan</Link>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button asChild size="sm" className="rounded-xl h-8 text-xs">
                      <Link href={`/developer/${tenantSlug}/subscriptions/checkout?plan=managed_byodb_setup`}>Pesan Layanan</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: BRING YOUR OWN DATABASE / STORAGE (SaCMS IT team only)      */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {isSuperAdmin && activeTab === "console" && (
            <div className="space-y-6 animate-in fade-in-50 duration-300">
              
              {/* BYODB: Custom PostgreSQL Connection */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Koneksi Basis Data Sendiri (Bring Your Own Database / BYODB)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Hubungkan instance PostgreSQL eksternal milik instansi Anda untuk menyimpan seluruh konten dan skema secara terisolasi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="databaseUrl" className="text-xs font-semibold text-foreground">PostgreSQL Connection URL</Label>
                    <Input
                      id="databaseUrl"
                      type="password"
                      placeholder="postgresql://user:password@db.perusahaan.com:5432/tenant_db?sslmode=require"
                      value={databaseUrl}
                      onChange={(e) => setDatabaseUrl(e.target.value)}
                      className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Kosongkan nilai ini dan simpan jika ingin kembali menggunakan cluster database bersama (Shared Pool) default dari SaCMS Cloud.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* BYOS: Custom S3 Storage */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    Koneksi Storage S3 Sendiri (Bring Your Own Storage / BYOS)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Simpan seluruh unggahan media secara mandiri ke bucket AWS S3, Cloudflare R2, MinIO, atau Google Cloud Storage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="storageEndpoint" className="text-xs font-semibold text-foreground">S3 Endpoint URL</Label>
                      <Input
                        id="storageEndpoint"
                        placeholder="https://s3.ap-southeast-1.amazonaws.com"
                        value={storageEndpoint}
                        onChange={(e) => setStorageEndpoint(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="storageBucket" className="text-xs font-semibold text-foreground">Nama Bucket S3</Label>
                      <Input
                        id="storageBucket"
                        placeholder="nama-bucket-media"
                        value={storageBucket}
                        onChange={(e) => setStorageBucket(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="storageAccessKey" className="text-xs font-semibold text-foreground">Access Key ID</Label>
                      <Input
                        id="storageAccessKey"
                        placeholder="AKIA..."
                        value={storageAccessKey}
                        onChange={(e) => setStorageAccessKey(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="storageSecretKey" className="text-xs font-semibold text-foreground">Secret Access Key</Label>
                      <Input
                        id="storageSecretKey"
                        type="password"
                        placeholder="••••••••••••"
                        value={storageSecretKey}
                        onChange={(e) => setStorageSecretKey(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="storagePublicUrl" className="text-xs font-semibold text-foreground">Public CDN Base URL</Label>
                    <Input
                      id="storagePublicUrl"
                      placeholder="https://media.perusahaan.com"
                      value={storagePublicUrl}
                      onChange={(e) => setStoragePublicUrl(e.target.value)}
                      className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                    />
                  </div>
                </CardContent>
              </Card>

            </div>
          )}

    </div>
  )
}
