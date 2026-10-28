"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Server, Database, HardDrive, Save, Trash2, Loader2, CheckCircle2, XCircle, Lock, PlugZap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { StorageAllocationSection } from "@/components/dashboard/enterprise-license-banner"

type TabKey = "database" | "storage"

const MASK = "••••••••"

interface NavItem {
  key: TabKey
  label: string
  description: string
  icon: typeof Server
}

const NAV_ITEMS: NavItem[] = [
  { key: "database", label: "Database", description: "PostgreSQL milik Anda sendiri (BYODB)", icon: Database },
  { key: "storage", label: "Storage", description: "MinIO/S3 milik Anda sendiri (BYOS) & alokasi per workspace", icon: HardDrive },
]

type TestResult = { status: "idle" | "success" | "error"; message?: string }

function InfrastructureShell() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const urlTab = searchParams.get("tab")

  const [tab, setTab] = useState<TabKey>(() => (urlTab === "storage" ? "storage" : "database"))

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set("tab", tab)
    window.history.replaceState({}, "", url.toString())
  }, [tab])

  const [loading, setLoading] = useState(true)
  const [eligible, setEligible] = useState(true)
  const [savingDb, setSavingDb] = useState(false)
  const [savingStorage, setSavingStorage] = useState(false)
  const [testingDb, setTestingDb] = useState(false)
  const [testingStorage, setTestingStorage] = useState(false)
  const [dbTestResult, setDbTestResult] = useState<TestResult>({ status: "idle" })
  const [storageTestResult, setStorageTestResult] = useState<TestResult>({ status: "idle" })

  const [dbUrl, setDbUrl] = useState("")
  const [endpoint, setEndpoint] = useState("")
  const [accessKey, setAccessKey] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [bucket, setBucket] = useState("")

  useEffect(() => {
    setLoading(true)
    fetch("/api/user/infrastructure")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        setEligible(data.eligible !== false)
        setDbUrl(data.masterDatabaseUrl || "")
        if (data.masterStorageConfig) {
          setEndpoint(data.masterStorageConfig.endpoint || "")
          setAccessKey(data.masterStorageConfig.accessKey || "")
          setSecretKey(data.masterStorageConfig.secretKey || "")
          setBucket(data.masterStorageConfig.bucket || "")
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const saveDatabaseUrl = async (value: string | null) => {
    setSavingDb(true)
    try {
      const res = await fetch("/api/user/infrastructure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterDatabaseUrl: value }),
      })
      const body = await res.json()
      if (res.ok) {
        setDbUrl(value || "")
        setDbTestResult({ status: "idle" })
        toast({ title: value ? "Tersimpan" : "Dihapus", description: value ? "URL database berhasil disimpan." : "Database kustom dihapus — workspace kembali ke pool bersama SaCMS." })
      } else {
        toast({ variant: "destructive", title: "Gagal Menyimpan", description: body.error || "Gagal menyimpan URL database." })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal menyimpan URL database." })
    } finally {
      setSavingDb(false)
    }
  }

  const saveStorageConfig = async (
    value: { endpoint: string; accessKey: string; secretKey: string; bucket: string } | null
  ) => {
    setSavingStorage(true)
    try {
      const res = await fetch("/api/user/infrastructure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterStorageConfig: value }),
      })
      const body = await res.json()
      if (res.ok) {
        if (!value) {
          setEndpoint("")
          setAccessKey("")
          setSecretKey("")
          setBucket("")
        }
        setStorageTestResult({ status: "idle" })
        toast({ title: value ? "Tersimpan" : "Dihapus", description: value ? "Konfigurasi storage MinIO berhasil disimpan." : "Storage kustom dihapus — workspace kembali ke pool bersama SaCMS." })
      } else {
        toast({ variant: "destructive", title: "Gagal Menyimpan", description: body.error || "Gagal menyimpan konfigurasi storage." })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal menyimpan konfigurasi storage." })
    } finally {
      setSavingStorage(false)
    }
  }

  const handleSaveDb = () => {
    const trimmed = dbUrl.trim()
    saveDatabaseUrl(trimmed === "" ? null : trimmed)
  }

  const handleSaveStorage = () => {
    if (!endpoint.trim() || !accessKey.trim() || !secretKey.trim() || !bucket.trim()) {
      toast({ variant: "destructive", title: "Form Belum Lengkap", description: "Isi Endpoint, Access Key, Secret Key, dan Bucket." })
      return
    }
    saveStorageConfig({ endpoint: endpoint.trim(), accessKey: accessKey.trim(), secretKey, bucket: bucket.trim() })
  }

  const handleTestDb = async () => {
    if (!dbUrl.trim() || dbUrl === MASK) return
    setTestingDb(true)
    setDbTestResult({ status: "idle" })
    try {
      const res = await fetch("/api/user/infrastructure/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "database", url: dbUrl.trim() }),
      })
      const body = await res.json()
      setDbTestResult({ status: res.ok && body.success ? "success" : "error", message: body.message || body.error })
    } catch {
      setDbTestResult({ status: "error", message: "Gagal menghubungi server untuk tes koneksi." })
    } finally {
      setTestingDb(false)
    }
  }

  const handleTestStorage = async () => {
    if (!endpoint.trim() || !accessKey.trim() || !secretKey.trim() || !bucket.trim()) {
      toast({ variant: "destructive", title: "Form Belum Lengkap", description: "Isi Endpoint, Access Key, Secret Key, dan Bucket sebelum tes koneksi." })
      return
    }
    setTestingStorage(true)
    setStorageTestResult({ status: "idle" })
    try {
      const res = await fetch("/api/user/infrastructure/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "storage",
          config: { endpoint: endpoint.trim(), accessKey: accessKey.trim(), secretKey, bucket: bucket.trim() },
        }),
      })
      const body = await res.json()
      setStorageTestResult({ status: res.ok && body.success ? "success" : "error", message: body.message || body.error })
    } catch {
      setStorageTestResult({ status: "error", message: "Gagal menghubungi server untuk tes koneksi." })
    } finally {
      setTestingStorage(false)
    }
  }

  const TestResultBadge = ({ result }: { result: TestResult }) => {
    if (result.status === "idle") return null
    const ok = result.status === "success"
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs",
          ok
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
        )}
      >
        {ok ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
        <span>{result.message || (ok ? "Koneksi berhasil." : "Koneksi gagal.")}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full min-h-[calc(100vh-4rem)] bg-background">
      {/* Top Banner Header */}
      <div className="border-b border-border/70 bg-card/40 backdrop-blur-xs px-4 md:px-6 lg:px-8 py-5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl lg:text-2xl font-black tracking-tight text-foreground">Infrastruktur</h1>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-primary border-primary/30 bg-primary/5">
                  Enterprise &amp; Agency
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hubungkan database PostgreSQL dan storage MinIO milik Anda sendiri (VPS), lalu atur alokasi storage per workspace.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Horizontal Navigation Bar */}
      <div className="border-b border-border/70 bg-card/25 px-4 md:px-6 lg:px-8 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center gap-1.5 py-2.5 overflow-x-auto scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const active = tab === item.key
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer group",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full max-w-md rounded-xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            {!eligible && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-700 dark:text-amber-400">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Database &amp; storage sendiri khusus plan <strong>Enterprise</strong> atau <strong>Agency</strong>. Anda tetap bisa menghapus konfigurasi lama di bawah, tapi tidak bisa menyimpan atau menguji yang baru sampai upgrade plan.
                </span>
              </div>
            )}

            {/* Tab: Database */}
            <div hidden={tab !== "database"}>
              <Card className="rounded-2xl border-border/80 shadow-xs">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Database PostgreSQL Sendiri</CardTitle>
                  <CardDescription className="text-xs">
                    Semua workspace yang Anda miliki akan memakai database ini sebagai pengganti pool bersama SaCMS.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">URL Database PostgreSQL</Label>
                    <Input
                      type="text"
                      placeholder="postgresql://user:password@host:5432/dbname"
                      value={dbUrl}
                      onChange={(e) => {
                        setDbUrl(e.target.value)
                        setDbTestResult({ status: "idle" })
                      }}
                      className="font-mono text-xs"
                      disabled={savingDb || testingDb}
                    />
                  </div>

                  <TestResultBadge result={dbTestResult} />

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => saveDatabaseUrl(null)} disabled={savingDb || dbUrl === ""}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Hapus
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestDb}
                      disabled={testingDb || !dbUrl.trim() || dbUrl === MASK || !eligible}
                    >
                      {testingDb ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5 mr-1.5" />}
                      Tes Koneksi
                    </Button>
                    <Button size="sm" onClick={handleSaveDb} disabled={savingDb || dbUrl === MASK || !eligible}>
                      {savingDb ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                      Simpan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tab: Storage */}
            <div hidden={tab !== "storage"} className="space-y-6">
              <Card className="rounded-2xl border-border/80 shadow-xs">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Storage MinIO Sendiri</CardTitle>
                  <CardDescription className="text-xs">
                    Semua workspace yang Anda miliki akan memakai storage ini sebagai pengganti pool bersama SaCMS.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs font-bold">Endpoint MinIO</Label>
                      <Input
                        placeholder="https://minio.domain-anda.com"
                        value={endpoint}
                        onChange={(e) => {
                          setEndpoint(e.target.value)
                          setStorageTestResult({ status: "idle" })
                        }}
                        className="text-xs"
                        disabled={savingStorage || testingStorage}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Access Key</Label>
                      <Input value={accessKey} onChange={(e) => setAccessKey(e.target.value)} className="text-xs" disabled={savingStorage || testingStorage} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Secret Key</Label>
                      <Input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} className="text-xs" disabled={savingStorage || testingStorage} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs font-bold">Nama Bucket</Label>
                      <Input value={bucket} onChange={(e) => setBucket(e.target.value)} className="text-xs" disabled={savingStorage || testingStorage} />
                    </div>
                  </div>

                  <TestResultBadge result={storageTestResult} />

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => saveStorageConfig(null)} disabled={savingStorage || !endpoint}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Hapus
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleTestStorage} disabled={testingStorage || !eligible}>
                      {testingStorage ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5 mr-1.5" />}
                      Tes Koneksi
                    </Button>
                    <Button size="sm" onClick={handleSaveStorage} disabled={savingStorage || !eligible}>
                      {savingStorage ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                      Simpan
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/80 shadow-xs">
                <CardContent className="pt-5">
                  <StorageAllocationSection />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default function AccountInfrastructurePage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-10 w-full max-w-md rounded-xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      }
    >
      <InfrastructureShell />
    </Suspense>
  )
}
