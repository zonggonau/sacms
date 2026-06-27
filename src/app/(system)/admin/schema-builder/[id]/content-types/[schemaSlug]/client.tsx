"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTemplateEditor, SchemaItem } from "../../template-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FieldTypeSelector } from "@/components/cms/field-type-selector"
import { FieldConfigModal, Field } from "@/components/cms/field-config-modal"
import { ArrowLeft, Save, Plus, Settings2, Trash2 } from "lucide-react"
import Link from "next/link"
import { FIELD_TYPES } from "@/lib/field-types"
import { toast } from "@/hooks/use-toast"

export function AdminTemplateSchemaEditor({
  schemaType,
  schemaSlug
}: {
  schemaType: "contentTypes" | "singleTypes" | "components"
  schemaSlug: string
}) {
  const router = useRouter()
  const { templateId, data, updateSchema } = useTemplateEditor()

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [fields, setFields] = useState<Field[]>([])

  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)

  const isNew = schemaSlug === "new"

  useEffect(() => {
    if (!isNew) {
      const list = data.schema_template?.[schemaType] || []
      const existing = list.find(s => s.slug === schemaSlug)
      if (existing) {
        setName(existing.name)
        setSlug(existing.slug)
        setDescription(existing.description || "")
        setFields(existing.fields || [])
      }
    }
  }, [schemaSlug, isNew, data.schema_template, schemaType])

  useEffect(() => {
    if (isNew && name && !editingField) {
      const generatedSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      setSlug(generatedSlug)
    }
  }, [name, isNew, editingField])

  const openTypeSelector = () => setIsTypeSelectorOpen(true)

  const selectType = (type: string) => {
    const newField: Field = {
      id: Date.now().toString(),
      name: "",
      slug: "",
      type: type,
      required: false,
      unique: false,
      options: null,
      relationType: "",
      targetModel: "",
      targetSlug: "",
      componentSlug: "",
      repeatable: false
    }
    setEditingField(newField)
    setIsTypeSelectorOpen(false)
    setIsConfigModalOpen(true)
  }

  const saveField = () => {
    if (!editingField || !editingField.name || !editingField.slug) {
      toast({ variant: "destructive", title: "Error", description: "Field name and slug are required" })
      return
    }

    if (fields.some(f => f.slug === editingField.slug && f.id !== editingField.id)) {
      toast({ variant: "destructive", title: "Error", description: "Field slug must be unique" })
      return
    }

    setFields(prev => {
      const existingIndex = prev.findIndex(f => f.id === editingField.id)
      if (existingIndex >= 0) {
        const newFields = [...prev]
        newFields[existingIndex] = editingField
        return newFields
      } else {
        return [...prev, editingField]
      }
    })
    
    setIsConfigModalOpen(false)
    setEditingField(null)
  }

  const editField = (field: Field) => {
    setEditingField(field)
    setIsConfigModalOpen(true)
  }

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  const handleSaveSchema = () => {
    if (!name || !slug) {
      toast({ variant: "destructive", title: "Error", description: "Name and slug are required" })
      return
    }

    const schema: SchemaItem = {
      name,
      slug,
      description,
      fields
    }

    updateSchema(schemaType, schema)
    toast({ title: "Saved", description: `${name} has been updated in the template draft.` })
    router.push(`/admin/schema-builder/${templateId}/${schemaType === "contentTypes" ? "content-types" : schemaType === "singleTypes" ? "single-types" : "components"}`)
  }

  return (
    <div className="flex flex-col h-full bg-[#f6f6f9]">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href={`/admin/schema-builder/${templateId}/${schemaType === "contentTypes" ? "content-types" : schemaType === "singleTypes" ? "single-types" : "components"}`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{isNew ? "Create new" : name}</h1>
            <p className="text-sm text-muted-foreground">
              {schemaType === "contentTypes" ? "Content Type" : schemaType === "singleTypes" ? "Single Type" : "Component"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href={`/admin/schema-builder/${templateId}/${schemaType === "contentTypes" ? "content-types" : schemaType === "singleTypes" ? "single-types" : "components"}`}>Cancel</Link>
          </Button>
          <Button onClick={handleSaveSchema}>
            <Save className="h-4 w-4 mr-2" />
            Save to Template
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Fields</h2>
              <p className="text-sm text-muted-foreground">Build the structure for {name || "this schema"}</p>
            </div>
            {fields.length > 0 && (
              <Button onClick={openTypeSelector} variant="secondary" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            )}
          </div>

          {fields.length === 0 ? (
            <div className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center bg-white/50">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-1">Add your first field</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Build your data structure by adding fields like Text, Media, Rich Text, or Relations.
              </p>
              <Button onClick={openTypeSelector}>
                <Plus className="h-4 w-4 mr-2" />
                Add new field
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => {
                const ft = FIELD_TYPES.find(t => t.type === field.type)
                const Icon = ft?.icon || Settings2
                
                return (
                  <div key={`${field.id || field.slug || 'field'}-${index}`} className="group flex items-center justify-between bg-white border rounded-lg p-3 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-md text-slate-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {field.name}
                          {field.required && <span className="text-red-500 text-xs">*</span>}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {field.slug} • {ft?.label || field.type}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editField(field)}>
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeField(field.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Basic Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. Article" 
                />
              </div>
              <div className="space-y-2">
                <Label>Slug ID</Label>
                <Input 
                  value={slug} 
                  onChange={e => setSlug(e.target.value)} 
                  placeholder="e.g. article" 
                  disabled={!isNew}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="What is this used for?" 
                  className="resize-none"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <FieldTypeSelector 
        isOpen={isTypeSelectorOpen}
        onOpenChange={setIsTypeSelectorOpen}
        onSelect={selectType}
      />

      <FieldConfigModal 
        isOpen={isConfigModalOpen}
        onOpenChange={setIsConfigModalOpen}
        editingField={editingField}
        setEditingField={setEditingField}
        fields={fields}
        tenantSlug="global-template-editor"
        context={schemaType === "contentTypes" ? "contentType" : schemaType === "singleTypes" ? "singleType" : "component"}
        onSave={saveField}
        templateComponents={data.schema_template?.components || []}
        templateContentTypes={data.schema_template?.contentTypes || []}
        templateSingleTypes={data.schema_template?.singleTypes || []}
      />
    </div>
  )
}
