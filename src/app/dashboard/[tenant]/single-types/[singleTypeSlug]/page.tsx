"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  ArrowLeft, Save, Edit2, FileText, Trash2, Loader2, 
  Globe, Database, ShieldCheck, Send, CheckCircle2, Zap
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Field Renderers
import { TextField } from "@/components/content/field-renderers/text-field"
import { TextareaField } from "@/components/content/field-renderers/textarea-field"
import { NumberField } from "@/components/content/field-renderers/number-field"
import { DateTimeField } from "@/components/content/field-renderers/datetime-field"
import { BooleanField } from "@/components/content/field-renderers/boolean-field"
import { DateField } from "@/components/content/field-renderers/date-field"
import { SelectField } from "@/components/content/field-renderers/select-field"
import { MediaField } from "@/components/content/field-renderers/media-field"
import { RichTextField } from "@/components/content/field-renderers/rich-text-field"
import { ComponentField } from "@/components/content/field-renderers/component-field"
import { cn } from "@/lib/utils"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  unique: boolean
  options?: any
}

interface SingleType {
  id: string
  name: string
  slug: string
  description: string | null
  fields: Field[]
  data: Record<string, unknown> | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export default function SingleTypeDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const singleTypeSlug = params?.singleTypeSlug as string
  
  const [singleType, setSingleType] = useState<SingleType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [locale, setLocale] = useState<string>("en")
  const [availableLocales, setAvailableLocales] = useState<any[]>([{ locale: "en", name: "English" }])

  const tenants = useMemo(() => session?.user?.tenants || [], [session])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const fetchData = async () => {
    if (!tenantSlug || !singleTypeSlug) return
    setLoading(true)
    try {
      const [stRes, locRes] = await Promise.all([
        fetch(`/api/tenant/${tenantSlug}/single-types/slug/${singleTypeSlug}`),
        fetch(`/api/tenant/${tenantSlug}/locales`)
      ])
      
      if (stRes.ok) {
        const data = await stRes.json()
        setSingleType(data)
        setFormData(data.data || {})
      }
      if (locRes.ok) {
        const data = await locRes.json()
        if (data.locales?.length > 0) setAvailableLocales(data.locales)
      }
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "Failed to load content" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchData()
  }, [tenantSlug, singleTypeSlug, session])

  const handleSave = async (publishNow: boolean = false) => {
    if (!singleType) return
    setSaving(true)
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/single-types/${singleType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          data: formData,
          publish: publishNow
        }),
      })
      if (!response.ok) throw new Error("Save failed")
      toast({ title: publishNow ? "Published!" : "Draft Saved" })
      fetchData()
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save content" })
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
      case "markdown": return <TextareaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} className="font-mono text-xs" />
      case "number": return <NumberField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "boolean": return <BooleanField value={value as boolean} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "date": return <DateField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "datetime": return <DateTimeField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      case "select": return <SelectField value={value as string} onChange={v => handleFieldChange(field.slug, v)} options={options} required={field.required} />
      case "media": return <MediaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} />
      case "component":
        const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        return <ComponentField tenantSlug={tenantSlug} componentSlug={opts?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} repeatable={opts?.repeatable} />
      default: return <Input value={value as string || ""} onChange={e => handleFieldChange(field.slug, e.target.value)} />
    }
  }

  if (loading) return (
    <div className="flex min-h-screen">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    </div>
  )

  if (!singleType) return null

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/${tenantSlug}/single-types`)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-extrabold tracking-tight">{singleType.name}</h1>
                  <Badge variant={singleType.publishedAt ? "default" : "secondary"} className="uppercase font-black text-[10px]">
                    {singleType.publishedAt ? "Live" : "Draft"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">Singleton Content &middot; /{singleType.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="bg-card" asChild>
                <Link href={`/dashboard/${tenantSlug}/single-types/${singleType.slug}/edit`}>
                  <Edit2 className="h-4 w-4 mr-2" /> Schema
                </Link>
              </Button>
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="bg-card font-bold">
                Save Draft
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 font-bold">
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
                  {singleType.fields.length === 0 ? (
                    <div className="text-center py-12 opacity-40">
                      <Zap className="h-12 w-12 mx-auto mb-4" />
                      <p className="font-bold">No fields defined</p>
                      <p className="text-xs">Go to schema editor to add attributes.</p>
                    </div>
                  ) : (
                    singleType.fields.map((field) => (
                      <div key={field.id} className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-bold">{field.name} {field.required && <span className="text-destructive">*</span>}</Label>
                          <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest opacity-50">{field.type}</Badge>
                        </div>
                        {renderField(field)}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-none shadow-sm bg-card">
                <CardHeader><CardTitle className="text-base font-bold">Localization</CardTitle></CardHeader>
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

              <Card className="border-none shadow-sm bg-card">
                <CardHeader><CardTitle className="text-base font-bold">System Info</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="flex justify-between border-b border-dashed pb-2">
                    <span className="text-muted-foreground uppercase font-bold text-[10px]">API Slug</span>
                    <code className="font-bold bg-muted px-1.5 py-0.5 rounded text-primary">/{singleType.slug}</code>
                  </div>
                  <div className="flex justify-between border-b border-dashed pb-2">
                    <span className="text-muted-foreground uppercase font-bold text-[10px]">Updated</span>
                    <span className="font-medium">{new Date(singleType.updatedAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex gap-3 text-primary shadow-sm">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <p className="text-[11px] leading-relaxed font-medium">
                  Singleton data is isolated per workspace. Changes here only affect <strong>{tenantSlug}</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
