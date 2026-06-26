"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Gem,
  Plus,
  Copy,
  Check,
  Search,
  ExternalLink,
  Trash2,
} from "lucide-react"

interface License {
  id: string
  licenseKey: string
  displayKey?: string
  customerName: string
  customerEmail: string
  organization: string
  type: string
  expiresAt: string
  isExpired: boolean
  daysRemaining: number
  status: string
  lastValidatedAt: string | null
  validatedCount: number
  createdAt: string
}

export default function EnterpriseLicensesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    organization: "",
    type: "enterprise",
    expiresIn: "365",
  })
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchLicenses = async () => {
    try {
      const res = await fetch("/api/admin/license/list")
      if (res.ok) {
        const data = await res.json()
        setLicenses(data.licenses || [])
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load licenses",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLicenses()
  }, [])

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedKey(true)
      toast({
        title: "Copied!",
        description: "License key copied to clipboard",
      })
      setTimeout(() => setCopiedKey(false), 2000)
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please select and copy manually",
        variant: "destructive",
      })
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGeneratedKey(null)
    setConfirmGenerate(false)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + parseInt(form.expiresIn))

    try {
      const res = await fetch("/api/admin/license/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          organization: form.organization,
          type: form.type,
          expiresAt: expiresAt.toISOString(),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setGeneratedKey(data.licenseKey)
        setShowGenerate(false)
        fetchLicenses()
        setForm({
          customerName: "",
          customerEmail: "",
          organization: "",
          type: "enterprise",
          expiresIn: "365",
        })
        toast({
          title: "License Generated",
          description: `Key created for ${form.customerName}`,
        })
      } else {
        const errData = await res.json()
        toast({
          title: "Generation Failed",
          description: errData.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to generate license",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/license/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast({
          title: "License Deleted",
          description: "The license has been successfully removed.",
        })
        setDeletingId(null)
        fetchLicenses()
      } else {
        const errData = await res.json()
        toast({
          title: "Deletion Failed",
          description: errData.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete license",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredLicenses = licenses.filter((lic) => {
    const matchesSearch =
      lic.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.customerEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.organization?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && lic.status === "active" && !lic.isExpired) ||
      (statusFilter === "expired" && (lic.isExpired || lic.status === "expired"))
    return matchesSearch && matchesStatus
  })

  // Accept all admin-level roles (same as admin layout)
  const adminRoles = ["super_admin", "admin", "employee", "karyawan"]
  if (!session?.user || !adminRoles.includes(session.user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Gem className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only administrators can manage enterprise licenses.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Gem className="w-6 h-6 text-primary" />
            Enterprise Licenses
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage self-hosting license keys for enterprise customers
          </p>
        </div>
        <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Generate Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Generate Enterprise License</DialogTitle>
              <DialogDescription>
                Create a new serial key for a customer. The key will be valid for the selected duration.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setConfirmGenerate(true)
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name *</Label>
                  <Input
                    id="customerName"
                    required
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    placeholder="Pemerintah Kab. Jayawijaya"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                    placeholder="admin@jayawijaya.go.id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org">Organization</Label>
                  <Input
                    id="org"
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                    placeholder="Pemkab Jayawijaya"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">License Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                      <SelectItem value="partner">Partner / Reseller</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Select
                    value={form.expiresIn}
                    onValueChange={(v) => setForm({ ...form, expiresIn: v })}
                  >
                    <SelectTrigger id="duration">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days (Trial)</SelectItem>
                      <SelectItem value="90">3 months</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                      <SelectItem value="730">2 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setShowGenerate(false)}>
                  Cancel
                </Button>
                <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
                  <AlertDialogTrigger asChild>
                    <Button type="submit" disabled={!form.customerName.trim()}>
                      {generating ? "Generating..." : "Generate License"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm License Generation</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will create an enterprise license key for{" "}
                        <strong>{form.customerName}</strong>
                        {form.organization ? ` (${form.organization})` : ""}.
                        The key will be valid for{" "}
                        {form.expiresIn === "30" ? "30 days" :
                         form.expiresIn === "90" ? "3 months" :
                         form.expiresIn === "365" ? "1 year" : "2 years"}.
                        <br /><br />
                        This action cannot be undone. Continue?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleGenerate} disabled={generating}>
                        {generating ? "Generating..." : "Yes, Generate"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Generated Key Success */}
      {generatedKey && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-green-600 flex items-center gap-2">
              <Check className="w-5 h-5" />
              License Key Generated Successfully
            </CardTitle>
            <CardDescription>
              Copy this key and share it with the customer. Keep it secure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="bg-black/5 dark:bg-white/5 p-4 rounded-lg font-mono text-xs break-all select-all border overflow-x-auto">
                {generatedKey}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => handleCopyKey(generatedKey)}
              >
                {copiedKey ? (
                  <><Check className="w-3 h-3 mr-1" /> Copied</>
                ) : (
                  <><Copy className="w-3 h-3 mr-1" /> Copy</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The customer must set this as{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">LICENSE_KEY</code>{" "}
              in their <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">.env</code> file.
              See{" "}
              <a
                href="/enterprise/installation"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                installation guide <ExternalLink className="w-3 h-3" />
              </a>
              .
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer, email, or organization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Licenses Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Validations</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredLicenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Gem className="w-8 h-8 opacity-30" />
                      {searchQuery || statusFilter !== "all" ? (
                        <p>No licenses match your search.</p>
                      ) : (
                        <>
                          <p className="font-medium">No enterprise licenses yet</p>
                          <p className="text-sm">Click "Generate Key" to create your first license.</p>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLicenses.map((lic) => (
                  <TableRow key={lic.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="font-medium">{lic.customerName}</div>
                      {lic.customerEmail && (
                        <div className="text-xs text-muted-foreground">{lic.customerEmail}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lic.organization || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                        {lic.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{new Date(lic.expiresAt).toLocaleDateString()}</div>
                      <div className="text-xs text-muted-foreground">
                        {lic.daysRemaining > 0 ? `${lic.daysRemaining}d left` : "Expired"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lic.status === "active" && !lic.isExpired ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 font-semibold">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 font-semibold">
                          {lic.isExpired ? "Expired" : lic.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{lic.validatedCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopyKey(lic.licenseKey)}
                          title="Copy license key"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingId(lic.id)}
                          title="Delete license"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary */}
      {!loading && licenses.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          Showing {filteredLicenses.length} of {licenses.length} license{licenses.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the license and remove access for any customers using it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button 
              variant="destructive" 
              onClick={() => deletingId && handleDelete(deletingId)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete License"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
