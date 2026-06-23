/**
 * POST /api/tenant/create
 * Create a new workspace (tenant) — for self-hosted users
 * No admin role required — any authenticated user can create workspaces
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isEnterpriseMode } from "@/lib/license"
import { isSelfHosted } from "@/lib/selfhost"

async function generateUniqueSlug(baseName: string): Promise<string> {
  let slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  if (!slug) slug = "workspace"

  let counter = 0
  while (await db.tenant.findUnique({ where: { slug } })) {
    counter++
    slug = `${slug}-${counter}`
  }
  return slug
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug: customSlug } = body
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 })
    }

    // Check enterprise/self-hosted mode — if active, skip plan limits
    const enterprise = await isEnterpriseMode()
    const selfHosted = isSelfHosted()

    // Check user's workspace limit (unless enterprise or self-hosted)
    if (!enterprise && !selfHosted) {
      const workspaceCount = await db.tenantMember.count({
        where: { userId: session.user.id, role: "owner" },
      })
      if (workspaceCount >= 1) {
        return NextResponse.json({ error: "Free mode allows 1 workspace. Activate enterprise license for unlimited workspaces." }, { status: 403 })
      }
    }

    const slug = customSlug ? await generateUniqueSlug(customSlug) : await generateUniqueSlug(name)

    const tenant = await db.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: name.trim(),
          slug,
          description: body.description || null,
          plan: (enterprise || selfHosted) ? "enterprise" : "starter",
          status: "active",
        },
      })

      // Add creator as owner
      await tx.tenantMember.create({
        data: {
          tenantId: newTenant.id,
          userId: session.user.id,
          role: "owner",
        },
      })

      return newTenant
    })

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
    })
  } catch (err) {
    console.error("Error creating tenant:", err)
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 })
  }
}
