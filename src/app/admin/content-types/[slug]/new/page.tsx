"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { 
  ArrowLeft, Save, Send, FileText, CheckCircle2, 
  Clock, Archive, Loader2, Globe, Layout, ChevronDown,
  Copy, Check, Info
} from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { TextField } from "@/components/content/field-renderers/text-field"
import { TextareaField } from "@/components/content/field-renderers/textarea-field"
import { NumberField } from "@/components/content/field-renderers/number-field"
import { DateTimeField } from "@/components/content/field-renderers/datetime-field"
import { BooleanField } from "@/components/content/field-renderers/boolean-field"
import { DateField } from "@/components/content/field-renderers/date-field"
import { SelectField } from "@/components/content/field-renderers/select-field"
import { MediaField } from "@/components/content/field-renderers/media-field"
import { MediaMultipleField } from "@/components/content/field-renderers/media-multiple-field"
import { RichTextField } from "@/components/content/field-renderers/rich-text-field"
import { ButtonField } from "@/components/content/field-renderers/button-field"
import { ComponentField } from "@/components/content/field-renderers/component-field"
import { AdvancedField } from "@/components/content/field-renderers/advanced-fields"
import { SlugField } from "@/components/content/field-renderers/slug-field"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  options: any
}

interface ContentType {
  id: string
  name: string
  slug: string
  description: string | null
  fields: Field[]
}

export default function AdminCreateEntryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const contentTypeSlug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [entryStatus, setEntryStatus] = useState<string>("DRAFT")
  const [locale, setLocale] = useState<string>("en")
  const [availableLocales, setAvailableLocales] = useState<any[]>([{ locale: "en", name: "English" }])
  const [copied, setCopied] = useState(false)

  const templateDocumentation = {
    "contentTypes": [
      {
        "name": "Master Template",
        "slug": "master-template",
        "description": "Template utama dengan semua jenis field tersedia untuk referensi model data",
        "isPublished": true,
        "fields": [
          { "name": "Text", "slug": "f_text", "type": "text", "label": "Text", "category": "Basic", "description": "Short text field", "required": true, "order": 0 },
          { "name": "Long Text", "slug": "f_textarea", "type": "textarea", "label": "Long Text", "category": "Basic", "description": "Multi-line text field", "order": 1 },
          { "name": "Rich Text (HTML)", "slug": "f_richtext", "type": "richText", "label": "Rich Text (HTML)", "category": "Basic", "description": "WYSIWYG editor", "order": 2 },
          { "name": "Markdown", "slug": "f_markdown", "type": "markdown", "label": "Markdown", "category": "Basic", "description": "Markdown editor", "order": 3 },
          { "name": "Slug", "slug": "f_slug", "type": "slug", "label": "Slug", "category": "Basic", "description": "URL-friendly string, auto-generated", "order": 4 },
          { "name": "Number", "slug": "f_number", "type": "number", "label": "Number", "category": "Number", "description": "Integer or decimal values", "order": 5 },
          { "name": "Date", "slug": "f_date", "type": "date", "label": "Date", "category": "Date & Time", "description": "Date picker", "order": 6 },
          { "name": "DateTime", "slug": "f_datetime", "type": "datetime", "label": "DateTime", "category": "Date & Time", "description": "Date and time picker", "order": 7 },
          { "name": "Time", "slug": "f_time", "type": "time", "label": "Time", "category": "Date & Time", "description": "Time picker", "order": 8 },
          { "name": "Select", "slug": "f_select", "type": "select", "label": "Select", "category": "Selection", "description": "Dropdown or radio selection", "options": "Option 1,Option 2,Option 3", "order": 9 },
          { "name": "Tags", "slug": "f_tags", "type": "tags", "label": "Tags", "category": "Selection", "description": "Array of strings", "order": 10 },
          { "name": "Boolean", "slug": "f_boolean", "type": "boolean", "label": "Boolean", "category": "Boolean", "description": "True/False toggle", "order": 11 },
          { "name": "Email", "slug": "f_email", "type": "email", "label": "Email", "category": "Validation", "description": "Validated email address", "order": 12 },
          { "name": "UID", "slug": "f_uid", "type": "uid", "label": "UID", "category": "Validation", "description": "Unique identifier", "order": 13 },
          { "name": "Media", "slug": "f_media", "type": "media", "label": "Media", "category": "Media", "description": "Single media file", "order": 14 },
          { "name": "Media (Multiple)", "slug": "f_media_multiple", "type": "mediaMultiple", "label": "Media (Multiple)", "category": "Media", "description": "Gallery or multi-upload", "order": 15 },
          { "name": "File", "slug": "f_file", "type": "file", "label": "File", "category": "Media", "description": "Document or binary file", "order": 16 },
          { "name": "Relation", "slug": "f_relation", "type": "relation", "label": "Relation", "category": "Relations", "description": "Link to another collection", "relationSlug": "other-collection", "order": 17 },
          { "name": "Component", "slug": "f_component", "type": "component", "label": "Component", "category": "Relations", "description": "Reusable field group", "relationSlug": "my-component", "order": 18 },
          { "name": "JSON", "slug": "f_json", "type": "json", "label": "JSON", "category": "Advanced", "description": "Custom JSON structure", "order": 19 },
          { "name": "Color", "slug": "f_color", "type": "color", "label": "Color", "category": "Advanced", "description": "Color hex picker", "order": 20 },
          { "name": "Location", "slug": "f_location", "type": "location", "label": "Location", "category": "Advanced", "description": "Geographical coordinates", "order": 21 }
        ]
      }
    ],
    "singleTypes": [
      {
        "name": "Site Config",
        "slug": "site-config",
        "description": "Halaman konfigurasi tunggal",
        "isPublished": true,
        "fields": [
          { "name": "Site Name", "slug": "site_name", "type": "text", "required": true },
          { "name": "Site Logo", "slug": "site_logo", "type": "media" }
        ]
      }
    ],
    "components": [
      {
        "name": "Reusable SEO",
        "slug": "reusable-seo",
        "description": "Komponen SEO reusable",
        "category": "SEO",
        "fields": [
          { "name": "Title Tag", "slug": "title_tag", "type": "text" },
          { "name": "Meta Desc", "slug": "meta_desc", "type": "textarea" }
        ]
      }
    ]
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(templateDocumentation, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: "Copied to clipboard" })
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      if (!contentTypeSlug) return
      try {
        const [ctRes] = await Promise.all([
          fetch(`/api/admin/content-types/by-slug/${contentTypeSlug}`)
        ])
        if (ctRes.ok) {
          const data = await ctRes.json()
          setContentType(data)
          // Init empty form
          const initialData: Record<string, any> = {}
          data.fields.forEach((f: Field) => {
            initialData[f.slug] = f.type === "boolean" ? false : ""
          })
          setFormData(initialData)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) fetchData()
  }, [contentTypeSlug, session])

  const handleSave = async (publishNow: boolean = false) => {
    setSaving(true)
    const targetStatus = publishNow ? "PUBLISHED" : entryStatus
    try {
      const res = await fetch(`/api/admin/content-types/by-slug/${contentTypeSlug}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: formData,
          status: targetStatus,
          locale,
          publish: publishNow
        }),
      })

      if (res.ok) {
        toast({ title: publishNow ? "Published!" : "Draft Saved" })
        router.push(`/admin/content-types/${contentTypeSlug}`)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Error", description: err.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (slug: string, value: any) => {
    setFormData(prev => ({ ...prev, [slug]: value }))
  }

  const renderField = (field: Field) => {
    const value = formData[field.slug]
    let options: string[] = []
    if (field.options) {
      let opts = field.options
      if (typeof field.options === 'string') {
        try {
          opts = JSON.parse(field.options)
        } catch (e) {
          // Not a JSON string, keep as is
        }
      }
      
      if (Array.isArray(opts)) options = opts
      else if (typeof opts === 'string') options = opts.split(",").map(o => o.trim())
    }

    switch (field.type) {
      case "text": return <TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} placeholder={field.name} />
      case "slug":
      case "uid":
        const sourceFieldName = (contentType?.fields.find(f => f.slug === 'title') || contentType?.fields.find(f => f.slug === 'name'))?.slug
        const sourceValue = sourceFieldName ? (formData[sourceFieldName] as string) : ""
        return (
          <SlugField 
            value={value as string} 
            onChange={v => handleFieldChange(field.slug, v)} 
            required={field.required} 
            placeholder={field.name}
            sourceValue={sourceValue}
          />
        )
      case "textarea": return <TextareaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "richText": return <RichTextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "number": return <NumberField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "boolean": return <BooleanField value={value as boolean} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "date": return <DateField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "select": return <SelectField value={value as string} onChange={v => handleFieldChange(field.slug, v)} options={options} required={field.required} />
      case "media": return <MediaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} tenantSlug="system" />
      case "json": return <AdvancedField value={value} onChange={v => handleFieldChange(field.slug, v)} type="json" required={field.required} />
      case "button": return <ButtonField value={value as any} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />
      case "component":
        const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        return <ComponentField tenantSlug="system" componentSlug={opts?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} repeatable={opts?.repeatable} />
      default: return <Input value={value as string || ""} onChange={e => handleFieldChange(field.slug, e.target.value)} />
    }
  }

  if (loading) return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex items-center justify-center flex-col w-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  )

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">New {contentType?.name}</h1>
                <p className="text-muted-foreground">Platform-level entry for system workspace.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={entryStatus} onValueChange={setEntryStatus}>
                <SelectTrigger className="w-32 bg-card font-bold text-xs uppercase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="bg-card">
                Save as {entryStatus}
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 font-bold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Publish Now
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-card">
                <CardHeader className="border-b bg-muted/10">
                  <CardTitle className="text-lg font-bold">Content Editor</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  {contentType?.fields.map(field => (
                    <div key={field.id} className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-bold">{field.name} {field.required && "*"}</Label>
                        <Badge variant="outline" className="text-[9px] opacity-50 uppercase">{field.type}</Badge>
                      </div>
                      {renderField(field)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card className="border-none shadow-sm bg-card">
                <CardHeader><CardTitle className="text-base font-bold">Localization</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Select Language</Label>
                    <Select value={locale} onValueChange={setLocale}>
                      <SelectTrigger className="bg-muted/30 border-none"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableLocales.map(l => (
                          <SelectItem key={l.locale} value={l.locale}>{l.name} ({l.locale})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {contentTypeSlug === 'templates' && (
                <Card className="border-none shadow-sm bg-card overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Info className="h-4 w-4 text-primary" />
                      Template Documentation
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-8 px-2">
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 rounded-lg p-3 relative group">
                      <pre className="text-[10px] font-mono overflow-auto max-h-[400px] scrollbar-hide">
                        {JSON.stringify(templateDocumentation, null, 2)}
                      </pre>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                      Gunakan JSON ini sebagai referensi saat membuat schema template baru. Klik ikon copy untuk menyalin seluruh struktur.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
