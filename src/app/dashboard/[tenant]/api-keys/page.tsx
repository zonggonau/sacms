"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Plus,
  Key,
  Copy,
  Trash2,
  Check,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ApiToken {
  id: string
  tenantId: string
  name: string
  token: string
  permissions: string[]
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export default function TenantApiKeysPage() {
  const params = useParams()
  const { data: session } = useSession()
  const tenantSlug = params.tenant as string
  const { toast } = useToast()

  const [contentTypes, setContentTypes] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTokenName, setNewTokenName] = useState("")
  const [newTokenPermissions, setNewTokenPermissions] = useState<string[]>(["read"])

  const tenants = session?.user?.tenants || []

  useEffect(() => {
    async function fetchData() {
      if (!tenantSlug || !session?.user) return

      try {
        // Fetch content types for sidebar
        const ctRes = await fetch(`/api/tenant/${tenantSlug}/content-types`)
        if (ctRes.ok) {
          const data = await ctRes.json()
          setContentTypes(data.contentTypes || [])
        }

        // Fetch API tokens
        const tokenRes = await fetch(`/api/tenant/${tenantSlug}/api-tokens`)
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json()
          setApiTokens(tokenData.tokens || [])
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
  }, [tenantSlug, session])

  const handleCopyKey = async (token: string, label: string = "API key") => {
    try {
      await navigator.clipboard.writeText(token)
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to copy ${label.toLowerCase()}`,
      })
    }
  }

  const handleCreateKey = async () => {
    if (!newTokenName || newTokenPermissions.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please provide a name and at least one permission",
      })
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/api-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTokenName,
          permissions: newTokenPermissions,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setApiTokens([...apiTokens, data.token])
        setShowCreateDialog(false)
        setNewTokenName("")
        setNewTokenPermissions(["read"])
        toast({
          title: "Success",
          description: "API key created successfully",
        })
      } else {
        const data = await res.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to create API key",
        })
      }
    } catch (error) {
      console.error("Failed to create API key:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create API key",
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteKey = async (tokenId: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/api-tokens/${tokenId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setApiTokens(apiTokens.filter((t) => t.id !== tokenId))
        toast({
          title: "Success",
          description: "API key deleted successfully",
        })
      } else {
        const data = await res.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to delete API key",
        })
      }
    } catch (error) {
      console.error("Failed to delete API key:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete API key",
      })
    }
  }

  const handleTogglePermission = (perm: string) => {
    setNewTokenPermissions((prev) =>
      prev.includes(perm)
        ? prev.filter((p) => p !== perm)
        : [...prev, perm]
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">API Keys</h1>
              <p className="text-muted-foreground">
                Manage API keys for your workspace
              </p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create API Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key for accessing the Content API
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Key Name</Label>
                    <Input
                      id="key-name"
                      placeholder="e.g., Production API Key"
                      value={newTokenName}
                      onChange={(e) => setNewTokenName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="space-y-2">
                      {["read", "write", "delete"].map((perm) => (
                        <div key={perm} className="flex items-center space-x-2">
                          <Checkbox
                            id={perm}
                            checked={newTokenPermissions.includes(perm)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewTokenPermissions([...newTokenPermissions, perm])
                              } else {
                                setNewTokenPermissions(
                                  newTokenPermissions.filter((p) => p !== perm)
                                )
                              }
                            }}
                          />
                          <label htmlFor={perm} className="text-sm capitalize">
                            {perm}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateKey} disabled={creating}>
                    {creating ? "Creating..." : "Create Key"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Info Banner */}
          <Card className="mb-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
            <CardContent className="flex items-center gap-4 p-4">
              <Key className="h-8 w-8 text-emerald-500" />
              <div>
                <h3 className="font-semibold">API Authentication</h3>
                <p className="text-sm text-muted-foreground">
                  Use API keys to authenticate requests to your content endpoints.{" "}
                  Include the key in the{" "}
                  <code className="bg-muted px-1 rounded">Authorization</code>{" "}
                  header.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Keys
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{apiTokens.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Read Permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {apiTokens.filter((k) => k.permissions.includes("read")).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Write Permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {apiTokens.filter((k) => k.permissions.includes("write")).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Delete Permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {apiTokens.filter((k) => k.permissions.includes("delete")).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* API Keys Table */}
          <Card>
            <CardHeader>
              <CardTitle>Your API Keys</CardTitle>
              <CardDescription>
                Keep your API keys secure. Never share them publicly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiTokens.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No API keys yet</p>
                  <p className="text-sm mt-1">
                    Create your first API key to get started
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Tenant ID</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiTokens.map((apiKey) => (
                      <TableRow key={apiKey.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{apiKey.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {apiKey.token.substring(0, 15)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyKey(apiKey.token)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted/50 px-2 py-1 rounded text-xs">
                              {apiKey.tenantId}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyKey(apiKey.tenantId, "Tenant ID")}
                              className="h-7 w-7"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {apiKey.permissions.map((perm) => (
                              <Badge key={perm} variant="outline" className="text-xs">
                                {perm}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(apiKey.createdAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(apiKey.lastUsedAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteKey(apiKey.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}