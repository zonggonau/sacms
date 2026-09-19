"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Plus, ExternalLink } from "lucide-react"

interface SingleType {
  id: string
  name: string
  slug: string
  description?: string | null
}

interface RelationFieldProps {
  value: string | null
  onChange: (value: string) => void
  tenantSlug: string
}

export function RelationField({ value, onChange, tenantSlug }: RelationFieldProps) {
  const [singleTypes, setSingleTypes] = useState<SingleType[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newSingleTypeName, setNewSingleTypeName] = useState("")
  const [newSingleTypeSlug, setNewSingleTypeSlug] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchSingleTypes()
  }, [tenantSlug])

  const fetchSingleTypes = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/single-types`)
      if (!response.ok) throw new Error("Failed to fetch single types")
      const data = await response.json()
      setSingleTypes(data || [])
    } catch (error) {
      console.error("Error fetching single types:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSingleType = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newSingleTypeName.trim()) return

    setCreating(true)
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/single-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSingleTypeName,
          slug: newSingleTypeSlug || newSingleTypeName.toLowerCase().replace(/\s+/g, "-"),
          description: "",
          isPublished: true,
        }),
      })

      if (!response.ok) throw new Error("Failed to create single type")

      const data = await response.json()
      onChange(data.singleType.slug)
      setShowCreateDialog(false)
      setNewSingleTypeName("")
      setNewSingleTypeSlug("")
      await fetchSingleTypes()
    } catch (error) {
      console.error("Error creating single type:", error)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-2">
      <Select
        value={value || ""}
        onValueChange={onChange}
        disabled={loading}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a Single Type to relate" />
        </SelectTrigger>
        <SelectContent>
          {singleTypes.length === 0 && !loading ? (
            <div className="p-2 text-sm text-muted-foreground text-center">
              No single types found
            </div>
          ) : (
            singleTypes.map((st) => (
              <SelectItem key={st.id} value={st.slug}>
                {st.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowCreateDialog(true)}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Create New Single Type
      </Button>

      {/* Create Single Type Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Single Type</DialogTitle>
            <DialogDescription>
              Create a new single type to use as relation. This will open in a new tab for complete configuration.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSingleType} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newSingleTypeName}
                onChange={(e) => {
                  setNewSingleTypeName(e.target.value)
                  if (!newSingleTypeSlug) {
                    setNewSingleTypeSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
                  }
                }}
                placeholder="e.g., Author, Category, Tag"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug (Optional)</label>
              <Input
                value={newSingleTypeSlug}
                onChange={(e) => setNewSingleTypeSlug(e.target.value)}
                placeholder="author, category, tag"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false)
                  // Open in new tab for full configuration
                  if (newSingleTypeName.trim()) {
                    const slug = newSingleTypeSlug || newSingleTypeName.toLowerCase().replace(/\s+/g, "-")
                    window.open(
                      `/dashboard/${tenantSlug}/single-types/new?name=${encodeURIComponent(newSingleTypeName)}&slug=${slug}`,
                      "_blank"
                    )
                  }
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create & Select"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}