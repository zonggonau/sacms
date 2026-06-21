"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  CheckCircle2,
  Loader2,
  Rocket,
  KeyRound,
  Building2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react"

type SetupStep = "welcome" | "license" | "workspace" | "done"

export default function SelfHostedSetupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState<SetupStep>("welcome")
  const [loading, setLoading] = useState(false)

  // License activation
  const [licenseKey, setLicenseKey] = useState("")
  const [licenseActive, setLicenseActive] = useState(false)

  // Workspace creation
  const [workspaceName, setWorkspaceName] = useState("")
  const [workspaceSlug, setWorkspaceSlug] = useState("")
  const [workspaceCreated, setWorkspaceCreated] = useState(false)
  const [workspaceId, setWorkspaceId] = useState("")
  const [seeding, setSeeding] = useState(false)

  // Check if already setup
  useEffect(() => {
    const checkLicense = async () => {
      try {
        const res = await fetch("/api/enterprise/status")
        const data = await res.json()
        if (data.valid) setLicenseActive(true)
      } catch {}
    }
    checkLicense()
  }, [])

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/enterprise/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey }),
      })
      if (res.ok) {
        setLicenseActive(true)
        toast({ title: "License Activated", description: "Enterprise mode is active." })
        setStep("workspace")
      } else {
        const data = await res.json()
        toast({ title: "Activation Failed", description: data.error || "Invalid key", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Activation failed", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/tenant/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName, slug: workspaceSlug || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        setWorkspaceId(data.tenant.id)
        setWorkspaceCreated(true)

        // Auto-seed the tenant
        setSeeding(true)
        try {
          await fetch("/api/admin/seed-tenant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId: data.tenant.id }),
          })
        } catch {}
        setSeeding(false)

        toast({ title: "Workspace Created", description: `"${workspaceName}" is ready.` })
        setStep("done")
      } else {
        const data = await res.json()
        toast({ title: "Create Failed", description: data.error || "Failed to create workspace", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to create workspace", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-lg space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["welcome", "license", "workspace", "done"] as SetupStep[]).map((s, i) => {
            const currentIdx = ["welcome", "license", "workspace", "done"].indexOf(step)
            const stepIdx = i
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  stepIdx <= currentIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {stepIdx < currentIdx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                {i < 3 && <div className={`w-8 h-0.5 ${stepIdx < currentIdx ? "bg-primary" : "bg-muted"}`} />}
              </div>
            )
          })}
        </div>

        {/* Welcome Step */}
        {step === "welcome" && (
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Rocket className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome to SaCMS</CardTitle>
              <CardDescription>Your self-hosted content management system is ready.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold">Enterprise Ready</p>
                    <p className="text-xs text-muted-foreground">Activate your license or start with free mode</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold">Create Workspace</p>
                    <p className="text-xs text-muted-foreground">Set up your first project in minutes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold">Pre-loaded Content</p>
                    <p className="text-xs text-muted-foreground">Sample pages and entries to get started fast</p>
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={() => setStep("license")}>
                Get Started <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* License Step */}
        {step === "license" && (
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="w-14 h-14 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-3">
                <KeyRound className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>Enterprise License (Optional)</CardTitle>
              <CardDescription>
                Activate your enterprise key for unlimited workspaces, or skip to try the free plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleActivateLicense} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="license-key">License Key</Label>
                  <Input
                    id="license-key"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="SACMS-..."
                    className="font-mono text-xs"
                  />
                </div>
                <Button type="submit" disabled={loading || !licenseKey.trim()} className="w-full">
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating...</> : "Activate License"}
                </Button>
              </form>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setStep("workspace")}>
                Skip — Try Free Mode
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Workspace Step */}
        {step === "workspace" && (
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="w-14 h-14 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-3">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>Create Your First Workspace</CardTitle>
              <CardDescription>Name your project and we will set everything up for you.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Workspace Name *</Label>
                  <Input
                    id="ws-name"
                    value={workspaceName}
                    onChange={(e) => {
                      setWorkspaceName(e.target.value)
                      if (!workspaceSlug || workspaceSlug === generateSlug(workspaceName.slice(0, -1))) {
                        setWorkspaceSlug(generateSlug(e.target.value))
                      }
                    }}
                    placeholder="Pemerintah Kab. Jayawijaya"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-slug">URL Slug</Label>
                  <Input
                    id="ws-slug"
                    value={workspaceSlug}
                    onChange={(e) => setWorkspaceSlug(generateSlug(e.target.value))}
                    placeholder="pemkab-jayawijaya"
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">https://sacms.cloud/dashboard/<strong>{workspaceSlug || "..."}</strong></p>
                </div>
                <Button type="submit" disabled={loading || !workspaceName.trim()} className="w-full">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Workspace...</>
                  ) : (
                    <>Create Workspace &rarr;</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Done Step */}
        {step === "done" && (
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <CardTitle className="text-2xl">All Set! 🎉</CardTitle>
              <CardDescription>
                {seeding ? "Loading sample content..." : "Your workspace is ready with sample content."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {seeding && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Seeding content types...
                </div>
              )}
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg p-4 text-sm space-y-2">
                <p className="font-bold text-green-800 dark:text-green-400">✨ What was created:</p>
                <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                  <li>✅ Sample content types (Pages, Berita, Layanan)</li>
                  <li>✅ Sample entries with Papua-themed content</li>
                  <li>✅ Workspace ready for editing</li>
                  {licenseActive && <li>✅ Enterprise mode active — unlimited everything</li>}
                </ul>
              </div>
              <Button
                className="w-full"
                onClick={() => router.push(`/dashboard/${workspaceSlug || workspaceId}`)}
              >
                Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
