"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import {
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  GripVertical,
  Layers,
  Zap,
} from "lucide-react"
import { FIELD_TYPES, FIELD_CATEGORIES } from "@/lib/field-types"
import { FieldTypeSelector } from "@/components/cms/field-type-selector"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

interface Field {
  name: string
  slug: string
  type: string
  required: boolean
  order: number
  options?: string
}

export default function NewSingleTypePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "", description: "" })
  const [fields, setFields] = useState<Field[]>([
    { name: "Title", slug: "title", type: "text", required: true, order: 0 },
  ])
  const [fieldSelectorOpen, setFieldSelectorOpen] = useState(false)
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null)

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

  const addField = () => {
    const n = fields.length
    setFields([...fields, { name: "", slug: "", type: "text", required: false, order: n }])
  }

  const removeField = (i: number) => {
    setFields(fields.filter((_, idx) => idx !== i).map((f, i) => ({ ...f, order: i })))
  }

  const updateField = (i: number, key: string, value: any) => {
    const updated = [...fields]
    updated[i] = { ...updated[i], [key]: value }
    if (key === "name" && !updated[i].slug) {
      updated[i].slug = generateSlug(value)
    }
    setFields(updated)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast({ title: "Error", description: "Name is required", variant: "destructive" })
    setSaving(true)
    try {
      const res = await fetch("/api/admin/single-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || generateSlug(form.name),
          description: form.description,
          fields: fields.map((f, i) => ({ ...f, order: i })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: "Created", description: `Single type "${data.name}" created` })
        router.push("/admin/single-types")
      } else {
        toast({ title: "Error", description: data.error || "Failed to create", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const adminRoles = ["super_admin", "admin", "employee", "karyawan"]
  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }
  if (!session?.user || !adminRoles.includes(session.user.role)) {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">New Single Type</h1>
          <p className="text-sm text-muted-foreground">Create a singleton content schema for your platform.</p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Basic Information
          </CardTitle>
          <CardDescription>Define the single type name and metadata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value, slug: form.slug || generateSlug(e.target.value) })}
                placeholder="Site Settings"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={e => setForm({ ...form, slug: generateSlug(e.target.value) })}
                placeholder="site-settings"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Global site configuration"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fields */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Fields ({fields.length})
            </CardTitle>
            <CardDescription>Define the schema fields for this single type.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addField}>
            <Plus className="w-4 h-4 mr-1" /> Add Field
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No fields yet. Click "Add Field" to start building your schema.
            </div>
          )}
          {fields.map((field, i) => {
            const typeInfo = FIELD_TYPES.find(ft => ft.type === field.type)
            const Icon = typeInfo?.icon || Zap
            return (
              <div key={i} className="flex items-start gap-2 p-4 border rounded-xl bg-card/50">
                <div className="mt-2 text-muted-foreground/30">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Name</Label>
                    <Input
                      value={field.name}
                      onChange={e => updateField(i, "name", e.target.value)}
                      placeholder="Field name"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Slug</Label>
                    <Input
                      value={field.slug}
                      onChange={e => updateField(i, "slug", e.target.value)}
                      placeholder="slug"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Type</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full justify-start gap-2 text-xs"
                      onClick={() => { setSelectedFieldIndex(i); setFieldSelectorOpen(true) }}
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {field.type}
                    </Button>
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox
                        id={`required-${i}`}
                        checked={field.required}
                        onCheckedChange={v => updateField(i, "required", v)}
                      />
                      <Label htmlFor={`required-${i}`} className="text-xs cursor-pointer">Required</Label>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeField(i)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <FieldTypeSelector
        isOpen={fieldSelectorOpen}
        onOpenChange={setFieldSelectorOpen}
        onSelect={(type) => {
          if (selectedFieldIndex !== null) {
            updateField(selectedFieldIndex, "type", type)
          }
        }}
      />

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="min-w-[140px]">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? "Creating..." : "Create Single Type"}
        </Button>
      </div>
    </div>
  )
}
