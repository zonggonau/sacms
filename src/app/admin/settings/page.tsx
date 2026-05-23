"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { 
  Loader2, Settings, Save, Database, Globe, Bell, 
  Shield, Server, Construction, Mail, HardDrive, Cpu, 
  Info, AlertTriangle, RefreshCw, Key, Copy
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState({
    siteName: "SaCMS",
    siteUrl: "http://localhost:3000",
    description: "Multi-tenant Content Management System",
    email: "admin@sacms.com",
    allowRegistration: "true",
    requireEmailVerification: "true",
    defaultTenantPlan: "free",
    maxTenants: "100",
    maxUsersPerTenant: "10",
    maintenanceMode: "false",
    maintenanceMessage: "System is currently undergoing maintenance. Please check back soon.",
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
        <div className="p-6 lg:p-8 w-full space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold">Platform Configuration</h1>
              <p className="text-muted-foreground">Adjust global defaults, maintenance settings, and system policies.</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Form Settings */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Maintenance Mode Card */}
              <Card className={`border-none shadow-sm transition-colors ${settings.maintenanceMode === 'true' ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-card'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Construction className={`h-5 w-5 ${settings.maintenanceMode === 'true' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                        Maintenance Mode
                      </CardTitle>
                      <CardDescription>Disable platform access during updates</CardDescription>
                    </div>
                    <Switch
                      checked={settings.maintenanceMode === "true"}
                      onCheckedChange={(v) => setSettings({...settings, maintenanceMode: String(v)})}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {settings.maintenanceMode === 'true' && (
                    <div className="space-y-2">
                      <Label htmlFor="maint-msg" className="text-xs font-bold text-amber-700">Display Message</Label>
                      <Textarea 
                        id="maint-msg" 
                        value={settings.maintenanceMessage}
                        onChange={e => setSettings({...settings, maintenanceMessage: e.target.value})}
                        className="bg-card border-amber-200 focus-visible:ring-amber-500" 
                        rows={2}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* General Config */}
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    Branding & SEO
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="siteName">Platform Name</Label>
                      <Input id="siteName" value={settings.siteName} onChange={e => setSettings({...settings, siteName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="siteUrl">Base URL</Label>
                      <Input id="siteUrl" value={settings.siteUrl} onChange={e => setSettings({...settings, siteUrl: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-desc">Meta Description</Label>
                    <Textarea id="site-desc" value={settings.description} onChange={e => setSettings({...settings, description: e.target.value})} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">System Email (SMTP Sender)</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="admin-email" className="pl-10" value={settings.email} onChange={e => setSettings({...settings, email: e.target.value})} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Registration & Security */}
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-emerald-500" />
                    Access Policies
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Public Registration</Label>
                      <p className="text-xs text-muted-foreground">Allow new users to sign up themselves</p>
                    </div>
                    <Switch checked={settings.allowRegistration === "true"} onCheckedChange={v => setSettings({...settings, allowRegistration: String(v)})} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Email Verification</Label>
                      <p className="text-xs text-muted-foreground">Mandatory verify before login</p>
                    </div>
                    <Switch checked={settings.requireEmailVerification === "true"} onCheckedChange={v => setSettings({...settings, requireEmailVerification: String(v)})} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Platform Limits & Info */}
            <div className="space-y-6">
              
              {/* Tenant Defaults */}
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Resource Quotas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Default Tenant Plan</Label>
                    <Select value={settings.defaultTenantPlan} onValueChange={v => setSettings({...settings, defaultTenantPlan: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Max Tenants Limit</Label>
                    <Input type="number" value={settings.maxTenants} onChange={e => setSettings({...settings, maxTenants: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Default Users/Tenant</Label>
                    <Input type="number" value={settings.maxUsersPerTenant} onChange={e => setSettings({...settings, maxUsersPerTenant: e.target.value})} />
                  </div>
                </CardContent>
              </Card>

              {/* Global API Access */}
              <Card className="border-none shadow-sm bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    Global API Access
                  </CardTitle>
                  <CardDescription className="text-[10px]">Manage the master key for public content API</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="global-api-key" className="text-[10px] font-bold uppercase tracking-tight">System API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input 
                          id="global-api-key" 
                          value={settings.systemApiKey} 
                          readOnly 
                          placeholder="No key generated"
                          className="pr-9 font-mono text-xs bg-card h-9" 
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
                  <p className="text-[9px] text-muted-foreground italic leading-tight">
                    This key allows public read access to all system/global content types without tenant restrictions.
                  </p>
                </CardContent>
              </Card>

              {/* System Info */}
              <Card className="bg-card shadow-sm border-none overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Server className="h-4 w-4" /> Runtime Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y text-xs">
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">CMS Version</span>
                      <span className="font-mono font-bold">v0.2.0</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">Environment</span>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold">{process.env.NODE_ENV}</Badge>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">Database Engine</span>
                      <span className="font-medium">PostgreSQL</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">Object Storage</span>
                      <span className="font-medium text-blue-600">Cloudflare R2</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Hint */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-blue-800">
                <Info className="h-5 w-5 shrink-0" />
                <p className="text-[11px] leading-relaxed">
                  These settings are stored in the database. Environment variables (`.env`) still take precedence for critical secrets like API keys.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
