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
} from "lucide-react"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"

interface DomainStatus {
  customDomain: string | null
  customDomainStatus: string | null
  verificationRecord: {
    name: string
    type: string
    value: string
  } | null
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
  const tenants = session?.user?.tenants || []

  const [loading, setLoading] = useState(true)
  const [savingBrand, setSavingBrand] = useState(false)
  const [savingDomain, setSavingDomain] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [copiedRecord, setCopiedRecord] = useState<"name" | "value" | null>(
    null
  )

  const [brand, setBrand] = useState<BrandSettings>({
    brandName: "",
    brandLogo: "",
    primaryColor: "#3B82F6",
    customEmailSender: "",
    faviconUrl: "",
  })

  const [domainInput, setDomainInput] = useState("")
  const [domainStatus, setDomainStatus] = useState<DomainStatus>({
    customDomain: null,
    customDomainStatus: null,
    verificationRecord: null,
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      if (!tenantSlug || !session?.user) return

      try {
        const [wlRes, domRes] = await Promise.all([
          fetch(`/api/tenant/${tenantSlug}/white-label`),
          fetch(`/api/tenant/${tenantSlug}/white-label/domain`),
        ])

        if (wlRes.ok) {
          const data = await wlRes.json()
          setBrand({
            brandName: data.brandName || "",
            brandLogo: data.brandLogo || "",
            primaryColor: data.primaryColor || "#3B82F6",
            customEmailSender: data.customEmailSender || "",
            faviconUrl: data.faviconUrl || "",
          })
        }

        if (domRes.ok) {
          const data = await domRes.json()
          setDomainStatus(data)
          setDomainInput(data.customDomain || "")
        }
      } catch {
        // ignore fetch errors on initial load
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [tenantSlug, session])

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

  async function handleSaveDomain() {
    setSavingDomain(true)
    try {
      const res = await fetch(
        `/api/tenant/${tenantSlug}/white-label/domain`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customDomain: domainInput.trim() || null }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        setDomainStatus(data)
      } else {
        alert(data.error || "Failed to save domain")
      }
    } finally {
      setSavingDomain(false)
    }
  }

  async function handleVerifyDomain() {
    setVerifying(true)
    try {
      const res = await fetch(
        `/api/tenant/${tenantSlug}/white-label/domain`,
        { method: "POST" }
      )
      const data = await res.json()
      if (res.ok) {
        setDomainStatus(data)
      } else {
        alert(data.error || "Verification failed. Check your DNS record.")
      }
    } finally {
      setVerifying(false)
    }
  }

  function copyToClipboard(text: string, field: "name" | "value") {
    navigator.clipboard.writeText(text)
    setCopiedRecord(field)
    setTimeout(() => setCopiedRecord(null), 2000)
  }

  function StatusBadge({ status }: { status: string | null }) {
    if (!status) return null
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
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />

      <div className="flex-1 overflow-auto">
        <div className="p-8 max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold">White-Label Settings</h1>
            <p className="text-muted-foreground mt-1">
              Customise your tenant branding and configure a custom domain for
              your public API.
            </p>
          </div>

          {/* ── Branding ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Branding
              </CardTitle>
              <CardDescription>
                Override the default ContentFlow branding for your tenant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brandName">Brand Name</Label>
                  <Input
                    id="brandName"
                    placeholder="Acme CMS"
                    value={brand.brandName}
                    onChange={(e) =>
                      setBrand((b) => ({ ...b, brandName: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
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
                      className="h-10 w-10 cursor-pointer rounded border p-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandLogo">Logo URL</Label>
                <Input
                  id="brandLogo"
                  type="url"
                  placeholder="https://acme.com/logo.png"
                  value={brand.brandLogo}
                  onChange={(e) =>
                    setBrand((b) => ({ ...b, brandLogo: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="faviconUrl">Favicon URL</Label>
                <Input
                  id="faviconUrl"
                  type="url"
                  placeholder="https://acme.com/favicon.ico"
                  value={brand.faviconUrl}
                  onChange={(e) =>
                    setBrand((b) => ({ ...b, faviconUrl: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customEmailSender">
                  Custom Email Sender{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="customEmailSender"
                  type="email"
                  placeholder="Acme CMS <noreply@acme.com>"
                  value={brand.customEmailSender}
                  onChange={(e) =>
                    setBrand((b) => ({
                      ...b,
                      customEmailSender: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveBrand} disabled={savingBrand}>
                  {savingBrand ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Branding
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Custom Domain ─────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Custom Domain
              </CardTitle>
              <CardDescription>
                Serve your public API on your own domain (e.g.{" "}
                <code className="bg-muted px-1 rounded text-xs">
                  api.yourcompany.com
                </code>
                ).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Domain input */}
              <div className="space-y-2">
                <Label htmlFor="customDomain">Domain</Label>
                <div className="flex gap-2">
                  <Input
                    id="customDomain"
                    placeholder="api.yourcompany.com"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                  />
                  <Button
                    onClick={handleSaveDomain}
                    disabled={savingDomain}
                    variant="outline"
                  >
                    {savingDomain ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
                {domainStatus.customDomain && (
                  <div className="flex items-center gap-2 pt-1">
                    <StatusBadge status={domainStatus.customDomainStatus} />
                  </div>
                )}
              </div>

              {/* DNS verification instructions */}
              {domainStatus.customDomain &&
                domainStatus.customDomainStatus !== "verified" &&
                domainStatus.verificationRecord && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <p className="text-sm font-medium">
                        DNS Verification Required
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Add the following TXT record to your DNS provider, then
                        click &ldquo;Verify&rdquo;.
                      </p>

                      <div className="rounded-md border bg-muted/40 p-4 space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Name / Host
                            </p>
                            <code className="break-all">
                              {domainStatus.verificationRecord.name}
                            </code>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() =>
                              copyToClipboard(
                                domainStatus.verificationRecord!.name,
                                "name"
                              )
                            }
                          >
                            {copiedRecord === "name" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Type
                            </p>
                            <code>TXT</code>
                          </div>
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Value
                            </p>
                            <code className="break-all">
                              {domainStatus.verificationRecord.value}
                            </code>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() =>
                              copyToClipboard(
                                domainStatus.verificationRecord!.value,
                                "value"
                              )
                            }
                          >
                            {copiedRecord === "value" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        DNS changes can take up to 48 hours to propagate.
                      </p>

                      <Button
                        onClick={handleVerifyDomain}
                        disabled={verifying}
                      >
                        {verifying ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Verify DNS Record
                      </Button>
                    </div>
                  </>
                )}

              {/* Point DNS instructions */}
              {domainStatus.customDomain && (
                <>
                  <Separator />
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Point your DNS to ContentFlow
                    </p>
                    <p>
                      After verification, create an{" "}
                      <strong>A record</strong> (or CNAME) pointing{" "}
                      <code className="bg-muted px-1 rounded">
                        {domainStatus.customDomain}
                      </code>{" "}
                      to this server&apos;s IP address.
                    </p>
                    {domainStatus.customDomainStatus === "verified" && (
                      <div className="flex items-center gap-2 pt-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>
                          Your custom domain is active! API requests to{" "}
                          <code className="bg-muted px-1 rounded text-foreground">
                            https://{domainStatus.customDomain}/content/...
                          </code>{" "}
                          will be served for this tenant.
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
