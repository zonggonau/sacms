"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Loader2,
  ArrowLeft,
  Edit,
  Type,
  Trash2,
  Box,
  Puzzle,
  Zap,
  Layout,
  Globe,
  Info,
} from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { FIELD_TYPES } from "@/lib/field-types"
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
import { cn } from "@/lib/utils"
import { getComponentBySlugAction, deleteComponentAction } from "@/actions/components"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  options?: any
}

interface Component {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  fields: Field[]
  isGlobal?: boolean
}

export default function ComponentDetailClient({
  tenantSlug,
  componentSlug,
  initialComponent,
}: {
  tenantSlug: string
  componentSlug: string
  initialComponent: Component | null
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [component, setComponent] = useState<Component | null>(initialComponent)

  const tenants = useMemo(() => session?.user?.tenants || [], [session])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  // Update state if initialComponent prop changes when navigating between slugs
  useEffect(() => {
    if (initialComponent?.slug !== componentSlug) {
      setComponent(null)
    } else {
      setComponent(initialComponent)
    }
  }, [componentSlug, initialComponent])

  const handleDelete = async () => {
    if (!component) return
    try {
      const response = await deleteComponentAction(tenantSlug, component.id)
      
      if (!response.error) {
        toast({ title: "Deleted", description: "Component removed successfully" })
        router.push(`/dashboard/${tenantSlug}/components`)
      } else {
        toast({ variant: "destructive", title: "Error", description: response.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  if (loading) return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex items-center justify-center flex-col w-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  )

  if (!component) return null

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/${tenantSlug}/components`)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-extrabold tracking-tight">{component.name}</h1>
                  {component.isGlobal && <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 font-black text-[9px] uppercase">Global</Badge>}
                </div>
                <p className="text-muted-foreground text-sm">Reusable Field Group &middot; /{component.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/5 font-bold text-xs">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-none border-none shadow-none">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-black uppercase text-destructive tracking-tight">Erase "{component.name}"?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-medium">
                      This will permanently remove the component and its fields. Any content types using this component will break.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-none h-10">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-none h-10 font-bold">
                      Delete Permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button className="bg-primary hover:bg-primary/90 font-bold shadow-none shadow-none" asChild>
                <Link href={`/dashboard/${tenantSlug}/components/${componentSlug}/edit`}>
                  <Edit className="mr-2 h-4 w-4" /> Edit Schema
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-none bg-card">
                <CardHeader className="border-b bg-muted/10">
                  <CardTitle className="text-lg font-bold">Defined Attributes</CardTitle>
                  <CardDescription>Structure of this reusable component</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {component.fields.length === 0 ? (
                    <div className="text-center py-12 opacity-40">
                      <Box className="h-12 w-12 mx-auto mb-4" />
                      <p className="font-bold">No fields defined</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {component.fields.map((field, index) => {
                        const typeInfo = FIELD_TYPES.find(ft => ft.type === field.type)
                        const Icon = typeInfo?.icon || Zap
                        return (
                          <div key={field.id} className="flex items-center gap-4 p-4 rounded-none bg-muted/30 border border-transparent hover:border-primary/20 transition-all">
                            <div className="w-10 h-10 rounded-none bg-card flex items-center justify-center text-primary shadow-none">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">{field.name}</span>
                                {field.required && <Badge className="text-[8px] h-3.5 bg-red-50 text-red-500 border-red-100 uppercase">REQ</Badge>}
                              </div>
                              <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">{field.type} &middot; /{field.slug}</div>
                            </div>
                            <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest opacity-50">{typeInfo?.category}</Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-none shadow-none bg-card">
                <CardHeader><CardTitle className="text-base font-bold">Metadata</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="flex justify-between border-b border-dashed pb-2">
                    <span className="text-muted-foreground uppercase font-bold text-[10px]">Category</span>
                    <Badge variant="secondary" className="font-bold text-[9px] uppercase">{component.category || "General"}</Badge>
                  </div>
                  <div className="flex justify-between border-b border-dashed pb-2">
                    <span className="text-muted-foreground uppercase font-bold text-[10px]">API Slug</span>
                    <code className="font-bold bg-muted px-1.5 py-0.5 rounded-none text-primary">/{component.slug}</code>
                  </div>
                  <div className="flex justify-between border-b border-dashed pb-2">
                    <span className="text-muted-foreground uppercase font-bold text-[10px]">Field Count</span>
                    <span className="font-bold">{component.fields.length}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 bg-orange-50 border border-orange-100 rounded-none flex gap-3 text-orange-800 shadow-none">
                <Info className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-[11px] leading-relaxed font-bold uppercase tracking-tight">Usage Note</p>
                  <p className="text-[10px] mt-0.5 opacity-80">This component is available as a "Component" field type when building other schemas.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
