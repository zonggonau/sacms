"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { TenantPageLayout } from "@/components/dashboard/tenant-page-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Plus, Trash2, Star, Globe } from "lucide-react"

interface TenantLocale {
  id: string
  locale: string
  name: string
  isDefault: boolean
}

const AVAILABLE_LOCALES = [
  { code: "en", name: "English" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "ko", name: "Korean" },
  { code: "ms", name: "Bahasa Melayu" },
  { code: "th", name: "Thai" },
  { code: "vi", name: "Vietnamese" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "pt", name: "Portuguese" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "ru", name: "Russian" },
  { code: "it", name: "Italian" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "tr", name: "Turkish" },
  { code: "sv", name: "Swedish" },
]

export default function LocalizationSettingsPage() {
  const params = useParams()
  const tenantSlug = params.tenant as string
  const { toast } = useToast()

  const [locales, setLocales] = useState<TenantLocale[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newLocaleCode, setNewLocaleCode] = useState("")
  const [newLocaleName, setNewLocaleName] = useState("")
  const [newLocaleDefault, setNewLocaleDefault] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  useEffect(() => {
    fetchLocales()
  }, [tenantSlug])

  async function fetchLocales() {
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/locales`)
      if (res.ok) {
        const data = await res.json()
        setLocales(data.locales || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load locales" })
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    if (!newLocaleCode || !newLocaleName) return
    setAdding(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/locales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: newLocaleCode,
          name: newLocaleName,
          isDefault: newLocaleDefault,
        }),
      })
      if (res.ok) {
        toast({ title: "Added", description: `Locale "${newLocaleName}" added successfully` })
        setAddDialogOpen(false)
        setNewLocaleCode("")
        setNewLocaleName("")
        setNewLocaleDefault(false)
        await fetchLocales()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to add locale" })
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to add locale" })
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this locale?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/locales/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Removed", description: "Locale removed" })
        await fetchLocales()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to remove locale" })
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to remove locale" })
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSetDefault(id: string) {
    setSettingDefaultId(id)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/locales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      })
      if (res.ok) {
        toast({ title: "Updated", description: "Default locale changed" })
        await fetchLocales()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error || "Failed to update" })
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to update locale" })
    } finally {
      setSettingDefaultId(null)
    }
  }

  // Filter out already-added locales from the selection dropdown
  const usedCodes = new Set(locales.map((l) => l.locale))
  const availableToAdd = AVAILABLE_LOCALES.filter((l) => !usedCodes.has(l.code))

  return (
    <TenantPageLayout
      tenantSlug={tenantSlug}
      title="Localization"
      description="Manage languages for your workspace. Each content type supports all enabled locales."
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="max-w-8xl space-y-6">
          {/* Header actions */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {locales.length} / 5 locales configured
              </p>
            </div>
            <Button
              size="sm"
              disabled={locales.length >= 5}
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Locale
            </Button>
          </div>

          {/* Locales table */}
          {locales.length === 0 ? (
            <div className="border rounded-lg p-12 text-center">
              <Globe className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 text-sm font-medium">No locales configured</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first locale to enable multilingual content.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Add Locale
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Locale Code</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locales.map((locale) => (
                    <TableRow key={locale.id}>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{locale.locale}</code>
                      </TableCell>
                      <TableCell className="font-medium">{locale.name}</TableCell>
                      <TableCell>
                        {locale.isDefault ? (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
                            <Star className="mr-1 h-3 w-3" /> Default
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground h-7"
                            disabled={settingDefaultId === locale.id}
                            onClick={() => handleSetDefault(locale.id)}
                          >
                            {settingDefaultId === locale.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Set as default"
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!locale.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-7 w-7 p-0"
                            disabled={deletingId === locale.id}
                            onClick={() => handleDelete(locale.id)}
                          >
                            {deletingId === locale.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Info card */}
          <div className="rounded-lg bg-muted/50 border p-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">How localization works</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Each content entry is created per locale — they share the same structure but have separate data</li>
              <li>The default locale is used as fallback when a requested locale is not available</li>
              <li>The content editor shows a locale switcher when multiple locales are enabled</li>
              <li>Public API supports <code className="bg-background px-1 rounded">?locale=en</code> parameter</li>
              <li>Maximum 5 locales per tenant in v1.0</li>
            </ul>
          </div>
        </div>
      )}

      {/* Add Locale Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Locale</DialogTitle>
            <DialogDescription>
              Add a new language to your workspace. All content types will support this locale.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Language</Label>
              {availableToAdd.length === 0 ? (
                <p className="text-sm text-muted-foreground">All available locales have been added.</p>
              ) : (
                <Select
                  value={newLocaleCode}
                  onValueChange={(code) => {
                    setNewLocaleCode(code)
                    const match = AVAILABLE_LOCALES.find((l) => l.code === code)
                    if (match) setNewLocaleName(match.name)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a language..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToAdd.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.name} ({l.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={newLocaleName}
                onChange={(e) => setNewLocaleName(e.target.value)}
                placeholder="e.g. English, Bahasa Indonesia"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!newLocaleCode || !newLocaleName || adding}
              onClick={handleAdd}
            >
              {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Locale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TenantPageLayout>
  )
}
