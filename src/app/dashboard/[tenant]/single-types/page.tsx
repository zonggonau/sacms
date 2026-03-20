"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Save, Eye, EyeOff, FileText, Plus, Edit2, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
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

interface SingleType {
  id: string
  name: string
  slug: string
  description: string | null
  fields: any[]
  data: any
  publishedAt: string | null
  isGlobal: boolean
}

export default function SingleTypesPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { data: session } = useSession()
  const [singleTypes, setSingleTypes] = useState<SingleType[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantSlug, setTenantSlug] = useState<string>("")

  const tenants = session?.user?.tenants || []
  const isSuperAdmin = session?.user?.role === "super_admin"

  useEffect(() => {
    const init = async () => {
      const { tenant } = await params
      setTenantSlug(tenant)
      await fetchSingleTypes(tenant)
    }
    init()
  }, [params])

  const fetchSingleTypes = async (tenant: string) => {
    try {
      const response = await fetch(`/api/tenant/${tenant}/single-types`)
      if (response.status === 403 || response.status === 404) {
        router.push("/dashboard")
        return
      }
      if (!response.ok) throw new Error("Failed to fetch single types")
      const data = await response.json()
      setSingleTypes(data)
    } catch (error) {
      console.error("Error fetching single types:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load single types",
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async (singleType: SingleType) => {
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/single-types`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          singleTypeId: singleType.id,
          publish: true,
        }),
      })

      if (!response.ok) throw new Error("Failed to publish")

      toast({
        title: "Success",
        description: `${singleType.name} published successfully`,
      })

      await fetchSingleTypes(tenantSlug)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to publish",
      })
    }
  }

  const handleUnpublish = async (singleType: SingleType) => {
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/single-types`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          singleTypeId: singleType.id,
          publish: false,
        }),
      })

      if (!response.ok) throw new Error("Failed to unpublish")

      toast({
        title: "Success",
        description: `${singleType.name} unpublished successfully`,
      })

      await fetchSingleTypes(tenantSlug)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to unpublish",
      })
    }
  }

  const handleDelete = async (singleType: SingleType) => {
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/single-types/${singleType.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete")

      toast({
        title: "Success",
        description: `${singleType.name} deleted successfully`,
      })

      await fetchSingleTypes(tenantSlug)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete single type",
      })
    }
  }

  if (loading && singleTypes.length === 0) {
    return (
      <div className="flex">
        <TenantSidebar tenantSlug={tenantSlug} />
        <main className="flex-1 min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Single Types</h1>
          <p className="text-muted-foreground">
            Manage your single types (singleton content)
          </p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/${tenantSlug}/single-types/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Buat Single Type
          </Link>
        </Button>
      </div>

      {singleTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Single Types</h3>
            <p className="text-muted-foreground text-center mb-4">
              You don't have any single types assigned yet. Contact your admin
              to get access.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Available Single Types</CardTitle>
            <CardDescription>
              Single types assigned to your tenant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {singleTypes.map((singleType) => (
                  <TableRow key={singleType.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {singleType.name}
                        {singleType.isGlobal && (
                          <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/20 bg-primary/5">
                            Global
                          </Badge>
                        )}
                      </div>
                      {singleType.description && (
                        <p className="text-sm text-muted-foreground">
                          {singleType.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {singleType.slug}
                    </TableCell>
                    <TableCell>{singleType.fields.length}</TableCell>
                    <TableCell>
                      <Badge
                        variant={singleType.publishedAt ? "default" : "secondary"}
                      >
                        {singleType.publishedAt ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {singleType.publishedAt
                        ? new Date(singleType.publishedAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link
                            href={`/dashboard/${tenantSlug}/single-types/${singleType.slug}`}
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
                        </Button>
                        
                        {(!singleType.isGlobal || isSuperAdmin) && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                            >
                              <Link
                                href={`/dashboard/${tenantSlug}/single-types/${singleType.slug}/edit`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Link>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus {singleType.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tindakan ini tidak dapat dibatalkan. Single type ini akan dihapus permanen beserta semua datanya.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(singleType)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {singleType.publishedAt ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <EyeOff className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Unpublish?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will unpublish {singleType.name}. Are you
                                  sure?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleUnpublish(singleType)}
                                >
                                  Unpublish
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePublish(singleType)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
        </div>
      </main>
    </div>
  )
}