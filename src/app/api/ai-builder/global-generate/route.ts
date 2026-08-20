import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { enforceUserAiCredits, deductUserAiCredits, enforceUserPlanLimit } from "@/lib/plan-enforcement"
import { generateSystemSchema } from "@/lib/ai-schema-generator"
import { createV0Chat } from "@/lib/v0-client"
import { deployToVercel } from "@/lib/vercel-client"
import { randomBytes, createHash } from "crypto"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const { 
      prompt, 
      targetWorkspace, 
      newWorkspaceName,
      apiBaseUrl = "http://localhost:3000",
      deployToVercelAfter = false 
    } = await req.json()

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    // 1. Verify User AI credits (25 credits for full frontend generation)
    const creditCheck = await enforceUserAiCredits(userId, 25)
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.message }, { status: 429 })
    }

    let tenant: any = null

    // 2. Resolve or Create Target Workspace
    if (targetWorkspace === "new" || !targetWorkspace) {
      // Check workspace capacity limit
      const wsLimit = await enforceUserPlanLimit(userId, "workspaces")
      if (!wsLimit.allowed) {
        return NextResponse.json({ error: wsLimit.message }, { status: 403 })
      }

      const wsName = newWorkspaceName?.trim() || prompt.split(" ").slice(0, 3).join(" ") + " App"
      let baseSlug = slugify(wsName) || `app-${randomBytes(3).toString("hex")}`
      
      // Ensure unique slug
      let uniqueSlug = baseSlug
      let count = 1
      while (await db.tenant.findUnique({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${baseSlug}-${count}`
        count++
      }

      tenant = await db.tenant.create({
        data: {
          name: wsName,
          slug: uniqueSlug,
          plan: "free",
          members: {
            create: {
              userId,
              role: "owner"
            }
          }
        }
      })
    } else {
      // Find existing tenant and verify membership
      tenant = await db.tenant.findFirst({
        where: {
          OR: [{ id: targetWorkspace }, { slug: targetWorkspace }],
          members: { some: { userId } }
        }
      })

      if (!tenant) {
        return NextResponse.json({ error: "Target workspace not found or unauthorized" }, { status: 404 })
      }
    }

    const tenantDb = await getTenantDb(tenant.slug)

    // 3. Generate Schema with DeepSeek AI
    const generatedSchema = await generateSystemSchema(prompt, tenant.id, userId)

    // 4. Save Schema & Initial Content
    for (const ct of generatedSchema.contentTypes) {
      const exists = await tenantDb.contentType.findFirst({ where: { slug: ct.slug, tenantId: tenant.id } })
      if (!exists) {
        const newCt = await tenantDb.contentType.create({
          data: {
            tenantId: tenant.id,
            name: ct.name,
            slug: ct.slug,
            description: ct.description,
            isPublished: true,
            schemaFields: {
              create: ct.fields.map((f, i) => ({
                name: f.name,
                slug: f.slug,
                type: f.type,
                required: f.required,
                unique: f.unique,
                order: i,
                relationSlug: f.type === 'relation' ? f.relationSlug : null,
                options: f.type === 'component' ? { componentSlug: f.componentSlug } : undefined
              }))
            },
            tenants: { create: { tenantId: tenant.id } }
          }
        })

        // Seed dummy entries
        if (ct.dummyData && Array.isArray(ct.dummyData) && ct.dummyData.length > 0) {
          for (const item of ct.dummyData) {
            await tenantDb.contentEntry.create({
              data: {
                contentTypeId: newCt.id,
                tenantId: tenant.id,
                status: "PUBLISHED",
                publishedAt: new Date(),
                data: item
              }
            })
          }
        }
      }
    }

    for (const st of generatedSchema.singleTypes) {
      const exists = await tenantDb.singleType.findFirst({ where: { slug: st.slug, tenantId: tenant.id } })
      if (!exists) {
        const newSt = await tenantDb.singleType.create({
          data: {
            tenantId: tenant.id,
            name: st.name,
            slug: st.slug,
            description: st.description,
            isPublished: true,
            fields: {
              create: st.fields.map((f, i) => ({
                name: f.name,
                slug: f.slug,
                type: f.type,
                required: f.required,
                order: i,
                options: f.type === 'component' ? { componentSlug: f.componentSlug } : undefined
              }))
            },
            tenants: {
              create: {
                tenantId: tenant.id,
                locale: 'en',
                enabled: true,
                data: (st.dummyData?.[0] || {}) as any
              }
            }
          }
        })
      }
    }

    for (const comp of generatedSchema.components) {
      const exists = await tenantDb.component.findFirst({ where: { slug: comp.slug, tenantId: tenant.id } })
      if (!exists) {
        await tenantDb.component.create({
          data: {
            tenantId: tenant.id,
            name: comp.name,
            slug: comp.slug,
            description: comp.description,
            category: (comp as any).category || "General",
            fields: {
              create: comp.fields.map((f, i) => ({
                name: f.name,
                slug: f.slug,
                type: f.type,
                required: f.required,
                order: i
              }))
            },
            tenants: { create: { tenantId: tenant.id } }
          }
        })
      }
    }

    // 5. Generate API Token for Frontend Integration
    const plainToken = `cf_${randomBytes(32).toString("hex")}`
    const hashedToken = createHash("sha256").update(plainToken).digest("hex")

    await db.apiToken.create({
      data: {
        tenantId: tenant.id,
        name: `AI Frontend Token - ${new Date().toLocaleDateString()}`,
        description: `Auto-generated for AI Frontend build from Global Studio`,
        token: hashedToken,
        type: "read-only",
        permissions: [],
        createdBy: userId,
      },
    })

    // 6. Build Super Prompt for V0
    const finalApiUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/public/${tenant.slug}`

    const schemaSummary = {
      contentTypes: generatedSchema.contentTypes.map(c => ({ name: c.name, slug: c.slug, fields: c.fields.map(f => ({ name: f.name, slug: f.slug, type: f.type })) })),
      singleTypes: generatedSchema.singleTypes.map(s => ({ name: s.name, slug: s.slug, fields: s.fields.map(f => ({ name: f.name, slug: f.slug, type: f.type })) })),
    }

    const superPrompt = `User Prompt: ${prompt}

HEADLESS CMS SCHEMA (from SaCMS):
${JSON.stringify(schemaSummary, null, 2)}

API INTEGRATION:
- Base URL: ${finalApiUrl}
- Token: ${plainToken}
- Auth Header: Authorization: Bearer ${plainToken}
- List collection: GET ${finalApiUrl}/content/{collectionSlug}
- Single type: GET ${finalApiUrl}/single/{singleTypeSlug}
- Filter: GET ${finalApiUrl}/content/{slug}?filters[fieldName][$eq]=value
- Populate relations: GET ${finalApiUrl}/content/{slug}?populate=relationField

Build a professional, production-ready Next.js 14 frontend app using App Router.
- Use TypeScript, Tailwind CSS, and shadcn/ui components.
- Fetch data from the API above using server components where possible.
- Use modern UI cards, tables, headers, hero sections, and responsive navigation.
- Make the design visually stunning, polished, and responsive.`

    // 7. Generate with V0.dev
    const v0Result = await createV0Chat(superPrompt)
    if (!v0Result?.chatId) throw new Error("Failed to create chat with v0 API")

    // 8. Deduct User Account AI Credits
    await deductUserAiCredits(userId, 25, "global_frontend_generate", tenant.id, "v0.dev")

    // 9. Save Settings
    await db.setting.upsert({ where: { key: `${tenant.id}_v0ChatId` }, update: { value: v0Result.chatId }, create: { tenantId: tenant.id, key: `${tenant.id}_v0ChatId`, value: v0Result.chatId } })
    await db.setting.upsert({ where: { key: `${tenant.id}_v0FrontendPrompt` }, update: { value: prompt }, create: { tenantId: tenant.id, key: `${tenant.id}_v0FrontendPrompt`, value: prompt } })

    let previewUrl = `/api/tenant/${tenant.slug}/ai-builder/preview/${v0Result.chatId}`
    let vercelUrl = ""

    if (deployToVercelAfter && v0Result.files && v0Result.files.length > 0) {
      try {
        const projectName = `sacms-${tenant.slug}-frontend`
        const deployment = await deployToVercel(projectName, v0Result.files)
        if (deployment.url) {
          vercelUrl = deployment.url
          previewUrl = deployment.url
          await db.setting.upsert({ where: { key: `${tenant.id}_v0PreviewUrl` }, update: { value: deployment.url }, create: { tenantId: tenant.id, key: `${tenant.id}_v0PreviewUrl`, value: deployment.url } })
        }
      } catch (deployError: any) {
        console.warn("Vercel deploy failed:", deployError.message)
      }
    }

    await db.setting.upsert({ where: { key: `${tenant.id}_v0PreviewUrl` }, update: { value: previewUrl }, create: { tenantId: tenant.id, key: `${tenant.id}_v0PreviewUrl`, value: previewUrl } })

    return NextResponse.json({
      success: true,
      v0ChatId: v0Result.chatId,
      previewUrl,
      vercelUrl,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
      },
      creditsDeducted: 25,
      filesGenerated: v0Result.files?.length || 0
    })
  } catch (error: any) {
    console.error("[Global AI Frontend Generate Error]", error)
    return NextResponse.json({ error: error.message || "Failed to generate frontend" }, { status: 500 })
  }
}
