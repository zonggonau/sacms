import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { createPermissionSchema } from "@/lib/validations"

// GET /api/admin/rbac/permissions - List all permissions
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const permissions = await db.permission.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    })

    // If no permissions exist yet, seed the defaults
    if (permissions.length === 0) {
      const defaults = [
        // Content permissions
        { name: "content.read", displayName: "Read Content", description: "View content entries", category: "content" },
        { name: "content.create", displayName: "Create Content", description: "Create new content entries", category: "content" },
        { name: "content.update", displayName: "Update Content", description: "Edit existing content entries", category: "content" },
        { name: "content.delete", displayName: "Delete Content", description: "Delete content entries", category: "content" },
        { name: "content.publish", displayName: "Publish Content", description: "Publish and unpublish content", category: "content" },
        // Media permissions
        { name: "media.read", displayName: "View Media", description: "Access the media library", category: "media" },
        { name: "media.upload", displayName: "Upload Media", description: "Upload new media files", category: "media" },
        { name: "media.delete", displayName: "Delete Media", description: "Remove media files", category: "media" },
        // Users permissions
        { name: "users.read", displayName: "View Users", description: "View team members", category: "users" },
        { name: "users.manage", displayName: "Manage Users", description: "Invite and remove members", category: "users" },
        // Settings permissions
        { name: "settings.read", displayName: "View Settings", description: "View tenant settings", category: "settings" },
        { name: "settings.update", displayName: "Update Settings", description: "Modify tenant settings", category: "settings" },
        // API permissions
        { name: "api.tokens.read", displayName: "View API Tokens", description: "View API tokens", category: "api" },
        { name: "api.tokens.manage", displayName: "Manage API Tokens", description: "Create and delete API tokens", category: "api" },
        { name: "api.webhooks.manage", displayName: "Manage Webhooks", description: "Create and configure webhooks", category: "api" },
      ]

      await db.permission.createMany({ data: defaults })
      const seeded = await db.permission.findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }],
      })
      return NextResponse.json({ permissions: seeded })
    }

    return NextResponse.json({ permissions })
  } catch (error) {
    console.error("Error fetching permissions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/admin/rbac/permissions - Create a new permission
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await validateBody(request, createPermissionSchema)
    if ("error" in result) return result.error
    const { name, displayName, description, category } = result.data

    const existing = await db.permission.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: "Permission with this name already exists" }, { status: 400 })
    }

    const permission = await db.permission.create({
      data: { name, displayName: displayName || name, description: description || null, category: category || "general" },
    })

    return NextResponse.json({ permission })
  } catch (error) {
    console.error("Error creating permission:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
