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

  const tenants = useMemo(() => session?.user?.tenants || [], [session?.user?.id])

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
        router.push(`/dashboard/${tenantSlug}/content-type-builder/components`)
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
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-muted/60" onClick={() => router.push(`/dashboard/${tenantSlug}/content-type-builder/components`)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black tracking-tight text-foreground">{component.name}</h1>
                  {component.isGlobal ? (
                    <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 px-2">Global</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-2">Kustom</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Grup Field Reusable &middot; <span className="font-mono">/{component.slug}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="h-8 px-3 text-destructive hover:bg-destructive/10 font-bold text-xs rounded-xl">
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl border border-border/80 bg-card text-foreground">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base font-bold text-destructive">Hapus "{component.name}"?</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs text-muted-foreground">
                      Tindakan ini akan menghapus komponen ini secara permanen. Skema yang menggunakan komponen ini mungkin akan terpengaruh.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel className="rounded-xl text-xs h-8">Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-bold h-8">
                      Hapus Permanen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button className="h-8 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs" asChild>
                <Link href={`/dashboard/${tenantSlug}/content-type-builder/components/${componentSlug}/edit`}>
                  <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit Skema
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border border-border/80 rounded-2xl shadow-xs overflow-hidden bg-card">
                <CardHeader className="p-5 pb-3 border-b border-border/60">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Daftar Atribut Terdefinisi</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  {component.fields.length === 0 ? (
                    <div className="text-center py-16 space-y-2">
                      <Box className="h-8 w-8 mx-auto text-muted-foreground/30" />
                      <p className="font-bold text-xs text-foreground">Belum ada field yang didefinisikan</p>
                      <p className="text-[11px] text-muted-foreground">Edit skema untuk menambahkan atribut pada komponen ini.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {component.fields.map((field) => {
                        const typeInfo = FIELD_TYPES.find(ft => ft.type === field.type)
                        const Icon = typeInfo?.icon || Zap
                        return (
                          <div key={field.id} className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/20 border border-border/60 hover:border-primary/40 transition-all">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-foreground">{field.name}</span>
                                {field.required && <Badge variant="outline" className="text-[8px] h-3.5 border-rose-500/20 text-rose-600 bg-rose-500/10 font-bold rounded-full">WAJIB</Badge>}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{field.type} &middot; /{field.slug}</div>
                            </div>
                            <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-full px-2 py-0.5 border-border/60 text-muted-foreground">{typeInfo?.category}</Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border border-border/80 rounded-2xl shadow-xs overflow-hidden bg-card">
                <CardHeader className="p-4 pb-2 border-b border-border/60">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Metadata</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-border/60">
                    <span className="text-muted-foreground text-xs">Kategori</span>
                    <Badge variant="secondary" className="font-bold text-[10px] rounded-full px-2 py-0.5">{component.category || "General"}</Badge>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/60">
                    <span className="text-muted-foreground text-xs">API Slug</span>
                    <code className="font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-lg text-xs">/{component.slug}</code>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground text-xs">Total Field</span>
                    <span className="font-bold text-foreground">{component.fields.length}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 bg-muted/40 border border-border/70 rounded-2xl flex gap-3 text-muted-foreground shadow-xs">
                <Info className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Catatan Penggunaan</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Komponen ini dapat disematkan ke skema koleksi atau single type sebagai field bertipe "Component".</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



