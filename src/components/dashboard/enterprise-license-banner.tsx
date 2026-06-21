"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Loader2,
  Check,
  ExternalLink,
  RefreshCw,
} from "lucide-react"

interface EnterpriseLicenseInfo {
  valid: boolean
  customerName?: string
  customerEmail?: string
  organization?: string
  type?: string
  features?: string[]
  expiresAt?: string
  issuedAt?: string
  daysRemaining?: number
  totalDays?: number
  status?: string
  error?: string
}

export function EnterpriseLicenseBanner() {
  const { toast } = useToast()
  const [license, setLicense] = useState<EnterpriseLicenseInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showActivate, setShowActivate] = useState(false)
  const [licenseKeyInput, setLicenseKeyInput] = useState("")
  const [activating, setActivating] = useState(false)

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
        toast({ title: "License Activated", description: "Enterprise mode is now active." })
        await fetchStatus()
      } else {
        toast({ title: "Activation Failed", description: data.error || "Invalid key", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Activation failed", variant: "destructive" })
    } finally {
      setActivating(false)
    }
  }

  if (loading) return null
  if (!license || !license.valid) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold">Standard Mode</p>
                <p className="text-xs text-muted-foreground">Workspace plan limits apply. Activate an enterprise key for unlimited access.</p>
              </div>
            </div>
            {!showActivate ? (
              <Button variant="outline" size="sm" onClick={() => setShowActivate(true)}>
                <KeyRound className="w-3.5 h-3.5 mr-2" />
                Activate License
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowActivate(false)}>
                Cancel
              </Button>
            )}
          </div>
          {showActivate && (
            <form onSubmit={handleActivate} className="mt-4 pt-4 border-t space-y-3">
              <Input
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value)}
                placeholder="Paste your SACMS-... serial key here"
                className="font-mono text-xs"
                required
              />
              <Button type="submit" disabled={activating || !licenseKeyInput.trim()} className="w-full">
                {activating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating...</> : "Activate License"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    )
  }

  const daysRemaining = license.daysRemaining || 0
  const isExpiring = daysRemaining < 30 && daysRemaining > 0
  const isExpired = daysRemaining <= 0
  const progressPct = license.totalDays ? Math.round(((license.totalDays - daysRemaining) / license.totalDays) * 100) : 60

  return (
    <Card className={cn(
      "border-2",
      isExpired ? "border-red-500/30" : isExpiring ? "border-yellow-500/30" : "border-green-500/30"
    )}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              isExpired ? "bg-red-500/10" : isExpiring ? "bg-yellow-500/10" : "bg-green-500/10"
            )}>
              {isExpired ? <ShieldAlert className="w-5 h-5 text-red-500" /> : 
               isExpiring ? <ShieldAlert className="w-5 h-5 text-yellow-500" /> : 
               <ShieldCheck className="w-5 h-5 text-green-500" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-bold",
                  isExpired ? "text-red-500" : isExpiring ? "text-yellow-500" : "text-green-500"
                )}>
                  {isExpired ? "License Expired" : 
                   isExpiring ? `Expiring in ${daysRemaining} days` : 
                   `Enterprise License — ${daysRemaining} days remaining`}
                </span>
                <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                  {license.type}
                </Badge>
              </div>
              <p className="text-sm font-bold mt-0.5">{license.customerName}</p>
            </div>
          </div>
          {isExpiring && (
            <a href="mailto:support@sacms.cloud?subject=License%20Renewal">
              <Button size="sm">Renew License</Button>
            </a>
          )}
        </div>
        {!isExpired && (
          <div className="mt-3">
            <Progress value={Math.min(progressPct, 100)} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
