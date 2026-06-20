"use client"

import { useState, useTransition } from "react"
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
import { Plus, Key, Copy, Trash2, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createApiTokenAction, deleteApiTokenAction } from "@/actions/api-keys"

interface ApiToken {
  id: string
  tenantId: string
  name: string
  token: string
  permissions: string[]
  expiresAt: Date | string | null
  lastUsedAt: Date | string | null
  createdAt: Date | string
}

interface ApiKeysClientProps {
  initialTokens: ApiToken[]
  tenantSlug: string
}

export function ApiKeysClient({ initialTokens, tenantSlug }: ApiKeysClientProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTokenName, setNewTokenName] = useState("")
  const [newTokenPermissions, setNewTokenPermissions] = useState<string[]>(["read"])
  const [createdPlainToken, setCreatedPlainToken] = useState<string | null>(null)
  const [showTokenDialog, setShowTokenDialog] = useState(false)

  const handleCopyKey = async (token: string, label: string = "API key") => {
    if (!token) return
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

  const handleCreateKey = () => {
    if (!newTokenName || newTokenPermissions.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please provide a name and at least one permission",
      })
      return
    }

    startTransition(async () => {
      const res = await createApiTokenAction(tenantSlug, {
        name: newTokenName,
        permissions: newTokenPermissions,
      })

      if (res.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.error,
        })
      } else {
        setShowCreateDialog(false)
        setNewTokenName("")
        setNewTokenPermissions(["read"])
        setCreatedPlainToken(res.plainToken || null)
        setShowTokenDialog(true)
        toast({
          title: "Success",
          description: "API key created successfully",
        })
      }
    })
  }

  const handleDeleteKey = (tokenId: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return

    startTransition(async () => {
      const res = await deleteApiTokenAction(tenantSlug, tokenId)
      if (res.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.error,
        })
      } else {
        toast({
          title: "Success",
          description: "API key deleted successfully",
        })
      }
    })
  }

  const formatDate = (dateString: Date | string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 min-h-screen flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">
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
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateKey} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {isPending ? "Creating..." : "Create Key"}
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
                <div className="text-2xl font-bold">{initialTokens.length}</div>
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
                  {initialTokens.filter((k) => k.permissions.includes("read")).length}
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
                  {initialTokens.filter((k) => k.permissions.includes("write")).length}
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
                  {initialTokens.filter((k) => k.permissions.includes("delete")).length}
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
              {initialTokens.length === 0 ? (
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
                    {initialTokens.map((apiKey) => (
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
                              {(apiKey.token || "").substring(0, 15)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyKey(apiKey.token || "")}
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
                            disabled={isPending}
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

        {/* Created Token Display Dialog */}
        <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>API Key Created</DialogTitle>
              <DialogDescription>
                Make sure to copy your API key now. You won't be able to see it again!
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2 py-4">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="token" className="sr-only">
                  API Key
                </Label>
                <Input
                  id="token"
                  defaultValue={createdPlainToken || ""}
                  readOnly
                  className="font-mono text-sm"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="px-3"
                onClick={() => handleCopyKey(createdPlainToken || "", "API key")}
              >
                <span className="sr-only">Copy</span>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter className="sm:justify-start">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowTokenDialog(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}
