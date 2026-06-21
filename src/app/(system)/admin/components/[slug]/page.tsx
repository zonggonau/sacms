"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, Box, Edit, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface ComponentField {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  order: number
}

interface ComponentDetail {
  id: string
  name: string
  slug: string
  description: string | null
  category: string
  schemaFields: ComponentField[]
  _count: { tenants: number }
}

export default function ComponentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params?.slug as string
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [component, setComponent] = useState<ComponentDetail | null>(null)

  useEffect(() => {
    if (!slug) return
    fetchComponent()
  }, [slug])

  const fetchComponent = async () => {
    try {
      const res = await fetch(`/api/admin/components/by-slug/${slug}`)
      if (res.ok) {
        const data = await res.json()
        setComponent(data.component || data)
      } else {
        toast({ title: "Error", description: "Component not found", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to load component", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!component) {
    return (
      <div className="p-6 text-center">
        <Box className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
        <p className="font-bold">Component not found</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/components")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">{component.name}</h1>
          <p className="text-sm text-muted-foreground">
            /{component.slug} — {component.description || "Reusable component"}
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px] uppercase font-bold">{component.category}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Box className="w-5 h-5 text-primary" />
            Fields ({component.schemaFields.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {component.schemaFields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No fields defined.</p>
          ) : (
            <div className="space-y-2">
              {component.schemaFields.map((field) => (
                <div key={field.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-bold">{field.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{field.slug}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">{field.type}</Badge>
                  {field.required && <Badge className="text-[10px] bg-red-500/10 text-red-600">Required</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
