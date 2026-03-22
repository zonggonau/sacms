"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { 
  ArrowLeft, Save, Send, FileText, CheckCircle2, 
  Clock, Archive, Loader2, Globe, Layout, ChevronDown,
  Eye, EyeOff
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

// Field Renderers
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
import { ComponentField } from "@/components/content/field-renderers/component-field"
import { ButtonField } from "@/components/content/field-renderers/button-field"
import { AdvancedField } from "@/components/content/field-renderers/advanced-fields"
import { AIAssistantDialog } from "@/components/content/ai-assistant-dialog"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  options: any
}

interface SingleType {
  id: string
  name: string
  slug: string
  description: string | null
  fields: Field[]
  data: any
  publishedAt: string | null
}

export default function CMSEditSingleTypePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const singleTypeSlug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [singleType, setSingleType] = useState<SingleType | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [locale, setLocale] = useState<string>("en")
  const [availableLocales, setAvailableLocales] = useState<any[]>([{ locale: "en", name: "English" }])

  useEffect(() => {
    async function fetchData() {
      if (!tenantSlug || !singleTypeSlug) return
      try {
        const [stRes, locRes] = await Promise.all([
          fetch(`/api/tenant/${tenantSlug}/single-types/slug/${singleTypeSlug}`),
          fetch(`/api/tenant/${tenantSlug}/locales`)
        ])
        
        if (stRes.ok) {
          const data = await stRes.json()
          setSingleType(data)
          let parsedData = data.data
          if (typeof data.data === 'string') {
            try { parsedData = JSON.parse(data.data) } catch (err) { parsedData = {} }
          }
          setFormData(parsedData || {})
        }
        if (locRes.ok) {
          const data = await locRes.json()
          if (data.locales?.length > 0) setAvailableLocales(data.locales)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) fetchData()
  }, [tenantSlug, singleTypeSlug, session])

  const handleSave = async (publish: boolean = false) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/single-types/${singleType?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: formData,
          publish
        }),
      })

      if (res.ok) {
        toast({ title: publish ? "Published!" : "Draft Saved" })
        if (publish) router.push(`/cms/${tenantSlug}/single-types`)
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
      const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
      if (Array.isArray(opts)) options = opts
      else if (typeof opts === 'string') options = opts.split(",").map(o => o.trim())
    }

    const LabelWithAI = () => (
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold text-foreground/80">{field.name} {field.required && "*"}</span>
        {(field.type === "text" || field.type === "textarea" || field.type === "richText") && (
          <AIAssistantDialog
            tenantSlug={tenantSlug}
            contentTypeSlug={singleTypeSlug}
            fieldName={field.name}
            currentValue={value as string}
            onApply={(content) => handleFieldChange(field.slug, content)}
          />
        )}
      </div>
    )

    switch (field.type) {
      case "text": 
        return <TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={<LabelWithAI />} placeholder={field.name} />
      case "textarea": 
        return <TextareaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={<LabelWithAI />} />
      case "richText": 
        return <RichTextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={<LabelWithAI />} />
      case "markdown": 
        return <TextareaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={<LabelWithAI />} placeholder="Enter markdown..." />
      case "number": 
      case "integer":
      case "decimal":
      case "float":
        return <NumberField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={field.name} type={field.type as any} />
      case "boolean": 
        return <BooleanField value={value as boolean} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={field.name} />
      case "date": 
        return <DateField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={field.name} />
      case "datetime": 
      case "timestamp":
        return <DateTimeField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={field.name} type={field.type as any} />
      case "select": 
        return <SelectField value={value as string} onChange={v => handleFieldChange(field.slug, v)} options={options} required={field.required} label={field.name} />
      case "media": 
        return <MediaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} label={field.name} type="image" />
      case "file":
        return <MediaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} label={field.name} type="file" />
      case "button": 
        return <ButtonField value={value as any} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />
      case "json":
      case "color":
      case "location":
        return <AdvancedField value={value} onChange={v => handleFieldChange(field.slug, v)} type={field.type} required={field.required} label={field.name} />
      case "component":
        const compOpts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        return <ComponentField tenantSlug={tenantSlug} componentSlug={compOpts?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} repeatable={compOpts?.repeatable} />
      default: 
        return <Input value={value as string || ""} onChange={e => handleFieldChange(field.slug, e.target.value)} />
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>

  return (
    <div className="p-6 lg:p-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/cms/${tenantSlug}/single-types`)}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-emerald-700">{singleType?.name}</h1>
            <p className="text-muted-foreground text-sm">Editing static page content</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {singleType?.publishedAt && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-black text-[10px] uppercase h-10 px-4 rounded-xl">
              <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Live
            </Badge>
          )}
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="bg-card rounded-xl font-bold h-10 border-emerald-100 hover:bg-emerald-50">
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-none font-bold rounded-xl h-10">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {singleType?.publishedAt ? "Update Live" : "Publish Now"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
            <CardHeader className="border-b bg-muted/10 p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" /> Page Editor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {singleType?.fields.length === 0 ? (
                <div className="text-center py-20 opacity-30">
                  <Globe className="h-16 w-16 mx-auto mb-4" />
                  <p className="font-bold">No fields configured for this page.</p>
                </div>
              ) : (
                singleType?.fields.map(field => (
                  <div key={field.id} className="space-y-2">
                    {renderField(field)}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b p-6"><CardTitle className="text-base font-bold flex items-center gap-2"><Globe className="h-4 w-4 text-emerald-600" /> Page Info</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Slug Identifier</Label>
                <div className="p-3 bg-muted/30 rounded-xl font-mono text-xs text-muted-foreground border border-dashed italic">
                  /{singleTypeSlug}
                </div>
              </div>
              <Separator className="opacity-50" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-bold uppercase tracking-tighter">Last Update</span>
                <span className="font-bold">{singleType?.publishedAt ? new Date(singleType.publishedAt).toLocaleString() : 'Never'}</span>
              </div>
            </CardContent>
          </Card>

          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-3xl flex gap-3 text-emerald-700 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <Save className="h-4 w-4" />
            </div>
            <p className="text-[11px] leading-relaxed font-medium">
              Changes saved here will affect the public API for <strong>{singleTypeSlug}</strong> after publishing.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
