"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, ArrowLeft, Save, Eye, FileText } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
}

interface SingleTypeData {
  id: string
  name: string
  slug: string
  schemaFields: Field[]
}

export default function SingleTypeDataPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params?.slug as string
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [singleType, setSingleType] = useState<SingleTypeData | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [entryId, setEntryId] = useState<string | null>(null)
  const [published, setPublished] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetchData()
  }, [slug])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch single type schema
      const stRes = await fetch(`/api/admin/single-types/by-slug/${slug}`)
      if (!stRes.ok) {
        toast({ title: "Error", description: "Single type not found", variant: "destructive" })
        return
      }
      const stData = await stRes.json()
      setSingleType(stData.singleType || stData)

      // Fetch existing data entries
      const dataRes = await fetch(`/api/admin/global/content?ct=${slug}`)
      if (dataRes.ok) {
        const dataEntries = await dataRes.json()
        const entries = dataEntries.entries || []
        if (entries.length > 0) {
          setEntryId(entries[0].id)
          setFormData(entries[0].data || {})
          setPublished(entries[0].status === "PUBLISHED")
        }
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/single-types/by-slug/${slug}/data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: formData }),
      })
      if (res.ok) {
        toast({ title: "Saved", description: "Data updated successfully" })
        setPublished(true)
      } else {
        const err = await res.json()
        toast({ title: "Error", description: err.error || "Save failed", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const renderField = (field: Field) => {
    const value = formData[field.slug] || ""

    switch (field.type) {
      case "richtext":
      case "textarea":
        return (
          <Textarea
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.slug]: e.target.value })}
            rows={4}
            className="font-mono text-xs"
          />
        )
      default:
        return (
          <Input
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.slug]: e.target.value })}
            className="font-mono text-xs"
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!singleType) {
    return (
      <div className="p-6 text-center">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
        <p className="font-bold">Single type not found</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/single-types")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">{singleType.name}</h1>
          <p className="text-sm text-muted-foreground">/{singleType.slug} — Edit content data</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open(`/api/public/content/${singleType.slug}`, "_blank")}>
          <Eye className="w-4 h-4 mr-2" /> Preview API
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Content Fields</CardTitle>
          <CardDescription>Edit the data for this single type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {singleType.schemaFields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.name}
                {field.required && <span className="text-destructive ml-1">*</span>}
                <span className="text-xs text-muted-foreground ml-2 font-mono">({field.type})</span>
              </Label>
              {renderField(field)}
            </div>
          ))}

          {singleType.schemaFields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No fields defined yet. Edit the schema to add fields.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
