"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Loader2,
  Save,
  Globe,
  Palette,
  Copy,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Clock,
  ArrowLeft,
  Trash2,
} from "lucide-react"
import Link from "next/link"

interface DomainRecord {
  id: string
  domain: string
  status: string
  verifiedAt: string | null
  isPrimary: boolean
  dnsVerification: {
    name: string
    type: string
    value: string
  }
}

interface BrandSettings {
  brandName: string
  brandLogo: string
  primaryColor: string
  customEmailSender: string
  faviconUrl: string
}

export default function WhiteLabelPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [savingBrand, setSavingBrand] = useState(false)
  const [savingDomain, setSavingDomain] = useState(false)
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null)
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null)
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null)

  const [brand, setBrand] = useState<BrandSettings>({
    brandName: "",
    brandLogo: "",
    primaryColor: "#3B82F6",
    customEmailSender: "",
    faviconUrl: "",
  })

  const [domainInput, setDomainInput] = useState("")
  const [domains, setDomains] = useState<DomainRecord[]>([])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchDomains = async () => {
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/white-label/domain`)
      if (res.ok) {
        const data = await res.json()
        setDomains(data.domains || [])
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    async function fetchData() {
      if (!tenantSlug || !session?.user) return

      try {
        const [wlRes] = await Promise.all([
          fetch(`/api/tenant/${tenantSlug}/white-label`),
          fetchDomains(),
        ])

        if (wlRes?.status === 403) {
          const error = await wlRes.json().catch(() => ({}))
          setAccessError(error.error || "White-label is not available for this workspace")
          return
        }

        if (wlRes?.ok) {
          const data = await wlRes.json()
          setBrand({
            brandName: data.brandName || "",
            brandLogo: data.brandLogo || "",
            primaryColor: data.primaryColor || "#3B82F6",
            customEmailSender: data.customEmailSender || "",
            faviconUrl: data.faviconUrl || "",
          })
        }

      } catch {
        // ignore fetch errors on initial load
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.id) {
      fetchData()
    }
  }, [tenantSlug, session?.user?.id])

  async function handleSaveBrand() {
    setSavingBrand(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/white-label`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brand),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Failed to save branding settings")
      }
    } finally {
      setSavingBrand(false)
    }
  }

  async function handleAddDomain() {
    if (!domainInput.trim()) return
    setSavingDomain(true)
    try {
      const res = await fetch(
        `/api/tenant/${tenantSlug}/white-label/domain`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customDomain: domainInput.trim() }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        setDomainInput("")
        await fetchDomains()
      } else {
        alert(data.error || "Failed to add domain")
      }
    } finally {
      setSavingDomain(false)
    }
  }

  async function handleVerifyDomain(domain: string) {
    setVerifyingDomain(domain)
    try {
      const res = await fetch(
        `/api/tenant/${tenantSlug}/white-label/domain`,
        { 
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customDomain: domain }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        await fetchDomains()
      } else {
        alert(data.error || "Verification failed. Check your DNS record.")
      }
    } finally {
      setVerifyingDomain(null)
    }
  }

  async function handleDeleteDomain(domain: string) {
    if (!confirm(`Are you sure you want to remove ${domain}?`)) return
    setDeletingDomain(domain)
    try {
      const res = await fetch(
        `/api/tenant/${tenantSlug}/white-label/domain`,
        { 
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customDomain: domain }),
        }
      )
      if (res.ok) {
        await fetchDomains()
      } else {
        const data = await res.json()
        alert(data.error || "Failed to remove domain.")
      }
    } finally {
      setDeletingDomain(null)
    }
  }

  function copyToClipboard(text: string, fieldId: string) {
    navigator.clipboard.writeText(text)
    setCopiedRecord(fieldId)
    setTimeout(() => setCopiedRecord(null), 2000)
  }

  function StatusBadge({ status }: { status: string }) {
    const map = {
      pending: { label: "Pending Verification", icon: Clock, variant: "secondary" },
      verified: { label: "Verified", icon: CheckCircle, variant: "default" },
      failed: { label: "Verification Failed", icon: AlertCircle, variant: "destructive" },
    } as const
    const cfg = map[status as keyof typeof map]
    if (!cfg) return null
    const Icon = cfg.icon
    return (
      <Badge variant={cfg.variant as "secondary" | "default" | "destructive"}>
        <Icon className="mr-1 h-3 w-3" />
        {cfg.label}
      </Badge>
    )
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center flex-1 flex-col w-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (accessError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>White-Label unavailable</CardTitle>
            <CardDescription>{accessError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/dashboard/${tenantSlug}/subscriptions`}>View plans</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 overflow-auto">
        <div className="p-8 max-w-3xl mx-auto space-y-8">
          <div className="space-y-4">
            <Button variant="ghost" size="sm" asChild className="-ml-3 text-muted-foreground">
              <Link href={`/dashboard/${tenantSlug}/settings`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Settings
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">White-Label Settings</h1>
              <p className="text-muted-foreground mt-1">
                Customise your tenant branding and configure a custom domain for
                your public API.
              </p>
            </div>
          </div>

          {/* ── Branding ─────────────────────────────────────────────── */}
          <Card className="border border-border/80 rounded-2xl shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 border-b border-border/60 bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Palette className="h-4 w-4 text-primary" />
                Kustomisasi Branding & Identitas
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Ganti logo, warna tema, dan identitas SaCMS dengan brand perusahaan Anda.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="brandName" className="text-xs font-semibold text-foreground">Nama Brand</Label>
                  <Input
                    id="brandName"
                    placeholder="Acme CMS"
                    value={brand.brandName}
                    onChange={(e) =>
                      setBrand((b) => ({ ...b, brandName: e.target.value }))
                    }
                    className="rounded-xl h-9 text-xs bg-background border-border/80"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="primaryColor" className="text-xs font-semibold text-foreground">Warna Primer Tema</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      placeholder="#3B82F6"
                      value={brand.primaryColor}
                      onChange={(e) =>
                        setBrand((b) => ({
                          ...b,
                          primaryColor: e.target.value,
                        }))
                      }
                      className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                    />
                    <input
                      type="color"
                      value={brand.primaryColor}
                      onChange={(e) =>
                        setBrand((b) => ({
                          ...b,
                          primaryColor: e.target.value,
                        }))
                      }
                      className="h-9 w-9 cursor-pointer rounded-xl border border-border/80 p-0.5 bg-background shrink-0"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="brandLogo" className="text-xs font-semibold text-foreground">URL Logo Perusahaan</Label>
                <Input
                  id="brandLogo"
                  type="url"
                  placeholder="https://acme.com/logo.png"
                  value={brand.brandLogo}
                  onChange={(e) =>
                    setBrand((b) => ({ ...b, brandLogo: e.target.value }))
                  }
                  className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="faviconUrl" className="text-xs font-semibold text-foreground">URL Favicon</Label>
                <Input
                  id="faviconUrl"
                  type="url"
                  placeholder="https://acme.com/favicon.ico"
                  value={brand.faviconUrl}
                  onChange={(e) =>
                    setBrand((b) => ({ ...b, faviconUrl: e.target.value }))
                  }
                  className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="customEmailSender" className="text-xs font-semibold text-foreground">
                  Alamat Email Pengirim Kustom{" "}
                  <span className="text-muted-foreground font-normal">
                    (opsional)
                  </span>
                </Label>
                <Input
                  id="customEmailSender"
                  type="email"
                  placeholder="noreply@acme.com"
                  value={brand.customEmailSender}
                  onChange={(e) =>
                    setBrand((b) => ({
                      ...b,
                      customEmailSender: e.target.value,
                    }))
                  }
                  className="rounded-xl h-9 text-xs bg-background border-border/80"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveBrand} disabled={savingBrand} className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground shadow-xs">
                  {savingBrand ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Simpan Branding
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Custom Domains ─────────────────────────────────────────── */}
          <Card className="border border-border/80 rounded-2xl shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 border-b border-border/60 bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Globe className="h-4 w-4 text-primary" />
                Domain Publik Kustom
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Akses REST dan GraphQL API menggunakan domain Anda sendiri (misal:{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">
                  api.perusahaananda.com
                </code>
                ).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              
              {domains.length > 0 && (
                <div className="space-y-4">
                  {domains.map((dom) => (
                    <div key={dom.id} className="rounded-xl border border-border/80 p-4 space-y-4 bg-muted/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-bold text-xs text-foreground font-mono">{dom.domain}</h3>
                          <StatusBadge status={dom.status} />
                          {dom.isPrimary && <Badge variant="outline" className="text-[10px] rounded-full">Primary</Badge>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDomain(dom.domain)}
                          disabled={deletingDomain === dom.domain}
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-500/10"
                        >
                          {deletingDomain === dom.domain ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>

                      {dom.status !== "verified" && dom.dnsVerification && (
                        <div className="space-y-3 pt-2">
                          <Separator className="bg-border/60" />
                          <p className="text-xs font-bold text-foreground">
                            Verifikasi DNS Diperlukan
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Tambahkan TXT record berikut pada DNS manager domain Anda, kemudian klik tombol Verifikasi.
                          </p>

                          <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-2.5 text-xs">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-0.5">
                                  Host / Name
                                </p>
                                <code className="break-all font-mono font-bold text-primary">
                                  {dom.dnsVerification.name}
                                </code>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0 rounded-lg"
                                onClick={() =>
                                  copyToClipboard(
                                    dom.dnsVerification.name,
                                    `name-${dom.id}`
                                  )
                                }
                              >
                                {copiedRecord === `name-${dom.id}` ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>

                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-0.5">
                                  Tipe Record
                                </p>
                                <code className="font-mono font-bold">TXT</code>
                              </div>
                            </div>

                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-0.5">
                                  Value / Isi
                                </p>
                                <code className="break-all font-mono text-[11px]">
                                  {dom.dnsVerification.value}
                                </code>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0 rounded-lg"
                                onClick={() =>
                                  copyToClipboard(
                                    dom.dnsVerification.value,
                                    `value-${dom.id}`
                                  )
                                }
                              >
                                {copiedRecord === `value-${dom.id}` ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-1">
                            <p className="text-[10px] text-muted-foreground">
                              Perubahan DNS memerlukan propagasi beberapa menit hingga jam.
                            </p>
                            <Button
                              size="sm"
                              onClick={() => handleVerifyDomain(dom.domain)}
                              disabled={verifyingDomain === dom.domain}
                              className="h-8 rounded-xl text-xs font-bold"
                            >
                              {verifyingDomain === dom.domain ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Verifikasi Record
                            </Button>
                          </div>
                        </div>
                      )}

                      {dom.status === "verified" && (
                        <div className="space-y-1 text-xs text-muted-foreground pt-1">
                          <p>
                            Arahkan DNS CNAME atau A record untuk{" "}
                            <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold text-foreground">
                              {dom.domain}
                            </code>{" "}
                            ke IP / host server SaCMS Anda.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Domain input */}
              <div className="space-y-1.5 pt-2">
                <Label htmlFor="customDomain" className="text-xs font-semibold text-foreground">Tambah Domain Baru</Label>
                <div className="flex gap-2">
                  <Input
                    id="customDomain"
                    placeholder="api.domainanda.com"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    className="rounded-xl h-9 text-xs font-mono bg-background border-border/80"
                  />
                  <Button
                    onClick={handleAddDomain}
                    disabled={savingDomain || !domainInput}
                    className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground shadow-xs shrink-0"
                  >
                    {savingDomain ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : null}
                    Tambah Domain
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
