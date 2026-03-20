"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, ArrowLeft, Shield, Users, Key, Settings, Save, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { AdminSidebar } from "@/components/dashboard/admin-sidebar"

interface Permission {
  id: string
  name: string
  displayName: string
  description?: string
  category: string
}

interface RolePermission {
  id: string
  roleId: string
  permissionId: string
  granted: boolean
  permission: Permission
}

const defaultPermissions: Permission[] = [
  // Content permissions
  { id: "1", name: "content.read", displayName: "Read Content", description: "View content entries", category: "content" },
  { id: "2", name: "content.create", displayName: "Create Content", description: "Create new content entries", category: "content" },
  { id: "3", name: "content.update", displayName: "Update Content", description: "Edit existing content entries", category: "content" },
  { id: "4", name: "content.delete", displayName: "Delete Content", description: "Delete content entries", category: "content" },
  { id: "5", name: "content.publish", displayName: "Publish Content", description: "Publish and unpublish content", category: "content" },
  // Media permissions
  { id: "6", name: "media.read", displayName: "Read Media", description: "View media files", category: "media" },
  { id: "7", name: "media.upload", displayName: "Upload Media", description: "Upload new media files", category: "media" },
  { id: "8", name: "media.delete", displayName: "Delete Media", description: "Delete media files", category: "media" },
  // User permissions
  { id: "9", name: "users.read", displayName: "Read Users", description: "View team members", category: "users" },
  { id: "10", name: "users.invite", displayName: "Invite Users", description: "Invite new team members", category: "users" },
  { id: "11", name: "users.manage", displayName: "Manage Users", description: "Edit and remove team members", category: "users" },
  // Settings permissions
  { id: "12", name: "settings.read", displayName: "Read Settings", description: "View workspace settings", category: "settings" },
  { id: "13", name: "settings.update", displayName: "Update Settings", description: "Modify workspace settings", category: "settings" },
  // API permissions
  { id: "14", name: "api.read", displayName: "Read API Tokens", description: "View API tokens", category: "api" },
  { id: "15", name: "api.create", displayName: "Create API Tokens", description: "Create new API tokens", category: "api" },
  { id: "16", name: "api.delete", displayName: "Delete API Tokens", description: "Delete API tokens", category: "api" },
]

const roles = [
  { id: "owner", name: "Owner", description: "Full access to all features" },
  { id: "admin", name: "Admin", description: "Manage content, users, and settings" },
  { id: "editor", name: "Editor", description: "Create and edit content" },
  { id: "viewer", name: "Viewer", description: "Read-only access" },
]

export default function RBACPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string

  const [tenants, setTenants] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedRole, setSelectedRole] = useState("editor")
  const [permissions, setPermissions] = useState<Record<string, boolean[]>>({})

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/admin/tenants")
        if (res.ok) {
          const data = await res.json()
          setTenants(data.tenants || [])
        }
      } catch (error) {
        console.error("Failed to fetch tenants:", error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.role === "super_admin") {
      fetchData()
    }
  }, [session])

  // Initialize default permissions for each role
  useEffect(() => {
    const defaultRolePermissions: Record<string, boolean[]> = {
      owner: defaultPermissions.map(() => true), // Owner has all permissions
      admin: defaultPermissions.map((p) => !p.name.includes("settings.update") && !p.name.includes("api.delete")),
      editor: defaultPermissions.map((p) => 
        p.name.startsWith("content.") || p.name.startsWith("media.") || p.name === "api.read"
      ),
      viewer: defaultPermissions.map((p) => 
        p.name.endsWith(".read")
      ),
    }
    setPermissions(defaultRolePermissions)
  }, [])

  const handleTogglePermission = (permissionIndex: number) => {
    setPermissions((prev) => ({
      ...prev,
      [selectedRole]: prev[selectedRole]?.map((val, idx) =>
        idx === permissionIndex ? !val : val
      ) || [],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // In production, save to database
      await new Promise((resolve) => setTimeout(resolve, 1000))
      alert("Permissions saved successfully!")
    } finally {
      setSaving(false)
    }
  }

  const currentTenant = useMemo(() => {
    return tenants.find((t) => t.slug === tenantSlug)
  }, [tenants, tenantSlug])

  const groupedPermissions = defaultPermissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = []
    }
    acc[permission.category].push(permission)
    return acc
  }, {} as Record<string, Permission[]>)

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 min-h-screen">
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href={`/admin/${tenantSlug}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Role-Based Access Control</h1>
              <p className="text-muted-foreground">
                Configure permissions for each role in {currentTenant?.name || tenantSlug}
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>

          {/* Role Tabs */}
          <Tabs value={selectedRole} onValueChange={setSelectedRole} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              {roles.map((role) => (
                <TabsTrigger key={role.id} value={role.id}>
                  {role.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {roles.map((role) => (
              <TabsContent key={role.id} value={role.id} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {role.name} Role
                    </CardTitle>
                    <CardDescription>{role.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {Object.entries(groupedPermissions).map(([category, perms]) => (
                        <div key={category}>
                          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                            {category}
                          </h3>
                          <div className="space-y-3">
                            {perms.map((permission, index) => {
                              const globalIndex = defaultPermissions.findIndex(
                                (p) => p.id === permission.id
                              )
                              const isEnabled = permissions[role.id]?.[globalIndex] ?? false
                              const isDisabled = role.id === "owner" // Owner always has all permissions

                              return (
                                <div
                                  key={permission.id}
                                  className={`flex items-center justify-between p-3 rounded-lg border ${
                                    isDisabled ? "bg-muted/50" : "hover:bg-muted/30"
                                  }`}
                                >
                                  <div>
                                    <p className="font-medium">{permission.displayName}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {permission.description}
                                    </p>
                                  </div>
                                  <Switch
                                    checked={isEnabled}
                                    disabled={isDisabled}
                                    onCheckedChange={() => handleTogglePermission(globalIndex)}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Permission Summary */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Permission Summary</CardTitle>
              <CardDescription>
                Overview of permissions for each role
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Permission</th>
                      {roles.map((role) => (
                        <th key={role.id} className="text-center p-2 font-medium">
                          {role.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {defaultPermissions.map((permission, index) => (
                      <tr key={permission.id} className="border-b last:border-b-0">
                        <td className="p-2">{permission.displayName}</td>
                        {roles.map((role) => (
                          <td key={role.id} className="text-center p-2">
                            {permissions[role.id]?.[index] ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                ✓
                              </Badge>
                            ) : (
                              <Badge variant="secondary">✗</Badge>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
