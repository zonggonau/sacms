import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { createV0Chat } from "@/lib/v0-client"
import { generateSystemSchema } from "@/lib/ai-schema-generator"
import { randomBytes, createHash } from "crypto"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const { prompt, apiBaseUrl = "http://localhost:3000", schemaOnly = true } = await req.json()
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Tenant not found or unauthorized" }, { status: 404 })
    
    const tenant = access.tenant
    const tenantDb = await getTenantDb(tenant.slug)

    // 1. Generate Schema with AI (5 credits from user pool)
    const generatedSchema = await generateSystemSchema(prompt, tenant.id, session.user.id)

    // 2. Insert into DB (Prisma)
    // We execute sequentially to avoid complex relation collisions
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
        
        // Generate Dummy Data for Content Type
        if (ct.dummyData && ct.dummyData.length > 0) {
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
        } else {
          // Fallback basic generation
          const dummyData: any = {}
          for (const f of ct.fields) {
            if (f.type === "text") dummyData[f.slug] = `Sample ${f.name}`
            if (f.type === "richText") dummyData[f.slug] = `<p>This is a sample generated rich text for ${f.name}.</p>`
            if (f.type === "number") dummyData[f.slug] = 42
            if (f.type === "boolean") dummyData[f.slug] = true
          }
          if (Object.keys(dummyData).length > 0) {
            await tenantDb.contentEntry.create({
              data: {
                contentTypeId: newCt.id,
                tenantId: tenant.id,
                status: "PUBLISHED",
                publishedAt: new Date(),
                data: dummyData
              }
            })
          }
        }
      }
    }

    for (const st of generatedSchema.singleTypes) {
      const exists = await tenantDb.singleType.findFirst({ where: { slug: st.slug, tenantId: tenant.id } })
      if (!exists) {
        // Generate Dummy Data for Single Type
        let dummyData: any = {}
        if (st.dummyData && st.dummyData.length > 0) {
          dummyData = st.dummyData[0]
        } else {
          for (const f of st.fields) {
            if (f.type === "text") dummyData[f.slug] = `Sample ${f.name}`
            if (f.type === "richText") dummyData[f.slug] = `<p>This is a sample generated rich text for ${f.name}.</p>`
            if (f.type === "number") dummyData[f.slug] = 42
            if (f.type === "boolean") dummyData[f.slug] = true
          }
        }

        const newSt = await tenantDb.singleType.create({
          data: {
            tenantId: tenant.id,
            name: st.name,
            slug: st.slug,
            description: st.description,
            isPublished: true,
            schemaFields: {
              create: st.fields.map((f, i) => ({
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
            tenants: { create: { tenantId: tenant.id, data: Object.keys(dummyData).length > 0 ? dummyData : undefined } }
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
            schemaFields: {
              create: comp.fields.map((f, i) => ({
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
      }
    }

    if (schemaOnly) {
      return NextResponse.json({ success: true, schema: generatedSchema })
    }

    // 3. Auto-Generate API Token for V0
    const plainToken = `cf_${randomBytes(32).toString("hex")}`
    const hashedToken = createHash("sha256").update(plainToken).digest("hex")
    
    await db.apiToken.create({
      data: {
        tenantId: tenant.id,
        name: `V0 Auto-Generated Token`,
        description: `Token generated automatically for V0.dev Website Builder on ${new Date().toISOString()}`,
        token: hashedToken,
        type: "read-only",
        permissions: [],
        createdBy: session.user.id,
      },
    })

    // 4. Create Super Prompt for V0
    const finalApiUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/public/${tenant.slug}`
    
    const superPrompt = `You are an expert Next.js frontend developer. Build a modern, highly aesthetic, and responsive website based on the following requirements and Headless CMS schema.

USER REQUEST:
"${prompt}"

HEADLESS CMS SCHEMA:
${JSON.stringify(generatedSchema, null, 2)}

API INTEGRATION GUIDE:
- Base API URL: ${finalApiUrl}
- API Token: ${plainToken}
- Authentication: You MUST pass the token in the headers: \`{ "Authorization": "Bearer ${plainToken}" }\` for all API calls.
- Fetch Collection Data: \`GET \${Base API URL}/content/[contentTypeSlug]\`. Returns: \`{ data: [{ id, ...fields }] }\`
- Fetch Single Page Data: \`GET \${Base API URL}/single/[singleTypeSlug]\`. Returns: \`{ data: { ...fields } }\`

REQUIREMENTS FOR v0.dev:
1. Use Next.js 14/15 App Router with Tailwind CSS.
2. Build a highly polished, premium, and dynamic UI (use Lucide React icons, smooth hover effects, modern typography).
3. Create the necessary pages and components to display the data defined in the schema.
4. Implement data fetching using React Server Components (\`await fetch(...)\`) or \`useEffect\` where appropriate. Write the actual fetch logic using the provided API URL and Token.
5. Handle loading and empty states gracefully.
6. Make sure all schema fields are utilized in the UI in a visually appealing way.`

    // 5. Generate frontend with v0
    const v0Result = await createV0Chat(superPrompt)
    
    if (!v0Result || !v0Result.chatId) {
      throw new Error("Failed to create chat with v0 API. Received invalid or missing chatId.")
    }
    
    // 2. Save v0ChatId and previewUrl to tenant settings (using unique key prefix)
    await db.setting.upsert({
      where: { key: `${tenant.id}_v0ChatId` },
      update: { value: v0Result.chatId },
      create: { tenantId: tenant.id, key: `${tenant.id}_v0ChatId`, value: v0Result.chatId }
    })
    
    await db.setting.upsert({
      where: { key: `${tenant.id}_v0FrontendPrompt` },
      update: { value: prompt },
      create: { tenantId: tenant.id, key: `${tenant.id}_v0FrontendPrompt`, value: prompt }
    })

    return NextResponse.json({ success: true, v0ChatId: v0Result.chatId, previewUrl: "" })
  } catch (error: any) {
    console.error("AI generation failed:", error)
    return NextResponse.json({ error: error.message || "Failed to generate" }, { status: 500 })
  }
}
