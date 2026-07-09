"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Loader2, Save, Server, Info, RefreshCw, Copy, Database, Key
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import { v4 as uuidv4 } from "uuid"

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState({
    globalTenantId: ""
  })

  const generateTenantId = () => {
    // Generate a secure UUID or CUID-like string for tenant ID
    const newId = "wks_" + uuidv4().replace(/-/g, '').substring(0, 24)
    setSettings({ ...settings, globalTenantId: newId })
    toast({ title: "Global Workspace ID Generated", description: "Remember to save changes to apply." })
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
              <p className="text-muted-foreground">Manage core system security and global workspaces.</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              {/* Global Workspace ID */}
              <Card className="border-none shadow-sm bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Global Workspace ID
                  </CardTitle>
                  <CardDescription className="text-xs">Identifies the master tenant containing public API content (Landing Page, Plans, Addons)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="global-tenant-id" className="text-xs font-bold uppercase tracking-tight">Active Workspace ID</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input 
                          id="global-tenant-id" 
                          value={settings.globalTenantId || ""} 
                          readOnly 
                          placeholder="Default: sacms-global"
                          className="pr-9 font-mono text-sm bg-card" 
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            const val = settings.globalTenantId || "";
                            navigator.clipboard.writeText(val)
                            toast({ title: "Copied", description: "Workspace ID copied to clipboard" })
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        title="Generate New Workspace ID"
                        className="h-9 w-9 shrink-0 border-primary/20 hover:bg-primary hover:text-primary-foreground"
                        onClick={generateTenantId}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-tight">
                    Generating a new ID maps the system's global APIs to a completely new tenant. Content from the previous global tenant will still exist in the database but won't be accessed by the public APIs until data is migrated or recreated.
                  </p>
                </CardContent>
              </Card>

              {/* Security Hint */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-blue-800">
                <Info className="h-5 w-5 shrink-0" />
                <p className="text-xs leading-relaxed">
                  These settings are securely stored in the database. The system automatically reads from here instead of `.env` configuration.
                </p>
              </div>
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

