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
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { toast } from "@/hooks/use-toast"
import { TextField } from "@/components/content/field-renderers/text-field"
import { TextareaField } from "@/components/content/field-renderers/textarea-field"
import { NumberField } from "@/components/content/field-renderers/number-field"
import { DateTimeField } from "@/components/content/field-renderers/datetime-field"
import { BooleanField } from "@/components/content/field-renderers/boolean-field"
import { DateField } from "@/components/content/field-renderers/date-field"
import { SelectField } from "@/components/content/field-renderers/select-field"
import { MediaField } from "@/components/content/field-renderers/media-field"
import { ButtonField } from "@/components/content/field-renderers/button-field"
import { MediaMultipleField } from "@/components/content/field-renderers/media-multiple-field"
import { RichTextField } from "@/components/content/field-renderers/rich-text-field"
import { RelationField } from "@/components/content/field-renderers/relation-field"
import { ComponentField } from "@/components/content/field-renderers/component-field"
import { ValidationField } from "@/components/content/field-renderers/validation-fields"
import { AdvancedField } from "@/components/content/field-renderers/advanced-fields"

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

export default function EditEntryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const contentTypeSlug = params?.slug as string
  const entryId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [entryStatus, setEntryStatus] = useState<string>("DRAFT")
  const [locale, setLocale] = useState<string>("en")
  const [availableLocales, setAvailableLocales] = useState<any[]>([{ locale: "en", name: "English" }])

  const tenants = session?.user?.tenants || []

  useEffect(() => {
    async function fetchData() {
      if (!tenantSlug || !contentTypeSlug || !entryId || contentType) return
      try {
        const [ctRes, entRes, locRes] = await Promise.all([
          fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}`),
          fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/${entryId}`),
          fetch(`/api/tenant/${tenantSlug}/locales`)
        ])
        
        if (ctRes.ok) setContentType(await ctRes.json())
        if (entRes.ok) {
          const data = await entRes.json()
          const entry = data.entry
          setEntryStatus(entry.status)
          setLocale(entry.locale)
          // Handle potentially stringified data
          let parsedData = entry.data
          if (typeof entry.data === 'string') {
            try { parsedData = JSON.parse(entry.data) } catch { parsedData = {} }
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
    if (status === "authenticated") fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, contentTypeSlug, entryId, status])

  const handleSave = async (publishNow: boolean = false) => {
    setSaving(true)
    const targetStatus = publishNow ? "PUBLISHED" : entryStatus
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: formData,
          status: targetStatus,
          locale,
          publish: publishNow
        }),
      })

      if (res.ok) {
        toast({ title: publishNow ? "Published Successfully!" : "Entry Updated" })
        router.push(`/dashboard/${tenantSlug}/content-types/${contentTypeSlug}`)
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

    switch (field.type) {
      case "text": return <TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} placeholder={field.name} />
      case "textarea": return <TextareaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "richText": return <RichTextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "number": return <NumberField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "boolean": return <BooleanField value={value as boolean} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "date": return <DateField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "select": return <SelectField value={value as string} onChange={v => handleFieldChange(field.slug, v)} options={options} required={field.required} />
      case "media": return <MediaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} />
      case "button": return <ButtonField value={value as any} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />
      case "component":
        const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        return <ComponentField tenantSlug={tenantSlug} componentSlug={opts?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} repeatable={opts?.repeatable} />
      default: return <Input value={value as string || ""} onChange={e => handleFieldChange(field.slug, e.target.value)} />
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-extrabold tracking-tight">Edit Entry</h1>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase">{entryStatus}</Badge>
                </div>
                <p className="text-muted-foreground">{contentType?.name} &middot; {entryId}</p>
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
                Update as {entryStatus}
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 font-bold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Save & Publish
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
                <CardHeader><CardTitle className="text-base font-bold">Metadata</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Language</Label>
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
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
