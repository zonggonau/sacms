"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Globe,
  Plus,
  RefreshCw,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Server,
  ArrowRight,
  Info,
  Star,
  LayoutDashboard,
  FileText,
  Zap,
  Layout,
} from "lucide-react"
import { toast } from "sonner"
import { BuyDomainDialog } from "@/components/domains/buy-domain-dialog"
import { parseDomainInfo, getExpectedDnsRecords, ExpectedDnsRecord, DnsDiagnosticsResult } from "@/lib/domain-parser"

type DomainTarget = "cms" | "workspace" | "site" | "api"

const DOMAIN_TARGETS: { value: DomainTarget; label: string; desc: string; icon: React.ReactNode; example: string }[] = [
  {
    value: "cms",
    label: "CMS Content Manager",
    desc: "Langsung masuk ke manajer konten tenant",
    icon: <FileText className="h-3.5 w-3.5" />,
    example: "admin.domain.com → /cms",
  },
  {
    value: "workspace",
    label: "Workspace Hub",
    desc: "Langsung masuk ke dashboard workspace",
    icon: <LayoutDashboard className="h-3.5 w-3.5" />,
    example: "portal.domain.com → /workspace",
  },
  {
    value: "site",
    label: "Halaman Web Publik",
    desc: "Tampilkan halaman publik / frontend site",
    icon: <Layout className="h-3.5 w-3.5" />,
    example: "domain.com → /site",
  },
  {
    value: "api",
    label: "Headless API Gateway",
    desc: "Expose REST & GraphQL API publik tenant",
    icon: <Zap className="h-3.5 w-3.5" />,
    example: "api.domain.com → /api",
  },
]

interface DomainItem {
  id: string
  domain: string
  status: "verified" | "pending" | "failed"
  isPrimary?: boolean
  target?: DomainTarget
  verifiedAt?: string
  dnsRecords?: ExpectedDnsRecord[]
  dnsVerification?: {
    type: string
    name: string
    value: string
  }
}

export default function TenantDomainsPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string

  const [domains, setDomains] = useState<DomainItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newDomainInput, setNewDomainInput] = useState("")
  const [newDomainTarget, setNewDomainTarget] = useState<DomainTarget>("cms")
  const [addingDomain, setAddingDomain] = useState(false)
  const [verifyingMap, setVerifyingMap] = useState<Record<string, boolean>>({})
  const [diagnosticsMap, setDiagnosticsMap] = useState<Record<string, DnsDiagnosticsResult>>({})
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null)
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null)
  const [updatingTargetMap, setUpdatingTargetMap] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showBuyDialog, setShowBuyDialog] = useState(false)

  const livePreviewInfo = newDomainInput.trim() ? parseDomainInfo(newDomainInput.trim()) : null
  const livePreviewRecords = livePreviewInfo ? getExpectedDnsRecords(livePreviewInfo.domain, "tenant-id-preview") : []

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login")
    }
  }, [authStatus, router])

  const fetchDomains = async () => {
    if (!tenantSlug) return
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/white-label/domain`)
      if (res.ok) {
        const data = await res.json()
        setDomains(data.domains || [])
      } else {
        toast.error("Gagal memuat daftar domain kustom")
      }
    } catch {
      toast.error("Terjadi kesalahan saat memuat domain")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantSlug && session?.user) {
      fetchDomains()
    }
  }, [tenantSlug, session])

  const handleAddDomain = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const domain = newDomainInput.trim().toLowerCase()
    if (!domain) return

    setAddingDomain(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/white-label/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customDomain: domain, target: newDomainTarget }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(`Domain ${domain} berhasil ditambahkan dengan tujuan "${newDomainTarget}". Silakan atur DNS record di bawah.`)
        setNewDomainInput("")
        setNewDomainTarget("cms")
        await fetchDomains()
      } else {
        toast.error(data.error || "Gagal menambahkan domain")
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi saat menambahkan domain")
    } finally {
      setAddingDomain(false)
    }
  }

  const handleUpdateTarget = async (domainName: string, target: DomainTarget) => {
    setUpdatingTargetMap((prev) => ({ ...prev, [domainName]: true }))
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/white-label/domain`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customDomain: domainName, target }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Tujuan domain diperbarui ke "${target}".`)
        setDomains((prev) => prev.map((d) => d.domain === domainName ? { ...d, target } : d))
      } else {
        toast.error(data.error || "Gagal memperbarui tujuan domain")
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi")
    } finally {
      setUpdatingTargetMap((prev) => ({ ...prev, [domainName]: false }))
    }
  }

  const handleVerifyDns = async (domainName: string) => {
    setVerifyingMap((prev) => ({ ...prev, [domainName]: true }))
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/white-label/domain`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customDomain: domainName }),
      })

      const data = await res.json()
      if (res.ok && data.verified) {
        toast.success(`Domain ${domainName} berhasil diverifikasi dan aktif!`)
        if (data.diagnostics) {
          setDiagnosticsMap((prev) => ({ ...prev, [domainName]: data.diagnostics }))
        }
        await fetchDomains()
      } else {
        if (data.diagnostics) {
          setDiagnosticsMap((prev) => ({ ...prev, [domainName]: data.diagnostics }))
        }
        toast.error(data.diagnostics?.summaryMessage || data.error || "Konfigurasi DNS belum sesuai atau belum tersebar.")
      }
    } catch {
      toast.error("Gagal melakukan pengecekan DNS. Silakan coba beberapa saat lagi.")
    } finally {
      setVerifyingMap((prev) => ({ ...prev, [domainName]: false }))
    }
  }

  const handleSetPrimary = async (domainName: string) => {
    setSettingPrimary(domainName)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/white-label/domain`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customDomain: domainName, isPrimary: true }),
      })

      if (res.ok) {
        toast.success(`Domain ${domainName} ditetapkan sebagai domain utama.`)
        await fetchDomains()
      } else {
        const data = await res.json()
        toast.error(data.error || "Gagal mengubah domain utama")
      }
    } catch {
      toast.error("Terjadi kesalahan saat mengubah status domain")
    } finally {
      setSettingPrimary(null)
    }
  }

  const handleDeleteDomain = (domainName: string) => {
    toast(`Hapus domain ${domainName}?`, {
      description: "Routing API dan web via domain ini akan dinonaktifkan.",
      action: {
        label: "Hapus",
        onClick: async () => {
          setDeletingDomain(domainName)
          const toastId = toast.loading(`Menghapus domain ${domainName}...`)
          try {
            const res = await fetch(`/api/tenant/${tenantSlug}/white-label/domain`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ customDomain: domainName }),
            })

            if (res.ok) {
              toast.success(`Domain ${domainName} berhasil dihapus.`, { id: toastId })
              await fetchDomains()
            } else {
              const data = await res.json()
              toast.error(data.error || "Gagal menghapus domain", { id: toastId })
            }
          } catch {
            toast.error("Terjadi kesalahan saat menghapus domain", { id: toastId })
          } finally {
            setDeletingDomain(null)
          }
        },
      },
      cancel: {
        label: "Batal",
        onClick: () => {},
      },
    })
  }

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success("Tersalin ke clipboard!")
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col w-full animate-in fade-in duration-300">
        <div className="flex-1 bg-background text-foreground flex flex-col w-full">
          <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-8">
            
            {/* Header Feed */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-8 h-8 rounded-xl" />
                  <Skeleton className="h-8 w-56 rounded-xl" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-4 w-96 max-w-full rounded-md" />
              </div>

              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-32 rounded-xl" />
                <Skeleton className="h-9 w-36 rounded-xl" />
              </div>
            </div>

            {/* DNS Gateway Setup Guidance Card Feed */}
            <Card className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-xs overflow-hidden">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-md" />
                    <Skeleton className="h-5 w-72 rounded-md" />
                  </div>
                  <Skeleton className="h-5 w-28 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-96 max-w-full rounded-md mt-2" />
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-background/80 border space-y-2">
                    <Skeleton className="h-4 w-36 rounded-md" />
                    <Skeleton className="h-3.5 w-full rounded-md" />
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </div>
                  <div className="p-4 rounded-xl bg-background/80 border space-y-2">
                    <Skeleton className="h-4 w-36 rounded-md" />
                    <Skeleton className="h-3.5 w-full rounded-md" />
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Domains Table Feed */}
            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-44 rounded-md" />
                  <Skeleton className="h-3.5 w-64 rounded-md" />
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
              </CardHeader>
              <CardContent className="p-5 space-y-4 divide-y divide-border/50">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="h-5 w-48 rounded-md" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                      <Skeleton className="h-3.5 w-64 rounded-md" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-24 rounded-xl" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Globe className="h-4 w-4" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">
                  Domain Kustom (Custom Domains)
                </h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold rounded-full">
                  {domains.length} Domain
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Hubungkan nama domain institusi/perusahaan Anda (Apex Domain <code className="font-mono text-primary">@</code> atau Subdomain <code className="font-mono text-primary">CNAME</code>) untuk akses langsung ke REST/GraphQL API dan frontend CMS.
              </p>
            </div>

            <Button
              onClick={() => setShowBuyDialog(true)}
              className="rounded-xl h-9 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Beli Domain Baru
            </Button>
          </div>

          {/* Add Domain Card */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Hubungkan Domain Milik Sendiri (BYOD)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Masukkan domain utama (misal: <span className="font-mono font-semibold text-foreground">intanjayakab.go.id</span>) atau subdomain (misal: <span className="font-mono font-semibold text-foreground">dpr.intanjayakab.go.id</span>).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <form onSubmit={handleAddDomain} className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Contoh: admin.domainanda.go.id atau portal.perusahaan.com"
                      value={newDomainInput}
                      onChange={(e) => setNewDomainInput(e.target.value)}
                      className="rounded-xl h-10 text-xs bg-background border-border/80 font-mono pl-9"
                    />
                    <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Button
                    type="submit"
                    disabled={addingDomain || !newDomainInput.trim()}
                    className="rounded-xl h-10 px-5 text-xs font-bold bg-primary text-primary-foreground shadow-xs shrink-0"
                  >
                    {addingDomain ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                    Tambahkan Domain
                  </Button>
                </div>

                {/* Portal Target Selector */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">Tujuan Portal Domain</Label>
                  <p className="text-[11px] text-muted-foreground">Pilih ke mana pengunjung akan diarahkan saat membuka domain ini.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DOMAIN_TARGETS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setNewDomainTarget(t.value)}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                          newDomainTarget === t.value
                            ? "border-primary bg-primary/5 shadow-xs"
                            : "border-border/60 hover:border-border hover:bg-muted/40"
                        }`}
                      >
                        <span className={`mt-0.5 ${newDomainTarget === t.value ? "text-primary" : "text-muted-foreground"}`}>
                          {t.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-bold ${newDomainTarget === t.value ? "text-primary" : "text-foreground"}`}>{t.label}</div>
                          <div className="text-[11px] text-muted-foreground">{t.desc}</div>
                          <code className="text-[10px] text-muted-foreground/70 font-mono">{t.example}</code>
                        </div>
                        {newDomainTarget === t.value && (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              {/* Live Preview Type Detection */}
              {livePreviewInfo && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-primary" />
                      Tipe Terdeteksi:{" "}
                      <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 font-mono text-[10px]">
                        {livePreviewInfo.isApex ? "Apex / Root Domain (@)" : `Subdomain (${livePreviewInfo.subdomainPrefix})`}
                      </Badge>
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Root: {livePreviewInfo.rootDomain}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {livePreviewInfo.isApex
                      ? "Domain ini akan memerlukan A Record (@) mengarah ke IP Server Gateway SaCMS."
                      : `Domain ini akan memerlukan CNAME Record (${livePreviewInfo.subdomainPrefix}) mengarah ke Edge Host SaCMS.`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connected Domains List & View Mode Switcher */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                Daftar Domain Terhubung ({domains.length})
              </h2>

              {domains.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allText = domains.flatMap(dom => {
                        const recs = getExpectedDnsRecords(dom.domain, session?.user?.id || "tenant")
                        return recs.map(r => `${r.type}\t${r.name}\t${r.value}\t${r.ttl}\t# ${dom.domain} (${r.description})`)
                      }).join("\n")
                      copyText(allText, "all-unified-records")
                    }}
                    className="rounded-xl h-8 px-3 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {copiedId === "all-unified-records" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Salin Semua Record DNS
                  </Button>
                </div>
              )}
            </div>

            {/* UNIFIED ALL-IN-ONE DNS MASTER TABLE CARD */}
            {domains.length > 0 && (
              <Card className="rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-primary/5 via-card to-card shadow-sm overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Tabel DNS Terpadu (Seluruh Record dalam 1 Tabel)
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Salin dan masukkan seluruh baris record di bawah ini ke DNS Manager Anda (Cloudflare, cPanel, Domainesia, Niagahoster, dll.) sekaligus.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px] font-mono font-bold self-start sm:self-auto">
                      {domains.reduce((acc, d) => acc + getExpectedDnsRecords(d.domain, session?.user?.id || "tenant").length, 0)} Total Record
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border/60 font-semibold">
                        <tr>
                          <th className="p-3.5 pl-5">Domain Tujuan</th>
                          <th className="p-3.5">Type</th>
                          <th className="p-3.5">Name / Host</th>
                          <th className="p-3.5">Value / Target</th>
                          <th className="p-3.5">Keterangan</th>
                          <th className="p-3.5">TTL</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 pr-5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {domains.flatMap((dom, domIdx) => {
                          const expectedRecords = getExpectedDnsRecords(dom.domain, session?.user?.id || "tenant")
                          const diagnostics = diagnosticsMap[dom.domain]

                          return expectedRecords.map((rec, recIdx) => {
                            const diagRec = diagnostics?.records?.find((r) => r.type === rec.type)
                            const status = diagRec?.status || (dom.status === "verified" ? "valid" : "pending")
                            const rowId = `unified-${dom.id}-${recIdx}`

                            return (
                              <tr key={rowId} className="hover:bg-muted/30 transition-colors">
                                <td className="p-3.5 pl-5 font-mono font-bold text-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <Globe className="h-3 w-3 text-primary shrink-0" />
                                    <span>{dom.domain}</span>
                                    {dom.isPrimary && (
                                      <Badge className="bg-primary/15 text-primary border-primary/20 text-[9px] font-bold px-1.5 py-0 h-4">
                                        Primary
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3.5 font-bold font-mono">
                                  <Badge
                                    variant="outline"
                                    className={`font-mono text-[11px] font-bold ${
                                      rec.type === "CNAME"
                                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                        : rec.type === "A"
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                        : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                    }`}
                                  >
                                    {rec.type}
                                  </Badge>
                                </td>
                                <td className="p-3.5 font-mono font-semibold text-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <span className="bg-muted px-1.5 py-0.5 rounded font-bold">{rec.name}</span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 rounded-md"
                                      onClick={() => copyText(rec.name, `uname-${rowId}`)}
                                    >
                                      {copiedId === `uname-${rowId}` ? (
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                      ) : (
                                        <Copy className="h-3 w-3 text-muted-foreground" />
                                      )}
                                    </Button>
                                  </div>
                                </td>
                                <td className="p-3.5 font-mono text-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <code className="bg-muted/70 px-2 py-0.5 rounded font-mono break-all">{rec.value}</code>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 rounded-md shrink-0"
                                      onClick={() => copyText(rec.value, `uval-${rowId}`)}
                                    >
                                      {copiedId === `uval-${rowId}` ? (
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                      ) : (
                                        <Copy className="h-3 w-3 text-muted-foreground" />
                                      )}
                                    </Button>
                                  </div>
                                </td>
                                <td className="p-3.5 text-[11px] text-muted-foreground max-w-[180px]">
                                  {rec.description}
                                </td>
                                <td className="p-3.5 text-muted-foreground font-mono">{rec.ttl}</td>
                                <td className="p-3.5">
                                  {status === "valid" ? (
                                    <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Valid
                                    </span>
                                  ) : status === "invalid" ? (
                                    <span className="inline-flex items-center text-rose-600 dark:text-rose-400 font-bold text-[11px]">
                                      <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Salah
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center text-muted-foreground text-[11px]">
                                      Menunggu
                                    </span>
                                  )}
                                </td>
                                <td className="p-3.5 pr-5 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[11px] font-bold rounded-lg border-border/80"
                                    onClick={() => copyText(`${rec.type}\t${rec.name}\t${rec.value}`, `urow-${rowId}`)}
                                  >
                                    {copiedId === `urow-${rowId}` ? "Tersalin" : "Salin Record"}
                                  </Button>
                                </td>
                              </tr>
                            )
                          })
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {domains.length === 0 ? (
              <Card className="rounded-2xl border border-dashed border-border/80 p-8 text-center bg-card">
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                    <Globe className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">Belum Ada Domain Kustom</h3>
                  <p className="text-xs text-muted-foreground">
                    Anda belum menghubungkan domain publik kustom. Tambahkan nama domain Anda di atas atau beli domain baru untuk mengaktifkan URL brand resmi.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-6">
                {domains.map((dom) => {
                  const info = parseDomainInfo(dom.domain)
                  const expectedRecords = getExpectedDnsRecords(dom.domain, session?.user?.id || "tenant")
                  const isVerifying = verifyingMap[dom.domain] || false
                  const diagnostics = diagnosticsMap[dom.domain]

                  const currentTarget = dom.target || "cms"
                  const currentTargetInfo = DOMAIN_TARGETS.find((t) => t.value === currentTarget)

                  return (
                    <Card key={dom.id} className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                      {/* Domain Header Bar */}
                      <div className="p-5 border-b border-border/60 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono font-bold text-sm text-foreground">{dom.domain}</span>
                          
                          {/* Status Badge */}
                          {dom.status === "verified" ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Valid Configuration
                            </Badge>
                          ) : dom.status === "failed" ? (
                            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Invalid Configuration
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold">
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Menunggu DNS
                            </Badge>
                          )}

                          {dom.isPrimary ? (
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-bold rounded-full">
                              <Star className="w-3 h-3 mr-1 fill-current" /> Primary Domain
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetPrimary(dom.domain)}
                              disabled={settingPrimary === dom.domain}
                              className="h-6 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground rounded-lg"
                            >
                              {settingPrimary === dom.domain ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                              Jadikan Primary
                            </Button>
                          )}

                          <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60">
                            {info.isApex ? "Apex Domain (@)" : `Subdomain (${info.subdomainPrefix})`}
                          </Badge>

                          {/* Portal Target Badge */}
                          <Badge variant="outline" className="text-[10px] border-border/60 flex items-center gap-1">
                            {currentTargetInfo?.icon}
                            <span className="ml-0.5">{currentTargetInfo?.label || currentTarget}</span>
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerifyDns(dom.domain)}
                            disabled={isVerifying}
                            className="rounded-xl text-xs font-bold h-8 border-border/80"
                          >
                            {isVerifying ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Cek Status DNS
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDomain(dom.domain)}
                            disabled={deletingDomain === dom.domain}
                            className="h-8 w-8 text-rose-500 hover:text-rose-600 rounded-xl hover:bg-rose-500/10"
                          >
                            {deletingDomain === dom.domain ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>

                      {/* Diagnostic Alert if invalid */}
                      {diagnostics && diagnostics.status !== "verified" && (
                        <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 text-xs space-y-1">
                          <p className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4" />
                            {diagnostics.summaryMessage}
                          </p>
                        </div>
                      )}

                      {/* Vercel-style DNS Records Table */}
                      <CardContent className="p-5 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-foreground">
                              Petunjuk Konfigurasi DNS Record
                            </Label>
                            <span className="text-[11px] text-muted-foreground">
                              Tambahkan record berikut pada DNS Manager (Cloudflare, cPanel, Domainesia, dll.)
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-border/80">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-muted/40 text-muted-foreground border-b border-border/60 font-semibold">
                                <tr>
                                  <th className="p-3">Type</th>
                                  <th className="p-3">Name / Host</th>
                                  <th className="p-3">Value / Target</th>
                                  <th className="p-3">Keterangan</th>
                                  <th className="p-3">TTL</th>
                                  <th className="p-3">Status</th>
                                  <th className="p-3 text-right">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {expectedRecords.map((rec, i) => {
                                  const diagRec = diagnostics?.records.find((r) => r.type === rec.type)
                                  const status = diagRec?.status || (dom.status === "verified" ? "valid" : "pending")

                                  return (
                                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                                      <td className="p-3 font-bold font-mono">
                                        <Badge
                                          variant="outline"
                                          className={`font-mono text-[11px] font-bold ${
                                            rec.type === "CNAME"
                                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                              : rec.type === "A"
                                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                              : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                          }`}
                                        >
                                          {rec.type}
                                        </Badge>
                                      </td>
                                      <td className="p-3 font-mono font-semibold text-foreground">
                                        <div className="flex items-center gap-1.5">
                                          <span>{rec.name}</span>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 rounded-md"
                                            onClick={() => copyText(rec.name, `name-${dom.id}-${i}`)}
                                          >
                                            {copiedId === `name-${dom.id}-${i}` ? (
                                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            ) : (
                                              <Copy className="h-3 w-3 text-muted-foreground" />
                                            )}
                                          </Button>
                                        </div>
                                      </td>
                                      <td className="p-3 font-mono text-foreground">
                                        <div className="flex items-center gap-1.5">
                                          <code className="bg-muted/50 px-1.5 py-0.5 rounded break-all">{rec.value}</code>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 rounded-md shrink-0"
                                            onClick={() => copyText(rec.value, `val-${dom.id}-${i}`)}
                                          >
                                            {copiedId === `val-${dom.id}-${i}` ? (
                                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            ) : (
                                              <Copy className="h-3 w-3 text-muted-foreground" />
                                            )}
                                          </Button>
                                        </div>
                                      </td>
                                      <td className="p-3 text-[11px] text-muted-foreground max-w-[200px]">
                                        {rec.description}
                                      </td>
                                      <td className="p-3 text-muted-foreground font-mono">{rec.ttl}</td>
                                      <td className="p-3">
                                        {status === "valid" ? (
                                          <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Valid
                                          </span>
                                        ) : status === "invalid" ? (
                                          <span className="inline-flex items-center text-rose-600 dark:text-rose-400 font-bold text-[11px]">
                                            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Salah
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center text-muted-foreground text-[11px]">
                                            Menunggu
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-3 text-right">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 text-[11px] font-bold rounded-lg border-border/80"
                                          onClick={() => copyText(`${rec.type} ${rec.name} ${rec.value}`, `all-${dom.id}-${i}`)}
                                        >
                                          {copiedId === `all-${dom.id}-${i}` ? "Tersalin" : "Salin Record"}
                                        </Button>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Portal Target Selector */}
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <ArrowRight className="h-3.5 w-3.5 text-primary" />
                            Tujuan Portal Domain
                          </Label>
                          <p className="text-[11px] text-muted-foreground">Pilih ke mana pengunjung akan diarahkan saat membuka <code className="font-mono text-foreground">{dom.domain}</code></p>
                          <div className="grid grid-cols-2 gap-2">
                            {DOMAIN_TARGETS.map((t) => (
                              <button
                                key={t.value}
                                type="button"
                                disabled={updatingTargetMap[dom.domain]}
                                onClick={() => currentTarget !== t.value && handleUpdateTarget(dom.domain, t.value)}
                                className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                                  currentTarget === t.value
                                    ? "border-primary bg-primary/10"
                                    : "border-border/50 hover:border-border hover:bg-muted/40 cursor-pointer"
                                }`}
                              >
                                <span className={currentTarget === t.value ? "text-primary" : "text-muted-foreground"}>{t.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-[11px] font-bold truncate ${currentTarget === t.value ? "text-primary" : "text-foreground"}`}>{t.label}</div>
                                  <code className="text-[10px] text-muted-foreground/70 font-mono">{t.example}</code>
                                </div>
                                {currentTarget === t.value && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                                {updatingTargetMap[dom.domain] && currentTarget !== t.value && null}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* SSL & Target URL Footer */}
                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground border-t border-border/60">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            <span>SSL Certificate: <strong>Auto Let&apos;s Encrypt / On-Demand TLS Aktif</strong></span>
                          </div>
                          
                          <a
                            href={`https://${dom.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 font-semibold"
                          >
                            Buka https://{dom.domain} <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* Buy Domain Modal */}
          <BuyDomainDialog
            open={showBuyDialog}
            onOpenChange={setShowBuyDialog}
            tenantSlug={tenantSlug}
            onSuccess={fetchDomains}
          />

        </div>
      </div>
    </div>
  )
}
