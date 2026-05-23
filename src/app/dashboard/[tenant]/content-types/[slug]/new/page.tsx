"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { 
  ArrowLeft, Save, Send, FileText, CheckCircle2, 
  Clock, Archive, Loader2, Globe, Layout, ChevronDown,
  Calendar as CalendarIcon, Eye, AlertCircle, Check, Plus
} from "lucide-react"
import { useSession } from "next-auth/react"
import { format } from "date-fns"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// Field Renderers
import { TextField } from "@/components/content/field-renderers/text-field"
import { TextareaField } from "@/components/content/field-renderers/textarea-field"
import { NumberField } from "@/components/content/field-renderers/number-field"
import { DateTimeField } from "@/components/content/field-renderers/datetime-field"
import { BooleanField } from "@/components/content/field-renderers/boolean-field"
import { DateField } from "@/components/content/field-renderers/date-field"
import { SelectField } from "@/components/content/field-renderers/select-field"
import { TagsField } from "@/components/content/field-renderers/tags-field"
import { MediaField } from "@/components/content/field-renderers/media-field"
import { ButtonField } from "@/components/content/field-renderers/button-field"
import { MediaMultipleField } from "@/components/content/field-renderers/media-multiple-field"
import { RichTextField } from "@/components/content/field-renderers/rich-text-field"
import { RelationSelectField } from "@/components/content/field-renderers/relation-select-field"
import { ComponentField } from "@/components/content/field-renderers/component-field"
import { AdvancedField } from "@/components/content/field-renderers/advanced-fields"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  options: any
  relationSlug?: string
}

interface ContentType {
  id: string
  name: string
  slug: string
  description: string | null
  fields: Field[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Draft", color: "bg-slate-500", icon: FileText },
  IN_REVIEW: { label: "In Review", color: "bg-blue-500", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-cyan-500", icon: CheckCircle2 },
  SCHEDULED: { label: "Scheduled", color: "bg-purple-500", icon: CalendarIcon },
  PUBLISHED: { label: "Published", color: "bg-emerald-500", icon: Check },
  ARCHIVED: { label: "Archived", color: "bg-orange-500", icon: Archive },
  REJECTED: { label: "Rejected", color: "bg-red-500", icon: AlertCircle },
}

export default function CreateEntryPage() {
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
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined)
  const [availableLocales, setAvailableLocales] = useState<any[]>([{ locale: "en", name: "English" }])

  const tenants = session?.user?.tenants || []

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
          // Init empty form
          const initialData: Record<string, any> = {}
          data.fields.forEach((f: Field) => {
            let isMultiple = false
            if (f.type === "relation" && f.options) {
              try {
                const o = typeof f.options === "string" ? JSON.parse(f.options) : f.options
                if (o?.relationType === "oneToMany" || o?.relationType === "manyToMany") isMultiple = true
              } catch(e) {}
            }
            if (f.type === "mediaMultiple" || isMultiple) {
              initialData[f.slug] = []
            } else {
              initialData[f.slug] = f.type === "boolean" ? false : ""
            }
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
  }, [tenantSlug, contentTypeSlug, status])

  const handleSave = async (publishNow: boolean = false) => {
    setSaving(true)
    
    let targetStatus = publishNow ? "PUBLISHED" : entryStatus
    if (!publishNow && scheduledAt && targetStatus !== "ARCHIVED") {
      targetStatus = "SCHEDULED"
    }

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: formData,
          status: targetStatus,
          locale,
          scheduledAt: scheduledAt?.toISOString() || null
        }),
      })

      if (res.ok) {
        toast({ title: publishNow ? "Published Successfully!" : "Entry Created" })
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
      let opts = field.options
      if (typeof field.options === 'string') {
        // Only try to parse if it looks like JSON (starts with [ or {)
        if (field.options.trim().startsWith('[') || field.options.trim().startsWith('{')) {
          try {
            opts = JSON.parse(field.options)
          } catch (e) {
            console.warn(`Failed to parse options for field ${field.slug} as JSON, using as raw string.`)
            opts = field.options
          }
        }
      }
      
      if (Array.isArray(opts)) {
        options = opts
      } else if (typeof opts === 'string') {
        options = opts.split(",").map(o => o.trim()).filter(Boolean)
      }
    }

    switch (field.type) {
      case "text":
        // Heuristic: if it's a text field but named hashtag/hastag/tags, use TagsField
        if (['hashtag', 'hastag', 'tags'].includes(field.slug.toLowerCase())) {
          return <TagsField value={value as any} onChange={v => handleFieldChange(field.slug, v)} placeholder={`Add ${field.name.toLowerCase()}...`} />
        }
        return <TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} placeholder={field.name} />
      
      case "slug":
      case "uid":
        return <TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} placeholder={field.name} />
      
      case "email":
        return <TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} placeholder="email@example.com" type="email" />

      case "textarea":
      case "markdown":
        return <TextareaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      
      case "richText":
        return <RichTextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      
      case "number":
      case "integer":
        return <NumberField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      
      case "boolean":
        return <BooleanField value={value as boolean} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      
      case "date":
      case "datetime":
      case "time":
        return <DateField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      
      case "select":
        return <SelectField value={value as string} onChange={v => handleFieldChange(field.slug, v)} options={options} required={field.required} />
      
      case "tags":
      case "hashtags":
        return <TagsField value={value as any} onChange={v => handleFieldChange(field.slug, v)} placeholder={`Add ${field.name.toLowerCase()}...`} />

      case "media":
      case "file":
        return <MediaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} />
      
      case "mediaMultiple":
        return <MediaMultipleField value={value as string[]} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} />

      case "relation":
        let relOpts: any = {}
        if (field.options) {
          try {
            relOpts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
          } catch (e) {}
        }
        const isMultiple = relOpts?.relationType === 'oneToMany' || relOpts?.relationType === 'manyToMany'
        return (
          <RelationSelectField 
            value={value as any} 
            onChange={v => handleFieldChange(field.slug, v)} 
            tenantSlug={tenantSlug}
            targetSlug={field.relationSlug || ""}
            label={field.name}
            required={field.required}
            multiple={isMultiple}
          />
        )

      case "button":
        return <ButtonField value={value as any} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />
      
      case "component":
        const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        return <ComponentField tenantSlug={tenantSlug} componentSlug={opts?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} repeatable={opts?.repeatable} />

      case "json":
        return <AdvancedField type="json" value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />

      case "color":
        return <AdvancedField type="color" value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />

      case "location":
        return <AdvancedField type="location" value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />

      default:
        return <Input value={value as string || ""} onChange={e => handleFieldChange(field.slug, e.target.value)} />
      }
  }

  if (loading) return <div className="flex items-center justify-center flex-1 flex-col w-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (!contentType) {
    return (
      <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex flex-col items-center justify-center p-8 text-center w-full">
          <div className="w-20 h-20 rounded-none bg-red-50 flex items-center justify-center mb-6 text-red-500">
            <AlertCircle className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Content Type Not Found</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            We couldn't find the structure for <strong>{contentTypeSlug}</strong>. It might have been deleted or moved.
          </p>
          <Button variant="outline" className="mt-8 rounded-none font-bold" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[entryStatus] || STATUS_CONFIG.DRAFT

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-extrabold tracking-tight">New {contentType?.name}</h1>
                  <Badge className={cn("text-[10px] font-black uppercase text-white", statusCfg.color)}>
                    {statusCfg.label}
                  </Badge>
                </div>
                <p className="text-muted-foreground">Fill in the fields to create a new entry.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={entryStatus} onValueChange={setEntryStatus}>
                <SelectTrigger className="w-40 bg-card font-bold text-xs uppercase rounded-none border-none shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val} className="text-xs font-bold uppercase">
                      <div className="flex items-center gap-2">
                        <cfg.icon className="h-3 w-3" />
                        {cfg.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={() => handleSave(true)} disabled={saving} className="bg-primary hover:bg-primary/90 shadow-none shadow-none h-10 rounded-none font-bold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create & Publish
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-none bg-card overflow-hidden rounded-none">
                <CardHeader className="border-b bg-muted/5 p-6">
                  <CardTitle className="text-lg font-bold">Content Editor</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-10">
                  {contentType?.fields.map(field => (
                    <div key={field.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-bold text-slate-700">{field.name} {field.required && "*"}</Label>
                        <Badge variant="outline" className="text-[9px] opacity-50 uppercase tracking-widest font-black">{field.type}</Badge>
                      </div>
                      {renderField(field)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-6">
              <Card className="border-none shadow-none bg-card rounded-none">
                <CardHeader className="p-6 pb-2"><CardTitle className="text-base font-bold">Status & Publishing</CardTitle></CardHeader>
                <CardContent className="p-6 pt-2 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Scheduled Publication</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-bold rounded-none border-none bg-muted/30 h-11",
                            !scheduledAt && "text-muted-foreground font-normal"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduledAt ? format(scheduledAt, "PPP") : <span>Set publish date...</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-none overflow-hidden shadow-none border-none" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledAt}
                          onSelect={setScheduledAt}
                          initialFocus
                          disabled={(date) => date < new Date()}
                        />
                        {scheduledAt && (
                          <div className="p-3 border-t bg-muted/10 flex justify-between">
                            <Button variant="ghost" size="sm" onClick={() => setScheduledAt(undefined)} className="text-[10px] uppercase font-black">Clear</Button>
                            <span className="text-[10px] text-muted-foreground italic pt-2">Will set status to SCHEDULED</span>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Localization</Label>
                    <Select value={locale} onValueChange={setLocale}>
                      <SelectTrigger className="bg-muted/30 border-none h-11 rounded-none font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        {availableLocales.map(l => (
                          <SelectItem key={l.locale} value={l.locale} className="font-bold">{l.name} ({l.locale.toUpperCase()})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <Button 
                    variant="outline" 
                    onClick={() => handleSave(false)} 
                    disabled={saving} 
                    className="w-full bg-slate-900 text-white hover:bg-slate-800 hover:text-white border-none h-11 rounded-none font-bold shadow-none shadow-none"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Create Entry
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
