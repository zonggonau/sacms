"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Loader2, Save, Server, Info, RefreshCw, Key, Copy, Database
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const [settings, setSettings] = useState({
    systemApiKey: ""
  })

  const generateApiKey = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    let result = "cf_"
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setSettings({ ...settings, systemApiKey: result })
    toast({ title: "API Key Generated", description: "Remember to save changes to apply." })
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings")
      if (res.ok) {
        const data = await res.json()
        if (data.settings && Object.keys(data.settings).length > 0) {
          setSettings((prev) => ({ ...prev, ...data.settings }))
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin") {
      fetchSettings()
    }
  }, [session])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })
      if (res.ok) {
        toast({ title: "Settings Saved", description: "Global configuration updated successfully" })
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update global settings" })
    } finally {
      setSaving(false)
    }
  }

  const handleSeedData = async () => {
    setSeeding(true)
    try {
      const res = await fetch("/api/admin/global/seed", { method: "POST" })
      if (res.ok) {
        toast({ title: "Seed Successful", description: "Global Settings & Content seed generated!" })
      } else {
        const data = await res.json()
        throw new Error(data.error || "Failed to seed global data")
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Seed Error", description: error.message })
    } finally {
      setSeeding(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex">
        <div className="flex-1 min-h-screen flex items-center justify-center flex-col w-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 w-full max-w-4xl space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold">Platform Configuration</h1>
              <p className="text-muted-foreground">Manage core system security and API access.</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              {/* Global API Access */}
              <Card className="border-none shadow-sm bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    Global API Access
                  </CardTitle>
                  <CardDescription className="text-xs">Manage the master key for public content API</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="global-api-key" className="text-xs font-bold uppercase tracking-tight">System API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input 
                          id="global-api-key" 
                          value={settings.systemApiKey} 
                          readOnly 
                          placeholder="No key generated"
                          className="pr-9 font-mono text-sm bg-card" 
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            if (settings.systemApiKey) {
                              navigator.clipboard.writeText(settings.systemApiKey)
                              toast({ title: "Copied", description: "API key copied to clipboard" })
                            }
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 shrink-0 border-primary/20 hover:bg-primary hover:text-primary-foreground"
                        onClick={generateApiKey}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-tight">
                    This key allows public read access to all system/global content types without tenant restrictions.
                  </p>
                </CardContent>
              </Card>

              {/* Security Hint */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-blue-800">
                <Info className="h-5 w-5 shrink-0" />
                <p className="text-xs leading-relaxed">
                  These settings are stored in the database. Environment variables (`.env`) still take precedence for critical secrets like API keys.
                </p>
              </div>

              {/* Global Seed Actions */}
              <Card className="border-none shadow-sm bg-orange-50/50">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Database className="h-5 w-5 text-orange-500" />
                    Seed Global Data
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Generate global schemas and seed basic structural content to initialize the system.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleSeedData} 
                    disabled={seeding}
                    variant="outline" 
                    className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white"
                  >
                    {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    {seeding ? "Generating Seed..." : "Generate Global Seed"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* System Info */}
              <Card className="bg-card shadow-sm border-none overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Server className="h-4 w-4" /> Runtime Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y text-sm">
                    <div className="p-4 flex justify-between items-center">
                      <span className="text-muted-foreground">CMS Version</span>
                      <span className="font-mono font-bold">v0.2.0</span>
                    </div>
                    <div className="p-4 flex justify-between items-center">
                      <span className="text-muted-foreground">Environment</span>
                      <Badge variant="outline" className="text-xs uppercase font-bold">{process.env.NODE_ENV}</Badge>
                    </div>
                    <div className="p-4 flex justify-between items-center">
                      <span className="text-muted-foreground">Database Engine</span>
                      <span className="font-medium">PostgreSQL</span>
                    </div>
                    <div className="p-4 flex justify-between items-center">
                      <span className="text-muted-foreground">Object Storage</span>
                      <span className="font-medium text-blue-600">Cloudflare R2</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
