"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft, Plus, Trash2, GripVertical, Zap } from "lucide-react"
import { FIELD_TYPES, FIELD_CATEGORIES } from "@/lib/field-types"
import { FieldTypeSelector } from "@/components/cms/field-type-selector"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"

interface Field {
  slug: string
  name: string
  type: string
  required: boolean
  order: number
}

export default function NewComponentPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "", description: "" })
  const [fields, setFields] = useState<Field[]>([
    { slug: "title", name: "Title", type: "text", required: true, order: 0 },
  ])
  const [fieldSelectorOpen, setFieldSelectorOpen] = useState(false)
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null)

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

  const addField = () => {
    const n = fields.length
    setFields([...fields, { slug: "", name: "", type: "text", required: false, order: n }])
  }

  const removeField = (i: number) => {
    setFields(fields.filter((_, idx) => idx !== i).map((f, i) => ({ ...f, order: i })))
  }

  const updateField = (i: number, key: keyof Field, value: any) => {
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
      const res = await fetch("/api/admin/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || generateSlug(form.name),
          description: form.description,
          fields: fields.map((f, i) => ({ ...f, order: i })),
        }),
      })
      if (res.ok) {
        toast({ title: "Created", description: "Component created" })
        router.push("/admin/components")
      } else {
        const data = await res.json()
        toast({ title: "Error", description: data.error || "Failed to create", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">New Component</h1>
          <p className="text-sm text-muted-foreground">Create a reusable component schema.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: form.slug || generateSlug(e.target.value) })} placeholder="Card Component" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={e => setForm({ ...form, slug: generateSlug(e.target.value) })} placeholder="card" className="font-mono text-xs" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Reusable card with image and text" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fields</CardTitle>
          <Button variant="outline" size="sm" onClick={addField}>
            <Plus className="w-4 h-4 mr-1" /> Add Field
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.map((field, i) => (
            <div key={i} className="flex items-center gap-2 p-3 border rounded-lg bg-card/50">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input value={field.name} onChange={e => updateField(i, "name", e.target.value)} placeholder="Field name" className="h-8 text-sm" />
              <Input value={field.slug} onChange={e => updateField(i, "slug", e.target.value)} placeholder="slug" className="h-8 text-xs font-mono w-32" />
              <Button
                variant="outline"
                size="sm"
                className="h-8 justify-start gap-2 text-xs"
                onClick={() => { setSelectedFieldIndex(i); setFieldSelectorOpen(true) }}
              >
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                {field.type}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeField(i)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
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

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {saving ? "Creating..." : "Create Component"}
        </Button>
      </div>
    </div>
  )
}
