"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { 
  ArrowLeft, Save, Send, FileText, CheckCircle2, 
  Clock, Archive, Loader2, Globe, Layout, ChevronDown
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
import { CMSSidebar } from "@/components/cms/cms-sidebar"
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
import { RelationField } from "@/components/content/field-renderers/relation-field"
import { ComponentField } from "@/components/content/field-renderers/component-field"
import { ButtonField } from "@/components/content/field-renderers/button-field"
import { AIAssistantDialog } from "@/components/content/ai-assistant-dialog"

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

export default function CMSCreateEntryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const contentTypeSlug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [entryStatus, setEntryStatus] = useState<string>("DRAFT")
  const [locale, setLocale] = useState<string>("en")
  const [availableLocales, setAvailableLocales] = useState<any[]>([{ locale: "en", name: "English" }])

  useEffect(() => {
    async function fetchData() {
      if (!tenantSlug || !contentTypeSlug || contentType) return
      try {
        const [ctRes, locRes] = await Promise.all([
          fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}`),
          fetch(`/api/tenant/${tenantSlug}/locales`)
        ])
        if (ctRes.ok) {
          const data = await ctRes.json()
          setContentType(data)
          const initialData: Record<string, any> = {}
          data.fields.forEach((f: Field) => {
            initialData[f.slug] = f.type === "boolean" ? false : ""
          })
          setFormData(initialData)
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
    if (status === "authenticated") fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, contentTypeSlug, status])

  const handleSave = async (publishNow: boolean = false) => {
    setSaving(true)
    const targetStatus = publishNow ? "PUBLISHED" : entryStatus
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries`, {
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
        router.push(`/cms/${tenantSlug}/content/${contentTypeSlug}`)
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
      if (typeof field.options === 'string' && (field.options.startsWith('[') || field.options.startsWith('{'))) {
        try {
          opts = JSON.parse(field.options)
        } catch (e) {
          console.warn("Failed to parse JSON options for field:", field.slug, e)
          opts = field.options
        }
      }
      
      if (Array.isArray(opts)) {
        options = opts
      } else if (typeof opts === 'string') {
        options = opts.split(",").filter(Boolean).map(o => o.trim())
      }
    }

    const LabelWithAI = () => (
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold">{field.name} {field.required && "*"}</span>
        {(field.type === "text" || field.type === "textarea" || field.type === "richText") && (
          <AIAssistantDialog
            tenantSlug={tenantSlug}
            contentTypeSlug={contentTypeSlug}
            fieldName={field.name}
            currentValue={value as string}
            onApply={(content) => handleFieldChange(field.slug, content)}
          />
        )}
      </div>
    )

    switch (field.type) {
      case "text": return <TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={<LabelWithAI />} />
      case "textarea": return <TextareaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={<LabelWithAI />} />
      case "richText": return <RichTextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={<LabelWithAI />} />
      case "number": return <NumberField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={field.name} />
      case "boolean": return <BooleanField value={value as boolean} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={field.name} />
      case "date": return <DateField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} label={field.name} />
      case "select": return <SelectField value={value as string} onChange={v => handleFieldChange(field.slug, v)} options={options} required={field.required} label={field.name} />
      case "media": return <MediaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} label={field.name} />
      case "button": return <ButtonField value={value as any} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />
      case "component":
        const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        return <ComponentField tenantSlug={tenantSlug} componentSlug={opts?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} repeatable={opts?.repeatable} />
      default: return <Input value={value as string || ""} onChange={e => handleFieldChange(field.slug, e.target.value)} />
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>

  return (
    <div className="p-6 lg:p-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-emerald-700">New {contentType?.name}</h1>
            <p className="text-muted-foreground">Drafting content for {tenantSlug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={entryStatus} onValueChange={setEntryStatus}>
            <SelectTrigger className="w-32 bg-card font-bold text-xs uppercase rounded-xl border-emerald-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-xl">
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="bg-card rounded-xl font-bold h-10 border-emerald-100 hover:bg-emerald-50">
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-none font-bold rounded-xl h-10">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Publish
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
            <CardHeader className="border-b bg-muted/10 p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" /> Content Editor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {contentType?.fields.map(field => (
                <div key={field.id}>
                  {renderField(field)}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b p-6"><CardTitle className="text-base font-bold flex items-center gap-2"><Globe className="h-4 w-4 text-emerald-600" /> Localization</CardTitle></CardHeader>
            <CardContent className="p-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Primary Language</Label>
                <Select value={locale} onValueChange={setLocale}>
                  <SelectTrigger className="bg-muted/30 border-none h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-xl">
                    {availableLocales.map(l => (
                      <SelectItem key={l.locale} value={l.locale}>{l.name} ({l.locale})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
