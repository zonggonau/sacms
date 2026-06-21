"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Plus, Box, Edit, Trash2, Search, Loader2, Zap, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface GlobalComponent {
  id: string
  name: string
  slug: string
  fields: { id: string; name: string; type: string }[]
  entryCount?: number
  createdAt: string
}

export default function GlobalComponentsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const [components, setComponents] = useState<GlobalComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchComponents()
  }, [])

  const fetchComponents = async () => {
    try {
      const res = await fetch("/api/admin/global/components")
      if (res.ok) {
        const data = await res.json()
        setComponents(data.components || [])
      }
    } catch {
      toast({ title: "Error", description: "Failed to load components", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const filtered = components.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const adminRoles = ["super_admin", "admin", "employee", "karyawan"]
  if (!session?.user || !adminRoles.includes(session.user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card>
          <CardHeader className="text-center">
            <Box className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Box className="w-6 h-6 text-primary" />
            Global Components
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage reusable component schemas for the SaCMS frontend
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => {
              if (confirm("Seed global components? This will re-initialize platform component schemas.")) {
                fetch("/api/admin/global/seed", { method: "POST" }).then(r => r.json()).then(d => {
                  toast({ title: d.success ? "Seed Successful" : "Seed Failed", description: d.success ? "Components initialized." : d.error })
                  fetchComponents()
                }).catch(() => toast({ title: "Error", description: "Seed failed", variant: "destructive" }))
              }
            }}
            className="border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold uppercase text-[10px] tracking-widest h-10 px-4 rounded-xl"
          >
            <Zap className="mr-2 h-4 w-4" /> Seed
          </Button>
          <Link href="/admin/components/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Component
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Components Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Box className="w-8 h-8 opacity-30" />
                      {searchQuery ? (
                        <p>No components match your search.</p>
                      ) : (
                        <>
                          <p className="font-medium">No global components</p>
                          <p className="text-sm">Components are reusable field groups used in content types.</p>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((comp) => (
                  <TableRow 
                    key={comp.id} 
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/admin/components/${comp.slug}`)}
                  >
                    <TableCell className="font-medium">{comp.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {comp.slug}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {comp.fields?.slice(0, 4).map((f) => (
                          <Badge key={f.id} variant="secondary" className="text-[10px]">
                            {f.name}
                          </Badge>
                        ))}
                        {(comp.fields?.length || 0) > 4 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{comp.fields!.length - 4}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(comp.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!loading && components.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {filtered.length} of {components.length} component{components.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  )
}
