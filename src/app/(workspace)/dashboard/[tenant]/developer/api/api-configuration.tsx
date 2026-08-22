"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Copy, Loader2, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function ApiConfiguration({ tenantSlug }: { tenantSlug: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // API settings
  const [apiKey, setApiKey] = useState("")
  const [generatingApiKey, setGeneratingApiKey] = useState(false)
  const [apiVersion, setApiVersion] = useState("v1")
  const [rateLimiting, setRateLimiting] = useState(true)
  const [requestsPerMinute, setRequestsPerMinute] = useState("60")
  const [burstLimit, setBurstLimit] = useState("100")
  const [corsOrigins, setCorsOrigins] = useState("")

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/settings`)
        if (res.ok) {
          const data = await res.json()
          const settings = data.settings
          setApiKey(settings.apiKey || "")
          setApiVersion(settings.apiVersion || "v1")
          setRateLimiting(settings.rateLimiting ?? true)
          setRequestsPerMinute(String(settings.requestsPerMinute || 60))
          setBurstLimit(String(settings.burstLimit || 100))
          setCorsOrigins(settings.corsOrigins || "")
        }
      } catch (error) {
        console.error("Failed to fetch API settings:", error)
      } finally {
        setLoading(false)
      }
    }

    if (tenantSlug) {
      fetchData()
    }
  }, [tenantSlug])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiVersion,
          rateLimiting,
          requestsPerMinute: parseInt(requestsPerMinute),
          burstLimit: parseInt(burstLimit),
          corsOrigins,
        }),
      })

      if (res.ok) {
        toast({
          title: "Settings saved",
          description: "API configuration updated successfully",
        })
      } else {
        const data = await res.json()
        toast({
          title: "Error",
          description: data.error || "Failed to save settings",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to save:", error)
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateApiKey = async () => {
    if (!confirm("Are you sure you want to generate a new API key? The old key will no longer work for new integrations if you rely on it.")) return
    
    setGeneratingApiKey(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/api-keys`, {
        method: "POST",
      })

      if (res.ok) {
        const data = await res.json()
        setApiKey(data.apiKey)
        toast({
          title: "Success",
          description: "New API key generated successfully",
        })
      } else {
        const data = await res.json()
        toast({
          title: "Error",
          description: data.error || "Failed to generate API key",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to generate API key:", error)
      toast({
        title: "Error",
        description: "Failed to generate API key",
        variant: "destructive",
      })
    } finally {
      setGeneratingApiKey(false)
    }
  }

  const handleCopyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      toast({
        title: "Copied",
        description: "API Key copied to clipboard",
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Configuration</CardTitle>
        <CardDescription>
          Configure API settings for your workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                value={apiKey || "No API key generated"}
                readOnly
                className="pr-10 font-mono text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleCopyApiKey}
                disabled={!apiKey}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              variant="secondary" 
              onClick={handleGenerateApiKey}
              disabled={generatingApiKey}
            >
              {generatingApiKey ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Generate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use this key to authenticate external applications and integrations.
          </p>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>API Version</Label>
          <Select value={apiVersion} onValueChange={setApiVersion}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="v1">v1 (Stable)</SelectItem>
              <SelectItem value="v2">v2 (Beta)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <Label>Rate Limiting</Label>
            <p className="text-sm text-muted-foreground">
              Enable rate limiting for API requests
            </p>
          </div>
          <Switch checked={rateLimiting} onCheckedChange={setRateLimiting} />
        </div>
        {rateLimiting && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Requests per minute</Label>
              <Input
                type="number"
                value={requestsPerMinute}
                onChange={(e) => setRequestsPerMinute(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Burst limit</Label>
              <Input
                type="number"
                value={burstLimit}
                onChange={(e) => setBurstLimit(e.target.value)}
              />
            </div>
          </div>
        )}
        <Separator />
        <div className="space-y-2">
          <Label>Allowed Origins (CORS)</Label>
          <Textarea
            placeholder="Enter allowed origins, one per line&#10;https://example.com&#10;https://app.example.com"
            rows={4}
            value={corsOrigins}
            onChange={(e) => setCorsOrigins(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Enter domain names, one per line. Use * for all origins (not recommended for production)
          </p>
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
