"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import {
  Copy,
  Check,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  KeyRound,
  Loader2,
} from "lucide-react"

export default function CustomerLicensePage() {
  const { toast } = useToast()
  const [license, setLicense] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showActivate, setShowActivate] = useState(false)
  const [licenseKeyInput, setLicenseKeyInput] = useState("")
  const [activating, setActivating] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/enterprise/status")
      if (res.ok) {
        const data = await res.json()
        setLicense(data)
      } else {
        setLicense(null)
      }
    } catch {
      setLicense(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    setActivating(true)

    try {
      const res = await fetch("/api/enterprise/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseKeyInput }),
      })

      const data = await res.json()

      if (res.ok) {
        setShowActivate(false)
        setLicenseKeyInput("")
        toast({
          title: "License Activated",
          description: `Enterprise mode active. ${data.daysRemaining} days remaining.`,
        })
        await fetchStatus()
      } else {
        toast({
          title: "Activation Failed",
          description: data.error || "Invalid license key",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to activate license. Please try again.",
        variant: "destructive",
      })
    } finally {
      setActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Checking license status...</p>
        </div>
      </div>
    )
  }

  // No License / Not Activated
  if (!license || !license.valid) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>No Enterprise License</CardTitle>
            <CardDescription>
              This instance is running in standard mode with plan limits applied.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showActivate && (
              <Button
                className="w-full"
                onClick={() => setShowActivate(true)}
              >
                <KeyRound className="w-4 h-4 mr-2" />
                Activate License
              </Button>
            )}

            {showActivate && (
              <form onSubmit={handleActivate} className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">License Key</label>
                  <Input
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    placeholder="Paste your SACMS-... key here"
                    className="font-mono text-xs min-h-[80px]"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the serial key you received from SaCMS.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={activating || !licenseKeyInput.trim()}
                    className="flex-1"
                  >
                    {activating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating...</>
                    ) : (
                      <>Activate</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowActivate(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            <div className="text-center pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                Don&apos;t have a license yet?
              </p>
              <a
                href="mailto:sales@sacms.cloud?subject=Enterprise%20License%20Inquiry"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Contact Sales <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Active License
  const daysRemaining = license.daysRemaining || 0
  const progressPct = license.totalDays
    ? Math.round(((license.totalDays - daysRemaining) / license.totalDays) * 100)
    : 50
  const isExpiring = daysRemaining < 30 && daysRemaining > 0
  const isExpired = daysRemaining <= 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* License Active Card */}
      <Card className={`border-2 ${
        isExpired ? "border-red-500/30" :
        isExpiring ? "border-yellow-500/30" :
        "border-green-500/30"
      }`}>
        <CardHeader className={`${
          isExpired ? "bg-red-500/5" :
          isExpiring ? "bg-yellow-500/5" :
          "bg-green-500/5"
        } rounded-t-lg`}>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {isExpired ? (
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 font-bold">
                    <ShieldAlert className="w-3 h-3 mr-1" /> Expired
                  </Badge>
                ) : isExpiring ? (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 font-bold">
                    <ShieldAlert className="w-3 h-3 mr-1" /> Expiring Soon
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 font-bold">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Active
                  </Badge>
                )}
                <Badge variant="secondary" className="uppercase text-[10px] font-bold">
                  {license.type}
                </Badge>
              </div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Enterprise License
              </CardTitle>
            </div>
            <ShieldCheck className={`w-10 h-10 ${
              isExpired ? "text-red-500" :
              isExpiring ? "text-yellow-500" :
              "text-green-500"
            }`} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-semibold">Customer</p>
              <p className="text-sm font-bold">{license.customerName}</p>
            </div>
            {license.organization && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-semibold">Organization</p>
                <p className="text-sm font-bold">{license.organization}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-semibold">Issued</p>
              <p className="text-sm font-bold">
                {license.issuedAt ? new Date(license.issuedAt).toLocaleDateString() : "-"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-semibold">Expires</p>
              <p className={`text-sm font-bold ${isExpiring || isExpired ? "text-destructive" : ""}`}>
                {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : "-"}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className={`font-semibold ${
                isExpired ? "text-destructive" :
                isExpiring ? "text-yellow-600" :
                "text-green-600"
              }`}>
                {isExpired
                  ? "License Expired"
                  : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`
                }
              </span>
              <span className="text-muted-foreground">
                {Math.round(progressPct)}% used
              </span>
            </div>
            <Progress
              value={Math.min(progressPct, 100)}
              className={`h-2 ${
                isExpired ? "bg-red-500/20" :
                isExpiring ? "bg-yellow-500/20" :
                "bg-green-500/20"
              }`}
            />
          </div>

          {/* Features */}
          {license.features && license.features.length > 0 && (
            <div className="pt-4 border-t space-y-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Included Features
              </p>
              <div className="flex flex-wrap gap-2">
                {license.features.map((f: string) => (
                  <Badge key={f} variant="secondary" className="text-xs">
                    ✅ {f.replace(/-/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t flex flex-col sm:flex-row gap-3">
            {isExpiring || isExpired ? (
              <a
                href="mailto:support@sacms.cloud?subject=License%20Renewal"
                className="flex-1"
              >
                <Button className="w-full">
                  Renew License
                </Button>
              </a>
            ) : null}
            <Button
              variant="outline"
              onClick={() => fetchStatus()}
              className={isExpiring || isExpired ? "" : "flex-1"}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card className="border-dashed">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Need help?{" "}
            <a href="mailto:support@sacms.cloud" className="text-primary hover:underline">
              support@sacms.cloud
            </a>
            {" "}·{" "}
            <a href="/docs/enterprise" className="text-primary hover:underline">
              Documentation
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
